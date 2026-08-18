import { Transaction, StoreProfile } from '../types';
import { formatRupiah, formatDateIndo } from '../utils/formatters';

/**
 * ESC/POS Constants for 58mm Thermal Printers (VSC MP-58M Pro, Panda, Eppos, Xprinter, etc.)
 */
const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  INIT: [ESC, 0x40],
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_ON: [GS, 0x21, 0x11],
  DOUBLE_HEIGHT: [GS, 0x21, 0x01],
  SIZE_NORMAL: [GS, 0x21, 0x00],
  FEED_3: [ESC, 0x64, 0x03],
  FEED_5: [ESC, 0x64, 0x05],
  CUT: [GS, 0x56, 0x01],
};

const LINE_WIDTH = 32;
const textEncoder = new TextEncoder();

function encodeText(text: string): number[] {
  return Array.from(textEncoder.encode(text));
}

function formatTwoColumns(left: string, right: string, width = LINE_WIDTH): string {
  const leftTrim = left.trim();
  const rightTrim = right.trim();
  const spaceNeeded = width - leftTrim.length - rightTrim.length;
  if (spaceNeeded > 0) {
    return leftTrim + ' '.repeat(spaceNeeded) + rightTrim;
  }
  return `${leftTrim} ${rightTrim}`;
}

function dashedLine(char = '-', width = LINE_WIDTH): string {
  return char.repeat(width);
}

/**
 * Build ESC/POS byte array for transaction
 */
export function buildReceiptBytes(
  transaction: Transaction,
  storeProfile: StoreProfile
): Uint8Array {
  const bytes: number[] = [];

  const add = (...cmds: number[][]) => {
    for (const cmd of cmds) {
      bytes.push(...cmd);
    }
  };

  const line = (text: string) => {
    bytes.push(...encodeText(text), 0x0a);
  };

  // 1. Initialize
  add(CMD.INIT);

  // 2. Header Toko (Center)
  add(CMD.ALIGN_CENTER, CMD.BOLD_ON);
  line(storeProfile.name.toUpperCase());
  add(CMD.BOLD_OFF);

  if (storeProfile.tagline) {
    line(storeProfile.tagline);
  }
  if (storeProfile.address) {
    line(storeProfile.address);
  }
  if (storeProfile.phone) {
    line(`Telp: ${storeProfile.phone}`);
  }

  // 3. Divider
  line(dashedLine('='));

  // 4. Metadata
  add(CMD.ALIGN_LEFT);
  line(`No: ${transaction.invoiceNo}`);
  if (storeProfile.showDateTime) {
    line(`Tgl: ${formatDateIndo(transaction.date)}`);
  }
  if (storeProfile.showCashierName && storeProfile.cashierName) {
    const cashierLine = `Kasir: ${storeProfile.cashierName}` + (transaction.customerName ? ` | Plg: ${transaction.customerName}` : '');
    line(cashierLine);
  } else if (transaction.customerName) {
    line(`Plg: ${transaction.customerName}`);
  }

  // 5. Divider
  line(dashedLine('-'));

  // 6. Items
  transaction.items.forEach((item) => {
    add(CMD.BOLD_ON);
    line(item.name);
    add(CMD.BOLD_OFF);

    const leftPart = ` ${item.qty} ${item.unit || 'pcs'} x ${formatRupiah(item.price)}`;
    const rightPart = formatRupiah(item.subtotal);
    line(formatTwoColumns(leftPart, rightPart));
  });

  // 7. Divider
  line(dashedLine('-'));

  // 8. Totals
  add(CMD.BOLD_ON);
  line(formatTwoColumns('TOTAL', formatRupiah(transaction.totalAmount)));
  add(CMD.BOLD_OFF);

  line(formatTwoColumns('TUNAI / BAYAR', formatRupiah(transaction.cashAmount)));
  add(CMD.BOLD_ON);
  line(formatTwoColumns('KEMBALIAN', formatRupiah(Math.max(0, transaction.changeAmount))));
  add(CMD.BOLD_OFF);

  if (transaction.notes) {
    line(dashedLine('-'));
    line(`Catatan: ${transaction.notes}`);
  }

  // 9. Footer
  line(dashedLine('='));
  add(CMD.ALIGN_CENTER);
  if (storeProfile.footerNote) {
    line(storeProfile.footerNote);
  }
  add(CMD.BOLD_ON);
  line('*** TERIMA KASIH ***');
  add(CMD.BOLD_OFF);

  // Feed and cut
  add(CMD.FEED_5);
  add(CMD.CUT);

  return new Uint8Array(bytes);
}

// Known Bluetooth service/characteristic UUIDs for thermal printers
const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS Printer Service
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Common Chinese POS BLE Service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip / ISSC BLE UART
  '0000ff00-0000-1000-8000-00805f9b34fb', // Custom FF00 Serial
  '0000fee7-0000-1000-8000-00805f9b34fb', // Custom FEE7 Serial
];

const PRINTER_CHAR_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '0000fee8-0000-1000-8000-00805f9b34fb',
];

interface PrinterConnection {
  device: any;
  server: any;
  characteristic: any;
}

let cachedConnection: PrinterConnection | null = null;

/**
 * Check if Web Bluetooth API is supported
 */
export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Connect to Bluetooth thermal printer
 */
export async function connectBluetoothPrinter(): Promise<PrinterConnection> {
  if (!isWebBluetoothSupported()) {
    throw new Error('Browser ini tidak mendukung Web Bluetooth. Buka di Google Chrome (Android/PC) dan pastikan Bluetooth aktif.');
  }

  // Reuse cached connection if still active
  if (cachedConnection?.server?.connected) {
    try {
      await cachedConnection.characteristic.writeValue(new Uint8Array([]));
      return cachedConnection;
    } catch {
      cachedConnection = null;
    }
  }

  // Request Bluetooth device pairing dialog
  const device = await (navigator as any).bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICE_UUIDS,
  });

  if (!device.gatt) {
    throw new Error('Bluetooth GATT tidak tersedia di perangkat ini');
  }

  const server = await device.gatt.connect();
  let characteristic: any = null;

  for (const serviceUuid of PRINTER_SERVICE_UUIDS) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      for (const charUuid of PRINTER_CHAR_UUIDS) {
        try {
          const char = await service.getCharacteristic(charUuid);
          if (char.properties.write || char.properties.writeWithoutResponse) {
            characteristic = char;
            break;
          }
        } catch {
          // continue
        }
      }
      if (characteristic) break;

      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          characteristic = char;
          break;
        }
      }
      if (characteristic) break;
    } catch {
      // continue
    }
  }

  // Fallback: search all available services
  if (!characteristic) {
    try {
      const services = await server.getPrimaryServices();
      for (const service of services) {
        const chars = await service.getCharacteristics();
        for (const char of chars) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            characteristic = char;
            break;
          }
        }
        if (characteristic) break;
      }
    } catch {
      // ignore
    }
  }

  if (!characteristic) {
    server.disconnect();
    throw new Error(
      'Gagal menemukan service write printer Bluetooth. Pastikan printer VSC MP-58M Pro menyala dan Bluetooth aktif.'
    );
  }

  cachedConnection = { device, server, characteristic };
  device.addEventListener('gattserverdisconnected', () => {
    cachedConnection = null;
  });

  return cachedConnection;
}

/**
 * Send byte data in safe chunk sizes to Bluetooth printer
 */
async function sendBytes(
  characteristic: any,
  data: Uint8Array
): Promise<void> {
  const CHUNK_SIZE = 64; // Safe chunk size for 58mm thermal printers
  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + CHUNK_SIZE);
    if (characteristic.properties.writeWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValueWithResponse(chunk);
    }
    if (offset + CHUNK_SIZE < data.length) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
}

/**
 * Print receipt directly to paired Bluetooth printer
 */
export async function printDirectBluetooth(
  transaction: Transaction,
  storeProfile: StoreProfile
): Promise<void> {
  const connection = await connectBluetoothPrinter();
  const receiptBytes = buildReceiptBytes(transaction, storeProfile);
  await sendBytes(connection.characteristic, receiptBytes);
}
