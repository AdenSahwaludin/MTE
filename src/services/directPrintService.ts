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
 * Generate official Thermer iOS JSON map with sequential zero-padded keys
 * e.g. { "000": { type: 0, content: "...", bold: 1, align: 1, format: 2 }, "001": ... }
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

  // 2. TAGLINE / SUBTITLE (Normal, Center)
  if (storeProfile.tagline) {
    addText(storeProfile.tagline, 0, 1, 0);
  }

  // 3. ALAMAT & TELP (Normal, Center)
  if (storeProfile.address) {
    addText(storeProfile.address, 0, 1, 0);
  }
  if (storeProfile.phone) {
    addText(`Telp: ${storeProfile.phone}`, 0, 1, 0);
  }

  // 4. GARIS PEMBATAS (30 Karakter aman untuk 58mm)
  addText('------------------------------', 0, 0, 0);

  // 5. METADATA TRANSAKSI
  addText(`No: ${transaction.invoiceNo}`, 0, 0, 0);
  if (storeProfile.showDateTime) {
    addText(formatDateIndo(transaction.date), 0, 0, 0);
  }
  if (storeProfile.showCashierName && storeProfile.cashierName) {
    const cashierLine = `Kasir: ${storeProfile.cashierName}` + (transaction.customerName ? ` | Plg: ${transaction.customerName}` : '');
    addText(cashierLine, 0, 0, 0);
  } else if (transaction.customerName) {
    addText(`Plg: ${transaction.customerName}`, 0, 0, 0);
  }

  // 6. GARIS PEMBATAS
  addText('------------------------------', 0, 0, 0);

  // 7. DAFTAR ITEM (Digabung 1 entry per item dengan \n untuk mencegah BLE packet burst)
  transaction.items.forEach((item) => {
    const displayName = item.name;
    const leftPart = ` ${item.qty} ${item.unit || 'pcs'} x ${formatRupiah(item.price)}`;
    const rightPart = formatRupiah(item.subtotal);
    const itemLine = formatTwoColumns(leftPart, rightPart, 30);

    addText(`${displayName}\n${itemLine}`, 0, 0, 0);
  });

  // 8. GARIS PEMBATAS
  addText('------------------------------', 0, 0, 0);

  // 9. TOTAL PEMBAYARAN
  const totalLine = formatTwoColumns('TOTAL', formatRupiah(transaction.totalAmount), 30);
  addText(totalLine, 1, 0, 0);

  // 10. JUMLAH BAYAR & KEMBALIAN
  const paidLine = formatTwoColumns('TUNAI / BAYAR', formatRupiah(transaction.cashAmount), 30);
  addText(paidLine, 0, 0, 0);

  const changeLine = formatTwoColumns('KEMBALIAN', formatRupiah(Math.max(0, transaction.changeAmount)), 30);
  addText(changeLine, 1, 0, 0);

  // 11. CATATAN
  if (transaction.notes) {
    addText('------------------------------', 0, 0, 0);
    addText(`Catatan: ${transaction.notes}`, 0, 0, 0);
  }

  // 12. GARIS PENUTUP
  addText('==============================', 0, 0, 0);

  // 13. FOOTER / UCAPAN (Center)
  if (storeProfile.footerNote) {
    addText(storeProfile.footerNote, 0, 1, 0);
  }
  addText('*** TERIMA KASIH ***', 1, 1, 0);

  // Convert array to sequential integer dictionary with 3-digit zero-padding:
  // e.g. { "000": entry0, "001": entry1, ..., "018": entry18 }
  // This is the EXACT schema expected by Thermer iOS app
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
 * Send receipt directly to RawBT app on Android (via deep link intent)
 */
export function printViaRawBT(
  transaction: Transaction,
  storeProfile: StoreProfile
): boolean {
  const plainText = generateReceiptPlainText(transaction, storeProfile);
  const base64Data = utf8ToBase64(plainText);

  // RawBT Android Intent URI & Custom Scheme
  const rawbtIntentUrl = `intent:base64,${base64Data}#Intent;scheme=rawbt:data;package=ru.a402d.rawbtprinter;end;`;
  const rawbtSchemeUrl = `rawbt:data:text/plain;charset=utf-8;base64,${base64Data}`;

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
