import { Transaction, StoreProfile } from '../types';
import { formatRupiah, formatDateIndo } from '../utils/formatters';

/**
 * Thermer Print Entry Schema for iOS (github.com/tussharmate/ios-thermer-custom-schema)
 */
export interface ThermerPrintEntry {
  /**
   * 0 = Text Entry
   * 1 = Image Entry
   * 2 = Barcode Entry
   * 3 = QR Entry
   */
  type: number;
  content?: string;
  /** 0 = Normal, 1 = Bold */
  bold?: number;
  /** 0 = Left, 1 = Center, 2 = Right */
  align?: number;
  /**
   * 0 = Normal
   * 1 = Double Height
   * 2 = Double Height + Width
   * 3 = Double Width
   * 4 = Small
   */
  format?: number;
}

export type ThermerEntriesMap = Record<string, ThermerPrintEntry>;

/**
 * Format two columns (Left aligned and Right aligned) across specific width
 */
export function formatTwoColumns(left: string, right: string, width = 30): string {
  const leftTrim = left.trim();
  const rightTrim = right.trim();
  const spaceNeeded = width - leftTrim.length - rightTrim.length;
  if (spaceNeeded > 0) {
    return leftTrim + ' '.repeat(spaceNeeded) + rightTrim;
  }
  return `${leftTrim} ${rightTrim}`;
}

/**
 * Generate official Thermer iOS JSON map with consolidated entries.
 * Grouping lines with '\n' prevents Bluetooth Low Energy (BLE) packet buffer overflow
 * on thermal printers like VSC MP-58M Pro.
 */
export function generateThermerReceiptEntries(
  transaction: Transaction,
  storeProfile: StoreProfile
): ThermerEntriesMap {
  const list: ThermerPrintEntry[] = [];

  const addText = (
    content: string,
    bold: number = 0,
    align: number = 0,
    format: number = 0
  ) => {
    if (!content || !content.trim()) return;
    list.push({
      type: 0,
      content,
      bold,
      align,
      format,
    });
  };

  // 1. NAMA TOKO (Bold, Center, Normal Size)
  addText(storeProfile.name.toUpperCase(), 1, 1, 0);

  // 2. HEADER TOKO: Tagline, Alamat, Telp digabung dalam 1 entry center
  // Mencegah BLE RX buffer crash yang terjadi jika tiap baris dikirim sebagai entry terpisah
  const headerLines: string[] = [];
  if (storeProfile.tagline) headerLines.push(storeProfile.tagline);
  if (storeProfile.address) headerLines.push(storeProfile.address);
  if (storeProfile.phone) headerLines.push(`Telp: ${storeProfile.phone}`);
  if (headerLines.length > 0) {
    addText(headerLines.join('\n'), 0, 1, 0);
  }

  // 3. METADATA TRANSAKSI (Digabung dengan pembatas 1 entry)
  const metaLines: string[] = ['------------------------------'];
  if (storeProfile.showDateTime) {
    metaLines.push(`Tgl: ${formatDateIndo(transaction.date)}`);
  }
  if (storeProfile.showCashierName && storeProfile.cashierName) {
    const cashierLine = `Kasir: ${storeProfile.cashierName}` + (transaction.customerName ? ` | Plg: ${transaction.customerName}` : '');
    metaLines.push(cashierLine);
  } else if (transaction.customerName) {
    metaLines.push(`Plg: ${transaction.customerName}`);
  }
  metaLines.push('------------------------------');
  addText(metaLines.join('\n'), 0, 0, 0);

  // 4. DAFTAR ITEM (1 entry per item: Nama \n Qty x Harga + Subtotal)
  transaction.items.forEach((item) => {
    const leftPart = ` ${item.qty} ${item.unit || 'pcs'} x ${formatRupiah(item.price)}`;
    const rightPart = formatRupiah(item.subtotal);
    const itemLine = formatTwoColumns(leftPart, rightPart, 30);
    const itemName = item.isNego ? `${item.name} (Nego)` : item.name;

    addText(`${itemName}\n${itemLine}`, 0, 0, 0);
  });

  // 5. TOTAL & PEMBAYARAN (Digabung dalam 1 block)
  const payLines: string[] = ['------------------------------'];
  payLines.push(formatTwoColumns('TOTAL', formatRupiah(transaction.totalAmount), 30));
  const payMethodLabel =
    transaction.paymentMethod === 'qris'
      ? 'BAYAR (QRIS)'
      : transaction.paymentMethod === 'transfer'
      ? 'BAYAR (TRANSFER)'
      : 'TUNAI / BAYAR';
  payLines.push(formatTwoColumns(payMethodLabel, formatRupiah(transaction.cashAmount), 30));
  payLines.push(formatTwoColumns('KEMBALIAN', formatRupiah(Math.max(0, transaction.changeAmount)), 30));
  if (transaction.notes) {
    payLines.push('------------------------------');
    payLines.push(`Catatan: ${transaction.notes}`);
  }
  payLines.push('==============================');
  addText(payLines.join('\n'), 0, 0, 0);

  // 6. FOOTER / UCAPAN TOKO (Center)
  const footerLines: string[] = [];
  if (storeProfile.footerNote) {
    footerLines.push(storeProfile.footerNote);
  }
  footerLines.push('*** TERIMA KASIH ***');
  addText(footerLines.join('\n'), 1, 1, 0);

  // Convert array to sequential integer dictionary with 3-digit zero-padding:
  // e.g. { "000": entry0, "001": entry1, ..., "006": entry6 }
  const entriesMap: ThermerEntriesMap = {};
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (item) {
      const key = i.toString().padStart(3, '0');
      entriesMap[key] = item;
    }
  }

  return entriesMap;
}

// Module-level cooldown lock to prevent duplicate BLE connection bursts on iOS
let lastThermerPrintTimestamp = 0;

/**
 * Send receipt directly to Thermer app on iOS (via official custom scheme `thermer://?data=`)
 */
export function printViaThermer(
  transaction: Transaction,
  storeProfile: StoreProfile
): boolean {
  if (typeof window === 'undefined') return false;

  const now = Date.now();
  // Enforce 1.5s cooldown to prevent multiple rapid triggers that crash Thermer socket
  if (now - lastThermerPrintTimestamp < 1500) {
    return false;
  }
  lastThermerPrintTimestamp = now;

  const entriesMap = generateThermerReceiptEntries(transaction, storeProfile);
  const jsonString = JSON.stringify(entriesMap);
  const encodedJson = encodeURIComponent(jsonString);

  // Official Thermer custom scheme URL: thermer://?data={jsonMap}
  const thermerUrl = `thermer://?data=${encodedJson}`;

  try {
    window.location.href = thermerUrl;
    return true;
  } catch (err) {
    console.error('Error triggering Thermer print:', err);
    return false;
  }
}
