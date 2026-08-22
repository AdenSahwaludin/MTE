import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { deleteProduct, exportDataJSON, importDataJSON } from '../services/storageService';
import { formatRupiah } from '../utils/formatters';
import { ProductModal } from './ProductModal';
import { ProductDetailModal } from './ProductDetailModal';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Info,
  Download,
  Upload,
  Layers,
  Tag,
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
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

  // Extract unique categories from actual products in DB
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set).sort();
  }, [products]);

  // Filter products based on search query (matching name, aliases, category, or ID) and category
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.id && p.id.toLowerCase().includes(q)) ||
        (p.aliases && p.aliases.some((alias) => alias.toLowerCase().includes(q))) ||
        (p.category && p.category.toLowerCase().includes(q));

      const matchesCategory =
        selectedCategory === 'all' || (p.category || '') === selectedCategory;

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

  const handleOpenDetailModal = (p: Product) => {
    setViewingProduct(p);
    setDetailModalOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus produk "${name}"?`)) {
      deleteProduct(id);
      onRefresh();
      showToast(`Produk "${name}" telah dihapus`, 'info');
      if (viewingProduct?.id === id) {
        setDetailModalOpen(false);
        setViewingProduct(null);
      }
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
            Kelola master data produk, harga satuan, kategori, dan detail alias untuk kasir.
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
            placeholder="Cari nama produk, nama lain/alias, kategori, atau ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {categories.length > 0 && (
          <select
            className="form-input"
            style={{ width: 'auto', minWidth: '170px' }}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">Semua Kategori ({products.length})</option>
            {categories.map((cat) => {
              const count = products.filter((p) => (p.category || '') === cat).length;
              return (
                <option key={cat} value={cat}>
                  {cat} ({count})
                </option>
              );
            })}
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
                  <th style={{ width: '42%' }}>Nama Produk</th>
                  <th style={{ width: '20%' }}>Kategori</th>
                  <th style={{ width: '12%' }}>Satuan</th>
                  <th style={{ width: '14%', textAlign: 'right' }}>Harga Satuan</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div
                        className="product-name-cell"
                        onClick={() => handleOpenDetailModal(p)}
                        title="Klik untuk melihat detail produk"
                        style={{ cursor: 'pointer' }}
                      >
                        <span className="product-table-name">{p.name}</span>
                        {p.aliases && p.aliases.length > 0 && (
                          <span
                            className="alias-count-indicator"
                            title={`${p.aliases.length} nama lain / alias terdaftar`}
                          >
                            <Tag size={10} style={{ marginRight: '2px' }} />
                            {p.aliases.length} Alias
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={p.category ? 'category-table-badge' : 'category-empty-text'}>
                        {p.category ? p.category : '-'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
                        {p.unit || 'Pcs'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {formatRupiah(p.price)}
                    </td>
                    <td>
                      <div className="product-action-btns" style={{ justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn-icon-action detail"
                          onClick={() => handleOpenDetailModal(p)}
                          title="Lihat Detail Produk (ID, Pembuat, Alias)"
                        >
                          <Info size={15} />
                        </button>
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

      {/* Modal Detail Produk */}
      <ProductDetailModal
        isOpen={detailModalOpen}
        product={viewingProduct}
        onClose={() => {
          setDetailModalOpen(false);
          setViewingProduct(null);
        }}
        onEdit={(p) => {
          handleOpenEditModal(p);
        }}
        onDelete={(id, name) => {
          handleDelete(id, name);
        }}
        showToast={showToast}
      />

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
