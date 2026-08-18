import React, { useState, useEffect, useRef } from 'react';
import { Product, CartItem, Transaction, StoreProfile } from '../types';
import {
  findProductByNameOrAlias,
  addOrUpdateProduct,
  saveTransaction,
  generateInvoiceNumber,
} from '../services/storageService';
import { printViaRawBT, printViaThermer } from '../services/directPrintService';
import { printDirectBluetooth, isWebBluetoothSupported } from '../services/bluetoothPrintService';
import { AutocompleteInput } from './AutocompleteInput';
import { ReceiptPreview } from './ReceiptPreview';
import { formatRupiah, formatNumber, parseNumberFromInput } from '../utils/formatters';
import {
  Plus,
  Trash2,
  Printer,
  RotateCcw,
  ShoppingCart,
  DollarSign,
  Keyboard,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Share2,
  Zap,
  Bluetooth,
} from 'lucide-react';

interface KasirViewProps {
  storeProfile: StoreProfile;
  onProductUpdated: () => void;
  onTransactionCreated?: () => void;
  onPrintReceipt: (trx: Transaction) => void;
  showToast: (msg: string, type?: 'success' | 'info') => void;
}

export const KasirView: React.FC<KasirViewProps> = ({
  storeProfile,
  onProductUpdated,
  onTransactionCreated,
  onPrintReceipt,
  showToast,
}) => {
  // Input fields for current item
  const [itemName, setItemName] = useState<string>('');
  const [itemPrice, setItemPrice] = useState<string>('');
  const [itemQty, setItemQty] = useState<number>(1);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Cart & Transaction state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [invoiceNo, setInvoiceNo] = useState<string>(generateInvoiceNumber());
  const [cashAmount, setCashAmount] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showMobilePreview, setShowMobilePreview] = useState<boolean>(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Focus name input on mount
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Keyboard shortcut handlers (F2 = Print, F4 = Reset)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        handlePrintReceipt();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleResetTransaction();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  });

  // Calculate Total & Change
  const totalAmount = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  const numericCash = parseNumberFromInput(cashAmount);
  const changeAmount = numericCash - totalAmount;

  // When user selects a product from autocomplete dropdown
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setItemName(product.name);
    setItemPrice(product.price.toString());
    // Auto focus to qty or price
    qtyInputRef.current?.focus();
    qtyInputRef.current?.select();
  };

  // Add item to cart + Auto-save if it's a new product
  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedName = itemName.trim();
    if (!trimmedName) {
      showToast('Mohon masukkan nama barang', 'info');
      nameInputRef.current?.focus();
      return;
    }

    const priceNum = parseNumberFromInput(itemPrice);
    const qtyNum = Math.max(1, itemQty || 1);

    // Check if item is already in database
    let matchedProd: Product | null = selectedProduct;
    if (!matchedProd) {
      matchedProd = findProductByNameOrAlias(trimmedName) || null;
    }

    let isNew = false;
    let finalProductId = matchedProd?.id;
    let finalUnit = matchedProd?.unit || 'Pcs';

    // Auto-save logic: if product not found in database, save it now!
    if (!matchedProd && storeProfile.autoSaveProducts) {
      const saved = addOrUpdateProduct(trimmedName, priceNum, [], 'Pcs', 'Umum');
      matchedProd = saved.product;
      finalProductId = saved.product.id;
      isNew = true;
      onProductUpdated();
      showToast(`✨ Barang baru "${trimmedName}" otomatis tersimpan di Master Produk (Rp ${formatNumber(priceNum)})`, 'success');
    }

    // Add to cart items
    const existingCartIndex = cartItems.findIndex(
      (item) => item.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingCartIndex !== -1) {
      // Update quantity of existing item in cart
      const updatedCart = [...cartItems];
      const existing = updatedCart[existingCartIndex];
      const newQty = existing.qty + qtyNum;
      updatedCart[existingCartIndex] = {
        ...existing,
        qty: newQty,
        price: priceNum > 0 ? priceNum : existing.price,
        subtotal: (priceNum > 0 ? priceNum : existing.price) * newQty,
      };
      setCartItems(updatedCart);
    } else {
      // Insert new cart item
      const newItem: CartItem = {
        id: 'cart-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        productId: finalProductId,
        name: trimmedName,
        price: priceNum,
        qty: qtyNum,
        unit: finalUnit,
        subtotal: priceNum * qtyNum,
        isNewProduct: isNew,
      };
      setCartItems((prev) => [...prev, newItem]);
    }

    // Clear input and refocus to name for continuous fast cashier flow
    setItemName('');
    setItemPrice('');
    setItemQty(1);
    setSelectedProduct(null);
    nameInputRef.current?.focus();
  };

  const handleUpdateCartQty = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = Math.max(1, item.qty + delta);
            return {
              ...item,
              qty: newQty,
              subtotal: item.price * newQty,
            };
          }
          return item;
        })
        .filter((item) => item.qty > 0)
    );
  };

  const handleRemoveCartItem = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Quick cash buttons
  const setExactCash = () => {
    setCashAmount(totalAmount.toString());
  };

  const addQuickCash = (amount: number) => {
    setCashAmount(amount.toString());
  };

  // Reset transaction
  const handleResetTransaction = () => {
    setCartItems([]);
    setItemName('');
    setItemPrice('');
    setItemQty(1);
    setCashAmount('');
    setCustomerName('');
    setNotes('');
    setSelectedProduct(null);
    setInvoiceNo(generateInvoiceNumber());
    nameInputRef.current?.focus();
  };

  // Helper to build and persist transaction before printing
  const createCurrentTransaction = (): Transaction | null => {
    if (cartItems.length === 0) {
      showToast('Keranjang masih kosong, tambahkan barang terlebih dahulu', 'info');
      nameInputRef.current?.focus();
      return null;
    }

    const finalCash = numericCash > 0 ? numericCash : totalAmount;
    const finalChange = finalCash - totalAmount;

    const transactionData: Transaction = {
      id: 'trx-' + Date.now(),
      invoiceNo,
      date: new Date().toISOString(),
      items: [...cartItems],
      totalAmount,
      cashAmount: finalCash,
      changeAmount: Math.max(0, finalChange),
      paymentMethod: 'cash',
      customerName: customerName.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    // Save transaction to local storage
    saveTransaction(transactionData);
    if (onTransactionCreated) {
      onTransactionCreated();
    }

    return transactionData;
  };

  // 1. Direct Web Bluetooth Print (Android Chrome / PC Web Bluetooth - No 3rd party app needed!)
  const [isPrintingBt, setIsPrintingBt] = useState(false);

  const handlePrintBluetooth = async () => {
    const trx = createCurrentTransaction();
    if (!trx) return;

    try {
      setIsPrintingBt(true);
      showToast('🔍 Menghubungkan ke printer Bluetooth (VSC MP-58M Pro)...', 'info');
      await printDirectBluetooth(trx, storeProfile);
      showToast('✅ Struk berhasil dicetak ke printer Bluetooth!', 'success');
      handleResetTransaction();
    } catch (err: any) {
      console.error('Bluetooth print error:', err);
      showToast(err?.message || 'Gagal koneksi Bluetooth. Pastikan Bluetooth aktif dan pilih printer.', 'info');
    } finally {
      setIsPrintingBt(false);
    }
  };

  // 2. Standard Browser Print (PC / Desktop / USB)
  const handlePrintReceipt = () => {
    const trx = createCurrentTransaction();
    if (!trx) return;

    showToast('Memproses cetak struk browser...', 'success');
    onPrintReceipt(trx);
    handleResetTransaction();
  };

  // 3. Direct RawBT Print (Android Companion App)
  const handlePrintRawBT = () => {
    const trx = createCurrentTransaction();
    if (!trx) return;

    showToast('⚡ Mengirim data ke RawBT Android (POS-58)...', 'success');
    printViaRawBT(trx, storeProfile);
    handleResetTransaction();
  };

  // 4. Direct Thermer Print (iOS Companion App)
  const handlePrintThermer = () => {
    const trx = createCurrentTransaction();
    if (!trx) return;

    showToast('🍎 Membuka aplikasi Thermer iOS (POS-58)...', 'success');
    printViaThermer(trx, storeProfile);
    handleResetTransaction();
  };

  return (
    <div className="pos-layout">
      {/* Main Left Column: POS Controls */}
      <div className="pos-main-panel">
        {/* Quick Add Product Card */}
        <div className="input-card">
          <div className="card-header-title">
            <h2>
              <ShoppingCart size={20} color="#2563eb" /> Kasir & Generate Struk
            </h2>
            <div className="shortcut-tip">
              <Keyboard size={14} /> Tekan <kbd>Enter</kbd> untuk tambah item | <kbd>F2</kbd> Cetak Struk
            </div>
          </div>

          <form onSubmit={handleAddItem} className="quick-add-form">
            {/* Nama Barang / Autocomplete */}
            <div className="form-group">
              <label>Nama Barang / Alias</label>
              <AutocompleteInput
                inputRef={nameInputRef}
                value={itemName}
                onChange={(val) => {
                  setItemName(val);
                  // If user manually clears or types, clear selected product reference if name diverges
                  if (selectedProduct && selectedProduct.name !== val) {
                    setSelectedProduct(null);
                  }
                }}
                onSelectProduct={handleSelectProduct}
                placeholder="Ketik nama barang atau alias..."
                autoFocus
              />
            </div>

            {/* Harga Barang */}
            <div className="form-group">
              <label>Harga Satuan</label>
              <div className="price-input-wrapper">
                <span className="currency-prefix">Rp</span>
                <input
                  ref={priceInputRef}
                  type="text"
                  className="form-input"
                  placeholder="0"
                  value={itemPrice ? formatNumber(itemPrice) : ''}
                  onChange={(e) => {
                    const raw = parseNumberFromInput(e.target.value);
                    setItemPrice(raw > 0 ? raw.toString() : '');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItem();
                    }
                  }}
                />
              </div>
            </div>

            {/* Qty */}
            <div className="form-group">
              <label>Qty</label>
              <div className="qty-input-wrapper">
                <button
                  type="button"
                  className="qty-btn"
                  onClick={() => setItemQty((q) => Math.max(1, q - 1))}
                >
                  -
                </button>
                <input
                  ref={qtyInputRef}
                  type="number"
                  min="1"
                  className="form-input"
                  value={itemQty}
                  onChange={(e) => setItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItem();
                    }
                  }}
                />
                <button
                  type="button"
                  className="qty-btn"
                  onClick={() => setItemQty((q) => q + 1)}
                >
                  +
                </button>
              </div>
            </div>

            {/* Tambah Button */}
            <button type="submit" className="btn-add-item">
              <Plus size={18} /> Tambah Item
            </button>
          </form>
        </div>

        {/* Cart Items Table Card */}
        <div className="cart-card">
          <div className="card-header-title" style={{ marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
              Daftar Barang Belanjaan ({cartItems.length} item)
            </h3>
            {cartItems.length > 0 && (
              <button
                type="button"
                onClick={() => setCartItems([])}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Trash2 size={13} /> Kosongkan Keranjang
              </button>
            )}
          </div>

          {cartItems.length === 0 ? (
            <div className="empty-cart-state">
              <ShoppingCart className="empty-cart-icon" />
              <p style={{ fontWeight: 600 }}>Belum ada barang di struk</p>
              <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                Ketik nama barang dan harga di atas, lalu klik <strong>Tambah Item</strong> atau tekan <kbd>Enter</kbd>.
              </p>
            </div>
          ) : (
            <div className="cart-table-wrapper">
              <table className="cart-table">
                <thead>
                  <tr>
                    <th>Barang</th>
                    <th style={{ textAlign: 'right' }}>Harga Satuan</th>
                    <th style={{ textAlign: 'center', width: '120px' }}>Jumlah (Qty)</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cartItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {item.name}
                          {item.isNewProduct && (
                            <span className="badge-new-item">
                              <Sparkles size={10} style={{ display: 'inline', marginRight: '2px' }} /> Auto-Saved
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {formatRupiah(item.price)}
                      </td>
                      <td>
                        <div className="qty-input-wrapper" style={{ height: '32px', maxWidth: '100px', margin: '0 auto' }}>
                          <button
                            type="button"
                            className="qty-btn"
                            style={{ height: '32px', width: '26px' }}
                            onClick={() => handleUpdateCartQty(item.id, -1)}
                          >
                            -
                          </button>
                          <span style={{ flex: 1, textAlign: 'center', fontWeight: 600, fontSize: '0.9rem' }}>
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            className="qty-btn"
                            style={{ height: '32px', width: '26px' }}
                            onClick={() => handleUpdateCartQty(item.id, 1)}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        {formatRupiah(item.subtotal)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-remove-item"
                          onClick={() => handleRemoveCartItem(item.id)}
                          title="Hapus item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payment & Action Card */}
        <div className="payment-card">
          {/* Total Ringkasan */}
          <div className="totals-summary">
            <span className="totals-label">TOTAL TAGIHAN</span>
            <span className="totals-amount">{formatRupiah(totalAmount)}</span>
          </div>

          {/* Quick Cash Buttons & Input Tunai */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Pembayaran Tunai / Uang Diterima
            </label>

            <div className="quick-cash-row">
              <button
                type="button"
                className={`btn-quick-cash ${numericCash === totalAmount && totalAmount > 0 ? 'active' : ''}`}
                onClick={setExactCash}
                disabled={totalAmount === 0}
              >
                Uang Pas ({formatRupiah(totalAmount)})
              </button>
              <button
                type="button"
                className={`btn-quick-cash ${numericCash === 10000 ? 'active' : ''}`}
                onClick={() => addQuickCash(10000)}
              >
                Rp 10.000
              </button>
              <button
                type="button"
                className={`btn-quick-cash ${numericCash === 20000 ? 'active' : ''}`}
                onClick={() => addQuickCash(20000)}
              >
                Rp 20.000
              </button>
              <button
                type="button"
                className={`btn-quick-cash ${numericCash === 50000 ? 'active' : ''}`}
                onClick={() => addQuickCash(50000)}
              >
                Rp 50.000
              </button>
              <button
                type="button"
                className={`btn-quick-cash ${numericCash === 100000 ? 'active' : ''}`}
                onClick={() => addQuickCash(100000)}
              >
                Rp 100.000
              </button>
              <button
                type="button"
                className={`btn-quick-cash ${numericCash === 200000 ? 'active' : ''}`}
                onClick={() => addQuickCash(200000)}
              >
                Rp 200.000
              </button>
            </div>

            <div className="price-input-wrapper" style={{ marginTop: '0.25rem' }}>
              <span className="currency-prefix">Rp</span>
              <input
                type="text"
                className="form-input"
                placeholder="Masukkan nominal uang bayar custom..."
                value={cashAmount ? formatNumber(cashAmount) : ''}
                onChange={(e) => {
                  const raw = parseNumberFromInput(e.target.value);
                  setCashAmount(raw > 0 ? raw.toString() : '');
                }}
              />
            </div>
          </div>

          {/* Kembalian Display */}
          {numericCash > 0 && (
            <div className={`change-display ${changeAmount >= 0 ? 'ok' : 'lacking'}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {changeAmount >= 0 ? (
                  <>
                    <CheckCircle2 size={18} />
                    <span>KEMBALIAN:</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={18} />
                    <span>KURANG BAYAR:</span>
                  </>
                )}
              </div>
              <span style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)' }}>
                {formatRupiah(Math.abs(changeAmount))}
              </span>
            </div>
          )}

          {/* Optional Info Pelanggan & Catatan */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <input
              type="text"
              className="form-input"
              style={{ fontSize: '0.85rem', height: '38px' }}
              placeholder="Nama Pelanggan (Opsional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <input
              type="text"
              className="form-input"
              style={{ fontSize: '0.85rem', height: '38px' }}
              placeholder="Catatan struk (Opsional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Direct Bluetooth Primary Action (Web Bluetooth ESC/POS - No apps needed) */}
          <button
            type="button"
            className="btn-primary-bluetooth"
            onClick={handlePrintBluetooth}
            disabled={cartItems.length === 0 || isPrintingBt}
            title="Cetak langsung ke printer Bluetooth VSC MP-58M Pro via Web Bluetooth"
          >
            <Bluetooth size={20} className={isPrintingBt ? 'animate-spin' : ''} />
            <div className="btn-bt-content">
              <span className="btn-bt-title">
                {isPrintingBt ? 'Menghubungkan Bluetooth...' : 'Cetak Bluetooth (VSC MP-58M)'}
              </span>
              <span className="btn-bt-subtitle">Direct ESC/POS Wireless • Android / PC</span>
            </div>
          </button>

          {/* Action Buttons: Reset & Browser Print */}
          <div className="action-buttons-row">
            <button
              type="button"
              className="btn-secondary-reset"
              onClick={handleResetTransaction}
              title="Reset transaksi kasir (F4)"
            >
              <RotateCcw size={16} /> Reset (F4)
            </button>
            <button
              type="button"
              className="btn-primary-print"
              onClick={handlePrintReceipt}
              disabled={cartItems.length === 0}
              title="Cetak via dialog browser / PC / USB (F2)"
            >
              <Printer size={18} /> Cetak Browser (F2)
            </button>
          </div>

          {/* Alternative Mobile Companion Apps (RawBT & Thermer) */}
          <div className="direct-print-wrapper">
            <div className="direct-print-header">
              <Zap size={13} color="#f59e0b" />
              <span>Opsi Tambahan (App Helper):</span>
            </div>
            <div className="direct-buttons-grid">
              <button
                type="button"
                className="btn-direct-rawbt"
                onClick={handlePrintRawBT}
                disabled={cartItems.length === 0}
                title="Buka via aplikasi RawBT (Android)"
              >
                <Smartphone size={16} />
                <div className="btn-direct-content">
                  <span className="btn-direct-title">RawBT App</span>
                  <span className="btn-direct-subtitle">Android Helper</span>
                </div>
              </button>
              <button
                type="button"
                className="btn-direct-thermer"
                onClick={handlePrintThermer}
                disabled={cartItems.length === 0}
                title="Buka via aplikasi Thermer (iOS / iPhone)"
              >
                <Share2 size={16} />
                <div className="btn-direct-content">
                  <span className="btn-direct-title">Thermer App</span>
                  <span className="btn-direct-subtitle">iOS / iPhone</span>
                </div>
              </button>
            </div>
          </div>

          {/* Mobile Preview Toggle Button */}
          <button
            type="button"
            className="btn-mobile-preview-toggle"
            onClick={() => setShowMobilePreview(!showMobilePreview)}
          >
            <Printer size={16} />
            {showMobilePreview ? 'Sembunyikan Tampilan Struk' : 'Lihat Tampilan Struk (58mm)'}
          </button>
        </div>
      </div>

      {/* Right Column: Live Receipt Preview */}
      <div className={`receipt-preview-panel ${!showMobilePreview ? 'mobile-hidden' : ''}`}>
        <ReceiptPreview
          items={cartItems}
          total={totalAmount}
          cash={numericCash || totalAmount}
          change={changeAmount}
          invoiceNo={invoiceNo}
          date={new Date().toISOString()}
          storeProfile={storeProfile}
          customerName={customerName}
          notes={notes}
        />
      </div>
    </div>
  );
};
