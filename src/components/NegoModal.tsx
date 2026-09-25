import React, { useState, useEffect, useRef } from 'react';
import { CartItem } from '../types';
import { FormattedNumberInput } from './FormattedNumberInput';
import { formatRupiah, parseNumberFromInput } from '../utils/formatters';
import { X, Tag, Check, RotateCcw, TrendingDown } from 'lucide-react';

export interface NegoModalProps {
  isOpen: boolean;
  item: CartItem | null;
  onClose: () => void;
  onApplyNego: (itemId: string, newPrice: number, resetToOriginal?: boolean) => void;
}

export const NegoModal: React.FC<NegoModalProps> = ({
  isOpen,
  item,
  onClose,
  onApplyNego,
}) => {
  const originalPrice = item?.originalPrice && item.originalPrice > 0 ? item.originalPrice : item?.price || 0;
  const [negoPriceStr, setNegoPriceStr] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (item && isOpen) {
      setNegoPriceStr(item.price.toString());
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [item, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const currentNegoPrice = parseNumberFromInput(negoPriceStr);
  const diffPerUnit = originalPrice - currentNegoPrice;
  const totalDiff = diffPerUnit * item.qty;
  const isDiscount = diffPerUnit > 0;
  const discountPercent = originalPrice > 0 ? Math.round((diffPerUnit / originalPrice) * 100) : 0;

  const handleApply = () => {
    if (currentNegoPrice <= 0) return;
    const isReset = currentNegoPrice === originalPrice;
    onApplyNego(item.id, currentNegoPrice, isReset);
    onClose();
  };

  const handleReset = () => {
    onApplyNego(item.id, originalPrice, true);
    onClose();
  };

  const applyPercentDiscount = (percent: number) => {
    const discounted = Math.round(originalPrice * (1 - percent / 100));
    setNegoPriceStr(discounted.toString());
  };

  const applyNominalDiscount = (nominal: number) => {
    const discounted = Math.max(0, originalPrice - nominal);
    setNegoPriceStr(discounted.toString());
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container nego-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header nego-modal-header">
          <div className="nego-modal-title">
            <Tag size={18} color="#2563eb" />
            <span>Nego Harga</span>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Tutup (Esc)">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body nego-modal-body">
          {/* Item Reference Card */}
          <div className="nego-item-info-card">
            <div className="nego-item-name">{item.name}</div>
            <div className="nego-item-meta">
              <span>Qty: <strong>{item.qty} {item.unit || 'pcs'}</strong></span>
              <span>•</span>
              <span>Normal: <strong>{formatRupiah(originalPrice)}</strong></span>
            </div>
            <div className="nego-subtotal-normal">
              Subtotal: {formatRupiah(originalPrice * item.qty)}
            </div>
          </div>

          {/* Form Input Harga Nego Baru */}
          <div className="form-group" style={{ marginBottom: '0.4rem' }}>
            <label className="nego-input-label">
              Harga Satuan Baru
            </label>
            <div className="price-input-wrapper">
              <span className="currency-prefix">Rp</span>
              <FormattedNumberInput
                inputRef={inputRef}
                value={negoPriceStr}
                onChange={(val) => setNegoPriceStr(val)}
                placeholder="0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApply();
                  }
                }}
              />
            </div>
          </div>

          {/* Quick Discount Presets */}
          <div className="nego-quick-discounts">
            <span className="nego-presets-label">Diskon:</span>
            <div className="nego-presets-row">
              <button
                type="button"
                className="btn-nego-preset"
                onClick={() => applyPercentDiscount(5)}
              >
                -5%
              </button>
              <button
                type="button"
                className="btn-nego-preset"
                onClick={() => applyPercentDiscount(10)}
              >
                -10%
              </button>
              <button
                type="button"
                className="btn-nego-preset"
                onClick={() => applyPercentDiscount(15)}
              >
                -15%
              </button>
              {originalPrice >= 10000 && (
                <button
                  type="button"
                  className="btn-nego-preset"
                  onClick={() => applyNominalDiscount(2000)}
                >
                  -2rb
                </button>
              )}
              {originalPrice >= 20000 && (
                <button
                  type="button"
                  className="btn-nego-preset"
                  onClick={() => applyNominalDiscount(5000)}
                >
                  -5rb
                </button>
              )}
              {originalPrice >= 50000 && (
                <button
                  type="button"
                  className="btn-nego-preset"
                  onClick={() => applyNominalDiscount(10000)}
                >
                  -10rb
                </button>
              )}
            </div>
          </div>

          {/* Savings Calculation Box */}
          {currentNegoPrice > 0 && (
            <div
              className={`nego-calc-summary ${
                isDiscount ? 'discount' : currentNegoPrice === originalPrice ? 'equal' : 'higher'
              }`}
            >
              {isDiscount ? (
                <>
                  <div className="nego-calc-row">
                    <span className="nego-calc-label">
                      <TrendingDown size={15} /> Potongan:
                    </span>
                    <span className="nego-calc-val">
                      -{formatRupiah(diffPerUnit)} ({discountPercent}%)
                    </span>
                  </div>
                  <div className="nego-calc-row total-saving">
                    <span>Total Hemat:</span>
                    <span className="nego-saving-highlight">-{formatRupiah(totalDiff)}</span>
                  </div>
                  <div className="nego-calc-subtotal">
                    Subtotal Baru: <strong>{formatRupiah(currentNegoPrice * item.qty)}</strong>
                  </div>
                </>
              ) : currentNegoPrice === originalPrice ? (
                <div style={{ textAlign: 'center', fontSize: '0.82rem', color: '#64748b' }}>
                  Harga sama dengan harga normal.
                </div>
              ) : (
                <div style={{ textAlign: 'center', fontSize: '0.82rem', color: '#b45309' }}>
                  Harga dinaikkan +{formatRupiah(currentNegoPrice - originalPrice)} / pcs
                  (Subtotal: {formatRupiah(currentNegoPrice * item.qty)})
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="nego-modal-actions">
            <button
              type="button"
              className="btn-primary-nego"
              onClick={handleApply}
              disabled={currentNegoPrice <= 0}
            >
              <Check size={18} />
              <span>Terapkan</span>
            </button>

            {(item.isNego || currentNegoPrice !== originalPrice) && (
              <button
                type="button"
                className="btn-reset-nego"
                onClick={handleReset}
                title="Kembalikan ke harga normal"
              >
                <RotateCcw size={15} />
                <span>Reset Normal ({formatRupiah(originalPrice)})</span>
              </button>
            )}

            <button type="button" className="btn-cancel-nego" onClick={onClose}>
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
