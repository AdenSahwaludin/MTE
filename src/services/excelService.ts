import * as XLSX from 'xlsx';
import { Product, Transaction } from '../types';
import { addOrUpdateProduct, getProducts } from './storageService';

/**
 * Service untuk Import & Export data Excel (.xlsx / .xls / .csv)
 * Khusus POS Toko Teknik & Elektronik "Mega Tehnik Elektronik"
 */

export interface ImportProductResult {
  success: boolean;
  total: number;
  added: number;
  updated: number;
  message: string;
  errors: string[];
}

/**
 * Normalisasi header kolom untuk fleksibilitas pembacaan file Excel
 */
const normalizeKey = (key: string): string => {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
};

/**
 * Parse harga dari berbagai format (Rp 50.000, 50,000, 50000, "50.000")
 */
const parsePrice = (rawVal: any): number => {
  if (typeof rawVal === 'number') {
    return isNaN(rawVal) ? 0 : Math.max(0, Math.round(rawVal));
  }
  if (!rawVal) return 0;

  const str = String(rawVal)
    .replace(/[^\d.,]/g, '')
    .trim();

  // Jika format rupiah Indonesia dengan titik ribuan (misal 50.000 atau 1.500.000)
  if (str.includes('.') && !str.includes(',')) {
    const parts = str.split('.');
    // Jika bagian setelah titik panjangnya 3 (misal .000), ini pemisah ribuan
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      const clean = str.replace(/\./g, '');
      const num = parseInt(clean, 10);
      return isNaN(num) ? 0 : num;
    }
  }

  // Jika format dengan koma ribuan (misal 50,000)
  if (str.includes(',') && !str.includes('.')) {
    const clean = str.replace(/,/g, '');
    const num = parseInt(clean, 10);
    return isNaN(num) ? 0 : num;
  }

  // Standar parseFloat
  const clean = str.replace(/,/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.max(0, Math.round(num));
};

/**
 * Parse alias / kata kunci AI (pisahkan berdasarkan koma atau titik koma)
 */
const parseAliases = (rawVal: any): string[] => {
  if (Array.isArray(rawVal)) {
    return rawVal.map((v) => String(v).trim()).filter(Boolean);
  }
  if (!rawVal) return [];

  return String(rawVal)
    .split(/[,;\n|]/)
    .map((s) => s.trim())
    .filter(Boolean);
};

/**
 * Ekspor seluruh produk ke file Excel (.xlsx) dengan styling lebar kolom rapi
 */
export const exportProductsToExcel = (products: Product[]): void => {
  const data = products.map((p, idx) => ({
    No: idx + 1,
    'Kode Produk': p.id || '',
    'Nama Produk': p.name || '',
    Kategori: p.category || 'Umum',
    Satuan: p.unit || 'Pcs',
    'Harga Jual (Rp)': p.price || 0,
    'Kata Kunci AI / Alias': (p.aliases || []).join(', '),
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Atur lebar kolom agar tidak terpotong saat dibuka di Excel
  worksheet['!cols'] = [
    { wch: 6 },  // No
    { wch: 18 }, // Kode Produk
    { wch: 38 }, // Nama Produk
    { wch: 18 }, // Kategori
    { wch: 12 }, // Satuan
    { wch: 18 }, // Harga Jual
    { wch: 36 }, // Kata Kunci AI
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Produk');

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `Data_Produk_MegaTeknik_${dateStr}.xlsx`;

  XLSX.writeFile(workbook, filename);
};

/**
 * Download Template Excel Kosong + Contoh Pengisian untuk Pengguna
 */
export const downloadProductExcelTemplate = (): void => {
  const sampleData = [
    {
      'Kode Produk': 'PRD-000001',
      'Nama Produk': 'Dinamo/Mesin Kipas Bearing',
      Kategori: 'Kipas',
      Satuan: 'Pcs',
      'Harga Jual (Rp)': 80000,
      'Kata Kunci AI / Alias': 'bearing kipas, laher dinamo, dinamo kipas',
    },
    {
      'Kode Produk': 'PRD-000002',
      'Nama Produk': 'Pipa PVC 1/2 Dim Rucika D',
      Kategori: 'Pipa',
      Satuan: 'Batang',
      'Harga Jual (Rp)': 28000,
      'Kata Kunci AI / Alias': 'pralon rucika, pipa paralon, rucika setengah dim',
    },
    {
      'Kode Produk': 'PRD-000003',
      'Nama Produk': 'Kran Air Onda 1/2 Inch A 801',
      Kategori: 'Sanitari',
      Satuan: 'Pcs',
      'Harga Jual (Rp)': 35000,
      'Kata Kunci AI / Alias': 'kran onda, keran onda, keran air',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  worksheet['!cols'] = [
    { wch: 18 },
    { wch: 38 },
    { wch: 18 },
    { wch: 12 },
    { wch: 18 },
    { wch: 42 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Produk');

  XLSX.writeFile(workbook, 'Template_Import_Produk_MegaTeknik.xlsx');
};

/**
 * Import file Excel (.xlsx, .xls, .csv) ke Database Produk
 */
export const importProductsFromExcel = async (file: File): Promise<ImportProductResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          return resolve({
            success: false,
            total: 0,
            added: 0,
            updated: 0,
            message: 'File kosong atau tidak dapat dibaca',
            errors: ['File kosong'],
          });
        }

        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          return resolve({
            success: false,
            total: 0,
            added: 0,
            updated: 0,
            message: 'File Excel tidak memiliki lembar kerja (worksheet)',
            errors: ['Lembar kerja kosong'],
          });
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rows || rows.length === 0) {
          return resolve({
            success: false,
            total: 0,
            added: 0,
            updated: 0,
            message: 'Tidak ada data produk yang ditemukan di dalam file Excel',
            errors: ['Tabel kosong'],
          });
        }

        let addedCount = 0;
        let updatedCount = 0;
        const errors: string[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNumber = i + 2; // Mengingat baris 1 adalah header di Excel

          // Identifikasi kolom secara fleksibel
          let rawId = '';
          let rawName = '';
          let rawCategory = 'Umum';
          let rawUnit = 'Pcs';
          let rawPrice = 0;
          let rawAliases: string[] = [];

          for (const key of Object.keys(row)) {
            const val = row[key];
            const normKey = normalizeKey(key);

            // Kolom Nama Produk
            if (
              normKey.includes('nama') ||
              normKey.includes('name') ||
              normKey.includes('produk') ||
              normKey.includes('barang') ||
              normKey.includes('item')
            ) {
              if (!normKey.includes('kode') && !normKey.includes('id') && !rawName) {
                rawName = String(val).trim();
              }
            }

            // Kolom ID / Kode Produk
            if (
              normKey.includes('kode') ||
              normKey.includes('id') ||
              normKey.includes('sku') ||
              normKey.includes('barcode')
            ) {
              if (!rawId) {
                rawId = String(val).trim();
              }
            }

            // Kolom Kategori
            if (normKey.includes('kategori') || normKey.includes('category') || normKey.includes('jenis')) {
              rawCategory = String(val).trim() || 'Umum';
            }

            // Kolom Satuan
            if (normKey.includes('satuan') || normKey.includes('unit') || normKey.includes('uom')) {
              rawUnit = String(val).trim() || 'Pcs';
            }

            // Kolom Harga
            if (normKey.includes('harga') || normKey.includes('price') || normKey.includes('nominal')) {
              rawPrice = parsePrice(val);
            }

            // Kolom Alias / Kata Kunci AI
            if (
              normKey.includes('alias') ||
              normKey.includes('katakunci') ||
              normKey.includes('keyword') ||
              normKey.includes('kamus')
            ) {
              rawAliases = parseAliases(val);
            }
          }

          // Validasi nama produk wajib ada
          if (!rawName) {
            errors.push(`Baris ${rowNumber}: Nama produk tidak boleh kosong`);
            continue;
          }

          try {
            const { isNew } = addOrUpdateProduct(
              rawName,
              rawPrice,
              rawAliases,
              rawUnit,
              rawCategory,
              rawId ? rawId : undefined
            );

            if (isNew) {
              addedCount++;
            } else {
              updatedCount++;
            }
          } catch (err: any) {
            errors.push(`Baris ${rowNumber} ("${rawName}"): ${err.message || 'Gagal menyimpan'}`);
          }
        }

        const totalSuccess = addedCount + updatedCount;
        resolve({
          success: totalSuccess > 0,
          total: rows.length,
          added: addedCount,
          updated: updatedCount,
          message:
            totalSuccess > 0
              ? `Berhasil mengimpor ${totalSuccess} produk (${addedCount} baru, ${updatedCount} diperbarui)`
              : 'Gagal mengimpor produk dari file Excel',
          errors,
        });
      } catch (err: any) {
        resolve({
          success: false,
          total: 0,
          added: 0,
          updated: 0,
          message: `Gagal membaca file Excel: ${err.message || 'Format tidak valid'}`,
          errors: [err.message || 'Format error'],
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        total: 0,
        added: 0,
        updated: 0,
        message: 'Gagal membaca file dari perangkat',
        errors: ['File reader error'],
      });
    };

    reader.readAsArrayBuffer(file);
  });
};

/**
 * Ekspor Riwayat Transaksi Penjualan ke Excel
 */
export const exportTransactionsToExcel = (transactions: Transaction[]): void => {
  const data = transactions.map((t, idx) => ({
    No: idx + 1,
    'No. Struk': t.invoiceNo,
    Tanggal: new Date(t.date).toLocaleString('id-ID'),
    Pelanggan: t.customerName || 'Umum',
    'Metode Pembayaran': (t.paymentMethod || 'cash').toUpperCase(),
    'Total Belanja (Rp)': t.totalAmount,
    'Uang Diterima (Rp)': t.cashAmount || t.totalAmount,
    'Kembalian (Rp)': t.changeAmount || 0,
    'Jumlah Item': t.items.length,
    'Rincian Barang': t.items
      .map((it) => `${it.name} (${it.qty} ${it.unit || 'Pcs'} @ Rp ${it.price.toLocaleString('id-ID')})`)
      .join('; '),
    Kasir: t.cashierName || 'Kasir',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 22 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 12 },
    { wch: 50 },
    { wch: 16 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Riwayat Transaksi');

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `Riwayat_Transaksi_MegaTeknik_${dateStr}.xlsx`;

  XLSX.writeFile(workbook, filename);
};
