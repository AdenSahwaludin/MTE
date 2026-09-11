import CoreBluetooth
import Foundation
import Capacitor
import UIKit

/**
 * Port iOS dari ThermalPrinterPlugin.java (Android).
 *
 * iOS tidak mengizinkan aplikasi pihak ketiga memakai Bluetooth Classic SPP
 * (butuh sertifikasi MFi), jadi pencetakan dilakukan via Bluetooth Low Energy
 * (CoreBluetooth) — jalur standar printer thermal 58mm (VSC MP-58M Pro,
 * Xprinter, dll) yang punya mode BLE.
 *
 * Nama plugin & method dibuat sama persis dengan versi Android
 * (listPaired / print / disconnect / openRawBT) agar
 * src/services/nativePrintService.ts bisa dipakai tanpa perubahan.
 * Perbedaan perilaku yang wajar di iOS:
 * - "address" = identifier UUID CoreBluetooth (bukan MAC address).
 * - listPaired = hasil scan BLE singkat + printer yang pernah dipakai
 *   (iOS tidak punya daftar pairing sistem untuk BLE).
 * - openRawBT = share sheet berisi teks struk (RawBT hanya ada di Android).
 */
@objc(ThermalPrinterPlugin)
public class ThermalPrinterPlugin: CAPPlugin, CAPBridgedPlugin, CBCentralManagerDelegate, CBPeripheralDelegate {
    public let identifier = "ThermalPrinterPlugin"
    public let jsName = "ThermalPrinter"

    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "listPaired", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "print", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openRawBT", returnType: CAPPluginReturnPromise),
    ]

    private enum PrinterError: LocalizedError {
        case noBluetooth
        case btState(CBManagerState)
        case timeout
        case noPrinter
        case invalidAddress(String)
        case printerNotFound(String)
        case disconnected
        case writeFailed(String)
        case noWritableCharacteristic

        var errorDescription: String? {
            switch self {
            case .noBluetooth:
                return "Perangkat ini tidak mendukung Bluetooth LE."
            case .btState(.poweredOff):
                return "Bluetooth mati. Nyalakan dulu lewat Pusat Kontrol."
            case .btState(.unauthorized):
                return "Izin Bluetooth belum diberikan. Buka Pengaturan > Privasi & Keamanan > Bluetooth, lalu aktifkan untuk Mega Tehnik."
            case .btState(.unsupported):
                return "Perangkat ini tidak mendukung Bluetooth LE."
            case .btState:
                return "Bluetooth tidak siap. Coba lagi."
            case .timeout:
                return "Gagal konek ke printer (timeout). Pastikan printer nyala, kertas ada, dan belum terhubung ke perangkat lain."
            case .noPrinter:
                return "Belum ada printer. Buka Pengaturan > Scan Printer dulu."
            case .invalidAddress(let address):
                return "Alamat printer tidak valid: \(address)"
            case .printerNotFound(let message):
                return message
            case .disconnected:
                return "Koneksi printer terputus."
            case .writeFailed(let message):
                return "Gagal mengirim data ke printer: \(message)"
            case .noWritableCharacteristic:
                return "Printer tidak menyediakan channel tulis BLE yang dikenali. Coba mode konfigurasi printer atau pakai printer lain."
            }
        }
    }

    /// Bungkus kontinuitas agar pasti di-resume tepat satu kali.
    private final class Waiter<T> {
        private var continuation: CheckedContinuation<T, Error>?
        private let lock = NSLock()

        /// Pasang kontinuitas. Return false kalau sudah terpasang/dipakai.
        func install(_ continuation: CheckedContinuation<T, Error>) -> Bool {
            lock.lock()
            defer { lock.unlock() }
            if self.continuation != nil { return false }
            self.continuation = continuation
            return true
        }

        func succeed(_ value: T) {
            lock.lock()
            let pending = continuation
            continuation = nil
            lock.unlock()
            pending?.resume(returning: value)
        }

        func fail(_ error: Error) {
            lock.lock()
            let pending = continuation
            continuation = nil
            lock.unlock()
            pending?.resume(throwing: error)
        }
    }

    // MARK: - State BLE (semua akses lewat bleQueue kecuali Waiter yang sudah thread-safe)

    private let bleQueue = DispatchQueue(label: "com.megateknik.pos.ble")
    private var central: CBCentralManager?

    private var connectedPeripheral: CBPeripheral?
    private var connectedAddress: String?

    private var discovered: [UUID: CBPeripheral] = [:]
    private var scannedNames: [UUID: String] = [:]
    private var foundServices: [CBService] = []
    // Guard anti-race: hanya SATU proses cetak dalam satu waktu — operasi BLE
    // memakai waiter bersama, dua print tumpang tindih saling menimpa state.
    private var isPrinting = false
    // Service yang sedang menunggu discoverCharacteristics. Callback terlambat
    // dari service lain (yang sudah timeout) wajib diabaikan.
    private var charsWaiterService: CBService?

    private var stateWaiter: Waiter<CBManagerState>?
    private var connectWaiter: Waiter<Void>?
    private var servicesWaiter: Waiter<Void>?
    private var charsWaiter: Waiter<Void>?
    private var writeWaiter: Waiter<Void>?
    private var readyWaiter: Waiter<Void>?

    // MARK: - Registrasi method plugin

    @objc func listPaired(_ call: CAPPluginCall) {
        let manager = ensureCentralManager()
        settleOnce(call) { settle in
            let currentState = self.bleQueue.sync { manager.state }
            if currentState == .unauthorized {
                settle(["devices": [], "needsPermission": true], nil)
                return
            }
            try await self.waitForPowerOn(timeout: 8)
            try await self.scanPrinters(duration: 2.5)
            settle(["devices": self.mergedDeviceList(), "needsPermission": false], nil)
        }
    }

    @objc func print(_ call: CAPPluginCall) {
        let base64Data = call.getString("data") ?? ""
        let address = call.getString("address") ?? ""
        guard !base64Data.isEmpty else {
            call.reject("Data struk kosong")
            return
        }
        guard let bytes = Data(base64Encoded: base64Data), !bytes.isEmpty else {
            call.reject("Data struk tidak valid (bukan base64)")
            return
        }
        _ = ensureCentralManager()
        let busy: Bool = bleQueue.sync { isPrinting }
        if busy {
            call.reject("Cetak sebelumnya masih berjalan. Tunggu sebentar, lalu cetak ulang dari Riwayat.")
            return
        }
        bleQueue.async { self.isPrinting = true }
        settleOnce(call, onFinish: {
            self.bleQueue.async { self.isPrinting = false }
        }) { settle in
            try await self.waitForPowerOn(timeout: 8)
            let target = try self.resolveTargetPeripheral(address: address)
            try await self.connect(target)
            let characteristic = try await self.discoverWritableCharacteristic(target)
            try await self.writeAll(target, characteristic: characteristic, data: bytes)
            self.persistKnownPrinter(target)
            let resultAddress = target.identifier.uuidString
            settle(["success": true, "address": resultAddress, "bytes": bytes.count], nil)
        }
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        teardownConnection()
        call.resolve(["success": true])
    }

    @objc func openRawBT(_ call: CAPPluginCall) {
        let text = call.getString("text") ?? ""
        guard !text.isEmpty else {
            call.reject("Teks struk kosong")
            return
        }
        // RawBT tidak ada di iOS — fallback terdekat: share sheet berisi teks struk
        // (bisa di-copy, dikirim via WhatsApp, atau dibuka di aplikasi cetak lain).
        DispatchQueue.main.async {
            guard let viewController = self.bridge?.viewController else {
                call.reject("Tidak bisa membuka share sheet.")
                return
            }
            let activity = UIActivityViewController(activityItems: [text], applicationActivities: nil)
            if let popover = activity.popoverPresentationController {
                popover.sourceView = viewController.view
                popover.sourceRect = CGRect(
                    x: viewController.view.bounds.midX,
                    y: viewController.view.bounds.midY,
                    width: 0,
                    height: 0
                )
                popover.permittedArrowDirections = []
            }
            viewController.present(activity, animated: true) {
                call.resolve(["success": true])
            }
        }
    }

    // MARK: - Orkestrasi

    /// Jalankan operasi async dengan jaminan call hanya di-settle satu kali
    /// plus watchdog timeout keseluruhan.
    private func settleOnce(
        _ call: CAPPluginCall,
        timeout: TimeInterval = 45,
        onFinish: (() -> Void)? = nil,
        operation: @escaping (_ settle: @escaping ([String: Any]?, String?) -> Void) async throws -> Void
    ) {
        let lock = NSLock()
        var settled = false
        var watchdog: DispatchWorkItem?
        let settle: (_ data: [String: Any]?, _ errorMessage: String?) -> Void = { data, errorMessage in
            lock.lock()
            let isFirst = !settled
            settled = true
            lock.unlock()
            guard isFirst else { return }
            watchdog?.cancel()
            onFinish?()
            if let data {
                call.resolve(data)
            } else {
                call.reject(errorMessage ?? "Operasi gagal.")
            }
        }
        let watchdogItem = DispatchWorkItem {
            settle(nil, PrinterError.timeout.errorDescription)
            self.teardownConnection()
        }
        watchdog = watchdogItem

        bleQueue.asyncAfter(deadline: .now() + timeout, execute: watchdogItem)

        Task.detached {
            do {
                try await operation(settle)
            } catch let error as PrinterError {
                self.teardownConnection()
                settle(nil, error.errorDescription)
            } catch {
                self.teardownConnection()
                settle(nil, error.localizedDescription)
            }
        }
    }

    private func ensureCentralManager() -> CBCentralManager {
        if let central { return central }
        let manager = CBCentralManager(delegate: self, queue: bleQueue)
        central = manager
        return manager
    }

    /// Tunggu Bluetooth poweredOn. Melempar btState kalau hasilnya bukan poweredOn.
    private func waitForPowerOn(timeout: TimeInterval) async throws {
        guard let central else { throw PrinterError.noBluetooth }
        let waiter = Waiter<CBManagerState>()
        // Pasang waiter dulu di antrean BLE supaya tidak ada celah race
        // dengan centralManagerDidUpdateState.
        let initialState: CBManagerState = bleQueue.sync {
            stateWaiter = waiter
            return central.state
        }
        // State sudah final (bukan .unknown): tidak akan ada event baru, langsung putuskan.
        guard initialState == .unknown else {
            guard initialState == .poweredOn else { throw PrinterError.btState(initialState) }
            return
        }
        let finalState = try await awaitWaiter(waiter, timeout: timeout)
        guard finalState == .poweredOn else { throw PrinterError.btState(finalState) }
    }

    /// Await waiter dengan watchdog timeout di bleQueue.
    private func awaitWaiter<T>(_ waiter: Waiter<T>, timeout: TimeInterval) async throws -> T {
        let watchdog = DispatchWorkItem { waiter.fail(PrinterError.timeout) }
        bleQueue.asyncAfter(deadline: .now() + timeout, execute: watchdog)
        defer { watchdog.cancel() }
        return try await withCheckedThrowingContinuation { continuation in
            if !waiter.install(continuation) {
                continuation.resume(throwing: PrinterError.disconnected)
            }
        }
    }

    /// Scan BLE sebentar untuk mengumpulkan perangkat yang punya nama.
    private func scanPrinters(duration: TimeInterval) async throws {
        guard let central else { throw PrinterError.noBluetooth }
        bleQueue.async {
            self.discovered.removeAll()
            self.scannedNames.removeAll()
            central.scanForPeripherals(withServices: nil)
        }
        try? await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))
        bleQueue.async { central.stopScan() }
    }

    /// Gabungan hasil scan + printer yang pernah dipakai (UserDefaults).
    /// Perangkat yang pernah dipakai dan nama mirip printer didahulukan,
    /// supaya pengguna tidak salah pilih di antara banyak perangkat BLE.
    private func mergedDeviceList() -> [[String: String]] {
        var entries: [(address: String, name: String, score: Int)] = []
        var seen = Set<String>()
        let scanResults: [(UUID, String)] = bleQueue.sync {
            self.scannedNames.map { ($0.key, $0.value) }
        }
        for (uuid, name) in scanResults {
            let address = uuid.uuidString
            guard !seen.contains(address) else { continue }
            seen.insert(address)
            entries.append((address, name, Self.printerNameScore(name)))
        }
        for known in loadKnownPrinters() where !seen.contains(known.address) {
            seen.insert(known.address)
            entries.append((known.address, known.name, Self.printerNameScore(known.name) + 1))
        }
        entries.sort { first, second -> Bool in
            if first.score != second.score { return first.score > second.score }
            return first.name < second.name
        }
        return entries.map { ["name": $0.name, "address": $0.address] }
    }

    /// Cari CBPeripheral tujuan: dari address (UUID) atau dari daftar printer dikenal.
    private func resolveTargetPeripheral(address: String) throws -> CBPeripheral {
        guard let central else { throw PrinterError.noBluetooth }

        if !address.isEmpty {
            guard let uuid = UUID(uuidString: address) else {
                throw PrinterError.invalidAddress(address)
            }
            if let peripheral = bleQueue.sync(execute: {
                central.retrievePeripherals(withIdentifiers: [uuid]).first
            }) {
                return peripheral
            }
            var cached: CBPeripheral?
            bleQueue.sync { cached = self.discovered[uuid] }
            if let cached { return cached }
            throw PrinterError.printerNotFound(
                "Printer (\(address)) tidak ditemukan. Nyalakan printernya lalu Scan Printer di menu Pengaturan."
            )
        }

        // Tanpa address: prioritaskan nama yang mirip printer (sama seperti versi Android)
        var candidates: [(address: String, name: String, score: Int)] = []
        let scanResults: [(UUID, String)] = bleQueue.sync {
            self.scannedNames.map { ($0.key, $0.value) }
        }
        for (uuid, name) in scanResults {
            candidates.append((uuid.uuidString, name, Self.printerNameScore(name)))
        }
        for known in loadKnownPrinters() {
            candidates.append((known.address, known.name, Self.printerNameScore(known.name)))
        }
        guard !candidates.isEmpty else { throw PrinterError.noPrinter }
        candidates.sort { $0.score > $1.score }

        for candidate in candidates {
            guard let uuid = UUID(uuidString: candidate.address) else { continue }
            if let peripheral = bleQueue.sync(execute: {
                central.retrievePeripherals(withIdentifiers: [uuid]).first
            }) {
                return peripheral
            }
            var cached: CBPeripheral?
            bleQueue.sync { cached = self.discovered[uuid] }
            if let cached { return cached }
        }
        throw PrinterError.printerNotFound(
            "Tidak ada printer yang bisa dihubungi. Pastikan printer nyala, lalu Scan Printer di menu Pengaturan."
        )
    }

    /// Nama mengandung kata kunci printer (semakin tinggi semakin mirip).
    private static func printerNameScore(_ name: String) -> Int {
        let lowered = name.lowercased()
        let keywords = ["print", "pos", "58", "80", "mp-", "mpt", "xprinter", "rpp", "pt-", "ble"]
        return keywords.contains { lowered.contains($0) } ? 1 : 0
    }

    private func connect(_ peripheral: CBPeripheral, timeout: TimeInterval = 12) async throws {
        let waiter = Waiter<Void>()
        bleQueue.async {
            self.connectWaiter = waiter
            self.central?.connect(peripheral)
        }
        try await awaitWaiter(waiter, timeout: timeout)
    }

    /// Discover service + characteristic secara BERURUTAN per service
    /// (service printer populer FFE0/FFF0/18F0/FF00 didahulukan).
    /// Dulu paralel memakai counter: service degenerate (0 characteristic)
    /// yang callback-nya tidak pernah fire bisa menggantung seluruh proses.
    /// Sekuensial + timeout kecil per service membatasi kerusakan pada satu
    /// service saja, dan berhenti lebih awal begitu printer ditemukan.
    private func discoverWritableCharacteristic(
        _ peripheral: CBPeripheral,
        perServiceTimeout: TimeInterval = 3
    ) async throws -> CBCharacteristic {
        let servicesDone = Waiter<Void>()
        bleQueue.async {
            self.foundServices = []
            self.servicesWaiter = servicesDone
            peripheral.discoverServices(nil)
        }
        try await awaitWaiter(servicesDone, timeout: 10)

        let preferredServices: [CBUUID] = [
            CBUUID(string: "FFE0"),
            CBUUID(string: "FFF0"),
            CBUUID(string: "18F0"),
            CBUUID(string: "FF00"),
        ]
        let services: [CBService] = bleQueue.sync {
            self.foundServices.sorted { first, second -> Bool in
                let firstIndex = preferredServices.firstIndex(of: first.uuid) ?? Int.max
                let secondIndex = preferredServices.firstIndex(of: second.uuid) ?? Int.max
                return firstIndex < secondIndex
            }
        }

        var best: (service: CBService, characteristic: CBCharacteristic, score: Int)?
        for service in services {
            let charsDone = Waiter<Void>()
            bleQueue.async {
                self.charsWaiterService = service
                self.charsWaiter = charsDone
                peripheral.discoverCharacteristics(nil, for: service)
            }
            // Service tanpa characteristic bisa tidak memicu callback sama
            // sekali — biarkan timeout lalu lanjut ke service berikutnya.
            _ = try? await awaitWaiter(charsDone, timeout: perServiceTimeout)

            let characteristics: [CBCharacteristic] = bleQueue.sync { service.characteristics ?? [] }
            for characteristic in characteristics {
                var score = 0
                if characteristic.properties.contains(.write) { score += 2 }
                if characteristic.properties.contains(.writeWithoutResponse) { score += 1 }
                guard score > 0 else { continue }
                if let currentBest = best {
                    if score > currentBest.score {
                        best = (service, characteristic, score)
                    }
                } else {
                    best = (service, characteristic, score)
                }
            }
            // Sudah dapat characteristic di service prioritas? Cukup, berhenti.
            if let found = best, preferredServices.contains(found.service.uuid) {
                break
            }
        }

        guard let found = best else {
            throw PrinterError.noWritableCharacteristic
        }
        return found.characteristic
    }

    /// Kirim data per chunk. Mode withResponse bila tersedia (paling andal),
    /// fallback ke writeWithoutResponse dengan flow control CoreBluetooth.
    private func writeAll(
        _ peripheral: CBPeripheral,
        characteristic: CBCharacteristic,
        data: Data
    ) async throws {
        let withResponse = characteristic.properties.contains(.write)
        let maxLength: Int = bleQueue.sync {
            max(
                peripheral.maximumWriteValueLength(for: withResponse ? .withResponse : .withoutResponse),
                20
            )
        }
        let chunkSize = min(maxLength, 512)

        var offset = 0
        while offset < data.count {
            let end = min(offset + chunkSize, data.count)
            let chunk = data.subdata(in: offset..<end)
            if withResponse {
                let waiter = Waiter<Void>()
                bleQueue.async {
                    self.writeWaiter = waiter
                    peripheral.writeValue(chunk, for: characteristic, type: .withResponse)
                }
                try await awaitWaiter(waiter, timeout: 8)
                // Jeda kecil antar chunk biar buffer printer 58mm tidak overflow
                try? await Task.sleep(nanoseconds: 8_000_000)
            } else {
                while !canSendWithoutResponse(peripheral) {
                    let waiter = Waiter<Void>()
                    bleQueue.async { self.readyWaiter = waiter }
                    try await awaitWaiter(waiter, timeout: 8)
                }
                bleQueue.async {
                    peripheral.writeValue(chunk, for: characteristic, type: .withoutResponse)
                }
                try? await Task.sleep(nanoseconds: 20_000_000)
            }
            offset = end
        }
        // Beri waktu printer mengosongkan buffer terakhir sebelum dianggap selesai
        try? await Task.sleep(nanoseconds: 200_000_000)
    }

    private func canSendWithoutResponse(_ peripheral: CBPeripheral) -> Bool {
        bleQueue.sync { peripheral.canSendWriteWithoutResponse }
    }

    // MARK: - Printer dikenal (pengganti daftar pairing sistem Android)

    private struct KnownPrinter {
        let address: String
        let name: String
    }

    private static let knownPrintersKey = "mt-known-printers"

    private func loadKnownPrinters() -> [KnownPrinter] {
        guard let raw = UserDefaults.standard.array(forKey: Self.knownPrintersKey) as? [[String: String]] else {
            return []
        }
        return raw.compactMap { entry in
            if let address = entry["address"], let name = entry["name"] {
                return KnownPrinter(address: address, name: name)
            }
            return nil
        }
    }

    private func persistKnownPrinter(_ peripheral: CBPeripheral) {
        let address = peripheral.identifier.uuidString
        let name = peripheral.name ?? "Printer BLE"
        var list = loadKnownPrinters().filter { $0.address != address }
        list.insert(KnownPrinter(address: address, name: name), at: 0)
        if list.count > 12 {
            list = Array(list.prefix(12))
        }
        UserDefaults.standard.set(
            list.map { ["address": $0.address, "name": $0.name] },
            forKey: Self.knownPrintersKey
        )
    }

    private func teardownConnection() {
        bleQueue.async {
            if let peripheral = self.connectedPeripheral {
                self.central?.cancelPeripheralConnection(peripheral)
            }
            self.connectedPeripheral = nil
            self.connectedAddress = nil
        }
    }

    private func failAllWaiters(_ error: Error) {
        stateWaiter?.fail(error)
        connectWaiter?.fail(error)
        servicesWaiter?.fail(error)
        charsWaiter?.fail(error)
        writeWaiter?.fail(error)
        readyWaiter?.fail(error)
    }

    // MARK: - CBCentralManagerDelegate (callback masuk di bleQueue)
    // @objc wajib eksplisit: Swift tidak meng-infers-nya untuk witness
    // protocol @objc (CBCentralManagerDelegate / CBPeripheralDelegate).

    @objc public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        stateWaiter?.succeed(central.state)
        if central.state != .poweredOn {
            failAllWaiters(PrinterError.btState(central.state))
            teardownConnection()
        }
    }

    @objc(centralManager:didDiscoverPeripheral:advertisementData:RSSI:)
    public func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        let name = peripheral.name ?? (advertisementData[CBAdvertisementDataLocalNameKey] as? String)
        guard let name, !name.isEmpty else { return }
        discovered[peripheral.identifier] = peripheral
        scannedNames[peripheral.identifier] = name
    }

    @objc(centralManager:didConnectPeripheral:)
    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        connectedPeripheral = peripheral
        connectedAddress = peripheral.identifier.uuidString
        peripheral.delegate = self
        connectWaiter?.succeed(())
    }

    @objc(centralManager:didFailToConnectPeripheral:error:)
    public func centralManager(
        _ central: CBCentralManager,
        didFailToConnect peripheral: CBPeripheral,
        error: Error?
    ) {
        connectedPeripheral = nil
        connectedAddress = nil
        let message = error.map { $0.localizedDescription } ?? "koneksi ditolak printer"
        connectWaiter?.fail(PrinterError.writeFailed(message))
    }

    @objc public func centralManager(
        _ central: CBCentralManager,
        didDisconnectPeripheral peripheral: CBPeripheral,
        error: Error?
    ) {
        if connectedAddress == peripheral.identifier.uuidString {
            connectedPeripheral = nil
            connectedAddress = nil
        }
        failAllWaiters(PrinterError.disconnected)
    }

    // MARK: - CBPeripheralDelegate

    @objc public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if let error {
            servicesWaiter?.fail(PrinterError.writeFailed(error.localizedDescription))
            return
        }
        let services = peripheral.services ?? []
        guard !services.isEmpty else {
            servicesWaiter?.fail(PrinterError.noWritableCharacteristic)
            return
        }
        foundServices = services
        servicesWaiter?.succeed(())
    }

    @objc(peripheral:didDiscoverCharacteristicsForService:error:)
    public func peripheral(
        _ peripheral: CBPeripheral,
        didDiscoverCharacteristicsFor service: CBService,
        error: Error?
    ) {
        // Abaikan callback terlambat dari service yang sudah lewat timeout-nya
        guard charsWaiterService === service else { return }
        if let error {
            charsWaiter?.fail(PrinterError.writeFailed(error.localizedDescription))
            return
        }
        charsWaiter?.succeed(())
    }

    @objc(peripheral:didWriteValueForCharacteristic:error:)
    public func peripheral(
        _ peripheral: CBPeripheral,
        didWriteValueFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        if let error {
            writeWaiter?.fail(PrinterError.writeFailed(error.localizedDescription))
            return
        }
        writeWaiter?.succeed(())
    }

    @objc(peripheral:peripheralIsReadyToSendWriteWithoutResponse:)
    public func peripheral(
        _ peripheral: CBPeripheral,
        peripheralIsReady toSendWriteWithoutResponse: CBCharacteristic
    ) {
        readyWaiter?.succeed(())
    }
}
