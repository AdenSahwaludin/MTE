import { Product, Transaction, StoreProfile, UserAccount } from '../types';
import { DEFAULT_STORE_PROFILE, INITIAL_SAMPLE_PRODUCTS, DEFAULT_USERS } from './defaultData';
import { syncService } from './syncService';
import {
  createAuthSession,
  clearAuthSession,
  getActiveSessionUser,
} from './sessionStore';

// Clean up legacy persistent localStorage keys immediately (v1, unversioned).
// Data v2 (di bawah) dipertahankan — jangan dihapus.
const purgeLegacyLocalStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    const legacyKeys = [
      'mega_teknik_products',
      'mega_teknik_transactions',
      'mega_teknik_profile',
      'mega_teknik_users',
      'mega_teknik_sync_queue',
      'mega_teknik_last_sync_time',
    ];
    legacyKeys.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn('Failed to clear legacy local storage:', err);
  }
};

purgeLegacyLocalStorage();

// --- PERSISTENSI LOKAL v2 (tahan reload & offline) ---
// Sebelumnya semua state hanya in-memory: reload = data hilang.
// Sekarang setiap mutasi ditulis ke localStorage (best-effort, quota-safe).
const LS_PRODUCTS_KEY = 'mega_teknik_products_v2';
const LS_TRANSACTIONS_KEY = 'mega_teknik_transactions_v2';
const LS_PROFILE_KEY = 'mega_teknik_profile_v2';
const LS_USERS_KEY = 'mega_teknik_users_v2';
const MAX_LOCAL_TRANSACTIONS = 2000;

const readJSON = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJSON = (key: string, value: unknown): void => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to persist ${key} (quota?)`, err);
  }
};

const isValidProduct = (p: any): p is Product => {
  return Boolean(p) && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.price === 'number';
};

const loadPersistedProducts = (): Product[] => {
  const arr = readJSON<unknown>(LS_PRODUCTS_KEY, null);
  if (Array.isArray(arr)) {
    const valid = arr.filter(isValidProduct);
    if (valid.length > 0 || arr.length === 0) return valid;
  }
  return [...INITIAL_SAMPLE_PRODUCTS];
};

const loadPersistedTransactions = (): Transaction[] => {
  const arr = readJSON<unknown>(LS_TRANSACTIONS_KEY, null);
  if (Array.isArray(arr)) {
    return (arr as Transaction[]).filter((t) => t && typeof t.id === 'string');
  }
  return [];
};

const loadPersistedProfile = (): StoreProfile => {
  const obj = readJSON<Partial<StoreProfile> | null>(LS_PROFILE_KEY, null);
  if (obj && typeof obj === 'object') {
    return { ...DEFAULT_STORE_PROFILE, ...obj };
  }
  return { ...DEFAULT_STORE_PROFILE };
};

const loadPersistedUsers = (): UserAccount[] => {
  const arr = readJSON<unknown>(LS_USERS_KEY, null);
  if (Array.isArray(arr) && arr.length > 0) {
    const valid = (arr as UserAccount[]).filter((u) => u && typeof u.username === 'string');
    if (valid.length > 0) return valid;
  }
  return [...DEFAULT_USERS];
};

// Fast Reactive In-Memory State, dihidrasi dari localStorage (tahan reload)
let inMemoryProducts: Product[] = loadPersistedProducts();
let inMemoryTransactions: Transaction[] = loadPersistedTransactions();
let inMemoryStoreProfile: StoreProfile = loadPersistedProfile();
let inMemoryUsers: UserAccount[] = loadPersistedUsers();

const persistProducts = () => writeJSON(LS_PRODUCTS_KEY, inMemoryProducts);
const persistProfile = () => writeJSON(LS_PROFILE_KEY, inMemoryStoreProfile);
const persistUsers = () => writeJSON(LS_USERS_KEY, inMemoryUsers);
const persistTransactions = () => {
  try {
    const capped =
      inMemoryTransactions.length > MAX_LOCAL_TRANSACTIONS
        ? inMemoryTransactions.slice(0, MAX_LOCAL_TRANSACTIONS)
        : inMemoryTransactions;
    writeJSON(LS_TRANSACTIONS_KEY, capped);
  } catch {
    // Fallback ekstrem: simpan 500 terakhir saja
    try {
      writeJSON(LS_TRANSACTIONS_KEY, inMemoryTransactions.slice(0, 500));
    } catch {
      /* abaikan — in-memory tetap jalan */
    }
  }
};

const SESSION_AUTH_KEY = 'mega_teknik_active_session';

// --- IN-MEMORY STATE SETTERS (Called by SyncService on fetch) ---

export const setInMemoryProducts = (products: Product[]) => {
  inMemoryProducts = Array.isArray(products) ? products : [];
  persistProducts();
};

export const setInMemoryTransactions = (transactions: Transaction[]) => {
  inMemoryTransactions = Array.isArray(transactions) ? transactions : [];
  persistTransactions();
};

export const setInMemoryStoreProfile = (profile: StoreProfile) => {
  inMemoryStoreProfile = { ...DEFAULT_STORE_PROFILE, ...profile };
  persistProfile();
};

export const setInMemoryUsers = (users: UserAccount[]) => {
  inMemoryUsers = Array.isArray(users) && users.length > 0 ? users : [...DEFAULT_USERS];
  persistUsers();
};

// --- PRODUCTS ---

export const getProducts = (): Product[] => {
  return inMemoryProducts;
};

export const saveProductsListDirect = (products: Product[]): void => {
  inMemoryProducts = products;
  persistProducts();
};

export const findProductByNameOrAlias = (query: string): Product | undefined => {
  if (!query || !query.trim()) return undefined;
  const q = query.trim().toLowerCase();
  const products = getProducts();

  const exact = products.find((p) => p.name.toLowerCase() === q);
  if (exact) return exact;

  const aliasMatch = products.find((p) =>
    p.aliases.some((a) => a.toLowerCase() === q)
  );
  if (aliasMatch) return aliasMatch;

  return undefined;
};

export interface SearchMatch {
  product: Product;
  matchedBy: 'name' | 'alias';
  matchText?: string;
}

export const searchProducts = (query: string): SearchMatch[] => {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  const products = getProducts();
  const results: SearchMatch[] = [];

  for (const product of products) {
    const nameMatch = product.name.toLowerCase().includes(q);
    const matchedAlias = product.aliases.find((a) => a.toLowerCase().includes(q));

    if (nameMatch) {
      results.push({ product, matchedBy: 'name' });
    } else if (matchedAlias) {
      results.push({ product, matchedBy: 'alias', matchText: matchedAlias });
    }
  }

  return results.sort((a, b) => {
    const aStartsWith = a.product.name.toLowerCase().startsWith(q);
    const bStartsWith = b.product.name.toLowerCase().startsWith(q);
    if (aStartsWith && !bStartsWith) return -1;
    if (!aStartsWith && bStartsWith) return 1;
    return a.product.name.localeCompare(b.product.name);
  });
};

// ID unik lintas device tanpa server-sequence: timestamp base36 + random.
// crypto.randomUUID dipakai bila tersedia (secure), fallback manual.
export const generateUniqueId = (prefix: string): string => {
  try {
    const g: any = globalThis as any;
    if (g?.crypto?.randomUUID) return `${prefix}-${g.crypto.randomUUID()}`;
  } catch {
    /* fallback di bawah */
  }
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${time}-${rand}`;
};

export const generateTransactionId = (): string => generateUniqueId('trx');
export const generateCartItemId = (): string => generateUniqueId('cart');
export const generateSyncActionId = (): string => generateUniqueId('sync');

export const generateNextProductId = (products: Product[] = inMemoryProducts): string => {
  const existingIds = new Set(products.map((p) => p.id));
  let maxNumber = 0;
  for (const p of products) {
    if (!p.id) continue;
    const match = p.id.match(/^PRD-(\d{1,10})(?:[-_].*)?$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  // Coba sekuensial dulu (tetap enak dibaca), tapi WAJIB cek tabrakan
  // (sebelumnya fallback products.length bisa duplikat setelah hapus data).
  let candidate = maxNumber + 1;
  // Jika tidak ada format PRD sama sekali (mis. sample prod-1..8),
  // mulai dari panjang+1 namun tetap lewat loop cek di bawah.
  if (maxNumber === 0 && products.length > 0) {
    candidate = products.length + 1;
  }
  for (let i = 0; i < 10000; i++) {
    const id = `PRD-${String(candidate).padStart(6, '0')}`;
    if (!existingIds.has(id)) return id;
    candidate++;
  }
  // Fallback terakhir: timestamp+random (dijamin unik lintas device)
  return generateUniqueId('PRD');
};

export const getUniqueUnits = (products: Product[] = inMemoryProducts): string[] => {
  const set = new Set<string>();
  products.forEach((p) => {
    if (p.unit && p.unit.trim()) {
      set.add(p.unit.trim());
    }
  });
  return Array.from(set);
};

export const getUniqueCategories = (products: Product[] = inMemoryProducts): string[] => {
  const set = new Set<string>();
  products.forEach((p) => {
    if (p.category && p.category.trim()) {
      set.add(p.category.trim());
    }
  });
  return Array.from(set);
};

export const addOrUpdateProduct = (
  name: string,
  price: number,
  aliases: string[] = [],
  unit: string = 'Pcs',
  category: string = '',
  id?: string,
  createdBy?: string
): { product: Product; isNew: boolean } => {
  const products = [...inMemoryProducts];
  const now = new Date().toISOString();
  const activeUser = getCurrentUser();
  const creatorName = createdBy || activeUser?.name || 'Administrator';

  if (id) {
    const index = products.findIndex((p) => p.id === id);
    if (index !== -1) {
      const updatedProduct: Product = {
        ...products[index],
        name: name.trim(),
        price: Math.max(0, price),
        aliases: aliases.map((a) => a.trim()).filter(Boolean),
        unit: unit.trim() || 'Pcs',
        category: category.trim() || '',
        updatedAt: now,
      };
      products[index] = updatedProduct;
      inMemoryProducts = products;
      persistProducts();
      syncService.enqueue('UPSERT_PRODUCT', updatedProduct);
      return { product: updatedProduct, isNew: false };
    }
  }

  const existingIndex = products.findIndex(
    (p) => p.name.toLowerCase() === name.trim().toLowerCase()
  );

  if (existingIndex !== -1) {
    const existing = products[existingIndex];
    const mergedAliases = Array.from(
      new Set([...existing.aliases, ...aliases.map((a) => a.trim()).filter(Boolean)])
    );

    const updatedProduct: Product = {
      ...existing,
      price: price > 0 ? price : existing.price,
      aliases: mergedAliases,
      unit: unit.trim() || existing.unit || 'Pcs',
      category: category.trim() !== '' ? category.trim() : (existing.category || ''),
      updatedAt: now,
    };
    products[existingIndex] = updatedProduct;
    inMemoryProducts = products;
    persistProducts();
    syncService.enqueue('UPSERT_PRODUCT', updatedProduct);
    return { product: updatedProduct, isNew: false };
  }

  const newId = generateNextProductId(products);
  const newProduct: Product = {
    id: newId,
    name: name.trim(),
    aliases: aliases.map((a) => a.trim()).filter(Boolean),
    price,
    unit: unit.trim() || 'Pcs',
    category: category.trim() || '',
    createdBy: creatorName,
    createdAt: now,
    updatedAt: now,
  };

  products.unshift(newProduct);
  inMemoryProducts = products;
  persistProducts();
  syncService.enqueue('UPSERT_PRODUCT', newProduct);
  return { product: newProduct, isNew: true };
};

export const deleteProduct = (id: string): void => {
  inMemoryProducts = inMemoryProducts.filter((p) => p.id !== id);
  persistProducts();
  syncService.enqueue('DELETE_PRODUCT', id);
};

// --- TRANSACTIONS ---

export const getTransactions = (): Transaction[] => {
  return inMemoryTransactions;
};

export const saveTransactionsListDirect = (transactions: Transaction[]): void => {
  inMemoryTransactions = transactions;
  persistTransactions();
};

export const saveTransaction = (transaction: Transaction): void => {
  // Idempotency: cegah duplikat akibat double-keypress / double-click.
  if (inMemoryTransactions.some((t) => t.id === transaction.id)) return;
  const activeUser = getCurrentUser();
  const txWithCashier: Transaction = {
    ...transaction,
    cashierName: transaction.cashierName || activeUser?.name || 'Kasir',
  };
  inMemoryTransactions = [txWithCashier, ...inMemoryTransactions];
  persistTransactions();
  syncService.enqueue('INSERT_TRANSACTION', txWithCashier);
};

export const deleteTransaction = (id: string): void => {
  inMemoryTransactions = inMemoryTransactions.filter((t) => t.id !== id);
  persistTransactions();
  syncService.enqueue('DELETE_TRANSACTION', id);
};

export const generateInvoiceNumber = (transactions: Transaction[] = inMemoryTransactions): string => {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const dayPrefix = `MTE-${dd}-${mm}-${yy}-`;

  let maxSeq = 0;

  // Scan all existing transactions for matching day sequence
  transactions.forEach((t) => {
    if (t.invoiceNo && t.invoiceNo.startsWith(dayPrefix)) {
      const suffix = t.invoiceNo.slice(dayPrefix.length);
      const num = parseInt(suffix, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  });

  // Loop cek eksistensi: cegah duplikat saat 2 transaksi dibuat dalam 1 render
  // sebelum state ter-refresh. CATATAN: sekuens harian tetap lokal per device;
  // id transaksi (UUID) yang menjadi kunci unik lintas device, bukan invoiceNo.
  const existing = new Set(transactions.map((t) => t.invoiceNo));
  let nextSeq = maxSeq + 1;
  for (let i = 0; i < 10000; i++) {
    const candidate = `${dayPrefix}${String(nextSeq).padStart(3, '0')}`;
    if (!existing.has(candidate)) return candidate;
    nextSeq++;
  }
  // Fallback sangat jarang: tambah suffix random agar tetap unik di layar
  return `${dayPrefix}${String(nextSeq).padStart(3, '0')}-${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
};

// --- STORE PROFILE ---

export const getStoreProfile = (): StoreProfile => {
  return inMemoryStoreProfile;
};

export const saveStoreProfileDirect = (profile: StoreProfile): void => {
  inMemoryStoreProfile = { ...DEFAULT_STORE_PROFILE, ...profile };
  persistProfile();
};

export const saveStoreProfile = (profile: StoreProfile): void => {
  saveStoreProfileDirect(profile);
  syncService.enqueue('UPSERT_PROFILE', profile);
};

// --- USERS & AUTHENTICATION ---

export const getUsers = (): UserAccount[] => {
  return inMemoryUsers;
};

export const saveUsers = (users: UserAccount[]): void => {
  inMemoryUsers = users;
  persistUsers();
};

// Gate klien untuk aksi admin. BUKAN pengganti otorisasi server
// (token frontend = publik), tapi mencegah kasir mengubah user
// lewat UI normal + mencegah kesalahan pemakaian API.
const assertAdminSession = (): void => {
  const caller = getActiveSessionUser();
  // Bootstrap tanpa sesi (mis. seed awal) tetap diizinkan;
  // setelah ada sesi aktif, wajib admin.
  if (caller && caller.role !== 'admin') {
    throw {
      code: 'FORBIDDEN',
      messageId: 'Hanya Administrator yang boleh mengelola pengguna.',
      messageEn: 'Only administrators can manage users.',
    };
  }
};

export const addOrUpdateUser = (
  userData: { username: string; password?: string; name: string; role: 'admin' | 'kasir' },
  id?: number | string
): UserAccount => {
  assertAdminSession();
  const users = [...inMemoryUsers];
  const now = new Date().toISOString();

  if (id !== undefined && id !== null && id !== '') {
    const idx = users.findIndex((u) => String(u.id) === String(id));
    if (idx !== -1) {
      const existing = users[idx];
      const updated: UserAccount = {
        ...existing,
        username: userData.username.trim().toLowerCase(),
        name: userData.name.trim(),
        role: userData.role,
        password: userData.password ? userData.password.trim() : existing.password,
        updatedAt: now,
      };
      users[idx] = updated;
      inMemoryUsers = users;
      persistUsers();
      syncService.enqueue('UPSERT_USER', updated);
      return updated;
    }
  }

  const existingIdx = users.findIndex(
    (u) => u.username.toLowerCase() === userData.username.trim().toLowerCase()
  );

  if (existingIdx !== -1) {
    const existing = users[existingIdx];
    const updated: UserAccount = {
      ...existing,
      name: userData.name.trim(),
      role: userData.role,
      password: userData.password ? userData.password.trim() : existing.password,
      updatedAt: now,
    };
    users[existingIdx] = updated;
    inMemoryUsers = users;
    persistUsers();
    syncService.enqueue('UPSERT_USER', updated);
    return updated;
  }

  // ID integer unik anti-tabrakan: max+1 dengan loop cek eksistensi
  // (sebelumnya users.length+1 bisa duplikat setelah hapus / id string).
  const takenIds = new Set(users.map((u) => String(u.id)));
  const maxIntId = users.reduce((max, u) => {
    const n = Number(u.id);
    return !isNaN(n) && Number.isInteger(n) && n > max ? n : max;
  }, 0);
  let nextId: number = maxIntId + 1;
  if (maxIntId <= 0) nextId = users.length + 1;
  while (takenIds.has(String(nextId))) nextId++;

  const newUser: UserAccount = {
    id: nextId,
    username: userData.username.trim().toLowerCase(),
    password: (userData.password || '123456').trim(),
    name: userData.name.trim(),
    role: userData.role,
    createdAt: now,
    updatedAt: now,
  };

  users.push(newUser);
  inMemoryUsers = users;
  persistUsers();
  syncService.enqueue('UPSERT_USER', newUser);
  return newUser;
};

export const deleteUser = (id: number | string): boolean => {
  try {
    assertAdminSession();
  } catch {
    return false;
  }
  const users = [...inMemoryUsers];
  const target = users.find((u) => String(u.id) === String(id));
  if (!target) return false;

  const admins = users.filter((u) => u.role === 'admin');
  if (target.role === 'admin' && admins.length <= 1) {
    return false;
  }

  inMemoryUsers = users.filter((u) => String(u.id) !== String(id));
  persistUsers();
  syncService.enqueue('DELETE_USER', id);
  return true;
};

// Session storage for active authentication state with 7-day sliding expiration
export const getCurrentUser = (): UserAccount | null => {
  return getActiveSessionUser();
};

export const setCurrentUser = (user: UserAccount | null): void => {
  if (user) {
    createAuthSession(user);
  } else {
    clearAuthSession();
  }
};

// --- BACKUP & EXPORT ---

export const exportDataJSON = (): string => {
  const data = {
    exportedAt: new Date().toISOString(),
    version: '1.2',
    profile: getStoreProfile(),
    products: getProducts(),
    transactions: getTransactions(),
    users: getUsers(),
  };
  return JSON.stringify(data, null, 2);
};

export const importDataJSON = (jsonStr: string): boolean => {
  try {
    const data = JSON.parse(jsonStr);
    if (data.products && Array.isArray(data.products)) {
      const valid = (data.products as unknown[]).filter(
        (p): p is Product => Boolean(p) && typeof (p as Product).id === 'string' && typeof (p as Product).name === 'string'
      );
      inMemoryProducts = valid;
      persistProducts();
    }
    if (data.profile && typeof data.profile === 'object') {
      inMemoryStoreProfile = { ...DEFAULT_STORE_PROFILE, ...data.profile };
      persistProfile();
    }
    if (data.transactions && Array.isArray(data.transactions)) {
      const valid = (data.transactions as unknown[]).filter(
        (t): t is Transaction => Boolean(t) && typeof (t as Transaction).id === 'string'
      );
      inMemoryTransactions = valid;
      persistTransactions();
    }
    if (data.users && Array.isArray(data.users)) {
      const valid = (data.users as unknown[]).filter(
        (u): u is UserAccount => Boolean(u) && typeof (u as UserAccount).username === 'string' && typeof (u as UserAccount).password === 'string'
      );
      if (valid.length > 0) {
        // Jangan biarkan import mengunci sistem tanpa admin
        const hasAdmin = valid.some((u) => u.role === 'admin');
        inMemoryUsers = hasAdmin ? valid : [...valid, ...DEFAULT_USERS.filter((d) => d.role === 'admin')];
        persistUsers();
      }
    }
    syncService.uploadAllLocalDataToTurso();
    return true;
  } catch (err) {
    console.error('Import failed:', err);
    return false;
  }
};
