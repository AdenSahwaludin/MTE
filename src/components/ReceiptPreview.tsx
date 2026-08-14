import React from 'react';
import { CartItem, StoreProfile } from '../types';
import { formatRupiah, formatDateIndo } from '../utils/formatters';
import { Printer, Eye } from 'lucide-react';

interface ReceiptPreviewProps {
  items: CartItem[];
  total: number;
  cash: number;
  change: number;
  invoiceNo: string;
  date: string;
  storeProfile: StoreProfile;
  customerName?: string;
  notes?: string;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({
  items,
  total,
  cash,
  change,
  invoiceNo,
  date,
  storeProfile,
  customerName,
  notes,
}) => {
  return (
    <div className="receipt-preview-panel">
      <div className="preview-header">
        <span>
          <Eye size={16} /> Live Preview Struk 58mm
        </span>
        <span style={{ fontSize: '0.72rem', background: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
          58 mm (Standar Mini)
        </span>
      </div>

      <div className="paper-receipt">
        {/* Header Toko */}
        <div className="receipt-store-header">
          <div className="receipt-store-title">{storeProfile.name}</div>
          {storeProfile.tagline && <div className="receipt-store-desc">{storeProfile.tagline}</div>}
          <div className="receipt-store-desc">{storeProfile.address}</div>
          <div className="receipt-store-desc">Telp: {storeProfile.phone}</div>
        </div>

        <hr className="receipt-double-divider" />

        {/* Metadata Struk */}
        <div className="receipt-meta-row">
          <span>No: {invoiceNo}</span>
          {storeProfile.showDateTime && <span>{formatDateIndo(date)}</span>}
        </div>
        {storeProfile.showCashierName && (
          <div className="receipt-meta-row">
            <span>Kasir: {storeProfile.cashierName}</span>
            {customerName && <span>Plg: {customerName}</span>}
          </div>
        )}

        <hr className="receipt-divider" />

        {/* Daftar Barang */}
        <div className="receipt-items-list">
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '10px 0', fontSize: '11px' }}>
              (Belum ada item ditambahkan)
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="receipt-item-row">
                <div className="receipt-item-name">{item.name}</div>
                <div className="receipt-item-calc">
                  <span>
                    {item.qty} {item.unit || 'pcs'} x {formatRupiah(item.price)}
                  </span>
                  <span>{formatRupiah(item.subtotal)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <hr className="receipt-divider" />

        {/* Ringkasan Total & Pembayaran */}
        <div className="receipt-summary-block">
          <div className="receipt-summary-row bold">
            <span>TOTAL</span>
            <span>{formatRupiah(total)}</span>
          </div>
          <div className="receipt-summary-row">
            <span>TUNAI / BAYAR</span>
            <span>{formatRupiah(cash)}</span>
          </div>
          <div className="receipt-summary-row">
            <span>KEMBALIAN</span>
            <span>{formatRupiah(Math.max(0, change))}</span>
          </div>
        </div>

        {notes && (
          <>
            <hr className="receipt-divider" />
            <div style={{ fontSize: '10px', fontStyle: 'italic' }}>Catatan: {notes}</div>
          </>
        )}

        <hr className="receipt-double-divider" />

        {/* Footer Toko */}
        <div className="receipt-footer-block">
          <div>{storeProfile.footerNote}</div>
          <div style={{ marginTop: '4px', fontWeight: 'bold' }}>*** TERIMA KASIH ***</div>
        </div>
      </div>
    </div>
  );
};
