package com.megateknik.pos;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(name = "ThermalPrinter", permissions = {
        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "btConnect"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_SCAN }, alias = "btScan")
})
public class ThermalPrinterPlugin extends Plugin {

    // SPP UUID umum untuk printer thermal Bluetooth Classic (MP-58M Pro, Xprinter, dll)
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private BluetoothSocket socket = null;
    private String connectedAddress = null;

    private boolean hasBtConnectPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return getActivity().checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)
                    == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    private void requestBtPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            requestPermissionForAliases(
                    new String[]{"btConnect", "btScan"},
                    call,
                    "btPermsCallback");
        }
    }

    @com.getcapacitor.PluginMethod(returnType = com.getcapacitor.PluginMethod.RETURN_NONE)
    public void btPermsCallback(PluginCall call) {
        // Callback kosong, user tinggal panggil listPaired lagi
    }

    @PluginMethod
    public void listPaired(PluginCall call) {
        try {
            if (!hasBtConnectPermission()) {
                requestBtPermission(call);
                // Kembalikan list kosong dulu, user panggil lagi setelah grant
                JSObject ret = new JSObject();
                ret.put("devices", new JSArray());
                ret.put("needsPermission", true);
                call.resolve(ret);
                return;
            }
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            JSArray arr = new JSArray();
            if (adapter != null) {
                Set<BluetoothDevice> bonded = adapter.getBondedDevices();
                if (bonded != null) {
                    for (BluetoothDevice d : bonded) {
                        JSObject o = new JSObject();
                        o.put("name", d.getName());
                        o.put("address", d.getAddress());
                        arr.put(o);
                    }
                }
            }
            JSObject ret = new JSObject();
            ret.put("devices", arr);
            ret.put("needsPermission", false);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Gagal ambil daftar printer: " + e.getMessage());
        }
    }

    private BluetoothSocket connectToAddress(String address) throws Exception {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) throw new Exception("HP ini tidak punya Bluetooth");
        if (!adapter.isEnabled()) throw new Exception("Bluetooth HP mati. Nyalakan dulu.");

        BluetoothDevice device;
        try {
            device = adapter.getRemoteDevice(address);
        } catch (Exception e) {
            throw new Exception("Alamat printer tidak valid: " + address);
        }

        // Tutup socket lama kalau beda alamat
        if (socket != null && connectedAddress != null && !connectedAddress.equals(address)) {
            try { socket.close(); } catch (Exception ignored) {}
            socket = null;
            connectedAddress = null;
        }

        if (socket != null && socket.isConnected() && address.equals(connectedAddress)) {
            return socket;
        }

        // Cancel discovery biar koneksi stabil
        try { adapter.cancelDiscovery(); } catch (Exception ignored) {}

        BluetoothSocket s = device.createRfcommSocketToServiceRecord(SPP_UUID);
        s.connect();
        socket = s;
        connectedAddress = address;
        return s;
    }

    private String findDefaultPrinterAddress() throws Exception {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) return null;
        Set<BluetoothDevice> bonded = adapter.getBondedDevices();
        if (bonded == null || bonded.isEmpty()) return null;
        // Prioritaskan nama yang mirip printer
        for (BluetoothDevice d : bonded) {
            String n = d.getName() != null ? d.getName().toLowerCase() : "";
            if (n.contains("print") || n.contains("pos") || n.contains("58") || n.contains("80")
                    || n.contains("mp-") || n.contains("mpt") || n.contains("xprinter")
                    || n.contains("rpp") || n.contains("pt-") || n.contains("ble")) {
                return d.getAddress();
            }
        }
        // Fallback: perangkat bonded pertama
        return bonded.iterator().next().getAddress();
    }

    @PluginMethod
    public void print(PluginCall call) {
        String base64Data = call.getString("data");
        String address = call.getString("address");
        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("Data struk kosong");
            return;
        }
        if (!hasBtConnectPermission()) {
            call.reject("Izin Bluetooth belum diberikan. Buka Pengaturan > Aplikasi > Mega Tehnik > Izinkan Perangkat Sekitar.");
            return;
        }

        // Jalan di thread background biar UI tidak freeze
        new Thread(() -> {
            try {
                String target = address;
                if (target == null || target.isEmpty()) {
                    target = findDefaultPrinterAddress();
                }
                if (target == null || target.isEmpty()) {
                    call.reject("Belum ada printer yang di-pairing. Pairing dulu printer VSC MP-58M di Pengaturan Bluetooth HP.");
                    return;
                }

                BluetoothSocket s = connectToAddress(target);
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                OutputStream out = s.getOutputStream();

                // Kirim per 512 byte biar printer 58mm tidak overflow
                int chunk = 512;
                for (int i = 0; i < bytes.length; i += chunk) {
                    int len = Math.min(chunk, bytes.length - i);
                    out.write(bytes, i, len);
                    out.flush();
                    if (i + chunk < bytes.length) {
                        try { Thread.sleep(30); } catch (InterruptedException ignored) {}
                    }
                }

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("address", target);
                ret.put("bytes", bytes.length);
                call.resolve(ret);
            } catch (SecurityException se) {
                call.reject("Izin Bluetooth ditolak: " + se.getMessage());
            } catch (Exception e) {
                // Reset socket biar percobaan berikutnya konek ulang
                try { if (socket != null) socket.close(); } catch (Exception ignored) {}
                socket = null;
                connectedAddress = null;
                String msg = e.getMessage() != null ? e.getMessage() : e.toString();
                if (msg.contains("socket") || msg.contains("connect") || msg.contains("read failed")) {
                    msg = "Gagal konek ke printer. Pastikan printer nyala, kertas ada, dan belum konek ke HP lain. (" + msg + ")";
                }
                call.reject(msg);
            }
        }).start();
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        try {
            if (socket != null) socket.close();
        } catch (Exception ignored) {}
        socket = null;
        connectedAddress = null;
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void openRawBT(PluginCall call) {
        String text = call.getString("text", "");
        try {
            String encoded = Uri.encode(text);
            // Intent resmi RawBT: intent:[teks]#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;
            String uriStr = "intent:" + encoded + "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;";
            Intent intent = Intent.parseUri(uriStr, Intent.URI_INTENT_SCHEME);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Gagal buka RawBT. Pastikan aplikasi RawBT terinstall. " + e.getMessage());
        }
    }
}
