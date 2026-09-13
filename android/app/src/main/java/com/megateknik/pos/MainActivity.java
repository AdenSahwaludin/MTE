package com.megateknik.pos;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Daftarkan plugin printer thermal lokal (Bluetooth Classic SPP)
        registerPlugin(ThermalPrinterPlugin.class);
    }
}
