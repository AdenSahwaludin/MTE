import { Product, Transaction, StoreProfile } from '../types';
import { DEFAULT_STORE_PROFILE, INITIAL_SAMPLE_PRODUCTS } from './defaultData';

const STORAGE_KEYS = {
  PRODUCTS: 'mega_teknik_products',
  TRANSACTIONS: 'mega_teknik_transactions',
  PROFILE: 'mega_teknik_profile',
};

// --- PRODUCT SERVICES ---
export const getProducts = (): Product[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!raw) {
      // Initialize with default sample products
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_SAMPLE_PRODUCTS));
      return INITIAL_SAMPLE_PRODUCTS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load products from storage:', err);
    return INITIAL_SAMPLE_PRODUCTS;
  }
};

export const saveProductsList = (products: Product[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  } catch (err) {
    console.error('Failed to save products list:', err);
  }
};

export const findProductByNameOrAlias = (query: string): Product | undefined => {
  if (!query || !query.trim()) return undefined;
  const q = query.trim().toLowerCase();
  const products = getProducts();

  // Exact name match first
  const exact = products.find((p) => p.name.toLowerCase() === q);
  if (exact) return exact;

  // Exact alias match
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

  // Sort: exact startsWith first
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
  const products = getProducts();
  const now = new Date().toISOString();

  // If ID is given, update that product
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
      saveProductsList(products);
      return { product: updatedProduct, isNew: false };
    }
  }

  // Check if product with same name exists
  const existingIndex = products.findIndex(
    (p) => p.name.toLowerCase() === name.trim().toLowerCase()
  );

  if (existingIndex !== -1) {
    // Update existing product price and merge aliases
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
    saveProductsList(products);
    return { product: updatedProduct, isNew: false };
  }

  // Create new product
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
  saveProductsList(products);
  return { product: newProduct, isNew: true };
};

export const deleteProduct = (id: string): void => {
  const products = getProducts().filter((p) => p.id !== id);
  saveProductsList(products);
};

// --- TRANSACTION SERVICES ---
export const getTransactions = (): Transaction[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to load transactions:', err);
    return [];
  }
};

export const saveTransaction = (transaction: Transaction): void => {
  try {
    const list = getTransactions();
    list.unshift(transaction);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save transaction:', err);
  }
};

export const deleteTransaction = (id: string): void => {
  const list = getTransactions().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(list));
};

export const generateInvoiceNumber = (): string => {
  const now = new Date();
  const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const randomSuffix = Math.floor(10 + Math.random() * 90);
  return `MT-${dateStr}-${timeStr}${randomSuffix}`;
};

// --- STORE PROFILE SERVICES ---
export const getStoreProfile = (): StoreProfile => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(DEFAULT_STORE_PROFILE));
      return DEFAULT_STORE_PROFILE;
    }
    return { ...DEFAULT_STORE_PROFILE, ...JSON.parse(raw) };
  } catch (err) {
    console.error('Failed to load store profile:', err);
    return DEFAULT_STORE_PROFILE;
  }
};

export const saveStoreProfile = (profile: StoreProfile): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  } catch (err) {
    console.error('Failed to save store profile:', err);
  }
};

// --- BACKUP & RESTORE ---
export const exportDataJSON = (): string => {
  const data = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    profile: getStoreProfile(),
    products: getProducts(),
    transactions: getTransactions(),
  };
  return JSON.stringify(data, null, 2);
};

export const importDataJSON = (jsonStr: string): boolean => {
  try {
    const data = JSON.parse(jsonStr);
    if (data.products && Array.isArray(data.products)) {
      saveProductsList(data.products);
    }
    if (data.profile) {
      saveStoreProfile(data.profile);
    }
    if (data.transactions && Array.isArray(data.transactions)) {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(data.transactions));
    }
    return true;
  } catch (err) {
    console.error('Import failed:', err);
    return false;
  }
};
