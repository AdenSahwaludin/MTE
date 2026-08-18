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
  // If too long, truncate or wrap
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
    // For Android Chrome, the Android Intent syntax is standard and most reliable
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
 * Send receipt directly to Thermer app on iOS (via deep link scheme / Web Share)
 */
export function printViaThermer(
  transaction: Transaction,
  storeProfile: StoreProfile
): boolean {
  const plainText = generateReceiptPlainText(transaction, storeProfile);
  const encodedText = encodeURIComponent(plainText);
  const base64Data = utf8ToBase64(plainText);

  // Thermer URL Schemes
  const thermerUrl = `thermer://print?data=${encodedText}`;
  const thermerSchemeUrl = `thermer:data:text/plain;base64,${base64Data}`;

  try {
    // Attempt deep link to Thermer app on iOS
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = thermerUrl;
    document.body.appendChild(iframe);

    setTimeout(() => {
      document.body.removeChild(iframe);
      // If still on page, try direct href navigation
      window.location.href = thermerUrl;
    }, 100);

    return true;
  } catch (err) {
    console.error('Error triggering Thermer print:', err);
    return false;
  }
}
