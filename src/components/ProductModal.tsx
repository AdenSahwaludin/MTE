import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../types';
import {
  addOrUpdateProduct,
  getUniqueUnits,
  getUniqueCategories,
} from '../services/storageService';
import { FormattedNumberInput } from './FormattedNumberInput';
import { X, Tag, ChevronDown } from 'lucide-react';

interface ProductModalProps {
  isOpen: boolean;
  productToEdit: Product | null;
  onClose: () => void;
  onSave: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  productToEdit,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('Pcs');
  const [category, setCategory] = useState('Umum');
  const [aliases, setAliases] = useState<string[]>([]);
  const [currentAliasInput, setCurrentAliasInput] = useState('');

  const [errorMessage, setErrorMessage] = useState('');

  // Fetch unique options currently present in database
  const availableUnits = useMemo(() => getUniqueUnits(), [isOpen]);
  const availableCategories = useMemo(() => getUniqueCategories(), [isOpen]);

  useEffect(() => {
    setErrorMessage('');
    if (productToEdit) {
      setName(productToEdit.name);
      setPrice(productToEdit.price ? productToEdit.price.toString() : '');
      setUnit(productToEdit.unit || 'Pcs');
      setCategory(productToEdit.category || 'Umum');
      setAliases(productToEdit.aliases || []);
    } else {
      setName('');
      setPrice('');
      setUnit('Pcs');
      setCategory('Umum');
      setAliases([]);
    }
    setCurrentAliasInput('');
  }, [productToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAddAlias = () => {
    const trimmed = currentAliasInput.trim();
    if (trimmed && !aliases.includes(trimmed)) {
      setAliases([...aliases, trimmed]);
      setCurrentAliasInput('');
    }
  };

  const handleRemoveAlias = (aliasToRemove: string) => {
    setAliases(aliases.filter((a) => a !== aliasToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage('Nama produk tidak boleh kosong');
      return;
    }

    const priceNum = price ? parseInt(price.replace(/\D/g, ''), 10) || 0 : 0;
    if (priceNum <= 0) {
      setErrorMessage('Harga satuan produk harus lebih dari Rp 0 (tidak boleh 0 atau kosong)');
      return;
    }

    // Check if there is pending unadded text in alias input
    let finalAliases = [...aliases];
    if (currentAliasInput.trim() && !finalAliases.includes(currentAliasInput.trim())) {
      finalAliases.push(currentAliasInput.trim());
    }

    addOrUpdateProduct(
      name.trim(),
      priceNum,
      finalAliases,
      unit.trim() || 'Pcs',
      category.trim() || 'Umum',
      productToEdit?.id
    );

    onSave();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{productToEdit ? 'Edit Data Produk' : 'Tambah Produk Baru'}</h3>
          <button className="modal-close-btn" onClick={onClose} title="Tutup">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form-wrapper">
          <div className="modal-body">
            {errorMessage && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#b91c1c',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                }}
              >
                {errorMessage}
              </div>
            )}

            {/* Nama Produk Utama */}
            <div className="form-group">
              <label>Nama Produk Utama *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Contoh: Kabel Eterna NYM 2 x 1.5mm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus={typeof window !== 'undefined' && !window.matchMedia('(hover: none) and (pointer: coarse)').matches && window.innerWidth >= 768}
              />
            </div>

            {/* Nama Lain / Alias Produk */}
            <div className="form-group">
              <label>
                <Tag size={13} color="#2563eb" /> Nama Lain / Alias Produk
              </label>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Nama sebutan lain yang sering dicari kasir (misal: "Kabel Putih", "Kabel Listrik")
              </span>
              <div className="alias-input-tag-box">
                {aliases.map((alias, idx) => (
                  <span key={idx} className="alias-pill">
                    {alias}
                    <button
                      type="button"
                      className="tag-remove-btn"
                      onClick={() => handleRemoveAlias(alias)}
                    >
                      &times;
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  className="tag-input-field"
                  placeholder={aliases.length === 0 ? 'Ketik nama lain lalu tekan Enter / Koma...' : 'Tambah nama lain...'}
                  value={currentAliasInput}
                  onChange={(e) => {
                    if (e.target.value.includes(',')) {
                      const parts = e.target.value.split(',');
                      if (parts[0].trim()) {
                        setAliases((prev) => Array.from(new Set([...prev, parts[0].trim()])));
                      }
                      setCurrentAliasInput('');
                    } else {
                      setCurrentAliasInput(e.target.value);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAlias();
                    }
                  }}
                />
              </div>
            </div>

            {/* Harga & Satuan */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label>Harga Satuan (Rp) *</label>
                <div className="price-input-wrapper">
                  <span className="currency-prefix">Rp</span>
                  <FormattedNumberInput
                    value={price}
                    onChange={(val) => setPrice(val)}
                    placeholder="0"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Satuan Barang</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Pcs, Meter, Rol, Dus..."
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  list="unit-db-list"
                />
                <datalist id="unit-db-list">
                  {availableUnits.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
                {availableUnits.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {availableUnits.map((u) => (
                      <button
                        key={u}
                        type="button"
                        className="category-pill-btn"
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.72rem',
                          fontWeight: unit.toLowerCase() === u.toLowerCase() ? 700 : 500,
                          background: unit.toLowerCase() === u.toLowerCase() ? '#dbeafe' : '#f8fafc',
                          color: unit.toLowerCase() === u.toLowerCase() ? '#1d4ed8' : '#475569',
                          border: '1px solid',
                          borderColor: unit.toLowerCase() === u.toLowerCase() ? '#93c5fd' : '#e2e8f0',
                          borderRadius: '999px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onClick={() => setUnit(u)}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Kategori */}
            <div className="form-group">
              <label>Kategori Produk</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ketik kategori..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                list="category-db-list"
              />
              <datalist id="category-db-list">
                {availableCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {availableCategories.length > 0 && (
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {availableCategories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="category-pill-btn"
                      style={{
                        padding: '3px 9px',
                        fontSize: '0.74rem',
                        fontWeight: category.toLowerCase() === c.toLowerCase() ? 700 : 500,
                        background: category.toLowerCase() === c.toLowerCase() ? '#dbeafe' : '#f8fafc',
                        color: category.toLowerCase() === c.toLowerCase() ? '#1d4ed8' : '#475569',
                        border: '1.5px solid',
                        borderColor: category.toLowerCase() === c.toLowerCase() ? '#93c5fd' : '#e2e8f0',
                        borderRadius: '999px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-outline" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="btn-primary">
              {productToEdit ? 'Simpan Perubahan' : 'Tambah Produk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
