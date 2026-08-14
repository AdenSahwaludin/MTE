import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { addOrUpdateProduct } from '../services/storageService';
import { formatNumber, parseNumberFromInput } from '../utils/formatters';
import { X, Plus, Tag } from 'lucide-react';

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

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setPrice(productToEdit.price.toString());
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
    if (!name.trim()) return;

    // Check if there is pending unadded text in alias input
    let finalAliases = [...aliases];
    if (currentAliasInput.trim() && !finalAliases.includes(currentAliasInput.trim())) {
      finalAliases.push(currentAliasInput.trim());
    }

    const priceNum = parseNumberFromInput(price);
    addOrUpdateProduct(
      name.trim(),
      priceNum,
      finalAliases,
      unit.trim(),
      category.trim(),
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
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
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
                autoFocus
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
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label>Harga Satuan (Rp) *</label>
                <div className="price-input-wrapper">
                  <span className="currency-prefix">Rp</span>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="0"
                    value={price ? formatNumber(price) : ''}
                    onChange={(e) => {
                      const raw = parseNumberFromInput(e.target.value);
                      setPrice(raw > 0 ? raw.toString() : '');
                    }}
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
                  list="unit-presets"
                />
                <datalist id="unit-presets">
                  <option value="Pcs" />
                  <option value="Meter" />
                  <option value="Batang" />
                  <option value="Rol" />
                  <option value="Set" />
                  <option value="Dus" />
                  <option value="Zak" />
                  <option value="Kg" />
                  <option value="Liter" />
                  <option value="Tube" />
                  <option value="Lembar" />
                </datalist>
              </div>
            </div>

            {/* Kategori */}
            <div className="form-group">
              <label>Kategori Produk</label>
              <input
                type="text"
                className="form-input"
                placeholder="Perkakas, Kelistrikan, Plumbing, Bangunan..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                list="category-presets"
              />
              <datalist id="category-presets">
                <option value="Kelistrikan" />
                <option value="Perkakas" />
                <option value="Plumbing" />
                <option value="Bahan Bangunan" />
                <option value="Bahan Perekat" />
                <option value="Baut & Mur" />
                <option value="Alat Ukur" />
                <option value="Umum" />
              </datalist>
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
