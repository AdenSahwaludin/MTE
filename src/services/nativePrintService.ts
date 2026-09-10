import { Capacitor } from '@capacitor/core';
import { Transaction, StoreProfile } from '../types';
import { buildReceiptBytes } from './bluetoothPrintService';
import { generateReceiptPlainText } from './directPrintService';

export interface PairedPrinter {
  name: string;
  address: string;
}

const PLUGIN_NAME = 'ThermalPrinter';
const STORAGE_KEY = 'mt-printer-address';

function getPlugin(): any {
  const cap = Capacitor as any;
  // Capacitor 5+: Plugins ada di window.Capacitor.Plugins
  const plugins = (window as any)?.Capacitor?.Plugins;
  if (plugins && plugins[PLUGIN_NAME]) return plugins[PLUGIN_NAME];
  if (cap?.Plugins && cap.Plugins[PLUGIN_NAME]) return cap.Plugins[PLUGIN_NAME];
  return null;
}

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return !!getPlugin();
  }
}

export function isNativePrinterAvailable(): boolean {
  return isNativeApp() && !!getPlugin();
}

export function getSavedPrinterAddress(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function savePrinterAddress(address: string): void {
  try {
    if (address) localStorage.setItem(STORAGE_KEY, address);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, sub as any);
  }
  return btoa(binary);
}

export async function listPairedPrinters(): Promise<PairedPrinter[]> {
  const plugin = getPlugin();
  if (!plugin) throw new Error('Plugin printer native belum terdaftar di APK ini.');
  const res = await plugin.listPaired();
  return (res?.devices || []) as PairedPrinter[];
}

/**
 * Print LANGSUNG via Bluetooth Classic SPP (tanpa aplikasi tambahan).
 * Dipakai di APK. Otomatis pakai alamat tersimpan, atau printer bonded pertama.
 */
export async function printNativeDirect(
  transaction: Transaction,
  storeProfile: StoreProfile,
  addressOverride?: string
): Promise<{ address: string; bytes: number }> {
  const plugin = getPlugin();
  if (!plugin) {
    throw new Error('APK belum support print langsung. Rebuild APK dulu.');
  }
  const bytes = buildReceiptBytes(transaction, storeProfile);
  const base64 = uint8ToBase64(bytes);
  const address = addressOverride || getSavedPrinterAddress();

  const res = await plugin.print({ data: base64, address });
  if (res?.address) savePrinterAddress(res.address);
  return { address: res?.address || address, bytes: res?.bytes || bytes.length };
}

/**
 * Buka RawBT via intent NATIVE (bukan window.location.href yang diblokir WebView).
 * Fallback kalau print langsung gagal.
 */
export async function openRawBTNative(
  transaction: Transaction,
  storeProfile: StoreProfile
): Promise<void> {
  const plugin = getPlugin();
  const plainText = generateReceiptPlainText(transaction, storeProfile);
  if (plugin?.openRawBT) {
    await plugin.openRawBT({ text: plainText });
    return;
  }
  // Fallback web (Chrome / PWA)
  const { printViaRawBT } = await import('./directPrintService');
  printViaRawBT(transaction, storeProfile);
}
