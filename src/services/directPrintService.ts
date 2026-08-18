import { Transaction, StoreProfile } from '../types';
import { formatRupiah, formatDateIndo } from '../utils/formatters';

const LINE_WIDTH = 32;

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
 * Center-align a string within the specified width
 */
function centerText(text: string, width = LINE_WIDTH): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length >= width) return trimmed.slice(0, width);
  const leftPad = Math.floor((width - trimmed.length) / 2);
  const rightPad = width - trimmed.length - leftPad;
  return ' '.repeat(leftPad) + trimmed + ' '.repeat(rightPad);
}

/**
 * Generate 32-character plain text thermal receipt formatted for 58mm ESC/POS printers (RawBT)
 */
export function generateReceiptPlainText(
  transaction: Transaction,
  storeProfile: StoreProfile
): string {
  const lines: string[] = [];
  const divider = '-'.repeat(LINE_WIDTH);
  const doubleDivider = '='.repeat(LINE_WIDTH);

  // 1. Store Header
  lines.push(centerText(storeProfile.name.toUpperCase()));
  if (storeProfile.tagline) {
    lines.push(centerText(storeProfile.tagline));
  }
  if (storeProfile.address) {
    lines.push(centerText(storeProfile.address));
  }
  if (storeProfile.phone) {
    lines.push(centerText(`Telp: ${storeProfile.phone}`));
  }

  lines.push(doubleDivider);

  // 2. Metadata
  lines.push(formatTwoColumns(`No: ${transaction.invoiceNo}`, '', LINE_WIDTH));
  if (storeProfile.showDateTime) {
    lines.push(formatTwoColumns('Tgl: ' + formatDateIndo(transaction.date), '', LINE_WIDTH));
  }
  if (storeProfile.showCashierName && storeProfile.cashierName) {
    const cashierStr = `Kasir: ${storeProfile.cashierName}`;
    const custStr = transaction.customerName ? `Plg: ${transaction.customerName}` : '';
    if (custStr) {
      lines.push(formatTwoColumns(cashierStr, custStr, LINE_WIDTH));
    } else {
      lines.push(cashierStr);
    }
  } else if (transaction.customerName) {
    lines.push(`Plg: ${transaction.customerName}`);
  }

  lines.push(divider);

  // 3. Items List
  transaction.items.forEach((item) => {
    lines.push(item.name);
    const leftCol = ` ${item.qty} ${item.unit || 'pcs'} x ${formatRupiah(item.price)}`;
    const rightCol = formatRupiah(item.subtotal);
    lines.push(formatTwoColumns(leftCol, rightCol, LINE_WIDTH));
  });

  lines.push(divider);

  // 4. Totals & Payment
  lines.push(formatTwoColumns('TOTAL', formatRupiah(transaction.totalAmount), LINE_WIDTH));
  lines.push(formatTwoColumns('TUNAI / BAYAR', formatRupiah(transaction.cashAmount), LINE_WIDTH));
  lines.push(formatTwoColumns('KEMBALIAN', formatRupiah(Math.max(0, transaction.changeAmount)), LINE_WIDTH));

  if (transaction.notes) {
    lines.push(divider);
    lines.push(`Catatan: ${transaction.notes}`);
  }

  lines.push(doubleDivider);

  // 5. Store Footer Note
  if (storeProfile.footerNote) {
    lines.push(centerText(storeProfile.footerNote));
  }
  lines.push(centerText('*** TERIMA KASIH ***'));
  lines.push('');
  lines.push('');
  lines.push('');

  return lines.join('\n');
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

  // 1. NAMA TOKO (Double Height + Width, Bold, Center)
  addText(storeProfile.name.toUpperCase(), 1, 1, 2);

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
  metaLines.push(`No: ${transaction.invoiceNo}`);
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

    addText(`${item.name}\n${itemLine}`, 0, 0, 0);
  });

  // 5. TOTAL & PEMBAYARAN (Digabung dalam 1 block)
  const payLines: string[] = ['------------------------------'];
  payLines.push(formatTwoColumns('TOTAL', formatRupiah(transaction.totalAmount), 30));
  payLines.push(formatTwoColumns('TUNAI / BAYAR', formatRupiah(transaction.cashAmount), 30));
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

/**
 * Encode string to Base64 safely with UTF-8 support
 */
function utf8ToBase64(str: string): string {
  return window.btoa(unescape(encodeURIComponent(str)));
}

/**
 * Send receipt directly to RawBT app on Android (via official intent / custom scheme)
 */
export function printViaRawBT(
  transaction: Transaction,
  storeProfile: StoreProfile
): boolean {
  const plainText = generateReceiptPlainText(transaction, storeProfile);
  const encodedText = encodeURIComponent(plainText);

  // Official RawBT Intent & Scheme for plain text receipt:
  // intent:[encodedText]#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;
  const rawbtIntentUrl = `intent:${encodedText}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
  const rawbtSchemeUrl = `rawbt:${encodedText}`;

  try {
    const isAndroid = /android/i.test(navigator.userAgent);
    if (isAndroid) {
      window.location.href = rawbtIntentUrl;
    } else {
      window.location.href = rawbtSchemeUrl;
    }
    return true;
  } catch (err) {
    console.error('Error triggering RawBT print:', err);
    return false;
  }
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
