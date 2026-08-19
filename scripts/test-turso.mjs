import { createClient } from '@libsql/client/web';

const client = createClient({
  url: 'https://mega-teknik-elektronik-adensahwaludin.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODcxNDg4MDYsImlkIjoiMDFhMDFhNWUtOGIwMS03NzgwLTliYjQtOTQ5YWIxYTk1M2VlIiwia2lkIjoiRVBsci1WZXk4cFpncEZUYmdmc3NmTXVMNUgzUWhDQVdzQk9sS204blJtMCIsInJpZCI6IjFmYTdhZmNlLWQ5ZWQtNDBmYi1hNThmLTUyZmE0OTNlZDNmYSJ9.-s_67DnajXUNcB9u4QBs-rz4HANrTWqICLWadCQ834fKIogiVv2Iut8KYAxeriYvRoL79HDoIfBtJ89u9ARhDg'
});

async function main() {
  console.log('Initializing Turso tables...');
  await client.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      aliases TEXT DEFAULT '[]',
      price REAL NOT NULL,
      unit TEXT DEFAULT 'Pcs',
      category TEXT DEFAULT 'Umum',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_deleted INTEGER DEFAULT 0
    );
  `);
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
      notes TEXT,
      created_at TEXT NOT NULL,
      is_deleted INTEGER DEFAULT 0
    );
  `);
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

  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table';");
  console.log('Turso tables ready:', tables.rows.map(r => r.name));
}

main().catch(console.error);
