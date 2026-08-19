import { createClient } from '@libsql/client/web';

const client = createClient({
  url: 'https://mega-teknik-elektronik-adensahwaludin.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODcxNDg4MDYsImlkIjoiMDFhMDFhNWUtOGIwMS03NzgwLTliYjQtOTQ5YWIxYTk1M2VlIiwia2lkIjoiRVBsci1WZXk4cFpncEZUYmdmc3NmTXVMNUgzUWhDQVdzQk9sS204blJtMCIsInJpZCI6IjFmYTdhZmNlLWQ5ZWQtNDBmYi1hNThmLTUyZmE0OTNlZDNmYSJ9.-s_67DnajXUNcB9u4QBs-rz4HANrTWqICLWadCQ834fKIogiVv2Iut8KYAxeriYvRoL79HDoIfBtJ89u9ARhDg'
});

async function run() {
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table';");
  console.log('Existing tables:', tables.rows.map(r => r.name));
  
  try {
    const users = await client.execute('SELECT * FROM users');
    console.log('Users in table users:', JSON.stringify(users.rows, null, 2));
  } catch (err) {
    console.log('Error selecting from users:', err.message);
  }
}

run().catch(console.error);
