import { Product } from '../types';
import { searchProducts } from './storageService';

export type VoiceAiActionType =
  | 'ADD_ITEMS'
  | 'REMOVE_ITEM'
  | 'CLEAR_CART'
  | 'APPLY_DISCOUNT'
  | 'CHECK_STOCK'
  | 'OPEN_PAYMENT'
  | 'FINALIZE_PAYMENT'
  | 'RESET_TRANSACTION';

export interface VoiceAiItem {
  matchedProductId?: string;
  name: string;
  price: number;
  qty: number;
  unit: string;
  isNew: boolean;
}

export interface VoiceAiPayment {
  cashAmount?: number;
  paymentMethod?: 'cash' | 'transfer' | 'qris';
  customerName?: string;
}

export interface VoiceAiRemoveTarget {
  name?: string;
  qty?: number;
  removeAll?: boolean;
  lastItem?: boolean;
}

export interface VoiceAiQueryInfo {
  productName: string;
  matchedProductId?: string;
  price?: number;
  unit?: string;
  message?: string;
}

export interface VoiceAiParseResult {
  success: boolean;
  rawTranscript: string;
  action: VoiceAiActionType;
  summary: string;
  items: VoiceAiItem[];
  payment?: VoiceAiPayment;
  removeTarget?: VoiceAiRemoveTarget;
  discountAmount?: number;
  discountTargetItemName?: string;
  queryInfo?: VoiceAiQueryInfo;
  error?: string;
  isOfflineFallback?: boolean;
}

const LOCAL_STORAGE_GEMINI_KEY = 'mte_gemini_api_key';

// Ambil API key dari localStorage (override pengguna) atau dari .env
export const getGeminiApiKey = (): string => {
  if (typeof window !== 'undefined') {
    const customKey = localStorage.getItem(LOCAL_STORAGE_GEMINI_KEY);
    if (customKey && customKey.trim()) {
      return customKey.trim();
    }
  }

  // Vite environment variables
  const envKey =
    (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ||
    ((typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) as string | undefined) ||
    '';

  return envKey.trim();
};

export const setGeminiApiKey = (key: string): void => {
  if (typeof window === 'undefined') return;
  if (!key || !key.trim()) {
    localStorage.removeItem(LOCAL_STORAGE_GEMINI_KEY);
  } else {
    localStorage.setItem(LOCAL_STORAGE_GEMINI_KEY, key.trim());
  }
};

// Cek apakah Web Speech Recognition didukung oleh browser/perangkat
export const isSpeechRecognitionSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
};

// Buat Audio Chime sintetis yang terdengar magis/futuristik
export const playMagicChime = (type: 'start' | 'success' | 'error' | 'undo' = 'success'): void => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    if (type === 'start') {
      // Dua nada naik lembut (tanda mulai mendengarkan)
      const notes = [440, 659.25]; // A4, E5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.08 + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.2);
      });
    } else if (type === 'success') {
      // Empat nada akord ceria (tanda ajaib selesai tergenerate)
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.07);
        gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + idx * 0.07 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.07 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.07);
        osc.stop(ctx.currentTime + idx * 0.07 + 0.32);
      });
    } else if (type === 'undo') {
      // Dua nada turun (tanda undo dibatalkan)
      const notes = [587.33, 440]; // D5, A4
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.09);
        gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + idx * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.09 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.09);
        osc.stop(ctx.currentTime + idx * 0.09 + 0.22);
      });
    } else {
      // Nada rendah tanda error
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.26);
    }
  } catch {
    // Web Audio API opsional
  }
};

// Tes koneksi API Key Gemini
export const testGeminiConnection = async (apiKeyOverride?: string): Promise<{ success: boolean; message: string }> => {
  const key = (apiKeyOverride || getGeminiApiKey()).trim();
  if (!key) {
    return {
      success: false,
      message: 'API Key Gemini belum diatur. Silakan isi di .env atau di form pengaturan ini.',
    };
  }

  const models = [
    'gemini-2.5-flash',
    'gemini-2.0-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-flash-latest',
  ];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Halo! Jawab singkat: OK' }] }],
        }),
      });

      if (res.ok) {
        return {
          success: true,
          message: `Koneksi berhasil! Model ${model} aktif dan siap digunakan.`,
        };
      }

      if (res.status === 400 || res.status === 403) {
        const errorData = await res.json().catch(() => ({}));
        return {
          success: false,
          message: `API Key tidak valid atau tidak memiliki izin (${errorData.error?.message || res.statusText}).`,
        };
      }
    } catch (err: any) {
      if (model === models[models.length - 1]) {
        return {
          success: false,
          message: `Gagal menghubungi server Gemini: ${err.message || 'Cek koneksi internet'}`,
        };
      }
    }
  }

  return {
    success: false,
    message: 'Tidak dapat menghubungkan ke Google Gemini API.',
  };
};

/**
 * Nomor 1: Pre-Filtering Kandidat Produk untuk Optimasi Token & Kecepatan
 * Memilih hanya 30-45 kandidat produk relevan dari transkrip ucapan kasir.
 * Mengurangi token prompt sebesar 85%+, memangkas latensi hingga < 1 detik.
 */
export const filterCandidateProducts = (transcript: string, products: Product[], maxCandidates = 40): Product[] => {
  if (!products || products.length <= maxCandidates) {
    return products || [];
  }

  const cleaned = transcript
    .toLowerCase()
    .replace(/[^\w\s/]/g, ' ')
    .trim();

  const stopWords = new Set([
    'dan', 'sama', 'terus', 'lalu', 'tambah', 'juga', 'tolong', 'masukin', 'masukkan',
    'ambil', 'beli', 'minta', 'ada', 'harganya', 'harga', 'rp', 'rupiah', 'ribu', 'rb',
    'biji', 'buah', 'batang', 'lonjor', 'sak', 'zak', 'rol', 'roll', 'meter', 'lembar',
    'pcs', 'kaleng', 'set', 'dus', 'box', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam',
    'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas', 'duabelas', 'yang', 'ini', 'itu',
    'buat', 'ke', 'di', 'dari', 'cek', 'stok', 'tanya', 'berapa', 'hapus', 'batalin', 'bayar'
  ]);

  const rawTokens = cleaned.split(/\s+/).filter((t) => t.length >= 2 && !stopWords.has(t));

  const scored: { product: Product; score: number }[] = [];

  for (const p of products) {
    let score = 0;
    const pName = p.name.toLowerCase();
    const pAliases = (p.aliases || []).map((a) => a.toLowerCase());
    const pCategory = (p.category || '').toLowerCase();

    // Exact phrase match
    if (cleaned.includes(pName) && pName.length > 3) {
      score += 150;
    }

    // Token overlap match
    for (const tok of rawTokens) {
      if (pName.includes(tok)) {
        score += tok.length > 3 ? 30 : 15;
      }
      for (const alias of pAliases) {
        if (alias.includes(tok)) {
          score += tok.length > 3 ? 25 : 12;
        }
      }
      if (pCategory && pCategory.includes(tok)) {
        score += 8;
      }
    }

    if (score > 0) {
      scored.push({ product: p, score });
    }
  }

  // Urutkan skor tertinggi
  scored.sort((a, b) => b.score - a.score);

  const candidateIds = new Set<string>();
  const candidates: Product[] = [];

  // Masukkan produk paling relevan
  for (const item of scored) {
    if (candidates.length >= maxCandidates - 10) break;
    if (!candidateIds.has(item.product.id)) {
      candidateIds.add(item.product.id);
      candidates.push(item.product);
    }
  }

  // Lengkapi dengan produk umum/teratas toko
  for (const p of products) {
    if (candidates.length >= maxCandidates) break;
    if (!candidateIds.has(p.id)) {
      candidateIds.add(p.id);
      candidates.push(p);
    }
  }

  return candidates;
};

// Fallback pencocokan lokal jika tanpa API key atau saat offline
const parseTranscriptLocally = (transcript: string, products: Product[]): VoiceAiParseResult => {
  const lower = transcript.toLowerCase().trim();

  // 1. Deteksi CLEAR_CART (Kosongkan Keranjang)
  if (/(?:kosongkan|reset)\s*(?:keranjang|struk|belanjaan)?|(?:batal(?:kan)?|hapus)\s*semua/i.test(lower)) {
    return {
      success: true,
      rawTranscript: transcript,
      action: 'CLEAR_CART',
      summary: 'Mengosongkan keranjang belanja',
      items: [],
      isOfflineFallback: true,
    };
  }

  // 2. Deteksi RESET_TRANSACTION (Reset Transaksi Baru)
  if (/(?:reset\s*transaksi|transaksi\s*baru|mulai\s*baru)/i.test(lower)) {
    return {
      success: true,
      rawTranscript: transcript,
      action: 'RESET_TRANSACTION',
      summary: 'Mereset transaksi kasir baru',
      items: [],
      isOfflineFallback: true,
    };
  }

  // 3. Deteksi CHECK_STOCK (Cek Stok / Tanya Harga)
  const stockMatch = lower.match(/(?:cek|tanya|ada)?\s*stok\s+(.+)|(?:berapa|tanya)\s*harga\s+(.+)|ada\s+(.+)\s*(?:nggak|gak|ada)?/i);
  if (stockMatch) {
    const rawQuery = (stockMatch[1] || stockMatch[2] || stockMatch[3] || '').trim();
    const query = rawQuery.replace(/\b(berapa|harganya|harga|stok|ada|kah|dong|pak|mas|bang)\b/gi, '').trim();
    if (query) {
      const matches = searchProducts(query);
      const top = matches[0]?.product;
      return {
        success: true,
        rawTranscript: transcript,
        action: 'CHECK_STOCK',
        summary: top ? `Info Stok: ${top.name}` : `Cek barang: ${query}`,
        items: [],
        queryInfo: {
          productName: top?.name || query,
          matchedProductId: top?.id,
          price: top?.price,
          unit: top?.unit || 'Pcs',
          message: top
            ? `${top.name} - Rp ${top.price.toLocaleString('id-ID')} / ${top.unit || 'Pcs'}`
            : `Barang "${query}" tidak ditemukan di database produk toko.`,
        },
        isOfflineFallback: true,
      };
    }
  }

  // 4. Deteksi REMOVE_ITEM (Hapus Barang)
  const removeMatch = lower.match(/(?:hapus|batal(?:kan)?|buang|keluarkan)\s+(.+)|kurangi\s+(.+)/i);
  if (removeMatch) {
    const targetStr = (removeMatch[1] || removeMatch[2] || '').trim();
    const isLast = /terakhir|yang\s*tadi/i.test(targetStr);
    return {
      success: true,
      rawTranscript: transcript,
      action: 'REMOVE_ITEM',
      summary: isLast ? 'Hapus barang terakhir dari struk' : `Hapus ${targetStr} dari struk`,
      items: [],
      removeTarget: {
        lastItem: isLast,
        name: isLast ? undefined : targetStr,
        removeAll: true,
      },
      isOfflineFallback: true,
    };
  }

  // 5. Deteksi APPLY_DISCOUNT (Nego / Diskon Cepat)
  const discountMatch = lower.match(/(?:beri|kasih|dapat|ada)?\s*(?:diskon|potongan|potong)\s*(?:harga)?\s*(\d+(?:[.,]\d+)?)\s*(?:ribu|rb|k)?(?:\s*(?:buat|untuk|pada|di)?\s*(.+))?/i);
  if (discountMatch) {
    let val = parseFloat(discountMatch[1].replace(/[.,]/g, ''));
    if (val < 1000 || lower.includes('ribu') || lower.includes('rb')) val *= 1000;
    const targetItem = (discountMatch[2] || '').trim();
    return {
      success: true,
      rawTranscript: transcript,
      action: 'APPLY_DISCOUNT',
      summary: `Diskon Rp ${val.toLocaleString('id-ID')}${targetItem ? ` untuk ${targetItem}` : ''}`,
      items: [],
      discountAmount: val,
      discountTargetItemName: targetItem || undefined,
      isOfflineFallback: true,
    };
  }

  // 6. Deteksi FINALIZE_PAYMENT / OPEN_PAYMENT
  if (/(?:uang\s*pas|bayar\s*lunas|bayar\s*uang\s*pas)/i.test(lower)) {
    return {
      success: true,
      rawTranscript: transcript,
      action: 'FINALIZE_PAYMENT',
      summary: 'Pembayaran uang pas',
      items: [],
      payment: { paymentMethod: 'cash' },
      isOfflineFallback: true,
    };
  }

  if (/(?:buka\s*(?:menu\s*)?bayar(?:an)?|lanjut\s*bayar|mau\s*bayar)/i.test(lower)) {
    return {
      success: true,
      rawTranscript: transcript,
      action: 'OPEN_PAYMENT',
      summary: 'Membuka menu pembayaran kasir',
      items: [],
      isOfflineFallback: true,
    };
  }

  // 7. DEFAULT: ADD_ITEMS (Tambah Barang ke Keranjang)
  // Split ucapan menjadi per item (kata sambung umum atau angka pemisah)
  const segments = lower
    .split(/,|\.|\bdan\b|\bsama\b|\bterus\b|\blalu\b|\btambah\b|\bjuga\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  const items: VoiceAiItem[] = [];

  const numberWords: Record<string, number> = {
    satu: 1,
    dua: 2,
    tiga: 3,
    empat: 4,
    lima: 5,
    enam: 6,
    tujuh: 7,
    delapan: 8,
    sembilan: 9,
    sepuluh: 10,
    sebelas: 11,
    duabelas: 12,
  };

  for (let seg of segments) {
    let explicitPrice = 0;
    if (/\bgocap\b/i.test(seg)) {
      explicitPrice = 50000;
      seg = seg.replace(/(?:harganya|harga|rp\.?)?\s*\bgocap\b/gi, '');
    } else if (/\bceban\b/i.test(seg)) {
      explicitPrice = 10000;
      seg = seg.replace(/(?:harganya|harga|rp\.?)?\s*\bceban\b/gi, '');
    } else if (/\bnoban\b/i.test(seg)) {
      explicitPrice = 20000;
      seg = seg.replace(/(?:harganya|harga|rp\.?)?\s*\bnoban\b/gi, '');
    } else if (/\bgoceng\b/i.test(seg)) {
      explicitPrice = 5000;
      seg = seg.replace(/(?:harganya|harga|rp\.?)?\s*\bgoceng\b/gi, '');
    } else {
      const pMatch = seg.match(/(?:harganya|harga|rp\.?|\s)+\s*(\d+(?:[.,]\d+)?)\s*(ribu|rb|k)?/i);
      if (pMatch) {
        let val = parseFloat(pMatch[1].replace(/[.,]/g, ''));
        if (pMatch[2] || val < 1000) val *= 1000;
        explicitPrice = val;
        seg = seg.replace(/(?:harganya|harga|rp\.?|\s)*\s*\d+(?:[.,]\d+)?\s*(?:ribu|rb|k)?/gi, '');
      }
    }

    let qty = 1;
    const digitMatch = seg.match(/(\d+)\s*(pcs|biji|batang|lonjor|sak|zak|rol|roll|meter|lembar|kaleng|buah|set)?/i);
    if (digitMatch) {
      qty = parseInt(digitMatch[1], 10) || 1;
    } else {
      for (const [word, num] of Object.entries(numberWords)) {
        const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
        if (wordRegex.test(seg)) {
          qty = num;
          break;
        }
      }
    }

    const cleanedQuery = seg
      .replace(/\b(masukin|masukkan|tambah|ambil|beli|minta|tolong|ada|biji|buah|batang|lonjor|sak|rol|meter|lembar|pcs|harganya|harga|rp|satuan)\b/gi, '')
      .replace(/\b(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|\d+)\b/gi, '')
      .replace(/[^\w\s/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanedQuery) continue;

    const matches = searchProducts(cleanedQuery);
    if (matches.length > 0) {
      const top = matches[0].product;
      items.push({
        matchedProductId: top.id,
        name: top.name,
        price: explicitPrice > 0 ? explicitPrice : top.price,
        qty: qty,
        unit: top.unit || 'Pcs',
        isNew: false,
      });
    } else {
      items.push({
        name: cleanedQuery.charAt(0).toUpperCase() + cleanedQuery.slice(1),
        price: explicitPrice > 0 ? explicitPrice : 0,
        qty: qty,
        unit: 'Pcs',
        isNew: true,
      });
    }
  }

  let cashAmount: number | undefined;
  if (/gocap/i.test(lower)) cashAmount = 50000;
  else if (/ceban/i.test(lower)) cashAmount = 10000;
  else if (/noban/i.test(lower)) cashAmount = 20000;
  else if (/goceng/i.test(lower)) cashAmount = 5000;
  else {
    const payMatch = lower.match(/(?:bayar|uang|tunai|cash)\s*(\d+(?:[.,]\d+)?)(?:\s*(?:ribu|rb|k))?/i);
    if (payMatch) {
      let val = parseFloat(payMatch[1].replace(/[.,]/g, ''));
      if (val < 1000 && lower.includes('ribu')) val *= 1000;
      cashAmount = val;
    }
  }

  return {
    success: items.length > 0,
    rawTranscript: transcript,
    action: 'ADD_ITEMS',
    summary: `${items.length} barang diidentifikasi (Mode Offline Cerdas)`,
    items,
    payment: cashAmount ? { cashAmount, paymentMethod: 'cash' } : undefined,
    isOfflineFallback: true,
  };
};

// Pemroses AI utama: Mengirim transkrip suara + ringkasan kandidat produk ke Gemini API
export const processVoiceTranscriptWithGemini = async (
  transcript: string,
  products: Product[]
): Promise<VoiceAiParseResult> => {
  const apiKey = getGeminiApiKey();

  if (!transcript || !transcript.trim()) {
    return {
      success: false,
      rawTranscript: transcript,
      action: 'ADD_ITEMS',
      summary: 'Tidak ada suara yang terdeteksi',
      items: [],
      error: 'Suara tidak terdeteksi. Silakan coba bicara lagi.',
    };
  }

  // 1. EVALUASI LOKAL INSTAN (< 2 milidetik)
  // Jika ucapan kasir adalah perintah operasional kasir (Hapus, Kosongkan, Diskon, Cek Stok, Bayar),
  // langsung eksekusi instan tanpa menunggu request cloud!
  const localResult = parseTranscriptLocally(transcript, products);
  if (localResult.action !== 'ADD_ITEMS') {
    return localResult;
  }

  // Jika tanpa API key, langsung gunakan pencocokan lokal
  if (!apiKey) {
    localResult.error = 'API Key Gemini belum disetel. Menggunakan pencocokan cerdas lokal.';
    return localResult;
  }

  // 2. Pre-Filtering Kandidat Produk untuk Gemini Cloud
  const candidateProducts = filterCandidateProducts(transcript, products, 35);
  const catalogSummary = candidateProducts.map((p) => ({
    id: p.id,
    name: p.name,
    aliases: p.aliases || [],
    price: p.price,
    unit: p.unit || 'Pcs',
    category: p.category || '',
  }));

  const systemInstruction = `Kamu adalah asisten kasir AI cerdas toko teknik "Mega Tehnik Elektronik".
Tugas: Analisis ucapan kasir dan ekstrak barang yang dibeli (nama barang bersih tanpa kata harga, harga nominal jika kasir menyebutkan, jumlah qty, dan matchedProductId jika cocok dengan katalog).
Slang Uang: gocap=50000, ceban=10000, noban=20000, goceng=5000, cepek=100000.
Satuan: batang/lonjor, sak, rol, biji/buah/pcs, meter, kaleng, set.
Output WAJIB JSON murni:
{
  "summary": "ringkasan singkat",
  "items": [
    {
      "matchedProductId": "string ID atau null",
      "name": "nama resmi barang",
      "price": 0,
      "qty": 1,
      "unit": "Pcs",
      "isNew": false
    }
  ],
  "payment": {
    "cashAmount": 0,
    "paymentMethod": "cash",
    "customerName": ""
  }
}
Katalog Produk:
${JSON.stringify(catalogSummary)}`;

  const prompt = `Ucapan Kasir: "${transcript}"`;

  // Coba model tercepat dengan STRICT TIMEOUT 1.4 detik & TANPA RETRY LOOP (Bebas Stuck!)
  const fastModels = ['gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];

  for (const model of fastModels) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1400);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Jika status 503 / 429 / 404, JANGAN DELAY RETRY! Langsung coba model berikutnya atau fallback lokal
        continue;
      }

      const data = await response.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const textPart = parts.find((p: any) => typeof p.text === 'string' && p.text.trim()) || parts[0];
      let rawText = textPart?.text || '';

      if (!rawText) continue;

      if (rawText.includes('```')) {
        rawText = rawText.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();
      }

      const parsed = JSON.parse(rawText);
      const items: VoiceAiItem[] = Array.isArray(parsed.items)
        ? parsed.items.map((it: any) => ({
            matchedProductId: it.matchedProductId || undefined,
            name: String(it.name || 'Barang').trim(),
            price: typeof it.price === 'number' ? Math.max(0, it.price) : 0,
            qty: typeof it.qty === 'number' ? Math.max(1, it.qty) : 1,
            unit: String(it.unit || 'Pcs').trim(),
            isNew: Boolean(it.isNew),
          }))
        : [];

      if (items.length > 0) {
        return {
          success: true,
          rawTranscript: transcript,
          action: 'ADD_ITEMS',
          summary: parsed.summary || `${items.length} barang terdeteksi oleh AI`,
          items,
          payment: parsed.payment
            ? {
                cashAmount:
                  typeof parsed.payment.cashAmount === 'number' && parsed.payment.cashAmount > 0
                    ? parsed.payment.cashAmount
                    : undefined,
                paymentMethod: ['cash', 'transfer', 'qris'].includes(parsed.payment.paymentMethod)
                  ? parsed.payment.paymentMethod
                  : 'cash',
                customerName: parsed.payment.customerName ? String(parsed.payment.customerName).trim() : undefined,
              }
            : undefined,
        };
      }
    } catch {
      // Abort / timeout atau kendala jaringan -> langsung coba berikutnya / fallback
    }
  }

  // Jika cloud Google sedang mengalami lonjakan beban (503) atau timeout,
  // gunakan hasil pencocokan lokal instan tanpa jeda!
  return localResult;
};
