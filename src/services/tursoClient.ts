import { createClient, Client } from '@libsql/client/web';
import { Product, Transaction, StoreProfile, UserAccount } from '../types';

const DEFAULT_TURSO_URL = 'libsql://mega-teknik-elektronik-adensahwaludin.aws-ap-northeast-1.turso.io';
const DEFAULT_TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODcxNDg4MDYsImlkIjoiMDFhMDFhNWUtOGIwMS03NzgwLTliYjQtOTQ5YWIxYTk1M2VlIiwia2lkIjoiRVBsci1WZXk4cFpncEZUYmdmc3NmTXVMNUgzUWhDQVdzQk9sS204blJtMCIsInJpZCI6IjFmYTdhZmNlLWQ5ZWQtNDBmYi1hNThmLTUyZmE0OTNlZDNmYSJ9.-s_67DnajXUNcB9u4QBs-rz4HANrTWqICLWadCQ834fKIogiVv2Iut8KYAxeriYvRoL79HDoIfBtJ89u9ARhDg';

// Extract credentials injected via Vite define / environment variables with fallback
const rawUrl = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TURSO_DATABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.TURSO_DATABASE_URL) ||
  DEFAULT_TURSO_URL
).trim();

const rawToken = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TURSO_AUTH_TOKEN) ||
  (typeof process !== 'undefined' && process.env?.TURSO_AUTH_TOKEN) ||
  DEFAULT_TURSO_TOKEN
).trim();

// Normalize URL for web client fetch protocol
const tursoUrl = rawUrl.replace(/^libsql:\/\//, 'https://');

export const isTursoConfigured = (): boolean => {
  return Boolean(tursoUrl && rawToken);
};

export const getTursoConfig = () => {
  let hostname = '';
  try {
    hostname = tursoUrl ? new URL(tursoUrl).hostname : '';
  } catch {
    hostname = tursoUrl;
  }
  return {
    url: tursoUrl,
    hasToken: Boolean(rawToken),
    databaseHost: hostname,
  };
};

let clientInstance: Client | null = null;

export const getTursoClient = (): Client | null => {
  if (!isTursoConfigured()) return null;
  if (!clientInstance) {
    try {
      clientInstance = createClient({
        url: tursoUrl,
        authToken: rawToken,
      });
    } catch (err) {
      console.error('Failed to initialize Turso client:', err);
      return null;
    }
  }
  return clientInstance;
};

let tablesInitialized = false;

// Initialize SQLite tables in Turso database if they don't exist
export const initTursoTables = async (force: boolean = false): Promise<boolean> => {
  if (tablesInitialized && !force) return true;
  const client = getTursoClient();
  if (!client) return false;

  try {
    // 1. Table: products
    await client.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        aliases TEXT DEFAULT '[]',
        price REAL NOT NULL,
        unit TEXT DEFAULT 'Pcs',
        category TEXT DEFAULT 'Umum',
        created_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0
      );
    `);

    // Safe migration: add created_by to products if column missing
    try {
      await client.execute(`ALTER TABLE products ADD COLUMN created_by TEXT;`);
    } catch {
      // Column already exists
    }

    // 2. Table: transactions
    await client.execute(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        invoice_no TEXT NOT NULL,
        date TEXT NOT NULL,
        items TEXT NOT NULL,
        total_amount REAL NOT NULL,
        cash_amount REAL NOT NULL,
        change_amount REAL NOT NULL,
        payment_method TEXT DEFAULT 'cash',
        customer_name TEXT,
        cashier_name TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0
      );
    `);

    // Safe migration: add cashier_name to transactions if column missing
    try {
      await client.execute(`ALTER TABLE transactions ADD COLUMN cashier_name TEXT;`);
    } catch {
      // Column already exists
    }

    // 3. Table: store_profile
    await client.execute(`
      CREATE TABLE IF NOT EXISTS store_profile (
        id TEXT PRIMARY KEY DEFAULT 'default',
        name TEXT NOT NULL,
        tagline TEXT,
        address TEXT,
        phone TEXT,
        footer_note TEXT,
        paper_size TEXT DEFAULT '58mm',
        show_date_time INTEGER DEFAULT 1,
        show_cashier_name INTEGER DEFAULT 1,
        cashier_name TEXT DEFAULT 'Kasir 01',
        auto_save_products INTEGER DEFAULT 1,
        currency TEXT DEFAULT 'Rp',
        updated_at TEXT NOT NULL
      );
    `);

    // 4. Table: users (INTEGER PRIMARY KEY AUTOINCREMENT)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'kasir',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0
      );
    `);

    // Seed default users if users table is empty
    const usersCount = await client.execute(`SELECT COUNT(*) as count FROM users WHERE is_deleted = 0;`);
    const count = Number(usersCount.rows[0]?.count || 0);
    if (count === 0) {
      const now = new Date().toISOString();
      await client.batch([
        {
          sql: `
            INSERT OR IGNORE INTO users (id, username, password, name, role, created_at, updated_at, is_deleted)
            VALUES (1, 'admin', 'admin123', 'Administrator', 'admin', ?, ?, 0);
          `,
          args: [now, now],
        },
        {
          sql: `
            INSERT OR IGNORE INTO users (id, username, password, name, role, created_at, updated_at, is_deleted)
            VALUES (2, 'kasir', 'kasir123', 'Kasir 01', 'kasir', ?, ?, 0);
          `,
          args: [now, now],
        },
      ], 'write');
    }

    tablesInitialized = true;
    return true;
  } catch (err) {
    console.error('Failed to initialize Turso tables:', err);
    throw err;
  }
};

// Test connection
export const testTursoConnection = async (): Promise<{ success: boolean; latencyMs: number; error?: string }> => {
  const client = getTursoClient();
  if (!client) {
    return { success: false, latencyMs: 0, error: 'Turso credentials (.env) belum terkonfigurasi' };
  }

  const start = performance.now();
  try {
    await client.execute('SELECT 1 as ping;');
    const latencyMs = Math.round(performance.now() - start);
    return { success: true, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return { success: false, latencyMs, error: err?.message || String(err) };
  }
};

// --- PRODUCTS OPERATIONS ---

export const fetchAllProductsFromTurso = async (): Promise<Product[]> => {
  const client = getTursoClient();
  if (!client) return [];

  const result = await client.execute(`
    SELECT id, name, aliases, price, unit, category, created_by, created_at, updated_at
    FROM products
    WHERE is_deleted = 0
    ORDER BY updated_at DESC;
  `);

  return result.rows.map((row: any) => {
    let aliases: string[] = [];
    try {
      aliases = typeof row.aliases === 'string' ? JSON.parse(row.aliases) : (row.aliases || []);
    } catch {
      aliases = [];
    }

    return {
      id: String(row.id),
      name: String(row.name),
      aliases,
      price: Number(row.price),
      unit: String(row.unit || 'Pcs'),
      category: String(row.category || 'Umum'),
      createdBy: row.created_by ? String(row.created_by) : undefined,
      createdAt: String(row.created_at || new Date().toISOString()),
      updatedAt: String(row.updated_at || new Date().toISOString()),
    };
  });
};

export const upsertProductToTurso = async (product: Product): Promise<void> => {
  const client = getTursoClient();
  if (!client) return;

  await client.execute({
    sql: `
      INSERT INTO products (id, name, aliases, price, unit, category, created_by, created_at, updated_at, is_deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        aliases = excluded.aliases,
        price = excluded.price,
        unit = excluded.unit,
        category = excluded.category,
        created_by = COALESCE(excluded.created_by, products.created_by),
        updated_at = excluded.updated_at,
        is_deleted = 0;
    `,
    args: [
      product.id,
      product.name,
      JSON.stringify(product.aliases || []),
      product.price,
      product.unit || 'Pcs',
      product.category || 'Umum',
      product.createdBy || null,
      product.createdAt || new Date().toISOString(),
      product.updatedAt || new Date().toISOString(),
    ],
  });
};

export const deleteProductFromTurso = async (id: string): Promise<void> => {
  const client = getTursoClient();
  if (!client) return;

  const now = new Date().toISOString();
  await client.execute({
    sql: `UPDATE products SET is_deleted = 1, updated_at = ? WHERE id = ?;`,
    args: [now, id],
  });
};

export const batchUpsertProductsToTurso = async (products: Product[]): Promise<void> => {
  const client = getTursoClient();
  if (!client || products.length === 0) return;

  const CHUNK_SIZE = 50;
  for (let i = 0; i < products.length; i += CHUNK_SIZE) {
    const chunk = products.slice(i, i + CHUNK_SIZE);
    const statements = chunk.map((p) => ({
      sql: `
        INSERT INTO products (id, name, aliases, price, unit, category, created_by, created_at, updated_at, is_deleted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          aliases = excluded.aliases,
          price = excluded.price,
          unit = excluded.unit,
          category = excluded.category,
          created_by = COALESCE(excluded.created_by, products.created_by),
          updated_at = excluded.updated_at,
          is_deleted = 0;
      `,
      args: [
        p.id,
        p.name,
        JSON.stringify(p.aliases || []),
        p.price,
        p.unit || 'Pcs',
        p.category || 'Umum',
        p.createdBy || null,
        p.createdAt || new Date().toISOString(),
        p.updatedAt || new Date().toISOString(),
      ],
    }));

    await client.batch(statements, 'write');
  }
};

// --- TRANSACTIONS OPERATIONS ---

export const fetchAllTransactionsFromTurso = async (): Promise<Transaction[]> => {
  const client = getTursoClient();
  if (!client) return [];

  const result = await client.execute(`
    SELECT id, invoice_no, date, items, total_amount, cash_amount, change_amount, payment_method, customer_name, cashier_name, notes
    FROM transactions
    WHERE is_deleted = 0
    ORDER BY date DESC;
  `);

  return result.rows.map((row: any) => {
    let items = [];
    try {
      items = typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []);
    } catch {
      items = [];
    }

    return {
      id: String(row.id),
      invoiceNo: String(row.invoice_no),
      date: String(row.date),
      items,
      totalAmount: Number(row.total_amount),
      cashAmount: Number(row.cash_amount),
      changeAmount: Number(row.change_amount),
      paymentMethod: (row.payment_method || 'cash') as 'cash' | 'transfer' | 'qris',
      customerName: row.customer_name ? String(row.customer_name) : undefined,
      cashierName: row.cashier_name ? String(row.cashier_name) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
    };
  });
};

export const insertTransactionToTurso = async (trx: Transaction): Promise<void> => {
  const client = getTursoClient();
  if (!client) return;

  await client.execute({
    sql: `
      INSERT INTO transactions (
        id, invoice_no, date, items, total_amount, cash_amount, change_amount, payment_method, customer_name, cashier_name, notes, created_at, is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(id) DO UPDATE SET
        invoice_no = excluded.invoice_no,
        date = excluded.date,
        items = excluded.items,
        total_amount = excluded.total_amount,
        cash_amount = excluded.cash_amount,
        change_amount = excluded.change_amount,
        payment_method = excluded.payment_method,
        customer_name = excluded.customer_name,
        cashier_name = excluded.cashier_name,
        notes = excluded.notes,
        is_deleted = 0;
    `,
    args: [
      trx.id,
      trx.invoiceNo,
      trx.date,
      JSON.stringify(trx.items || []),
      trx.totalAmount,
      trx.cashAmount,
      trx.changeAmount,
      trx.paymentMethod || 'cash',
      trx.customerName || null,
      trx.cashierName || null,
      trx.notes || null,
      trx.date || new Date().toISOString(),
    ],
  });
};

export const deleteTransactionFromTurso = async (id: string): Promise<void> => {
  const client = getTursoClient();
  if (!client) return;

  await client.execute({
    sql: `UPDATE transactions SET is_deleted = 1 WHERE id = ?;`,
    args: [id],
  });
};

export const batchInsertTransactionsToTurso = async (transactions: Transaction[]): Promise<void> => {
  const client = getTursoClient();
  if (!client || transactions.length === 0) return;

  const CHUNK_SIZE = 50;
  for (let i = 0; i < transactions.length; i += CHUNK_SIZE) {
    const chunk = transactions.slice(i, i + CHUNK_SIZE);
    const statements = chunk.map((trx) => ({
      sql: `
        INSERT INTO transactions (
          id, invoice_no, date, items, total_amount, cash_amount, change_amount, payment_method, customer_name, cashier_name, notes, created_at, is_deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ON CONFLICT(id) DO UPDATE SET
          invoice_no = excluded.invoice_no,
          date = excluded.date,
          items = excluded.items,
          total_amount = excluded.total_amount,
          cash_amount = excluded.cash_amount,
          change_amount = excluded.change_amount,
          payment_method = excluded.payment_method,
          customer_name = excluded.customer_name,
          cashier_name = excluded.cashier_name,
          notes = excluded.notes,
          is_deleted = 0;
      `,
      args: [
        trx.id,
        trx.invoiceNo,
        trx.date,
        JSON.stringify(trx.items || []),
        trx.totalAmount,
        trx.cashAmount,
        trx.changeAmount,
        trx.paymentMethod || 'cash',
        trx.customerName || null,
        trx.cashierName || null,
        trx.notes || null,
        trx.date || new Date().toISOString(),
      ],
    }));

    await client.batch(statements, 'write');
  }
};

// --- STORE PROFILE OPERATIONS ---

export const fetchStoreProfileFromTurso = async (): Promise<StoreProfile | null> => {
  const client = getTursoClient();
  if (!client) return null;

  const result = await client.execute(`
    SELECT name, tagline, address, phone, footer_note, paper_size, show_date_time, show_cashier_name, cashier_name, auto_save_products, currency
    FROM store_profile
    WHERE id = 'default'
    LIMIT 1;
  `);

  if (result.rows.length === 0) return null;
  const row: any = result.rows[0];

  return {
    name: String(row.name),
    tagline: String(row.tagline || ''),
    address: String(row.address || ''),
    phone: String(row.phone || ''),
    footerNote: String(row.footer_note || ''),
    paperSize: (row.paper_size || '58mm') as '58mm',
    showDateTime: Boolean(row.show_date_time ?? 1),
    showCashierName: Boolean(row.show_cashier_name ?? 1),
    cashierName: String(row.cashier_name || 'Kasir 01'),
    autoSaveProducts: Boolean(row.auto_save_products ?? 1),
    currency: String(row.currency || 'Rp'),
  };
};

export const upsertStoreProfileToTurso = async (profile: StoreProfile): Promise<void> => {
  const client = getTursoClient();
  if (!client) return;

  const now = new Date().toISOString();
  await client.execute({
    sql: `
      INSERT INTO store_profile (
        id, name, tagline, address, phone, footer_note, paper_size, show_date_time, show_cashier_name, cashier_name, auto_save_products, currency, updated_at
      ) VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        tagline = excluded.tagline,
        address = excluded.address,
        phone = excluded.phone,
        footer_note = excluded.footer_note,
        paper_size = excluded.paper_size,
        show_date_time = excluded.show_date_time,
        show_cashier_name = excluded.show_cashier_name,
        cashier_name = excluded.cashier_name,
        auto_save_products = excluded.auto_save_products,
        currency = excluded.currency,
        updated_at = excluded.updated_at;
    `,
    args: [
      profile.name,
      profile.tagline || '',
      profile.address || '',
      profile.phone || '',
      profile.footerNote || '',
      profile.paperSize || '58mm',
      profile.showDateTime ? 1 : 0,
      profile.showCashierName ? 1 : 0,
      profile.cashierName || 'Kasir 01',
      profile.autoSaveProducts ? 1 : 0,
      profile.currency || 'Rp',
      now,
    ],
  });
};

// --- USERS OPERATIONS ---

export const fetchAllUsersFromTurso = async (): Promise<UserAccount[]> => {
  const client = getTursoClient();
  if (!client) return [];

  const result = await client.execute(`
    SELECT id, username, password, name, role, created_at, updated_at
    FROM users
    WHERE is_deleted = 0
    ORDER BY id ASC;
  `);

  return result.rows.map((row: any) => ({
    id: typeof row.id === 'number' ? row.id : (!isNaN(Number(row.id)) ? Number(row.id) : String(row.id)),
    username: String(row.username),
    password: String(row.password),
    name: String(row.name),
    role: (row.role || 'kasir') as 'admin' | 'kasir',
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
  }));
};

export const upsertUserToTurso = async (user: UserAccount): Promise<void> => {
  const client = getTursoClient();
  if (!client) return;

  const now = new Date().toISOString();
  await client.execute({
    sql: `
      INSERT INTO users (id, username, password, name, role, created_at, updated_at, is_deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        password = excluded.password,
        name = excluded.name,
        role = excluded.role,
        updated_at = excluded.updated_at,
        is_deleted = 0;
    `,
    args: [
      user.id,
      user.username.toLowerCase().trim(),
      user.password,
      user.name.trim(),
      user.role,
      user.createdAt || now,
      user.updatedAt || now,
    ],
  });
};

export const deleteUserFromTurso = async (id: number | string): Promise<void> => {
  const client = getTursoClient();
  if (!client) return;

  const now = new Date().toISOString();
  await client.execute({
    sql: `UPDATE users SET is_deleted = 1, updated_at = ? WHERE id = ?;`,
    args: [now, id],
  });
};

export const batchUpsertUsersToTurso = async (users: UserAccount[]): Promise<void> => {
  const client = getTursoClient();
  if (!client || users.length === 0) return;

  const now = new Date().toISOString();
  const statements = users.map((u) => ({
    sql: `
      INSERT INTO users (id, username, password, name, role, created_at, updated_at, is_deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        password = excluded.password,
        name = excluded.name,
        role = excluded.role,
        updated_at = excluded.updated_at,
        is_deleted = 0;
    `,
    args: [
      u.id,
      u.username.toLowerCase().trim(),
      u.password,
      u.name.trim(),
      u.role,
      u.createdAt || now,
      u.updatedAt || now,
    ],
  }));

  await client.batch(statements, 'write');
};

// --- SMART LOW-ROW METADATA CHECK ---
export interface RemoteTimestamps {
  productMod: string | null;
  trxMod: string | null;
  profileMod: string | null;
  userMod: string | null;
}

export const fetchLatestTimestampsFromTurso = async (): Promise<RemoteTimestamps | null> => {
  const client = getTursoClient();
  if (!client) return null;

  try {
    const results = await client.batch([
      { sql: `SELECT MAX(updated_at) as mod FROM products WHERE is_deleted = 0;`, args: [] },
      { sql: `SELECT MAX(created_at) as mod FROM transactions WHERE is_deleted = 0;`, args: [] },
      { sql: `SELECT updated_at as mod FROM store_profile WHERE id = 'default';`, args: [] },
      { sql: `SELECT MAX(updated_at) as mod FROM users WHERE is_deleted = 0;`, args: [] },
    ], 'read');

    return {
      productMod: results[0]?.rows[0]?.mod ? String(results[0].rows[0].mod) : null,
      trxMod: results[1]?.rows[0]?.mod ? String(results[1].rows[0].mod) : null,
      profileMod: results[2]?.rows[0]?.mod ? String(results[2].rows[0].mod) : null,
      userMod: results[3]?.rows[0]?.mod ? String(results[3].rows[0].mod) : null,
    };
  } catch (err) {
    console.error('Failed to fetch timestamps from Turso:', err);
    return null;
  }
};

// Clear all records from Turso database tables
export const clearAllTursoData = async (): Promise<void> => {
  const client = getTursoClient();
  if (!client) return;

  const now = new Date().toISOString();
  await client.batch([
    { sql: 'DELETE FROM products;', args: [] },
    { sql: 'DELETE FROM transactions;', args: [] },
    { sql: 'DELETE FROM store_profile;', args: [] },
    { sql: 'DELETE FROM users;', args: [] },
    {
      sql: `
        INSERT INTO users (id, username, password, name, role, created_at, updated_at, is_deleted)
        VALUES ('user-admin', 'admin', 'admin123', 'Administrator', 'admin', ?, ?, 0);
      `,
      args: [now, now],
    },
  ], 'write');
};
