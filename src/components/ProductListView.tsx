import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { deleteProduct, exportDataJSON, importDataJSON } from '../services/storageService';
import { formatRupiah, formatDateIndo } from '../utils/formatters';
import { ProductModal } from './ProductModal';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Tag,
  Download,
  Upload,
  Layers,
  AlertTriangle,
} from 'lucide-react';

interface ProductListViewProps {
  products: Product[];
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'info') => void;
}

export const ProductListView: React.FC<ProductListViewProps> = ({
  products,
  onRefresh,
  showToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filter products based on search query (matching name OR aliases) and category
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.aliases && p.aliases.some((alias) => alias.toLowerCase().includes(q))) ||
        (p.category && p.category.toLowerCase().includes(q));

      const matchesCategory =
        selectedCategory === 'all' || p.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (p: Product) => {
    setEditingProduct(p);
    setModalOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus produk "${name}"?`)) {
      deleteProduct(id);
      onRefresh();
      showToast(`Produk "${name}" telah dihapus`, 'info');
    }
  };

  // Export JSON
  const handleExport = () => {
    const jsonStr = exportDataJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_produk_mega_teknik_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data produk & transaksi berhasil diekspor ke file JSON', 'success');
  };

  // Import JSON
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importDataJSON(content);
        if (success) {
          onRefresh();
          showToast('Data berhasil diimpor dari file JSON!', 'success');
        } else {
          showToast('Gagal membaca format file JSON', 'info');
        }
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  return (
    <div className="product-view-container">
      {/* Page Header */}
      <div className="page-header-row">
        <div className="page-title">
          <h2>
            <Package size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} color="#2563eb" />
            Daftar Produk ({products.length} Barang)
          </h2>
          <p>
            Kelola nama produk, daftar nama lain / alias untuk pencarian kasir, dan harga satuan.
          </p>
        </div>

        <div className="page-actions">
          <label className="btn-outline" style={{ cursor: 'pointer', margin: 0 }}>
            <Upload size={16} /> Import JSON
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </label>
          <button type="button" className="btn-outline" onClick={handleExport}>
            <Download size={16} /> Export JSON
          </button>
          <button type="button" className="btn-primary" onClick={handleOpenAddModal}>
            <Plus size={18} /> Tambah Produk
          </button>
        </div>
      </div>

      {/* Search & Category Filters */}
      <div className="search-filter-card">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="form-input"
            placeholder="Cari berdasarkan nama produk atau nama lain/alias..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {categories.length > 0 && (
          <select
            className="form-input"
            style={{ width: 'auto', minWidth: '160px' }}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">Semua Kategori ({products.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Product Table */}
      <div className="products-table-card">
        {filteredProducts.length === 0 ? (
          <div className="empty-cart-state">
            <Package className="empty-cart-icon" />
            <p style={{ fontWeight: 600 }}>Tidak ada produk yang cocok</p>
            <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>
              {searchQuery
                ? `Tidak ditemukan produk dengan kata kunci "${searchQuery}"`
                : 'Belum ada produk terdaftar. Klik Tambah Produk untuk menambahkan.'}
            </p>
          </div>
        ) : (
          <div className="cart-table-wrapper" style={{ margin: 0 }}>
            <table className="cart-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Nama Produk</th>
                  <th style={{ width: '35%' }}>Nama Lain / Alias (Pencarian Cepat)</th>
                  <th style={{ width: '15%' }}>Kategori / Satuan</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>Harga Satuan</th>
                  <th style={{ width: '8%', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{p.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        ID: {p.id}
                      </div>
                    </td>
                    <td>
                      {p.aliases && p.aliases.length > 0 ? (
                        <div className="aliases-badge-container">
                          {p.aliases.map((alias, aIdx) => (
                            <span key={aIdx} className="alias-pill">
                              <Tag size={10} style={{ display: 'inline', marginRight: '3px' }} />
                              {alias}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                          (Belum ada nama lain)
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                        {p.category || 'Umum'}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Satuan: {p.unit || 'Pcs'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {formatRupiah(p.price)}
                    </td>
                    <td>
                      <div className="product-action-btns" style={{ justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn-icon-action"
                          onClick={() => handleOpenEditModal(p)}
                          title="Edit Produk"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon-action delete"
                          onClick={() => handleDelete(p.id, p.name)}
                          title="Hapus Produk"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit */}
      <ProductModal
        isOpen={modalOpen}
        productToEdit={editingProduct}
        onClose={() => setModalOpen(false)}
        onSave={() => {
          onRefresh();
          showToast(
            editingProduct ? 'Data produk berhasil diperbarui' : 'Produk baru berhasil ditambahkan',
            'success'
          );
        }}
      />
    </div>
  );
};
