import { Product } from '../types';
import { searchProducts } from './storageService';

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

export interface VoiceAiParseResult {
  success: boolean;
  rawTranscript: string;
  summary: string;
  items: VoiceAiItem[];
  payment?: VoiceAiPayment;
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
export const playMagicChime = (type: 'start' | 'success' | 'error' = 'success'): void => {
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

  // Model Gemini yang dicoba (prioritaskan flash-lite dan 3.1-flash-lite yang stabil dan cepat)
  const models = [
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
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
      // Coba model berikutnya jika 404
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

// Fallback pencocokan lokal jika tanpa API key atau offline
const parseTranscriptLocally = (transcript: string, products: Product[]): VoiceAiParseResult => {
  const lower = transcript.toLowerCase();

  // Split ucapan menjadi per item (kata sambung umum: 'dan', 'sama', 'terus', 'lalu', 'tambah', ',', '.')
  const segments = lower
    .split(/,|\.|\bdan\b|\bsama\b|\bterus\b|\blalu\b|\btambah\b|\bjuga\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  const items: VoiceAiItem[] = [];

  // Parse angka kata informal bahasa Indonesia
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
    // 1. Ekstrak harga khusus jika kasir menyebutkan harga untuk barang ini (misal "harganya 50 ribu", "harga rp50rb", "gocap")
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

    // 2. Ekstrak kuantitas
    let qty = 1;
    const digitMatch = seg.match(/(\d+)\s*(pcs|biji|batang|lonjor|sak|zak|rol|roll|meter|lembar|kaleng|buah|set)?/i);
    if (digitMatch) {
      qty = parseInt(digitMatch[1], 10) || 1;
    } else {
      // Cek kata angka
      for (const [word, num] of Object.entries(numberWords)) {
        const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
        if (wordRegex.test(seg)) {
          qty = num;
          break;
        }
      }
    }

    // 3. Bersihkan segmen dari kuantitas, satuan, kata harga, dan simbol agar murni nama barang
    const cleanedQuery = seg
      .replace(/\b(masukin|masukkan|tambah|ambil|beli|minta|tolong|ada|biji|buah|batang|lonjor|sak|rol|meter|lembar|pcs|harganya|harga|rp|satuan)\b/gi, '')
      .replace(/\b(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|\d+)\b/gi, '')
      .replace(/[^\w\s/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanedQuery) continue;

    // 4. Cari produk di katalog menggunakan multi-token search
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
      // Produk baru jika benar-benar tidak cocok
      items.push({
        name: cleanedQuery.charAt(0).toUpperCase() + cleanedQuery.slice(1),
        price: explicitPrice > 0 ? explicitPrice : 0,
        qty: qty,
        unit: 'Pcs',
        isNew: true,
      });
    }
  }

  // 5. Cek pembayaran global dalam ucapan lokal (misal: 'bayar 50 ribu', 'gocap', 'ceban')
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
    summary: `${items.length} barang diidentifikasi (Mode Offline)`,
    items,
    payment: cashAmount ? { cashAmount, paymentMethod: 'cash' } : undefined,
    isOfflineFallback: true,
  };
};

// Pemroses AI utama: Mengirim transkrip suara + katalog produk toko ke Gemini API
export const processVoiceTranscriptWithGemini = async (
  transcript: string,
  products: Product[]
): Promise<VoiceAiParseResult> => {
  const apiKey = getGeminiApiKey();

  if (!transcript || !transcript.trim()) {
    return {
      success: false,
      rawTranscript: transcript,
      summary: 'Tidak ada suara yang terdeteksi',
      items: [],
      error: 'Suara tidak terdeteksi. Silakan coba bicara lagi.',
    };
  }

  // Jika tidak ada API key, gunakan local matching engine
  if (!apiKey) {
    const localResult = parseTranscriptLocally(transcript, products);
    localResult.error = 'API Key Gemini belum disetel. Hasil menggunakan pencocokan lokal.';
    return localResult;
  }

  // Ringkas katalog produk toko untuk efisiensi token & kecepatan inferensi
  const catalogSummary = products.map((p) => ({
    id: p.id,
    name: p.name,
    aliases: p.aliases || [],
    price: p.price,
    unit: p.unit || 'Pcs',
    category: p.category || '',
  }));

  const systemInstruction = `Kamu adalah asisten kasir pintar untuk toko teknik & elektronik "Mega Tehnik Elektronik".
Tugasmu adalah menganalisis ucapan kasir/pelanggan bahasa Indonesia (termasuk bahasa percakapan sehari-hari, slang daerah, atau istilah toko teknik), lalu mengekstrak barang yang ingin dibeli, jumlahnya, harganya, dan info pembayaran.

ATURAN KRUSIAL PENCOCOKAN PRODUK & HARGA:
1. Pahami Nama Barang dengan Fleksibel & Cerdas:
   - Urutan kata bisa terbalik atau berantakan (contoh: "bearing dinamo" atau "dinamo bearing" -> HARUS dicocokkan ke "Dinamo/Mesin Kipas Bearing").
   - Singkatan dan istilah umum toko teknik (contoh: "pralon" = "pipa paralon/PVC", "onda" = "kran onda", "wd" = "mata gerinda potong wd").
   - Selalu utamakan mencocokkan ke produk yang sudah ada di katalog toko jika kata kuncinya mirip/relevan.
   - JANGAN membuat produk baru jika di katalog sudah ada barang yang serupa!

2. Memisahkan Nama Barang dari Kata Harga / Nominal:
   - Jika kasir menyebut harga (contoh: "bearing dinamo harganya 50 ribu", "kuas cat harga 15rb", "pipa rp30.000"):
     * PISAHKAN nama barang dari harga!
     * JANGAN PERNAH memasukkan kata "harga", "harganya", "rp", atau angka nominal uang ke dalam nama barang!
     * Masukkan nominalnya ke properti 'price' (contoh: 50000, 15000, 30000).

3. Aturan Harga Barang:
   - Jika barang COCOK dengan katalog:
     * Jika kasir menyebut harga (misal nego / promo): gunakan harga yang diucapkan kasir di 'price'.
     * Jika kasir TIDAK menyebut harga: gunakan harga resmi dari katalog produk.
     * Gunakan 'matchedProductId' dari katalog, gunakan nama resmi dari katalog, dan set 'isNew: false'.
   - Jika barang BENAR-BENAR TIDAK ADA di katalog toko:
     * Set 'isNew: true', 'matchedProductId': null.
     * Jika kasir menyebut harga: isi 'price' dengan nominal tersebut.
     * Jika kasir tidak menyebut harga: isi 'price': 0.

4. Satuan Khusus Toko Teknik:
   - "dim" / "in" / "inci" = ukuran pipa atau kran (contoh: pipa 1/2 dim = Pipa 1/2 Inch).
   - "batang" / "lonjor" = Batang (pipa/besi).
   - "sak" / "zak" = Sak (semen).
   - "rol" / "roll" = Rol (kabel, selang, talang).
   - "biji" / "buah" / "pcs" = Pcs (baut, mur, bearing, fitting).
   - "dus" / "box" = Box.
   - "kaleng" / "galon" = Kaleng.
   - "meter" = Meter.

5. Slang Uang Indonesia:
   - "seceng" = 1000, "goceng" = 5000, "ceban" = 10000, "noban" = 20000, "gocap" = 50000, "cepek" = 100000, "setengah juta" = 500000, "sejuta" = 1000000.

WAJIB MENGEMBALIKAN HANYA JSON MURNI SESUAI SCHEMA:
{
  "summary": "Ringkasan singkat, misal: '1 barang terdeteksi'",
  "items": [
    {
      "matchedProductId": "string ID katalog atau null",
      "name": "nama resmi barang (bersih tanpa kata 'harga')",
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

Katalog Produk Toko:
${JSON.stringify(catalogSummary)}`;

  const prompt = `Ucapan Kasir:
"${transcript}"`;

  // Model Gemini yang dicoba (prioritaskan flash-lite dan 3.1-flash-lite yang stabil dan cepat)
  const models = [
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
  ];
  let lastError = '';

  for (const model of models) {
    let attempt = 0;
    while (attempt < 2) {
      attempt++;
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          lastError = `Status ${response.status}: ${errorText}`;
          if ((response.status === 503 || response.status === 429) && attempt < 2) {
            await new Promise((r) => setTimeout(r, 700));
            continue;
          }
          break;
        }

        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const textPart = parts.find((p: any) => typeof p.text === 'string' && p.text.trim()) || parts[0];
        let rawText = textPart?.text || '';

        if (!rawText) {
          throw new Error('Jawaban AI kosong');
        }

        // Bersihkan blok markdown ```json jika ada
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

      return {
        success: items.length > 0,
        rawTranscript: transcript,
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
      } catch (err: any) {
        lastError = err.message || String(err);
      }
    }
  }

  // Jika semua model gagal (misal kuota habis atau offline), jalankan fallback lokal
  console.warn('Gemini API call failed, falling back to local voice parser:', lastError);
  const fallback = parseTranscriptLocally(transcript, products);
  fallback.error = `AI Cloud tidak merespons (${lastError}). Menggunakan pencocokan cerdas lokal.`;
  return fallback;
};
