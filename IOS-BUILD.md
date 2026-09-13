# Build iOS — Mega Tehnik Elektronik

Program ini dibangun dengan **React + TypeScript** dan dikemas ke aplikasi native
memakai **Capacitor**. Kode web-nya dipakai ulang 100% — versi iOS **tidak perlu
bahasa baru** untuk 95% fitur. Satu-satunya bagian native adalah plugin cetak
Bluetooth (`ThermalPrinterPlugin`) yang sudah di-porting ke **Swift** di
`ios/App/App/ThermalPrinterPlugin.swift`.

## Yang sudah disiapkan (dari Linux)

| Bagian | Lokasi | Status |
|---|---|---|
| Project Xcode (Capacitor 8 + SPM) | `ios/` | ✅ digenerate `npx cap add ios` |
| Plugin printer Swift (CoreBluetooth/BLE) | `ios/App/App/ThermalPrinterPlugin.swift` | ✅ port dari versi Java Android |
| Registrasi plugin | `ios/App/App/MainViewController.swift` + `SceneDelegate.swift` | ✅ |
| Izin Bluetooth | `ios/App/App/Info.plist` (`NSBluetoothAlwaysUsageDescription`) | ✅ |
| App icon brand | `ios/App/App/Assets.xcassets/AppIcon.appiconset/` | ✅ dari `design-assets/app-icon-1024.png` |
| Splash screen brand 2732x2732 | `ios/App/App/Assets.xcassets/Splash.imageset/` | ✅ generator: `scripts/generate-ios-assets.mjs` |
| Launch screen gelap | `ios/App/App/Base.lproj/LaunchScreen.storyboard` | ✅ |

## Yang harus dilakukan di Mac (syarat Apple, tidak bisa dari Linux)

Membuat aplikasi iOS **wajib** memakai macOS + Xcode. Pilihan:

1. **Mac fisik** (MacBook/Mac mini) — Xcode gratis di App Store, atau
2. **Sewa cloud Mac** (MacStadium, dll), atau
3. **GitHub Actions** dengan runner `macos-*` untuk build CI.

### Build TANPA Mac: GitHub Actions (otomatis)

Repo ini punya workflow `.github/workflows/build-ios.yml` (mirip `build-apk.yml`):
setiap push ke `main` (atau manual via tab **Actions → Build iOS IPA → Run
workflow**) akan membuild web, sync Capacitor, lalu menjalankan `xcodebuild`
di runner macOS dan mengemas hasilnya menjadi **`Mega-Teknik-POS-iOS-unsigned.ipa`**.

Cara mengambil filenya:

1. Buka `github.com/AdenSahwaludin/MTE` → tab **Actions** → pilih run **Build iOS IPA**.
2. Di bagian bawah (Artifacts) unduh **Mega-Teknik-POS-iOS-unsigned-IPA**.
3. `.ipa`-nya **belum bertanda tangan** (unsigned). Cara pasang ke iPhone:
   - Gratis: tanda tangan pakai **Sideloadly** atau **AltStore** dengan Apple ID
     biasa (berlaku 7 hari, harus install ulang setelahnya), atau
   - Resmi: gabung **Apple Developer Program** ($99/tahun) lalu sign + pasang via
     TestFlight / Xcode.

### Langkah build di Mac (alternatif)

```bash
# 1. Di Linux / mana saja: build web + sinkron ke iOS
npm install
npm run build
npx cap sync ios

# 2. Di Mac: buka project Xcode
open ios/App/App.xcodeproj

# 3. Di Xcode:
#    - Pilih target "App" > Signing & Capabilities
#    - Login Apple ID (Xcode > Settings > Accounts)
#    - Centang "Automatically manage signing", pilih Team
#    - Sambungkan iPhone, pilih device, klik Run (▶)
```

### Distribusi

- **Tes di HP sendiri**: akun Apple ID gratis cukup, tapi aplikasi kadaluarsa
  tiap 7 hari (harus build ulang).
- **TestFlight / App Store**: perlu **Apple Developer Program** (US$99/tahun).

## Beda perilaku iOS vs Android

| Fitur | Android | iOS |
|---|---|---|
| Cetak Bluetooth | Bluetooth Classic SPP (UUID `00001101-...`) | **BLE (CoreBluetooth)** — iOS melarang SPP untuk aplikasi umum. Printer harus diaktifkan mode BLE-nya (umumnya sudah otomatis). |
| "Perangkat ter-pairing" | Daftar pairing sistem | Hasil scan BLE ±2,5 detik + riwayat printer yang pernah dipakai |
| Alamat printer | MAC address | Identifier UUID CoreBluetooth (tersimpan otomatis di localStorage seperti Android) |
| Splash screen | `drawable/splash.png` | `Splash.imageset` + LaunchScreen storyboard |

Setelah scan, pilih printer di Pengaturan — alamatnya otomatis tersimpan dan
pencetakan berjalan sama seperti di Android.

## Regenerasi aset brand iOS

Jika logo/brand berubah:

```bash
node scripts/generate-ios-assets.mjs
```

(dianalogikan dengan `scripts/generate-brand-assets.mjs` untuk Android/PWA.)

## Catatan teknis plugin Swift

- `ThermalPrinterPlugin.swift` memakai CoreBluetooth: koneksi ke printer,
  cari characteristic writable (prioritas service `FFE0`/`FFF0`/`18F0`/`FF00`),
  kirim byte ESC/POS per chunk (maks 512 byte, jeda antar chunk — setara
  logika `print()` versi Java).
- UI web memanggil plugin lewat `src/services/nativePrintService.ts`
  **tanpa perubahan apa pun** — nama plugin (`ThermalPrinter`) dan method
  (`listPaired`, `print`, `disconnect`) dibuat identik.
- **Belum teruji di printer sungguhan** karena build iOS butuh Mac — saat
  pertama kali build di Xcode, uji cetak dengan printer VSC MP-58M Pro di
  mode BLE dan laporkan error yang muncul (log dari Xcode console).
