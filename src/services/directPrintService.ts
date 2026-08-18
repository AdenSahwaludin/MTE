import { Transaction, StoreProfile } from '../types';
import { formatRupiah, formatDateIndo } from '../utils/formatters';

const LINE_WIDTH = 32; // 32 characters for 58mm thermal paper

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
 * Format two columns (Left aligned and Right aligned) across LINE_WIDTH
 */
function formatTwoColumns(left: string, right: string, width = LINE_WIDTH): string {
  const leftTrim = left.trim();
  const rightTrim = right.trim();
  const spaceNeeded = width - leftTrim.length - rightTrim.length;
  if (spaceNeeded > 0) {
    return leftTrim + ' '.repeat(spaceNeeded) + rightTrim;
  }
  return leftTrim + ' ' + rightTrim;
}

/**
 * Generate 32-character plain text thermal receipt formatted for 58mm ESC/POS printers
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
  lines.push(formatTwoColumns(`No: ${transaction.invoiceNo}`, ''));
  if (storeProfile.showDateTime) {
    lines.push(formatTwoColumns('Tgl: ' + formatDateIndo(transaction.date), ''));
  }
  if (storeProfile.showCashierName && storeProfile.cashierName) {
    const cashierStr = `Kasir: ${storeProfile.cashierName}`;
    const custStr = transaction.customerName ? `Plg: ${transaction.customerName}` : '';
    if (custStr) {
      lines.push(formatTwoColumns(cashierStr, custStr));
    } else {
      lines.push(cashierStr);
    }
  } else if (transaction.customerName) {
    lines.push(`Plg: ${transaction.customerName}`);
  }

  lines.push(divider);

  // 3. Items List
  transaction.items.forEach((item) => {
    // Item Name on first line
    lines.push(item.name);
    // Qty x Price on left, Subtotal on right
    const leftCol = ` ${item.qty} ${item.unit || 'pcs'} x ${formatRupiah(item.price)}`;
    const rightCol = formatRupiah(item.subtotal);
    lines.push(formatTwoColumns(leftCol, rightCol));
  });

  lines.push(divider);

  // 4. Totals & Payment
  lines.push(formatTwoColumns('TOTAL', formatRupiah(transaction.totalAmount)));
  lines.push(formatTwoColumns('TUNAI / BAYAR', formatRupiah(transaction.cashAmount)));
  lines.push(formatTwoColumns('KEMBALIAN', formatRupiah(Math.max(0, transaction.changeAmount))));

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
  lines.push(''); // 3 lines feed for tear off

  return lines.join('\n');
}

/**
 * Generate structured Thermer JSON with 'entries' array required by Thermer iOS / Android
 */
export function generateThermerJson(
  transaction: Transaction,
  storeProfile: StoreProfile
): { entries: any[] } {
  const entries: any[] = [];

  // Header Toko
  entries.push({
    type: 'text',
    content: storeProfile.name.toUpperCase(),
    bold: 1,
    align: 1,
    format: 2, // Large / double size header
  });

  if (storeProfile.tagline) {
    entries.push({
      type: 'text',
      content: storeProfile.tagline,
      bold: 0,
      align: 1,
      format: 0,
    });
  }

  if (storeProfile.address) {
    entries.push({
      type: 'text',
      content: storeProfile.address,
      bold: 0,
      align: 1,
      format: 0,
    });
  }

  if (storeProfile.phone) {
    entries.push({
      type: 'text',
      content: `Telp: ${storeProfile.phone}`,
      bold: 0,
      align: 1,
      format: 0,
    });
  }

  // Divider ganda
  entries.push({
    type: 'text',
    content: '================================',
    bold: 0,
    align: 1,
    format: 0,
  });

  // Metadata
  entries.push({
    type: 'text',
    content: `No: ${transaction.invoiceNo}`,
    bold: 0,
    align: 0,
    format: 0,
  });

  if (storeProfile.showDateTime) {
    entries.push({
      type: 'text',
      content: `Tgl: ${formatDateIndo(transaction.date)}`,
      bold: 0,
      align: 0,
      format: 0,
    });
  }

  if (storeProfile.showCashierName && storeProfile.cashierName) {
    const cashierLine = `Kasir: ${storeProfile.cashierName}` + (transaction.customerName ? ` | Plg: ${transaction.customerName}` : '');
    entries.push({
      type: 'text',
      content: cashierLine,
      bold: 0,
      align: 0,
      format: 0,
    });
  } else if (transaction.customerName) {
    entries.push({
      type: 'text',
      content: `Plg: ${transaction.customerName}`,
      bold: 0,
      align: 0,
      format: 0,
    });
  }

  // Divider putus-putus
  entries.push({
    type: 'text',
    content: '--------------------------------',
    bold: 0,
    align: 1,
    format: 0,
  });

  // Daftar Barang
  transaction.items.forEach((item) => {
    // Baris nama barang (bold)
    entries.push({
      type: 'text',
      content: item.name,
      bold: 1,
      align: 0,
      format: 0,
    });

    // Baris qty x harga dan subtotal rata kanan
    const left = ` ${item.qty} ${item.unit || 'pcs'} x ${formatRupiah(item.price)}`;
    const right = formatRupiah(item.subtotal);
    const spaceNeeded = Math.max(1, 32 - left.length - right.length);
    const itemCalc = left + ' '.repeat(spaceNeeded) + right;

    entries.push({
      type: 'text',
      content: itemCalc,
      bold: 0,
      align: 0,
      format: 0,
    });
  });

  // Divider putus-putus
  entries.push({
    type: 'text',
    content: '--------------------------------',
    bold: 0,
    align: 1,
    format: 0,
  });

  // Total
  const totalLeft = 'TOTAL';
  const totalRight = formatRupiah(transaction.totalAmount);
  const totalSpace = Math.max(1, 32 - totalLeft.length - totalRight.length);
  entries.push({
    type: 'text',
    content: totalLeft + ' '.repeat(totalSpace) + totalRight,
    bold: 1,
    align: 0,
    format: 1,
  });

  // Tunai
  const cashLeft = 'TUNAI / BAYAR';
  const cashRight = formatRupiah(transaction.cashAmount);
  const cashSpace = Math.max(1, 32 - cashLeft.length - cashRight.length);
  entries.push({
    type: 'text',
    content: cashLeft + ' '.repeat(cashSpace) + cashRight,
    bold: 0,
    align: 0,
    format: 0,
  });

  // Kembalian
  const changeLeft = 'KEMBALIAN';
  const changeRight = formatRupiah(Math.max(0, transaction.changeAmount));
  const changeSpace = Math.max(1, 32 - changeLeft.length - changeRight.length);
  entries.push({
    type: 'text',
    content: changeLeft + ' '.repeat(changeSpace) + changeRight,
    bold: 0,
    align: 0,
    format: 0,
  });

  // Catatan Struk (jika ada)
  if (transaction.notes) {
    entries.push({
      type: 'text',
      content: '--------------------------------',
      bold: 0,
      align: 1,
      format: 0,
    });
    entries.push({
      type: 'text',
      content: `Catatan: ${transaction.notes}`,
      bold: 0,
      align: 0,
      format: 0,
    });
  }

  // Divider ganda
  entries.push({
    type: 'text',
    content: '================================',
    bold: 0,
    align: 1,
    format: 0,
  });

  // Pesan Footer
  if (storeProfile.footerNote) {
    entries.push({
      type: 'text',
      content: storeProfile.footerNote,
      bold: 0,
      align: 1,
      format: 0,
    });
  }

  entries.push({
    type: 'text',
    content: '*** TERIMA KASIH ***',
    bold: 1,
    align: 1,
    format: 0,
  });

  // Extra line feed
  entries.push({
    type: 'text',
    content: '\n\n',
    bold: 0,
    align: 1,
    format: 0,
  });

  return { entries };
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

/**
 * Send receipt directly to Thermer app on iOS (via deep link schema with 'entries' JSON)
 */
export function printViaThermer(
  transaction: Transaction,
  storeProfile: StoreProfile
): boolean {
  const thermerJson = generateThermerJson(transaction, storeProfile);
  const jsonString = JSON.stringify(thermerJson);
  const encodedJson = encodeURIComponent(jsonString);

  // Thermer expects JSON payload with { "entries": [...] } in 'data' parameter
  const thermerUrl = `thermer://print?data=${encodedJson}`;

  try {
    // Trigger deep link navigation directly
    window.location.href = thermerUrl;
    return true;
  } catch (err) {
    console.error('Error triggering Thermer print:', err);
    return false;
  }
}
