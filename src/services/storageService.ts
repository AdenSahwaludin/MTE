import { Product, Transaction, StoreProfile, UserAccount } from '../types';
import { DEFAULT_STORE_PROFILE, INITIAL_SAMPLE_PRODUCTS, DEFAULT_USERS } from './defaultData';
import { syncService } from './syncService';
import {
  fetchAllUsersFromTurso,
  upsertUserToTurso,
  deleteUserFromTurso,
} from './tursoClient';

// Clean up legacy persistent localStorage keys immediately
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

// Fast Reactive In-Memory State (0 ms read latency for POS autocomplete and UI)
let inMemoryProducts: Product[] = [...INITIAL_SAMPLE_PRODUCTS];
let inMemoryTransactions: Transaction[] = [];
let inMemoryStoreProfile: StoreProfile = { ...DEFAULT_STORE_PROFILE };
let inMemoryUsers: UserAccount[] = [...DEFAULT_USERS];

const SESSION_AUTH_KEY = 'mega_teknik_active_session';

// --- IN-MEMORY STATE SETTERS (Called by SyncService on fetch) ---

export const setInMemoryProducts = (products: Product[]) => {
  inMemoryProducts = Array.isArray(products) ? products : [];
};

export const setInMemoryTransactions = (transactions: Transaction[]) => {
  inMemoryTransactions = Array.isArray(transactions) ? transactions : [];
};

export const setInMemoryStoreProfile = (profile: StoreProfile) => {
  inMemoryStoreProfile = { ...DEFAULT_STORE_PROFILE, ...profile };
};

export const setInMemoryUsers = (users: UserAccount[]) => {
  inMemoryUsers = Array.isArray(users) && users.length > 0 ? users : [...DEFAULT_USERS];
};

// --- PRODUCTS ---

export const getProducts = (): Product[] => {
  return inMemoryProducts;
};

export const saveProductsListDirect = (products: Product[]): void => {
  inMemoryProducts = products;
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

export const addOrUpdateProduct = (
  name: string,
  price: number,
  aliases: string[] = [],
  unit: string = 'Pcs',
  category: string = 'Umum',
  id?: string
): { product: Product; isNew: boolean } => {
  const products = [...inMemoryProducts];
  const now = new Date().toISOString();

  if (id) {
    const index = products.findIndex((p) => p.id === id);
    if (index !== -1) {
      const updatedProduct: Product = {
        ...products[index],
        name: name.trim(),
        price,
        aliases: aliases.map((a) => a.trim()).filter(Boolean),
        unit: unit.trim() || 'Pcs',
        category: category.trim() || 'Umum',
        updatedAt: now,
      };
      products[index] = updatedProduct;
      inMemoryProducts = products;
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
      unit: unit || existing.unit,
      updatedAt: now,
    };
    products[existingIndex] = updatedProduct;
    inMemoryProducts = products;
    syncService.enqueue('UPSERT_PRODUCT', updatedProduct);
    return { product: updatedProduct, isNew: false };
  }

  const newProduct: Product = {
    id: 'prod-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    name: name.trim(),
    aliases: aliases.map((a) => a.trim()).filter(Boolean),
    price,
    unit: unit.trim() || 'Pcs',
    category: category.trim() || 'Umum',
    createdAt: now,
    updatedAt: now,
  };

  products.unshift(newProduct);
  inMemoryProducts = products;
  syncService.enqueue('UPSERT_PRODUCT', newProduct);
  return { product: newProduct, isNew: true };
};

export const deleteProduct = (id: string): void => {
  inMemoryProducts = inMemoryProducts.filter((p) => p.id !== id);
  syncService.enqueue('DELETE_PRODUCT', id);
};

// --- TRANSACTIONS ---

export const getTransactions = (): Transaction[] => {
  return inMemoryTransactions;
};

export const saveTransactionsListDirect = (transactions: Transaction[]): void => {
  inMemoryTransactions = transactions;
};

export const saveTransaction = (transaction: Transaction): void => {
  inMemoryTransactions = [transaction, ...inMemoryTransactions];
  syncService.enqueue('INSERT_TRANSACTION', transaction);
};

export const deleteTransaction = (id: string): void => {
  inMemoryTransactions = inMemoryTransactions.filter((t) => t.id !== id);
  syncService.enqueue('DELETE_TRANSACTION', id);
};

export const generateInvoiceNumber = (): string => {
  const now = new Date();
  const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const randomSuffix = Math.floor(10 + Math.random() * 90);
  return `MT-${dateStr}-${timeStr}${randomSuffix}`;
};

// --- STORE PROFILE ---

export const getStoreProfile = (): StoreProfile => {
  return inMemoryStoreProfile;
};

export const saveStoreProfileDirect = (profile: StoreProfile): void => {
  inMemoryStoreProfile = { ...DEFAULT_STORE_PROFILE, ...profile };
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
};

export const addOrUpdateUser = (
  userData: { username: string; password?: string; name: string; role: 'admin' | 'kasir' },
  id?: string
): UserAccount => {
  const users = [...inMemoryUsers];
  const now = new Date().toISOString();

  if (id) {
    const idx = users.findIndex((u) => u.id === id);
    if (idx !== -1) {
      const existing = users[idx];
      const updated: UserAccount = {
        ...existing,
        username: userData.username.trim().toLowerCase(),
        name: userData.name.trim(),
        role: userData.role,
        password: userData.password ? userData.password.trim() : existing.password,
      };
      users[idx] = updated;
      inMemoryUsers = users;
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
    };
    users[existingIdx] = updated;
    inMemoryUsers = users;
    syncService.enqueue('UPSERT_USER', updated);
    return updated;
  }

  const newUser: UserAccount = {
    id: 'user-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    username: userData.username.trim().toLowerCase(),
    password: (userData.password || '123456').trim(),
    name: userData.name.trim(),
    role: userData.role,
    createdAt: now,
  };

  users.push(newUser);
  inMemoryUsers = users;
  syncService.enqueue('UPSERT_USER', newUser);
  return newUser;
};

export const deleteUser = (id: string): boolean => {
  const users = [...inMemoryUsers];
  const target = users.find((u) => u.id === id);
  if (!target) return false;

  const admins = users.filter((u) => u.role === 'admin');
  if (target.role === 'admin' && admins.length <= 1) {
    return false;
  }

  inMemoryUsers = users.filter((u) => u.id !== id);
  syncService.enqueue('DELETE_USER', id);
  return true;
};

// Session storage for active authentication state (resets on browser session close)
export const getCurrentUser = (): UserAccount | null => {
  try {
    const raw = sessionStorage.getItem(SESSION_AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setCurrentUser = (user: UserAccount | null): void => {
  try {
    if (user) {
      sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(SESSION_AUTH_KEY);
    }
  } catch (err) {
    console.error('Failed to set current user in session storage:', err);
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
      inMemoryProducts = data.products;
    }
    if (data.profile) {
      inMemoryStoreProfile = { ...DEFAULT_STORE_PROFILE, ...data.profile };
    }
    if (data.transactions && Array.isArray(data.transactions)) {
      inMemoryTransactions = data.transactions;
    }
    if (data.users && Array.isArray(data.users)) {
      inMemoryUsers = data.users;
    }
    syncService.uploadAllLocalDataToTurso();
    return true;
  } catch (err) {
    console.error('Import failed:', err);
    return false;
  }
};
