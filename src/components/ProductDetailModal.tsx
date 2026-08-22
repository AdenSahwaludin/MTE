import React, { useState } from 'react';
import { Product } from '../types';
import { formatRupiah, formatDateIndo } from '../utils/formatters';
import {
  Package,
  X,
  Tag,
  Edit2,
  Trash2,
  Copy,
  Check,
  Layers,
  User,
  Calendar,
  Clock,
  Info,
} from 'lucide-react';

interface ProductDetailModalProps {
  isOpen: boolean;
  product: Product | null;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onDelete: (id: string, name: string) => void;
  showToast: (msg: string, type?: 'success' | 'info') => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  isOpen,
  product,
  onClose,
  onEdit,
  onDelete,
  showToast,
}) => {
  const [copiedId, setCopiedId] = useState(false);

  if (!isOpen || !product) return null;

  const handleCopyId = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(product.id);
      setCopiedId(true);
      showToast(`ID Produk "${product.id}" berhasil disalin`, 'success');
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleEditClick = () => {
    onClose();
    onEdit(product);
  };

  const handleDeleteClick = () => {
    onClose();
    onDelete(product.id, product.name);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container product-detail-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
              }}
            >
              <Package size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Detail Produk</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                Informasi lengkap data barang & pencarian
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Tutup">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body product-detail-body">
          {/* Main Info Hero Card */}
          <div className="detail-hero-card">
            <div className="detail-hero-title-row">
              <div className="detail-hero-name">{product.name}</div>
              {product.category && (
                <span className="detail-category-badge">
                  <Layers size={11} style={{ display: 'inline', marginRight: '4px' }} />
                  {product.category}
                </span>
              )}
            </div>
            <div className="detail-hero-price-row">
              <span className="detail-hero-price">{formatRupiah(product.price)}</span>
              <span className="detail-hero-unit">/ {product.unit || 'Pcs'}</span>
            </div>
          </div>

          {/* Key Details Grid */}
          <div className="detail-grid">
            {/* ID Produk */}
            <div className="detail-info-card">
              <div className="detail-card-label">
                <Info size={13} color="#2563eb" /> ID Produk
              </div>
              <div className="detail-card-value-row">
                <span className="detail-mono-id">{product.id}</span>
                <button
                  type="button"
                  className="detail-copy-btn"
                  onClick={handleCopyId}
                  title="Salin ID Produk"
                >
                  {copiedId ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                  <span>{copiedId ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            </div>

            {/* Dibuat Oleh */}
            <div className="detail-info-card">
              <div className="detail-card-label">
                <User size={13} color="#0284c7" /> Dibuat Oleh
              </div>
              <div className="detail-card-value">
                <span className="detail-creator-badge">
                  {product.createdBy || 'Administrator / Kasir'}
                </span>
              </div>
            </div>

            {/* Satuan */}
            <div className="detail-info-card">
              <div className="detail-card-label">
                <Package size={13} color="#059669" /> Satuan Barang
              </div>
              <div className="detail-card-value" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                {product.unit || 'Pcs'}
              </div>
            </div>

            {/* Kategori */}
            <div className="detail-info-card">
              <div className="detail-card-label">
                <Layers size={13} color="#7c3aed" /> Kategori
              </div>
              <div className="detail-card-value" style={{ fontWeight: 600, color: product.category ? 'var(--text-main)' : '#94a3b8' }}>
                {product.category || '-'}
              </div>
            </div>

            {/* Tanggal Ditambahkan */}
            {product.createdAt && (
              <div className="detail-info-card">
                <div className="detail-card-label">
                  <Calendar size={13} color="#64748b" /> Waktu Dibuat
                </div>
                <div className="detail-card-value" style={{ fontSize: '0.8rem', color: '#475569' }}>
                  {formatDateIndo(product.createdAt)}
                </div>
              </div>
            )}

            {/* Terakhir Diperbarui */}
            {product.updatedAt && (
              <div className="detail-info-card">
                <div className="detail-card-label">
                  <Clock size={13} color="#64748b" /> Terakhir Diubah
                </div>
                <div className="detail-card-value" style={{ fontSize: '0.8rem', color: '#475569' }}>
                  {formatDateIndo(product.updatedAt)}
                </div>
              </div>
            )}
          </div>

          {/* Section: Nama Lain / Alias */}
          <div className="detail-aliases-card">
            <div className="detail-aliases-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                <Tag size={15} color="#2563eb" />
                <span>Nama Lain / Alias (Pencarian Cepat Kasir)</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {product.aliases && product.aliases.length > 0 ? `${product.aliases.length} Alias Terdaftar` : '0 Alias'}
              </span>
            </div>
            
            <p style={{ margin: '4px 0 10px 0', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
              Kata kunci sebutan lain yang otomatis dikenali mesin pencarian di halaman kasir untuk produk ini:
            </p>

            {product.aliases && product.aliases.length > 0 ? (
              <div className="detail-aliases-list">
                {product.aliases.map((alias, idx) => (
                  <span key={idx} className="detail-alias-pill">
                    <Tag size={11} style={{ marginRight: '4px', opacity: 0.8 }} />
                    {alias}
                  </span>
                ))}
              </div>
            ) : (
              <div className="detail-aliases-empty">
                Belum ada nama lain / alias yang ditambahkan. Anda dapat menambahkan nama lain melalui menu <b>Edit Produk</b>.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button
            type="button"
            className="btn-outline"
            style={{ color: '#dc2626', borderColor: '#fecaca', background: '#fff5f5' }}
            onClick={handleDeleteClick}
          >
            <Trash2 size={15} /> Hapus
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn-outline" onClick={onClose}>
              Tutup
            </button>
            <button type="button" className="btn-primary" onClick={handleEditClick}>
              <Edit2 size={15} /> Edit Produk
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
