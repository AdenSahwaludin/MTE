import React, { useEffect, useRef } from 'react';
import { CartItem, StoreProfile } from '../types';
import { FormattedNumberInput } from './FormattedNumberInput';
import { formatRupiah } from '../utils/formatters';
import {
  X,
  Printer,
  Save,
  Bluetooth,
  Smartphone,
  Share2,
  CheckCircle2,
  AlertCircle,
  Coins,
  ArrowLeft,
  Check,
} from 'lucide-react';

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  cartItems: CartItem[];
  invoiceNo: string;
  cashAmount: string;
  setCashAmount: (val: string) => void;
  smartCashSuggestions: number[];
  numericCash: number;
  changeAmount: number;
  isInsufficientCash: boolean;
  onSaveOnly: () => void;
  onPrintBluetooth: () => void;
  isPrintingBt: boolean;
  onPrintReceipt: () => void;
  onPrintRawBT: () => void;
  onPrintThermer: () => void;
  storeProfile: StoreProfile;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  totalAmount,
  cartItems,
  invoiceNo,
  cashAmount,
  setCashAmount,
  smartCashSuggestions,
  numericCash,
  changeAmount,
  isInsufficientCash,
  onSaveOnly,
  onPrintBluetooth,
  isPrintingBt,
  onPrintReceipt,
  onPrintRawBT,
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
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (!isInsufficientCash) {
          onPrintReceipt();
        }
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (!isInsufficientCash) {
          onSaveOnly();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isInsufficientCash, onPrintReceipt, onSaveOnly, onClose]);

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
              <span>Pembayaran & Cetak Struk</span>
            </div>
            <span className="payment-modal-invoice-tag">
              {invoiceNo} • {cartItems.length} Barang ({totalQty} Pcs)
            </span>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Tutup Modal (Esc)">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body payment-modal-body">
          {/* Total Tagihan Box (Clean Bright Light Theme) */}
          <div className="payment-total-box">
            <div className="payment-total-info">
              <span className="payment-total-label">TOTAL TAGIHAN</span>
              <span className="payment-total-items-badge">{totalQty} Pcs Barang</span>
            </div>
            <div className="payment-total-amount">{formatRupiah(totalAmount)}</div>
          </div>

          {/* Quick Cash Chips & Input Tunai */}
          <div className="payment-field-group">
            <div className="payment-label-row">
              <label className="payment-section-label">
                <Coins size={14} color="#2563eb" /> Uang Diterima / Nominal Bayar
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
                        <span className="chip-label">Uang Pas:</span>
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
                  Uang kurang <strong>{formatRupiah(totalAmount - numericCash)}</strong>
                </span>
              </div>
            )}

            {/* Kembalian / Status Display */}
            {numericCash > 0 && !isInsufficientCash && (
              <div className="change-display-compact ok">
                <div className="change-label">
                  <CheckCircle2 size={16} color="#059669" />
                  <span>KEMBALIAN:</span>
                </div>
                <span className="change-value">{formatRupiah(Math.max(0, changeAmount))}</span>
              </div>
            )}
          </div>

          {/* Cetak & Simpan Action Buttons */}
          <div className="payment-actions-section">
            {/* Primary Bluetooth Direct Print */}
            <button
              type="button"
              className="btn-primary-bluetooth"
              onClick={onPrintBluetooth}
              disabled={isPrintingBt || isInsufficientCash}
              title="Cetak langsung ke printer Bluetooth (VSC MP-58M) via Web Bluetooth"
            >
              <Bluetooth size={19} className={isPrintingBt ? 'animate-spin' : ''} />
              <div className="btn-bt-content">
                <span className="btn-bt-title">
                  {isPrintingBt ? 'Menghubungkan Bluetooth...' : 'Cetak Bluetooth (MP-58M)'}
                </span>
                <span className="btn-bt-subtitle">Direct ESC/POS Android & PC</span>
              </div>
            </button>

            {/* Secondary Action Grid: Browser Print & Save Only */}
            <div className="action-buttons-grid">
              <button
                type="button"
                className="btn-primary-print"
                onClick={onPrintReceipt}
                disabled={isInsufficientCash}
                title="Cetak struk via dialog browser / PC / USB (F2)"
              >
                <Printer size={17} />
                <span>Cetak Browser<span className="btn-shortcut-tag"> (F2)</span></span>
              </button>

              <button
                type="button"
                className="btn-primary-save-only"
                onClick={onSaveOnly}
                disabled={isInsufficientCash}
                title="Simpan transaksi langsung ke database tanpa dialog cetak (F3)"
              >
                <Save size={17} />
                <span>Simpan Saja<span className="btn-shortcut-tag"> (F3)</span></span>
              </button>
            </div>

            {/* Helper Apps Grid */}
            <div className="direct-buttons-row">
              <button
                type="button"
                className="btn-direct-app rawbt"
                onClick={onPrintRawBT}
                disabled={isInsufficientCash}
                title="Cetak via RawBT Android"
              >
                <Smartphone size={14} />
                <span>RawBT (Android)</span>
              </button>
              <button
                type="button"
                className="btn-direct-app thermer"
                onClick={onPrintThermer}
                disabled={isInsufficientCash}
                title="Cetak via Thermer iOS"
              >
                <Share2 size={14} />
                <span>Thermer (iOS)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer: Back to Cart Button */}
        <div className="modal-footer payment-modal-footer">
          <button type="button" className="btn-outline-compact" onClick={onClose}>
            <ArrowLeft size={15} /> Kembali ke Keranjang
          </button>
          <span className="esc-hint">
            Tekan <kbd>Esc</kbd> untuk batal
          </span>
        </div>
      </div>
    </div>
  );
};
