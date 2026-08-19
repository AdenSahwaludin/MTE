import { createClient } from '@libsql/client/web';

const client = createClient({
  url: 'https://mega-teknik-elektronik-adensahwaludin.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODcxNDg4MDYsImlkIjoiMDFhMDFhNWUtOGIwMS03NzgwLTliYjQtOTQ5YWIxYTk1M2VlIiwia2lkIjoiRVBsci1WZXk4cFpncEZUYmdmc3NmTXVMNUgzUWhDQVdzQk9sS204blJtMCIsInJpZCI6IjFmYTdhZmNlLWQ5ZWQtNDBmYi1hNThmLTUyZmE0OTNlZDNmYSJ9.-s_67DnajXUNcB9u4QBs-rz4HANrTWqICLWadCQ834fKIogiVv2Iut8KYAxeriYvRoL79HDoIfBtJ89u9ARhDg'
});

async function clearDatabase() {
  console.log('Menghapus semua isi data di Turso Database...');
  
  await client.execute('DELETE FROM products;');
  await client.execute('DELETE FROM transactions;');
  await client.execute('DELETE FROM store_profile;');

  const pCount = await client.execute('SELECT COUNT(*) as count FROM products;');
  const tCount = await client.execute('SELECT COUNT(*) as count FROM transactions;');
  const sCount = await client.execute('SELECT COUNT(*) as count FROM store_profile;');

  console.log('Hasil pengosongan database Turso:');
  console.log('- Total Produk di Turso:', pCount.rows[0].count);
  console.log('- Total Transaksi di Turso:', tCount.rows[0].count);
  console.log('- Total Profil Toko di Turso:', sCount.rows[0].count);
  console.log('Database Turso telah bersih / kosong 100%.');
}

clearDatabase().catch(console.error);
