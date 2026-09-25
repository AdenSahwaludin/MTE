import React from 'react';
import { Transaction, StoreProfile } from '../types';
import { formatRupiah, formatDateIndo } from '../utils/formatters';

interface ThermalReceiptProps {
  transaction: Transaction | null;
  storeProfile: StoreProfile;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ transaction, storeProfile }) => {
  if (!transaction) return null;

  return (
    <div id="thermal-print-target">
      <div className="thermal-receipt-container">
        {/* Header Toko */}
        <div className="thermal-header">
          <div className="thermal-logo-wrap">
            <img src="/logo.webp" alt="Logo" className="thermal-logo-img" />
          </div>
          <div className="thermal-store-name">{storeProfile.name}</div>
          {storeProfile.tagline && <div className="thermal-store-info">{storeProfile.tagline}</div>}
          <div className="thermal-store-info">{storeProfile.address}</div>
          {storeProfile.phone && <div className="thermal-store-info">Telp: {storeProfile.phone}</div>}
        </div>

        <hr className="thermal-double-divider" />

        {/* Info Transaksi */}
        {storeProfile.showDateTime && (
          <div className="thermal-meta-row" style={{ justifyContent: 'center' }}>
            <span>{formatDateIndo(transaction.date)}</span>
          </div>
        )}
        {storeProfile.showCashierName && (
          <div className="thermal-meta-row">
            <span>Kasir: {transaction.cashierName || storeProfile.cashierName}</span>
            {transaction.customerName && <span>Plg: {transaction.customerName}</span>}
          </div>
        )}
        {!storeProfile.showCashierName && transaction.customerName && (
          <div className="thermal-meta-row">
            <span>Plg: {transaction.customerName}</span>
          </div>
        )}

        <hr className="thermal-divider" />

        {/* Daftar Barang */}
        <div className="thermal-items-list">
          {transaction.items && transaction.items.map((item, index) => (
            <div key={index} className="thermal-item-entry">
              <div className="thermal-item-name">
                {item.name}
                {item.isNego && <span style={{ fontSize: '8px', marginLeft: '3px' }}> (Nego)</span>}
              </div>
              <div className="thermal-item-detail">
                <span>
                  {item.qty} {item.unit || 'pcs'} x {formatRupiah(item.price)}
                </span>
                <span>{formatRupiah(item.subtotal)}</span>
              </div>
            </div>
          ))}
        </div>

        <hr className="thermal-divider" />

        {/* Total & Bayar */}
        <div className="thermal-totals-section">
          <div className="thermal-total-row grand-total">
            <span>TOTAL</span>
            <span>{formatRupiah(transaction.totalAmount)}</span>
          </div>
          <div className="thermal-total-row">
            <span>
              {transaction.paymentMethod === 'qris'
                ? 'BAYAR (QRIS)'
                : transaction.paymentMethod === 'transfer'
                ? 'BAYAR (TRANSFER)'
                : 'TUNAI / BAYAR'}
            </span>
            <span>{formatRupiah(transaction.cashAmount)}</span>
          </div>
          <div className="thermal-total-row">
            <span>KEMBALIAN</span>
            <span>{formatRupiah(Math.max(0, transaction.changeAmount))}</span>
          </div>
        </div>

        {transaction.notes && (
          <>
            <hr className="thermal-divider" />
            <div style={{ fontSize: '9px', fontStyle: 'italic', margin: '1.5mm 0' }}>
              Catatan: {transaction.notes}
            </div>
          </>
        )}

        <hr className="thermal-double-divider" />

        {/* Footer */}
        <div className="thermal-footer">
          {storeProfile.footerNote && <div>{storeProfile.footerNote}</div>}
          <div style={{ marginTop: '2mm', fontWeight: 'bold' }}>*** TERIMA KASIH ***</div>
        </div>
      </div>
    </div>
  );
};
