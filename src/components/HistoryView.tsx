import React, { useState } from 'react';
import { Transaction, StoreProfile } from '../types';
import { deleteTransaction } from '../services/storageService';
import { printViaRawBT, printViaThermer } from '../services/directPrintService';
import { formatRupiah, formatDateIndo } from '../utils/formatters';
import {
  History,
  Printer,
  Trash2,
  Calendar,
  DollarSign,
  Receipt,
  Search,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Share2,
} from 'lucide-react';

interface HistoryViewProps {
  transactions: Transaction[];
  storeProfile: StoreProfile;
  onRefresh: () => void;
  onPrintReceipt: (trx: Transaction) => void;
  showToast: (msg: string, type?: 'success' | 'info') => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  transactions,
  storeProfile,
  onRefresh,
  onPrintReceipt,
  showToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter transactions
  const filtered = transactions.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const matchesInvoice = t.invoiceNo.toLowerCase().includes(q);
    const matchesCustomer = t.customerName?.toLowerCase().includes(q);
    const matchesItem = t.items.some((item) => item.name.toLowerCase().includes(q));
    return matchesInvoice || matchesCustomer || matchesItem;
  });

  // Calculate stats
  const totalOmset = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTransactions = transactions.filter((t) => t.date.startsWith(todayStr));
  const todayOmset = todayTransactions.reduce((sum, t) => sum + t.totalAmount, 0);

  const handleReprint = (t: Transaction) => {
    showToast(`Mencetak ulang struk ${t.invoiceNo}...`, 'info');
    onPrintReceipt(t);
  };

  const handleReprintRawBT = (t: Transaction) => {
    showToast(`⚡ Mengirim ulang ke RawBT Android (${t.invoiceNo})...`, 'success');
    printViaRawBT(t, storeProfile);
  };

  const handleReprintThermer = (t: Transaction) => {
    showToast(`🍎 Membuka Thermer iOS (${t.invoiceNo})...`, 'success');
    printViaThermer(t, storeProfile);
  };

  const handleDelete = (id: string, invoiceNo: string) => {
    if (window.confirm(`Hapus riwayat transaksi "${invoiceNo}"?`)) {
      deleteTransaction(id);
      onRefresh();
      showToast(`Riwayat ${invoiceNo} dihapus`, 'info');
    }
  };

  return (
    <div className="product-view-container">
      {/* Header */}
      <div className="page-header-row">
        <div className="page-title">
          <h2>
            <History size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} color="#2563eb" />
            Riwayat Transaksi Struk
          </h2>
          <p>Daftar seluruh struk yang pernah dibuat dan dicetak.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="history-stats-row">
        <div className="stat-card">
          <div className="stat-icon">
            <Receipt size={22} />
          </div>
          <div className="stat-info">
            <h4>Transaksi Hari Ini</h4>
            <span>{todayTransactions.length} Struk</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <DollarSign size={22} />
          </div>
          <div className="stat-info">
            <h4>Omset Hari Ini</h4>
            <span style={{ color: '#059669' }}>{formatRupiah(todayOmset)}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f8fafc', color: '#475569' }}>
            <Calendar size={22} />
          </div>
          <div className="stat-info">
            <h4>Total Semua Transaksi</h4>
            <span>{transactions.length} Struk ({formatRupiah(totalOmset)})</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="search-filter-card">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="form-input"
            placeholder="Cari berdasarkan No. Struk, Nama Barang, atau Pelanggan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="products-table-card">
        {filtered.length === 0 ? (
          <div className="empty-cart-state">
            <Receipt className="empty-cart-icon" />
            <p style={{ fontWeight: 600 }}>Belum ada riwayat transaksi</p>
            <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>
              Struk yang dicetak di menu Kasir akan otomatis tercatat di sini.
            </p>
          </div>
        ) : (
          <div className="cart-table-wrapper" style={{ margin: 0 }}>
            <table className="cart-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>No. Struk</th>
                  <th style={{ width: '20%' }}>Waktu Transaksi</th>
                  <th style={{ width: '25%' }}>Jumlah Barang</th>
                  <th style={{ width: '18%', textAlign: 'right' }}>Total Tagihan</th>
                  <th style={{ width: '15%', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const isExpanded = expandedId === t.id;
                  return (
                    <React.Fragment key={t.id}>
                      <tr>
                        <td>
                          <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                            {t.invoiceNo}
                          </div>
                          {t.customerName && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Plg: {t.customerName}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{formatDateIndo(t.date)}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : t.id)}
                            style={{
                              background: '#f1f5f9',
                              border: 'none',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                            }}
                          >
                            {t.items.length} Barang {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                          {formatRupiah(t.totalAmount)}
                        </td>
                        <td>
                          <div className="product-action-btns" style={{ justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn-icon-action"
                              style={{ color: '#059669', borderColor: '#a7f3d0' }}
                              onClick={() => handleReprint(t)}
                              title="Cetak Ulang Struk"
                            >
                              <Printer size={15} />
                            </button>
                            <button
                              type="button"
                              className="btn-icon-action delete"
                              onClick={() => handleDelete(t.id, t.invoiceNo)}
                              title="Hapus Riwayat"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Detail row if expanded */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} style={{ background: '#f8fafc', padding: '1rem 1.5rem' }}>
                            <div style={{ fontSize: '0.85rem' }}>
                              <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>
                                Rincian Barang Pembelian:
                              </div>
                              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {t.items.map((item, idx) => (
                                  <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px dotted #e2e8f0' }}>
                                    <span>
                                      <strong>{item.name}</strong> ({item.qty} {item.unit || 'pcs'} x {formatRupiah(item.price)})
                                    </span>
                                    <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                                      {formatRupiah(item.subtotal)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                              <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleReprint(t)}
                                    className="btn-outline"
                                    style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <Printer size={13} /> Cetak Browser
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleReprintRawBT(t)}
                                    className="btn-history-rawbt"
                                    title="Cetak ulang langsung via RawBT (Android)"
                                  >
                                    <Smartphone size={13} /> RawBT (Android)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleReprintThermer(t)}
                                    className="btn-history-thermer"
                                    title="Cetak ulang langsung via Thermer (iOS)"
                                  >
                                    <Share2 size={13} /> Thermer (iOS)
                                  </button>
                                </div>
                                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: '#475569' }}>
                                  <span>Bayar: <strong>{formatRupiah(t.cashAmount)}</strong></span>
                                  <span>Kembalian: <strong>{formatRupiah(t.changeAmount)}</strong></span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
