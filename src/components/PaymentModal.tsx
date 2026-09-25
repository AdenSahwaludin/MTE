import React, { useEffect, useRef } from 'react';
import { CartItem, StoreProfile } from '../types';
import { FormattedNumberInput } from './FormattedNumberInput';
import { formatRupiah } from '../utils/formatters';
import {
  X,
  Save,
  Bluetooth,
  Share2,
  CheckCircle2,
  AlertCircle,
  Coins,
  ArrowLeft,
  Check,
  Banknote,
  QrCode,
  CreditCard,
} from 'lucide-react';

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  cartItems: CartItem[];
  invoiceNo: string;
  paymentMethod: 'cash' | 'transfer' | 'qris';
  setPaymentMethod: (method: 'cash' | 'transfer' | 'qris') => void;
  cashAmount: string;
  setCashAmount: (val: string) => void;
  smartCashSuggestions: number[];
  numericCash: number;
  changeAmount: number;
  isInsufficientCash: boolean;
  customerName: string;
  setCustomerName: (val: string) => void;
  notes: string;
  setNotes: (val: string) => void;
  onSaveOnly: () => void;
  onPrintBluetooth: () => void;
  isPrintingBt: boolean;
  onPrintThermer: () => void;
  storeProfile: StoreProfile;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  totalAmount,
  cartItems,
  invoiceNo,
  paymentMethod,
  setPaymentMethod,
  cashAmount,
  setCashAmount,
  smartCashSuggestions,
  numericCash,
  changeAmount,
  isInsufficientCash,
  customerName,
  setCustomerName,
  notes,
  setNotes,
  onSaveOnly,
  onPrintBluetooth,
  isPrintingBt,
  onPrintThermer,
}) => {
  const cashInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape or handle keyboard shortcuts inside modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (!isInsufficientCash) {
          onSaveOnly();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isInsufficientCash, onSaveOnly, onClose]);

  // Focus cash input on desktop when modal opens
  useEffect(() => {
    if (isOpen) {
      const isMobile =
        typeof window !== 'undefined' &&
        (window.matchMedia('(hover: none) and (pointer: coarse)').matches || window.innerWidth < 768);
      if (!isMobile) {
        setTimeout(() => {
          cashInputRef.current?.focus();
        }, 100);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalQty = cartItems.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container payment-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header payment-modal-header">
          <div className="payment-modal-title-wrap">
            <div className="payment-modal-title">
              <Coins size={18} color="#2563eb" />
              <span>Pembayaran</span>
            </div>
            <span className="payment-modal-invoice-tag">
              {invoiceNo} • {totalQty} pcs
            </span>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Tutup (Esc)">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body payment-modal-body">
          {/* Total Box */}
          <div className="payment-total-box">
            <div className="payment-total-info">
              <span className="payment-total-label">TOTAL</span>
              <span className="payment-total-items-badge">{totalQty} pcs</span>
            </div>
            <div className="payment-total-amount">{formatRupiah(totalAmount)}</div>
          </div>

          {/* Metode Pembayaran (Segmented Control) */}
          <div className="payment-method-selector">
            <button
              type="button"
              className={`method-tab-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
              onClick={() => setPaymentMethod('cash')}
            >
              <Banknote size={16} />
              <span>Tunai</span>
            </button>
            <button
              type="button"
              className={`method-tab-btn ${paymentMethod === 'qris' ? 'active' : ''}`}
              onClick={() => {
                setPaymentMethod('qris');
                setCashAmount(totalAmount.toString());
              }}
            >
              <QrCode size={16} />
              <span>QRIS</span>
            </button>
            <button
              type="button"
              className={`method-tab-btn ${paymentMethod === 'transfer' ? 'active' : ''}`}
              onClick={() => {
                setPaymentMethod('transfer');
                setCashAmount(totalAmount.toString());
              }}
            >
              <CreditCard size={16} />
              <span>Transfer</span>
            </button>
          </div>

          {/* Skenario 1: Pembayaran Tunai (Cash) */}
          {paymentMethod === 'cash' ? (
            <div className="payment-field-group">
              <div className="payment-label-row">
                <label className="payment-section-label">
                  <Coins size={14} color="#2563eb" /> Uang Diterima
                </label>
                {numericCash > 0 && changeAmount === 0 && (
                  <span className="badge-exact-cash">
                    <Check size={12} /> Uang Pas
                  </span>
                )}
              </div>

              {/* Quick Cash Suggestions */}
              <div className="quick-cash-chips-container">
                {smartCashSuggestions.map((amount, idx) => {
                  const isSelected = numericCash === amount;
                  return (
                    <button
                      key={amount}
                      type="button"
                      className={`btn-quick-chip ${isSelected ? 'active' : ''} ${idx === 0 ? 'exact' : ''}`}
                      onClick={() => setCashAmount(amount.toString())}
                    >
                      {idx === 0 ? (
                        <>
                          <span className="chip-label">Pas:</span>
                          <span className="chip-val">{formatRupiah(amount)}</span>
                        </>
                      ) : (
                        <span className="chip-val">{formatRupiah(amount)}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Custom Cash Input */}
              <div className="price-input-wrapper payment-input-custom">
                <span className="currency-prefix">Rp</span>
                <FormattedNumberInput
                  inputRef={cashInputRef}
                  className={`form-input ${isInsufficientCash ? 'warning' : ''}`}
                  placeholder="0"
                  value={cashAmount}
                  onChange={(val) => setCashAmount(val)}
                />
              </div>

              {/* Insufficient Cash Notice */}
              {isInsufficientCash && (
                <div className="insufficient-alert">
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>
                    Kurang <strong>{formatRupiah(totalAmount - numericCash)}</strong>
                  </span>
                </div>
              )}

              {/* Kembalian / Status Display */}
              {numericCash > 0 && !isInsufficientCash && (
                <div className="change-display-compact ok">
                  <div className="change-label">
                    <CheckCircle2 size={16} color="#059669" />
                    <span>Kembalian:</span>
                  </div>
                  <span className="change-value">{formatRupiah(Math.max(0, changeAmount))}</span>
                </div>
              )}
            </div>
          ) : (
            /* Skenario 2: Pembayaran Non-Tunai (QRIS / Transfer Bank) */
            <div className="non-cash-info-card">
              <div className="non-cash-icon-wrap">
                {paymentMethod === 'qris' ? <QrCode size={22} /> : <CreditCard size={22} />}
              </div>
              <div className="non-cash-text-wrap">
                <div className="non-cash-title">
                  {paymentMethod === 'qris' ? 'QRIS' : 'Transfer Bank'}
                </div>
                <div className="non-cash-desc">
                  Uang pas: <strong>{formatRupiah(totalAmount)}</strong> (tanpa kembalian)
                </div>
              </div>
            </div>
          )}

          {/* Info Pelanggan & Catatan */}
          <div className="payment-field-group">
            <div className="form-group" style={{ marginBottom: '0.6rem' }}>
              <label className="payment-section-label" htmlFor="payment-customer">
                Pelanggan (opsional)
              </label>
              <input
                id="payment-customer"
                type="text"
                className="form-input"
                placeholder="Nama pelanggan..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                maxLength={60}
                autoComplete="off"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="payment-section-label" htmlFor="payment-notes">
                Catatan (opsional)
              </label>
              <input
                id="payment-notes"
                type="text"
                className="form-input"
                placeholder={
                  paymentMethod === 'qris'
                    ? 'Catatan QRIS / keterangan...'
                    : paymentMethod === 'transfer'
                    ? 'No. Ref / bank...'
                    : 'Catatan struk / garansi...'
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={120}
                autoComplete="off"
              />
            </div>
          </div>

          {/* Cetak & Simpan Action Buttons */}
          <div className="payment-actions-section">
            {/* Primary Bluetooth Direct Print */}
            <button
              type="button"
              className="btn-primary-bluetooth"
              onClick={onPrintBluetooth}
              disabled={isPrintingBt || isInsufficientCash}
              title="Cetak langsung ke printer Bluetooth"
            >
              <Bluetooth size={19} className={isPrintingBt ? 'animate-spin' : ''} />
              <div className="btn-bt-content">
                <span className="btn-bt-title">
                  {isPrintingBt ? 'Menghubungkan...' : 'Cetak Bluetooth'}
                </span>
                <span className="btn-bt-subtitle">Thermal 58mm</span>
              </div>
            </button>

            {/* Secondary Action Grid: Save Only & Thermer iOS */}
            <div className="action-buttons-grid">
              <button
                type="button"
                className="btn-primary-save-only"
                onClick={onSaveOnly}
                disabled={isInsufficientCash}
                title="Simpan transaksi tanpa cetak (F3)"
              >
                <Save size={17} />
                <span>Simpan <span className="btn-shortcut-tag">(F3)</span></span>
              </button>

              <button
                type="button"
                className="btn-direct-app thermer"
                onClick={onPrintThermer}
                disabled={isInsufficientCash}
                title="Cetak via Thermer iOS"
              >
                <Share2 size={14} />
                <span>Thermer iOS</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer: Back to Cart Button */}
        <div className="modal-footer payment-modal-footer">
          <button type="button" className="btn-outline-compact" onClick={onClose}>
            <ArrowLeft size={15} /> Kembali
          </button>
          <span className="esc-hint">
            <kbd>Esc</kbd> Batal
          </span>
        </div>
      </div>
    </div>
  );
};
