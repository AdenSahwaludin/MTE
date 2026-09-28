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

// Validasi format key Gemini (AIza...) agar pesan error jelas, bukan timeout misterius.
export const isPlausibleGeminiKey = (key: string): boolean => {
  const k = (key || '').trim();
  if (!k) return false;
  // Key Gemini asli diawali AIza, panjang ~39 char. Key "AQ.Ab8..." = bukan Gemini.
  if (/^AQ\./.test(k)) return false;
  if (/^AIza[0-9A-Za-z_\-]{20,}/.test(k)) return true;
  // Izinkan key lain tapi minimal panjang wajar agar tidak buang request
  return k.length >= 20;
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

// Model valid — disamakan antara test koneksi & pemrosesan.
// JANGAN pakai nama halusinasi seperti gemini-3.1-flash-lite.
export const GEMINI_PREFERRED_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
];

// Tes koneksi API Key Gemini
export const testGeminiConnection = async (apiKeyOverride?: string): Promise<{ success: boolean; message: string }> => {
  const key = (apiKeyOverride || getGeminiApiKey()).trim();
  if (!key) {
    return {
      success: false,
      message: 'API Key Gemini belum diatur. Silakan isi di .env atau di form pengaturan ini.',
    };
  }
  if (!isPlausibleGeminiKey(key)) {
    return {
      success: false,
      message: 'Format API Key ini bukan key Gemini (Gemini diawali "AIza..."). Key "AQ...." biasanya key layanan lain. Ganti dengan key dari Google AI Studio.',
    };
  }

  const models = GEMINI_PREFERRED_MODELS;

  let lastStatus = '';
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

      lastStatus = `${res.status} ${res.statusText}`;
      if (res.status === 400 || res.status === 403) {
        const errorData = await res.json().catch(() => ({}));
        return {
          success: false,
          message: `API Key tidak valid atau tidak memiliki izin (${errorData.error?.message || res.statusText}).`,
        };
      }
      // 404 = nama model salah -> coba model berikutnya, 429/503 -> coba berikutnya
      continue;
    } catch (err: any) {
      lastStatus = err?.message || 'network error';
      if (model === models[models.length - 1]) {
        return {
          success: false,
          message: `Gagal menghubungi server Gemini: ${lastStatus}. Cek koneksi internet.`,
        };
      }
    }
  }

  return {
    success: false,
    message: `Tidak dapat menghubungkan ke Google Gemini API (${lastStatus}). Coba lagi atau pakai Mode Offline Cerdas.`,
  };
};

/* ============================================================
 * Helpers parsing Bahasa Indonesia — inti perbaikan "oon"
 * ============================================================ */

const QTY_UNITS = [
  'pcs', 'biji', 'buah', 'batang', 'lonjor', 'sak', 'zak', 'rol', 'roll',
  'meter', 'mtr', 'lembar', 'lbr', 'kaleng', 'klg', 'set', 'pak', 'dus',
  'box', 'lusin', 'pasang', 'bungkus', 'botol', 'tube', 'tabung', 'keping',
];

const SLANG_PRICE: Record<string, number> = {
  gocap: 50000,
  goceng: 5000,
  ceban: 10000,
  cepek: 100000,
  noban: 20000,
  goban: 50000,
};

const BASE_NUM_WORDS: Record<string, number> = {
  nol: 0, satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6,
  tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11,
  seratus: 100, seribu: 1000, sejuta: 1000000,
};

// Normalisasi typo umum hasil STT id-ID untuk toko teknik
export const normalizeSttText = (s: string): string => {
  let t = (s || '').toLowerCase();
  const fixes: Array<[RegExp, string]> = [
    [/\bbering\b/g, 'bearing'],
    [/\bbereng\b/g, 'bearing'],
    [/\bpaling[-\s]?paling\b/g, 'baling-baling'],
    [/\bbaling[-\s]?paling\b/g, 'baling-baling'],
    [/\bpipa\s+paralon\b/g, 'pipa paralon'],
    [/\bpralon\b/g, 'paralon'],
    [/\brucika\b/g, 'rucika'],
    [/\brossika\b/g, 'rucika'],
    [/\bonda\b/g, 'onda'],
    [/\bdinamo\b/g, 'dinamo'],
    [/\bgerinda\b/g, 'gerinda'],
    [/\bgrenda\b/g, 'gerinda'],
    [/\bsemen\b/g, 'semen'],
    [/\bobeng\b/g, 'obeng'],
    [/\bsolasi\b/g, 'solasi'],
    [/\bsolasi\b/g, 'solasi'],
  ];
  for (const [re, rep] of fixes) t = t.replace(re, rep);
  return t;
};

// Ubah frase angka Indonesia -> number. Mendukung: dua, duabelas, tiga belas,
// dua puluh, dua puluh lima, seratus, dua ratus, seribu, dua ribu, sejuta, selusin, sepasang.
export const wordsToNumber = (phrase: string): number | null => {
  const p = (phrase || '').toLowerCase().trim().replace(/-/g, ' ');
  if (!p) return null;
  if (/^\d+$/.test(p)) return parseInt(p, 10);

  const tokens = p.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  // Kasus khusus cepat
  if (tokens.length === 1) {
    const w = tokens[0];
    if (BASE_NUM_WORDS[w] !== undefined) return BASE_NUM_WORDS[w];
    if (w === 'selusin' || w === 'selusinnya') return 12;
    if (w === 'sepasang' || w === 'sepasangnya') return 2;
    if (w === 'setengah') return 0.5;
    if (w === 'duabelas') return 12;
    // belasan: "tigabelas" tanpa spasi (hasil STT kadang menempel)
    const belasGlue = w.match(/^(tiga|empat|lima|enam|tujuh|delapan|sembilan)belas$/);
    if (belasGlue) {
      const base: Record<string, number> = { tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9 };
      return base[belasGlue[1]] + 10;
    }
    return null;
  }

  // Parser umum: ratus / puluh / belas / ribu / juta
  try {
    let total = 0;
    let current = 0;
    const base: Record<string, number> = {
      nol: 0, satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6,
      tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11,
    };
    for (let i = 0; i < tokens.length; i++) {
      const w = tokens[i];
      if (base[w] !== undefined) {
        current += base[w];
      } else if (w === 'belas') {
        current += 10; // "tiga belas" -> current 3 + 10 = 13
      } else if (w === 'puluh') {
        current *= 10;
      } else if (w === 'ratus') {
        if (current === 0) current = 1;
        current *= 100;
      } else if (w === 'seratus') {
        current += 100;
      } else if (w === 'ribu' || w === 'rb' || w === 'k') {
        if (current === 0) current = 1;
        current *= 1000;
        total += current;
        current = 0;
      } else if (w === 'seribu') {
        total += 1000;
      } else if (w === 'juta') {
        if (current === 0) current = 1;
        current *= 1000000;
        total += current;
        current = 0;
      } else if (w === 'sejuta') {
        total += 1000000;
      } else if (w === 'lusin' || w === 'selusin') {
        if (current === 0) current = 1;
        current *= 12;
      } else if (w === 'setengah') {
        // "setengah lusin" -> 6 ; "dua setengah" -> 2.5
        const nxt = tokens[i + 1];
        if (nxt === 'lusin') {
          current += 6;
          i++;
        } else {
          current += 0.5;
        }
      } else {
        return null; // token asing -> bukan angka murni
      }
    }
    total += current;
    return total > 0 || tokens.includes('nol') ? total : null;
  } catch {
    return null;
  }
};

// Parse nilai harga format Indonesia: "25.000" -> 25000, "2,5" -> 2.5,
// "25" + suffix ribu -> 25000. suffix: ribu/rb/k.
export const parsePriceValue = (rawNum: string, suffix?: string): number => {
  const raw = (rawNum || '').trim();
  const hasSuffix = Boolean(suffix && /^(ribu|rb|k)$/i.test(suffix.trim()));
  let val: number;
  if (/[.,]/.test(raw)) {
    // Format ID: titik = ribuan, koma = desimal. "25.000" -> 25000, "2,5" -> 2.5
    const withoutThousand = raw.replace(/\./g, '');
    const withDotDecimal = withoutThousand.replace(/,/g, '.');
    val = parseFloat(withDotDecimal) || 0;
  } else {
    val = parseFloat(raw) || 0;
  }
  if (hasSuffix) val *= 1000;
  return Math.round(val);
};

// Lindungi ukuran inch (5", 4 inch, 1/2 inch) agar tidak dimakan parser qty/harga.
// Kembalikan { text, sizes } — sizes dikembalikan ke nama produk di akhir.
const protectInchSizes = (seg: string): { text: string; sizes: string[] } => {
  const sizes: string[] = [];
  let idx = 0;
  const text = seg.replace(
    /(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)?)\s*(?:inch|inchi|in\b|")/gi,
    (m, num) => {
      const norm = String(num).replace(/\s+/g, '').replace(',', '.') + '"';
      sizes.push(norm);
      const ph = ` __INCH${idx}__ `;
      idx++;
      return ph;
    }
  );
  // Lindungi juga dimensi pecahan "1/2", "3/4" yang menempel tanpa kata inch
  const text2 = text.replace(/(?<!\d)(\d+\s*\/\s*\d+)(?!\d)/g, (m) => {
    sizes.push(m.replace(/\s+/g, ''));
    const ph = ` __INCH${idx}__ `;
    idx++;
    return ph;
  });
  return { text: text2, sizes };
};

const restoreInchSizes = (name: string, sizes: string[]): string => {
  let out = name;
  sizes.forEach((s, i) => {
    out = out.replace(`__INCH${i}__`, s);
  });
  // Sisa placeholder (kalau ikut ke-clean) -> tempel di belakang
  const leftover = sizes.filter((_, i) => out.includes(`__inch${i}__`) || out.includes(`__INCH${i}__`));
  void leftover;
  return out.replace(/\s+/g, ' ').trim();
};

/**
 * Nomor 1: Pre-Filtering Kandidat Produk untuk Optimasi Token & Kecepatan
 * Memilih hanya 30-45 kandidat produk relevan dari transkrip ucapan kasir.
 */
export const filterCandidateProducts = (transcript: string, products: Product[], maxCandidates = 40): Product[] => {
  if (!products || products.length <= maxCandidates) {
    return products || [];
  }

  const normalized = normalizeSttText(transcript);
  const cleaned = normalized
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

    // Alias exact
    for (const alias of pAliases) {
      if (alias.length > 3 && cleaned.includes(alias)) {
        score += 120;
      }
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

// Split cerdas: pisahkan multi-item dalam satu ucapan.
// "dinamo bearing 1 baling-baling ... 25rb" -> ["dinamo bearing 1", "baling-baling ... 25rb"]
// "baut 50 biji pipa 2 batang" -> ["baut 50 biji", "pipa 2 batang"]
const smartSplitSegments = (lowerRaw: string): string[] => {
  // PENTING: jangan split titik/koma di dalam angka ("25.000", "2,5").
  // Koma/titik hanya pemisah jika TIDAK diikuti digit.
  const coarse = lowerRaw
    .split(/,(?!\d)|\.(?!\d)|;|\||\bdan\b|\bsama\b|\bterus\b|\blalu\b|\btambah\b|\bjuga\b|\blanjut\b|\bplus\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  const out: string[] = [];
  const unitAlt = QTY_UNITS.join('|');

  for (const c of coarse) {
    // Tahap A: split setelah UNIT + kata produk. "50 biji pipa 2 batang" -> split setelah "biji "
    // Cari pola: <unit> <spasi> <kata>=3huruf. Split di sana, tapi jangan split kalau sisa kanan cuma unit saja.
    let parts: string[] = [c];
    const unitBoundaryRe = new RegExp(`\\b(${unitAlt})\\b\\s+(?=[a-zA-Z]{3,})`, 'gi');
    const tmpA: string[] = [];
    for (const p of parts) {
      let lastIdx = 0;
      let m: RegExpExecArray | null;
      unitBoundaryRe.lastIndex = 0;
      const splits: number[] = [];
      while ((m = unitBoundaryRe.exec(p)) !== null) {
        const cutAt = m.index + m[0].length;
        const left = p.slice(lastIdx, cutAt).trim();
        const right = p.slice(cutAt).trim();
        // Hanya split kalau kiri punya kata produk (>=3 char) dan kanan punya >=2 kata / harga
        if (left.replace(/\W/g, '').length >= 3 && right.length >= 4) {
          splits.push(cutAt);
          lastIdx = cutAt;
        }
      }
      if (splits.length === 0) {
        tmpA.push(p);
      } else {
        let prev = 0;
        for (const s of splits) {
          tmpA.push(p.slice(prev, s).trim());
          prev = s;
        }
        const tail = p.slice(prev).trim();
        if (tail) tmpA.push(tail);
      }
    }
    parts = tmpA.flatMap((x) => [x]);

    // Tahap B: split pada angka qty kecil di tengah. "bearing 1 baling-baling" -> split setelah "1 "
    // Syarat: angka 1-99, didahului huruf, diikuti kata produk (>=3 huruf), bukan bagian harga/ukuran.
    const tmpB: string[] = [];
    for (const p of parts) {
      // Jangan ganggu segmen yang sudah jelas 1 item pendek
      const qtyMidRe = /\b([a-zA-Z]{3,})\s+(\d{1,2}|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|duabelas)\s+(?=[a-zA-Z]{3,})/gi;
      let m: RegExpExecArray | null;
      let cut: number | null = null;
      // Proteksi: jangan split kalau angka itu didahului kata harga/rp (itu harga, bukan batas item)
      while ((m = qtyMidRe.exec(p)) !== null) {
        const wordBefore = (m[1] || '').toLowerCase();
        // "harganya dua puluh..." -> wordBefore=harganya, jangan split (itu harga, bukan batas item)
        if (/^(harga|harganya|harganye|rp|seharga|senilai|dibandrol)$/.test(wordBefore)) continue;
        const before = p.slice(Math.max(0, m.index - 18), m.index).toLowerCase();
        if (/(harga|harganya|rp|seharga)\s*$/.test(before)) continue;
        const afterWord = p.slice(m.index + m[0].length, m.index + m[0].length + 14).toLowerCase().trim();
        // Jangan split kalau kata setelahnya adalah unit (itu qty+unit normal, bukan batas item)
        if (new RegExp(`^(${unitAlt})\\b`).test(afterWord)) continue;
        // Jangan split kalau lanjutannya adalah kelanjutan angka ("puluh", "belas", "ratus", "ribu") —
        // itu "dua puluh lima ribu" (harga), bukan batas 2 barang.
        if (/^(puluh|belas|ratus|ribu|rb\b|rupiah|juta|lusin)\b/.test(afterWord)) continue;
        // Jangan split kalau setelah angka adalah penanda harga ("1 harganya 80000" = 1 item, bukan 2).
        if (/^(harga|harganya|harganye|rp|seharga|senilai|dibandrol)\b/.test(afterWord)) continue;
        // Jangan split kalau kiri cuma 1 kata pendek (mis. "kabel 2 x 1.5" -> jangan)
        const left = p.slice(0, m.index + m[1].length + 1 + m[2].length).trim();
        const right = p.slice(m.index + m[0].length - 0).trim();
        // Kanan harus cukup panjang (>=8 char) agar tidak over-split "obeng 2 arah"
        if (left.length >= 6 && right.length >= 8) {
          cut = m.index + m[1].length + 1 + m[2].length;
          // Cari spasi setelah angka untuk cut bersih
          const rest = p.slice(cut);
          const sp = rest.search(/\s/);
          cut = sp >= 0 ? cut + sp : cut;
          break; // cukup 1 split per segmen agar tidak fragmentasi
        }
      }
      if (cut !== null) {
        const leftPart = p.slice(0, cut).trim();
        const rightPart = p.slice(cut).trim();
        if (leftPart.length > 2 && rightPart.length > 2) {
          tmpB.push(leftPart, rightPart);
        } else {
          tmpB.push(p);
        }
      } else {
        tmpB.push(p);
      }
    }
    out.push(...tmpB);
  }

  return out.map((s) => s.trim()).filter((s) => s.length > 2);
};

// Ekstrak harga dari SATU segmen. Hanya hapus substring harga itu saja (bukan semua angka!).
// Urutan: 1) slang dengan/tanpa marker, 2) marker harga/rp + angka, 3) angka + ribu/rb/k.
const extractPriceFromSegment = (seg: string): { price: number; rest: string } => {
  let working = seg;
  let price = 0;

  // 1) Slang: gocap/ceban/noban/goceng/cepek — tangkap kemunculan pertama
  const slangMatch = working.match(/\b(gocap|goceng|ceban|cepek|noban|goban)\b/i);
  if (slangMatch) {
    price = SLANG_PRICE[slangMatch[1].toLowerCase()] || 0;
    working = working.replace(slangMatch[0], ' ');
    return { price, rest: working };
  }

  // 2) Marker eksplisit: harganya|harga|rp|seharga + angka (digit ATAU kata) + opsional ribu
  // Contoh: "harganya Rp25.000", "harga 25 ribu", "harga dua puluh lima ribu", "rp 10rb"
  const markerRe = /(?:harganye?|harganya|harga|seharga|senilai|dibandrol)\s*(?:rp\.?\s*)?([0-9]+(?:[.,][0-9]+)*|[a-zA-Z]+(?:\s+[a-zA-Z]+){0,5}?)\s*(ribu|rb|k|rupiah)?\b|\brp\.?\s*([0-9]+(?:[.,][0-9]+)*)\s*(ribu|rb|k|rupiah)?\b/i;
  const m = working.match(markerRe);
  if (m) {
    const full = m[0];
    const numStr = (m[1] || m[3] || '').trim();
    const suffix = (m[2] || m[4] || '').trim();
    if (/^\d/.test(numStr)) {
      price = parsePriceValue(numStr, suffix);
      // "harganya 25" tanpa suffix & tanpa titik -> asumsikan ribu (25 -> 25000).
      // Tapi "harganya 25000" sudah >=1000 -> biarkan.
      if (!suffix && !/[.,]/.test(numStr)) {
        const plain = parseInt(numStr, 10);
        if (plain > 0 && plain < 1000) price = plain * 1000;
      }
    } else {
      // Kata: "dua puluh lima" (+ribu?)
      const numWords = wordsToNumber(numStr + (suffix ? ' ribu' : ''));
      if (numWords !== null && numWords > 0) {
        price = suffix || /ribu|rb|\bk\b/i.test(full) ? Math.round(numWords * (/ribu|rb|\bk\b/i.test(numStr + ' ' + suffix) && numWords < 1000 ? 1000 : 1)) : Math.round(numWords);
        // Koreksi: "dua puluh lima ribu" -> wordsToNumber("dua puluh lima ribu") sudah 25000
        if (numWords >= 1000) price = Math.round(numWords);
        else if (suffix) price = Math.round(numWords * 1000);
        else price = Math.round(numWords);
      }
    }
    if (price > 0) {
      working = working.replace(full, ' ');
      return { price, rest: working };
    }
  }

  // 3) Pola "25 ribu / 10rb / 25k" tanpa marker — aman karena qty jarang pakai ribu
  const ribuRe = /\b([0-9]+(?:[.,][0-9]+)*|[a-zA-Z]+(?:\s+[a-zA-Z]+){0,4}?)\s*(ribu|rb|\bk\b|rupiah)\b/i;
  const m2 = working.match(ribuRe);
  if (m2) {
    const numStr = (m2[1] || '').trim();
    const suffix = (m2[2] || '').trim();
    if (/^\d/.test(numStr)) {
      price = parsePriceValue(numStr, suffix);
    } else {
      const n = wordsToNumber(numStr);
      if (n !== null && n > 0) price = Math.round(n * 1000);
    }
    if (price > 0) {
      working = working.replace(m2[0], ' ');
      return { price, rest: working };
    }
  }

  return { price: 0, rest: working };
};

// Ekstrak qty dari segmen (SETELAH harga dihapus). Kembalikan qty + sisa + unit terduga.
const extractQtyFromSegment = (seg: string): { qty: number; rest: string; unitHint?: string } => {
  const unitAlt = QTY_UNITS.join('|');

  // Pola "2x", "x2", "2 pcs", "50 biji", "dua batang"
  const qtyUnitRe = new RegExp(
    `(\\d+(?:[.,]\\d+)?)\\s*(${unitAlt})\\b|\\b(${unitAlt})\\s*(\\d+(?:[.,]\\d+)?)|\\b(\\d+)\\s*[x×]\\s*|\\b(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|duabelas|tiga\\s+belas|empat\\s+belas|lima\\s+belas|enam\\s+belas|tujuh\\s+belas|delapan\\s+belas|sembilan\\s+belas|dua\\s+puluh(?:\\s+lima|\\s+dua|\\s+tiga|\\s+empat)?|selusin|sepasang|setengah\\s+lusin)\\s*(${unitAlt})?\\b`,
    'i'
  );
  const m = seg.match(qtyUnitRe);
  if (m) {
    const full = m[0];
    let qty = 1;
    let unitHint: string | undefined;
    if (m[1] && m[2]) {
      qty = parseInt(m[1], 10) || 1;
      unitHint = m[2];
    } else if (m[3] && m[4]) {
      qty = parseInt(m[4], 10) || 1;
      unitHint = m[3];
    } else if (m[5]) {
      qty = parseInt(m[5], 10) || 1;
    } else if (m[6]) {
      const n = wordsToNumber(m[6]);
      qty = n !== null && n > 0 ? Math.round(n) : 1;
      unitHint = m[7] || undefined;
    }
    qty = Math.min(Math.max(1, qty), 10000);
    // Proteksi: angka dimensi "2 x 1.5" — "2x" di situ bukan qty. Jika setelah match ada pola "x angka", batalkan.
    const afterIdx = seg.indexOf(full) + full.length;
    const after = seg.slice(afterIdx, afterIdx + 10);
    if (/^\s*x\s*\d/i.test(full + after) && /^\s*\d/.test(after)) {
      // Ini dimensi, bukan qty — jangan hapus
      return { qty: 1, rest: seg };
    }
    const rest = seg.replace(full, ' ');
    return { qty, rest, unitHint };
  }

  // Fallback: angka digit tunggal kecil tanpa unit di awal/akhir ("dinamo 1", "2 dinamo")
  // Ambil hanya jika tepat 1 angka kecil dan bukan bagian dimensi (x, /, ., inch sudah diproteksi)
  const bareNums = [...seg.matchAll(/(?<!\d)(\d{1,3})(?!\d)/g)].map((x) => x[1]);
  if (bareNums.length === 1) {
    const v = parseInt(bareNums[0], 10);
    if (v >= 1 && v <= 99) {
      // Pastikan bukan "2x1.5" (ada x di sekitar)
      const idx = seg.indexOf(bareNums[0]);
      const ctx = seg.slice(Math.max(0, idx - 3), idx + bareNums[0].length + 3).toLowerCase();
      if (/x/.test(ctx) || /\//.test(ctx)) return { qty: 1, rest: seg };
      const rest = seg.replace(bareNums[0], ' ');
      return { qty: v, rest };
    }
  }

  return { qty: 1, rest: seg };
};

const cleanProductName = (seg: string): string => {
  return seg
    .replace(/\b(masukin|masukkan|tambahin|tambahkan|tambah|ambilin|ambil|belikan|beli|minta|mintakan|tolong|coba|kasih|beri|ada|yang|buat|untuk|ke|di|dari|satuan|buahnya|bijinya)\b/gi, ' ')
    .replace(/\bharganye?\b|\bharganya\b|\bharga\b|\brp\b/gi, ' ')
    .replace(/[^\w\s/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Fallback pencocokan lokal jika tanpa API key atau saat offline
const parseTranscriptLocally = (transcript: string, products: Product[]): VoiceAiParseResult => {
  const normalized = normalizeSttText(transcript);
  const lower = normalized.toLowerCase().trim();

  // 1. Deteksi CLEAR_CART (Kosongkan Keranjang) — pakai word boundary agar "penghapus" aman
  if (/\b(kosongkan|kosongin)\b.*\b(keranjang|struk|belanjaan)?\b|\b(hapus|batalkan|batal)\b\s+semua\b/i.test(lower)) {
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
  if (/\breset\s*transaksi\b|\btransaksi\s*baru\b|\bmulai\s*(baru|transaksi\s*baru)\b/i.test(lower)) {
    return {
      success: true,
      rawTranscript: transcript,
      action: 'RESET_TRANSACTION',
      summary: 'Mereset transaksi kasir baru',
      items: [],
      isOfflineFallback: true,
    };
  }

  // 3. Deteksi CHECK_STOCK — WAJIB ada kata cek/stok/harga/tanya. "ada dinamo" saja = ADD, bukan cek.
  const stockMatch = lower.match(
    /\b(?:cek|cekin|tanya|tanyakan|lihat|liat)\b[^,.;]*\b(?:stok|harga|harganya)\b\s*(.+)|(?:berapa|brapa)\s+(?:harga|harganya)\s*(.+)|(?:cek|tanya)\s+(?:stok\s+)?(.+)|stok\s+(.+)/i
  );
  if (stockMatch) {
    const rawQuery = (stockMatch[1] || stockMatch[2] || stockMatch[3] || stockMatch[4] || '').trim();
    const query = rawQuery.replace(/\b(berapa|brapa|harganya|harga|stok|cek|tanya|tanyakan|dong|kah|pak|mas|bang|mbak|kak|ya)\b/gi, '').replace(/[?.!,]/g, ' ').replace(/\s+/g, ' ').trim();
    if (query && query.length >= 2) {
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

  // 4. Deteksi REMOVE_ITEM — pakai \b agar "penghapus" tidak ke-trigger
  const removeMatch = lower.match(/\b(?:hapuskan|hapus|batalkan|batal|buang|keluarkan)\b\s*(.+)?|\bkurangi\b\s*(.+)/i);
  if (removeMatch) {
    const targetStr = ((removeMatch[1] || removeMatch[2] || '') as string).trim();
    // Jangan anggap perintah hapus kalau targetnya kosong & ucapan jelas-jelas beli ("beli penghapus")
    const isBuyContext = /\b(beli|tambah|ambil|minta)\b/i.test(lower) && !/^\s*(hapus|batal|buang|keluarkan|kurangi)\b/i.test(lower) && !/\b(tolong\s+)?(hapus|batal|buang)\b/i.test(lower);
    if (!isBuyContext) {
      const isLast = /\bterakhir\b|\byang\s*tadi\b|\byang\s*barusan\b/i.test(targetStr);
      // Ekstrak qty hapus: "hapus baut 2" / "kurangi 2 baut"
      let removeQty: number | undefined;
      const qtyInTarget = targetStr.match(/(\d+)\s*(pcs|biji|buah|batang)?/i);
      if (qtyInTarget) {
        const v = parseInt(qtyInTarget[1], 10);
        if (v > 0 && v < 1000) removeQty = v;
      } else {
        const w = targetStr.match(/\b(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\b/i);
        if (w) {
          const n = wordsToNumber(w[1]);
          if (n !== null && n > 0) removeQty = n;
        }
      }
      return {
        success: true,
        rawTranscript: transcript,
        action: 'REMOVE_ITEM',
        summary: isLast ? 'Hapus barang terakhir dari struk' : `Hapus ${targetStr || 'barang'} dari struk`,
        items: [],
        removeTarget: {
          lastItem: isLast,
          name: isLast ? undefined : (targetStr || undefined),
          qty: removeQty,
          removeAll: removeQty ? false : true,
        },
        isOfflineFallback: true,
      };
    }
  }

  // 5. Deteksi APPLY_DISCOUNT — "diskon 5 ribu", "beri diskon gocap", "potong 2,5 ribu".
  // Kata kerja (beri/kasih) opsional, kata diskon/potongan wajib SATU kali (bukan dua).
  const discountMatch = lower.match(
    /\b(?:beri|berikan|kasih|kasi|dapat|minta|tolong)?\s*\b(?:diskon|potongan|potong|korting)\b\s*(?:harga|sebesar|senilai)?\s*([0-9]+(?:[.,][0-9]+)*|[a-zA-Z]+(?:\s+[a-zA-Z]+){0,4}?)\s*(ribu|rb|\bk\b)?(?:\s*(?:buat|untuk|pada|di|ke)?\s*(.+))?/i
  );
  if (discountMatch) {
    const numStr = (discountMatch[1] || '').trim();
    const suffix = (discountMatch[2] || '').trim();
    let val = 0;
    const slangKey = numStr.toLowerCase();
    if (SLANG_PRICE[slangKey] !== undefined) {
      val = SLANG_PRICE[slangKey];
    } else if (/^\d/.test(numStr)) {
      val = parsePriceValue(numStr, suffix);
    } else {
      const n = wordsToNumber(numStr);
      if (n !== null) val = suffix ? Math.round(n * 1000) : Math.round(n);
    }
    if (val > 0) {
      const targetItem = ((discountMatch[3] || '') as string).replace(/\b(buat|untuk|pada|di|ke|barang|yang)\b/gi, ' ').replace(/\s+/g, ' ').trim();
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
  }

  // 6. Deteksi FINALIZE_PAYMENT / OPEN_PAYMENT
  if (/\buang\s*pas\b|\bbayar\s*lunas\b|\bbayar\s*uang\s*pas\b|\bpas\s*aja\b/i.test(lower)) {
    // Ekstrak nominal bayar HANYA jika ada kata bayar/uang/tunai/cash (hindari harga item dikira bayar)
    let cashAmount: number | undefined;
    const payM = lower.match(/\b(?:bayar|uang|tunai|cash|transfer)\b[^,.;]*?(\d+(?:[.,]\d+)*)\s*(ribu|rb|\bk\b)?/i);
    if (payM) cashAmount = parsePriceValue(payM[1], payM[2]);
    else {
      const slangPay = lower.match(/\b(?:bayar|uang|tunai|cash)\b[^,.;]*?\b(gocap|goceng|ceban|cepek|noban|goban)\b/i);
      if (slangPay) cashAmount = SLANG_PRICE[slangPay[1].toLowerCase()];
    }
    return {
      success: true,
      rawTranscript: transcript,
      action: 'FINALIZE_PAYMENT',
      summary: 'Pembayaran uang pas',
      items: [],
      payment: { paymentMethod: 'cash', cashAmount },
      isOfflineFallback: true,
    };
  }

  if (/\bbuka\b[^,.;]*\bbayar(?:an)?\b|\blanjut\s*bayar\b|\bmau\s*bayar\b|\bke\s*(menu\s*)?bayar\b/i.test(lower)) {
    return {
      success: true,
      rawTranscript: transcript,
      action: 'OPEN_PAYMENT',
      summary: 'Membuka menu pembayaran kasir',
      items: [],
      isOfflineFallback: true,
    };
  }

  // 7. DEFAULT: ADD_ITEMS — splitter cerdas + harga/qty terisolasi per segmen
  const segments = smartSplitSegments(lower);
  const items: VoiceAiItem[] = [];

  for (let segRaw of segments) {
    if (!segRaw || segRaw.trim().length < 2) continue;

    // Lindungi ukuran inch dulu
    const { text: segNoInch, sizes } = protectInchSizes(segRaw);
    let seg = ` ${segNoInch} `;

    // Pisahkan frasa BAYAR dari segmen barang agar nominal bayar tidak dimakan jadi harga item.
    // "baut 50 biji bayar 100 ribu" -> seg barang "baut 50 biji", nominal 100rb jadi cash (global).
    seg = seg.replace(
      /\b(bayar|uang|tunai|cash|transfer|qris)\b\s*(\d+(?:[.,]\d+)*\s*(?:ribu|rb|\bk\b|rupiah)?|gocap|goceng|ceban|cepek|noban|goban)\b/gi,
      ' '
    );

    // Ekstrak harga (hanya substring harga yang dihapus!)
    const { price: explicitPrice, rest: afterPrice } = extractPriceFromSegment(seg);
    seg = afterPrice;

    // Ekstrak qty (hanya substring qty yang dihapus!)
    const { qty, rest: afterQty, unitHint } = extractQtyFromSegment(seg);
    seg = afterQty;

    // Bersihkan sisa jadi nama produk
    let cleanedQuery = cleanProductName(seg);
    // Kembalikan placeholder inch ke nama
    if (sizes.length > 0) {
      // placeholder masih ada sebagai __INCHn__ (lowercase karena seg lower)
      let tmp = cleanedQuery.toLowerCase();
      sizes.forEach((s, i) => {
        tmp = tmp.replace(`__inch${i}__`, ` ${s} `);
      });
      cleanedQuery = tmp.replace(/\s+/g, ' ').trim();
      // Kalau placeholder hilang karena cleaning, tempel ukuran di belakang
      if (!sizes.some((s) => cleanedQuery.includes(s.replace('"', '').trim())) && !cleanedQuery.includes('inch') && !cleanedQuery.includes('"')) {
        cleanedQuery = `${cleanedQuery} ${sizes.join(' ')}`.trim();
      }
    }
    // Hapus sisa angka kata qty dari nama ("satu", "dua", "50") — tapi JANGAN hapus angka dimensi (x, /, inch sudah aman)
    cleanedQuery = cleanedQuery
      .replace(/\b(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|duabelas|tiga\s+belas|dua\s+puluh(?:\s+\w+)?|selusin|sepasang)\b/gi, ' ')
      .replace(/(?<!\d\/)(?<!\dx)(?<!\d)\b\d+\b(?!\s*\/)(?!\s*x)/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanedQuery || cleanedQuery.replace(/\W/g, '').length < 2) continue;

    const matches = searchProducts(cleanedQuery);
    if (matches.length > 0) {
      const top = matches[0].product;
      // Satuan: prioritaskan unitHint jika masuk akal, else unit katalog
      const finalUnit = unitHint
        ? unitHint.charAt(0).toUpperCase() + unitHint.slice(1).toLowerCase()
        : top.unit || 'Pcs';
      items.push({
        matchedProductId: top.id,
        name: sizes.length > 0 && !top.name.includes(sizes[0].replace('"', '').trim()) ? `${top.name} ${sizes.join(' ')}` : top.name,
        price: explicitPrice > 0 ? explicitPrice : top.price,
        qty,
        unit: finalUnit,
        isNew: false,
      });
    } else {
      const pretty = cleanedQuery.charAt(0).toUpperCase() + cleanedQuery.slice(1);
      items.push({
        name: pretty,
        price: explicitPrice > 0 ? explicitPrice : 0,
        qty,
        unit: unitHint ? unitHint.charAt(0).toUpperCase() + unitHint.slice(1).toLowerCase() : 'Pcs',
        isNew: true,
      });
    }
  }

  // Nominal bayar HANYA jika ada intent bayar eksplisit — jangan colong harga barang (gocap bug lama)
  let cashAmount: number | undefined;
  if (/\b(bayar|tunai|cash|transfer|qris|uang\s*pas|lunas)\b/i.test(lower)) {
    const slangPay = lower.match(/\b(bayar|uang|tunai|cash)\b[^,.;]*?\b(gocap|goceng|ceban|cepek|noban|goban)\b/i);
    if (slangPay) {
      cashAmount = SLANG_PRICE[slangPay[2].toLowerCase()];
    } else {
      const payMatch = lower.match(/\b(?:bayar|uang|tunai|cash)\b[^,.;]*?(\d+(?:[.,]\d+)*)\s*(ribu|rb|\bk\b|rupiah)?/i);
      if (payMatch) {
        cashAmount = parsePriceValue(payMatch[1], payMatch[2]);
      }
    }
  }

  // Kalau tidak ada barang tapi ada intent bayar ("bayar gocap", "bayar 50 ribu") -> jadikan pembayaran, bukan produk "Bayar"
  if (items.length === 0 && cashAmount && /\b(bayar|tunai|cash|transfer|qris|uang)\b/i.test(lower)) {
    return {
      success: true,
      rawTranscript: transcript,
      action: 'FINALIZE_PAYMENT',
      summary: `Pembayaran tunai Rp ${cashAmount.toLocaleString('id-ID')}`,
      items: [],
      payment: { cashAmount, paymentMethod: 'cash' },
      isOfflineFallback: true,
    };
  }

  return {
    success: items.length > 0,
    rawTranscript: transcript,
    action: 'ADD_ITEMS',
    summary: items.length > 0 ? `${items.length} barang diidentifikasi (Mode Offline Cerdas)` : 'Tidak ada barang terdeteksi',
    items,
    payment: cashAmount ? { cashAmount, paymentMethod: 'cash' } : undefined,
    isOfflineFallback: true,
    error: items.length === 0 ? 'Tidak ada barang yang terdeteksi dari ucapan suara.' : undefined,
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

  // 1. EVALUASI LOKAL INSTAN — perintah operasional langsung dieksekusi.
  // Tapi kalau ucapan multi-intent (ada "tambah/beli" + "hapus"), biarkan Gemini yang memisahkan.
  const localResult = parseTranscriptLocally(transcript, products);
  const hasAddIntent = /\b(tambah|tambahin|beli|belikan|ambil|minta|masukin|masukkan)\b/i.test(transcript);
  const hasRemoveIntent = /\b(hapus|batalkan|batal|buang|keluarkan|kurangi)\b/i.test(transcript);
  const isMultiIntent = hasAddIntent && hasRemoveIntent;
  if (localResult.action !== 'ADD_ITEMS' && !isMultiIntent) {
    return localResult;
  }

  // Jika tanpa API key / format salah, langsung gunakan pencocokan lokal (yang sudah diperbaiki)
  if (!apiKey || !isPlausibleGeminiKey(apiKey)) {
    if (localResult.action === 'ADD_ITEMS') {
      localResult.error = !apiKey
        ? 'API Key Gemini belum disetel. Menggunakan pencocokan cerdas lokal.'
        : 'Format API Key bukan Gemini (harus "AIza..."). Menggunakan pencocokan cerdas lokal. Perbaiki key di Pengaturan.';
    }
    // Kalau multi-intent tapi offline, kembalikan local (prioritas aman: ADD)
    if (isMultiIntent && localResult.action !== 'ADD_ITEMS') {
      const addOnly = parseTranscriptLocally(transcript.replace(/\b(hapus|batalkan|batal|buang|keluarkan|kurangi)[^,.;]*/gi, ' '), products);
      if (addOnly.items.length > 0) return addOnly;
    }
    return localResult;
  }

  // 2. Pre-Filtering Kandidat Produk untuk Gemini Cloud
  const candidateProducts = filterCandidateProducts(transcript, products, 35);
  const validIds = new Set(candidateProducts.map((p) => p.id));
  const catalogSummary = candidateProducts.map((p) => ({
    id: p.id,
    name: p.name,
    aliases: p.aliases || [],
    price: p.price,
    unit: p.unit || 'Pcs',
    category: p.category || '',
  }));

  const systemInstruction = `Kamu adalah parser kasir toko teknik "Mega Tehnik Elektronik". Tugas: ubah UCAPAN KASIR jadi JSON barang.

ATURAN KERAS:
1. Pisahkan MULTI-ITEM. "dinamo bearing 1 baling-baling kipas angin 25rb" = 2 item: {dinamo bearing, qty 1} + {baling-baling kipas angin, price 25000}.
2. HARGA hanya jika ada penanda: kata harganya/harga/rp/seharga ATAU angka+ribu/rb/k/rupiah ATAU slang (gocap=50000, ceban=10000, noban=20000, goceng=5000, cepek=100000). Angka kecil polos (1, 2, 50) TANPA penanda = QTY, bukan harga.
3. QTY: angka + satuan (pcs/biji/buah/batang/lonjor/sak/rol/meter/lembar/kaleng/set/dus/box) atau angka kata (satu..duabelas, dua puluh, tiga belas, selusin=12, sepasang=2). Default qty=1.
4. UKURAN bukan qty/harga: 5", 4 inch, 1/2 inch, 2x1.5mm. Tempelkan ke nama, jangan jadi qty/price.
5. matchedProductId HARUS salah satu ID dari Katalog di bawah, atau null jika benar-benar tidak ada yang mirip. JANGAN mengarang ID. Cocokkan typo STT: bering=bearing, paling=baling, pralon=paralon.
6. isNew=true HANYA jika tidak ada katalog yang mirip. Jika mirip, pakai nama resmi katalog + harga katalog (kecuali kasir menyebut harga lain, pakai harga ucapan).
7. Jangan masukkan kata kerja (beli/tambah/ambil/minta/tolong) dan kata harga ke name.
8. payment.cashAmount HANYA jika ada kata bayar/uang/tunai/cash/transfer. Harga barang BUKAN cashAmount.

Contoh:
Ucapan: "baut baja 50 biji sama pipa rucika 2 batang"
JSON: {"summary":"2 barang","items":[{"matchedProductId":null,"name":"Baut Baja","price":0,"qty":50,"unit":"Biji","isNew":true},{"matchedProductId":null,"name":"Pipa Rucika","price":0,"qty":2,"unit":"Batang","isNew":true}]}

Ucapan: "baling-baling kipas angin harganya dua puluh lima ribu"
JSON: {"summary":"1 barang","items":[{"matchedProductId":null,"name":"Baling-baling Kipas Angin","price":25000,"qty":1,"unit":"Pcs","isNew":true}]}

Output WAJIB JSON murni tanpa markdown:
{"summary":"...","items":[{"matchedProductId":"... atau null","name":"...","price":0,"qty":1,"unit":"Pcs","isNew":false}],"payment":{"cashAmount":0,"paymentMethod":"cash","customerName":""}}
Katalog Produk:
${JSON.stringify(catalogSummary)}`;

  const prompt = `Ucapan Kasir: "${transcript}"`;

  // Timeout 9 detik (jaringan HP lambat) — coba model valid berurutan, tanpa delay retry.
  const fastModels = GEMINI_PREFERRED_MODELS.slice(0, 4);

  for (const model of fastModels) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

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
        // 404/503/429 -> langsung coba model berikutnya
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
        ? parsed.items.map((it: any) => {
            const rawId = typeof it.matchedProductId === 'string' && it.matchedProductId.trim() ? it.matchedProductId.trim() : undefined;
            // Validasi ID: harus ada di katalog yang dikirim, kalau tidak -> undefined (hindari halusinasi)
            const matchedProductId = rawId && validIds.has(rawId) ? rawId : undefined;
            let qty = typeof it.qty === 'number' ? Math.floor(it.qty) : parseInt(String(it.qty || '1'), 10);
            if (!Number.isFinite(qty) || qty < 1) qty = 1;
            if (qty > 10000) qty = 10000;
            let price = typeof it.price === 'number' ? Math.floor(it.price) : parseInt(String(it.price || '0'), 10);
            if (!Number.isFinite(price) || price < 0) price = 0;
            return {
              matchedProductId,
              name: String(it.name || 'Barang').trim().slice(0, 80),
              price: Math.max(0, price),
              qty: Math.max(1, qty),
              unit: String(it.unit || 'Pcs').trim().slice(0, 12) || 'Pcs',
              isNew: matchedProductId ? false : Boolean(it.isNew),
            };
          })
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
                    ? Math.floor(parsed.payment.cashAmount)
                    : undefined,
                paymentMethod: ['cash', 'transfer', 'qris'].includes(parsed.payment.paymentMethod)
                  ? parsed.payment.paymentMethod
                  : 'cash',
                customerName: parsed.payment.customerName ? String(parsed.payment.customerName).trim().slice(0, 40) || undefined : undefined,
              }
            : undefined,
        };
      }
    } catch {
      // Abort / timeout atau kendala jaringan -> langsung coba berikutnya / fallback
    }
  }

  // Cloud gagal/timeout -> gunakan hasil lokal yang sudah diperbaiki (tanpa jeda)
  if (localResult.action === 'ADD_ITEMS' && localResult.items.length === 0) {
    localResult.error = 'AI cloud tidak merespons (timeout/jaringan). Pencocokan lokal juga tidak menemukan barang. Coba ucapkan lebih spesifik.';
  }
  return localResult;
}
