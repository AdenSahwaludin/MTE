import Capacitor

/// Pengganti registerPlugin(ThermalPrinterPlugin.class) di MainActivity Android:
/// mendaftarkan plugin printer thermal lokal ke bridge Capacitor iOS.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginType(ThermalPrinterPlugin.self)
    }
}
