import React, { useState, useEffect, useRef } from 'react';
import { Product, CartItem, Transaction, StoreProfile } from '../types';
import {
  findProductByNameOrAlias,
  addOrUpdateProduct,
  saveTransaction,
  generateInvoiceNumber,
  getCurrentUser,
} from '../services/storageService';
import { printViaRawBT, printViaThermer } from '../services/directPrintService';
import { printDirectBluetooth } from '../services/bluetoothPrintService';
import { AutocompleteInput } from './AutocompleteInput';
import { FormattedNumberInput } from './FormattedNumberInput';
import { ReceiptPreview } from './ReceiptPreview';
import { PaymentModal } from './PaymentModal';
import { formatRupiah, formatNumber, parseNumberFromInput } from '../utils/formatters';
import {
  Plus,
  Trash2,
  Printer,
  RotateCcw,
  ShoppingCart,
  Keyboard,
  Sparkles,
  CreditCard,
  ArrowRight,
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
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const focusInputIfDesktop = (ref: React.RefObject<HTMLInputElement | null>) => {
    if (typeof window === 'undefined') return;
    const isMobileTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches || window.innerWidth < 768;
    if (!isMobileTouch) {
      ref.current?.focus();
    }
  };

  // Direct focus for active user actions (works on both mobile and desktop)
  const focusInput = (ref: React.RefObject<HTMLInputElement | null>) => {
    if (typeof window === 'undefined' || !ref.current) return;
    ref.current.focus();
    try {
      ref.current.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    } catch {
      // ignore
    }
  };

  // Focus name input on mount (only on desktop to prevent mobile keyboard popups & zoom)
  useEffect(() => {
    focusInputIfDesktop(nameInputRef);
  }, []);

  // Calculate Total & Change
  const totalAmount = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  const numericCash = parseNumberFromInput(cashAmount);
  const changeAmount = numericCash - totalAmount;

  // Keyboard shortcut handlers (F2 = Open Modal / Print, F3 = Save, F4 = Reset)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (!isPaymentModalOpen) {
          handleOpenPaymentModal();
        }
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (isPaymentModalOpen) {
          handleSaveOnlyTransaction();
        }
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleResetTransaction();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  });

  // Add item directly to cart from autocomplete suggestion on Enter
  const addItemToCartDirect = (prod: Product, qty: number = 1) => {
    const qtyNum = Math.max(1, qty || 1);
    const priceNum = prod.price;

    const existingCartIndex = cartItems.findIndex(
      (item) => item.name.toLowerCase() === prod.name.trim().toLowerCase()
    );

    if (existingCartIndex !== -1) {
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
      const newItem: CartItem = {
        id: 'cart-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        productId: prod.id,
        name: prod.name.trim(),
        price: priceNum,
        qty: qtyNum,
        unit: prod.unit || 'Pcs',
        subtotal: priceNum * qtyNum,
        isNewProduct: false,
      };
      setCartItems((prev) => [...prev, newItem]);
    }

    // Reset input fields and keep focus on name input for fast continuous scanning/typing
    setItemName('');
    setItemPrice('');
    setItemQty(1);
    setSelectedProduct(null);
    focusInputIfDesktop(nameInputRef);
  };

  // When user selects a product from autocomplete dropdown
  const handleSelectProduct = (product: Product, andAddToCart: boolean = false) => {
    setSelectedProduct(product);
    setItemName(product.name);
    setItemPrice(product.price > 0 ? product.price.toString() : '');

    if (andAddToCart && product.price > 0) {
      addItemToCartDirect(product, itemQty || 1);
    } else if (product.price <= 0) {
      focusInput(priceInputRef);
    } else {
      focusInput(qtyInputRef);
    }
  };

  const handleEnterWithoutMatch = () => {
    const priceNum = parseNumberFromInput(itemPrice);
    if (priceNum > 0 && itemName.trim()) {
      handleAddItem();
    } else {
      // Direct focus into price input when adding new item on mobile & desktop!
      focusInput(priceInputRef);
    }
  };

  // Add item to cart + Auto-save if it's a new product
  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedName = itemName.trim();
    if (!trimmedName) {
      showToast('Mohon masukkan nama barang', 'info');
      focusInput(nameInputRef);
      return;
    }

    const priceNum = parseNumberFromInput(itemPrice);
    if (priceNum <= 0) {
      showToast('Harga satuan barang tidak boleh Rp 0. Silakan masukkan harga barang.', 'info');
      focusInput(priceInputRef);
      return;
    }

    const qtyNum = Math.max(1, itemQty || 1);

    // Check if item is already in database
    let matchedProd: Product | null = selectedProduct;
    if (!matchedProd) {
      matchedProd = findProductByNameOrAlias(trimmedName) || null;
    }

    let isNew = false;
    let finalProductId = matchedProd?.id;
    let finalUnit = matchedProd?.unit || 'Pcs';

    // Auto-save logic: if product not found in database and has valid price, save it with empty default category!
    if (!matchedProd && storeProfile.autoSaveProducts && priceNum > 0) {
      const activeUser = getCurrentUser();
      const saved = addOrUpdateProduct(
        trimmedName,
        priceNum,
        [],
        'Pcs',
        '', // default category empty string instead of 'Umum'
        undefined,
        activeUser?.name || 'Kasir'
      );
      matchedProd = saved.product;
      finalProductId = saved.product.id;
      isNew = true;
      onProductUpdated();
      showToast(`Barang baru "${trimmedName}" otomatis tersimpan di Master Produk (Rp ${formatNumber(priceNum)})`, 'success');
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
    focusInputIfDesktop(nameInputRef);
  };

  const handleUpdateCartQty = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.qty + delta;
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

  const smartCashSuggestions = React.useMemo(() => {
    if (totalAmount <= 0) return [];
    const list: number[] = [totalAmount];
    const candidates = new Set<number>();

    if (totalAmount < 10000) {
      candidates.add(Math.ceil(totalAmount / 2000) * 2000);
      candidates.add(Math.ceil(totalAmount / 5000) * 5000);
      candidates.add(10000);
      candidates.add(20000);
      candidates.add(50000);
      candidates.add(100000);
    } else if (totalAmount < 20000) {
      candidates.add(20000);
      candidates.add(50000);
      candidates.add(100000);
    } else if (totalAmount < 50000) {
      candidates.add(Math.ceil(totalAmount / 10000) * 10000);
      candidates.add(50000);
      candidates.add(100000);
    } else if (totalAmount < 100000) {
      candidates.add(Math.ceil(totalAmount / 10000) * 10000);
      candidates.add(Math.ceil(totalAmount / 50000) * 50000);
      candidates.add(100000);
      candidates.add(150000);
      candidates.add(200000);
    } else {
      candidates.add(Math.ceil(totalAmount / 10000) * 10000);
      candidates.add(Math.ceil(totalAmount / 50000) * 50000);
      candidates.add(Math.ceil(totalAmount / 100000) * 100000);
      candidates.add(Math.ceil(totalAmount / 100000) * 100000 + 100000);
      candidates.add(Math.ceil(totalAmount / 100000) * 100000 + 200000);
      candidates.add(Math.ceil(totalAmount / 500000) * 500000);
    }

    const sorted = Array.from(candidates)
      .filter((amount) => amount > totalAmount)
      .sort((a, b) => a - b);

    for (const val of sorted) {
      if (list.length < 5) {
        list.push(val);
      }
    }

    return list;
  }, [totalAmount]);

  const isInsufficientCash = numericCash > 0 && numericCash < totalAmount;

  const handleOpenPaymentModal = () => {
    if (cartItems.length === 0) {
      showToast('Keranjang masih kosong, tambahkan barang terlebih dahulu', 'info');
      focusInputIfDesktop(nameInputRef);
      return;
    }
    // Pre-fill cashAmount with total if empty
    if (!cashAmount || parseNumberFromInput(cashAmount) <= 0) {
      setCashAmount(totalAmount.toString());
    }
    setIsPaymentModalOpen(true);
  };

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
    setIsPaymentModalOpen(false);
    focusInputIfDesktop(nameInputRef);
  };

  const createCurrentTransaction = (): Transaction | null => {
    if (cartItems.length === 0) {
      showToast('Keranjang masih kosong, tambahkan barang terlebih dahulu', 'info');
      focusInputIfDesktop(nameInputRef);
      return null;
    }

    if (numericCash > 0 && numericCash < totalAmount) {
      showToast(`Uang diterima (${formatRupiah(numericCash)}) kurang dari total tagihan (${formatRupiah(totalAmount)})`, 'info');
      return null;
    }

    const finalCash = numericCash > 0 ? numericCash : totalAmount;
    const finalChange = finalCash - totalAmount;
    const activeUser = getCurrentUser();

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
      cashierName: activeUser?.name || storeProfile.cashierName || 'Kasir',
      notes: notes.trim() || undefined,
    };

    saveTransaction(transactionData);
    if (onTransactionCreated) {
      onTransactionCreated();
    }

    return transactionData;
  };

  // 1. Save Transaction ONLY (No Printing dialog triggered)
  const handleSaveOnlyTransaction = () => {
    const trx = createCurrentTransaction();
    if (!trx) return;

    showToast(`Transaksi ${trx.invoiceNo} berhasil disimpan ke database!`, 'success');
    handleResetTransaction();
  };

  // 2. Direct Web Bluetooth Print (Android Chrome / PC Web Bluetooth - No 3rd party app needed!)
  const [isPrintingBt, setIsPrintingBt] = useState(false);

  const handlePrintBluetooth = async () => {
    const trx = createCurrentTransaction();
    if (!trx) return;

    try {
      setIsPrintingBt(true);
      showToast('Menghubungkan ke printer Bluetooth (VSC MP-58M Pro)...', 'info');
      await printDirectBluetooth(trx, storeProfile);
      showToast('Struk berhasil dicetak ke printer Bluetooth!', 'success');
      handleResetTransaction();
    } catch (err: any) {
      console.error('Bluetooth print error:', err);
      showToast(err?.message || 'Gagal koneksi Bluetooth. Pastikan Bluetooth aktif dan pilih printer.', 'info');
    } finally {
      setIsPrintingBt(false);
    }
  };

  // 3. Standard Browser Print (PC / Desktop / USB)
  const handlePrintReceipt = () => {
    const trx = createCurrentTransaction();
    if (!trx) return;

    showToast('Memproses cetak struk browser...', 'success');
    onPrintReceipt(trx);
    handleResetTransaction();
  };

  // 4. Direct RawBT Print (Android Companion App)
  const handlePrintRawBT = () => {
    const trx = createCurrentTransaction();
    if (!trx) return;

    showToast('Mengirim data ke RawBT Android (POS-58)...', 'success');
    printViaRawBT(trx, storeProfile);
    handleResetTransaction();
  };

  // 5. Direct Thermer Print (iOS Companion App)
  const handlePrintThermer = () => {
    const trx = createCurrentTransaction();
    if (!trx) return;

    showToast('Membuka aplikasi Thermer iOS (POS-58)...', 'success');
    printViaThermer(trx, storeProfile);
    handleResetTransaction();
  };

  const totalQty = cartItems.reduce((sum, item) => sum + item.qty, 0);

  return (
    <>
      <div className="pos-layout">
        {/* Main Left Column: POS Controls */}
        <div className="pos-main-panel">
          {/* Card 1: Quick Add Product Card */}
          <div className="input-card">
            <div className="card-header-title">
              <h2>
                <ShoppingCart size={20} color="#2563eb" /> Kasir & Generate Struk
              </h2>
              <div className="shortcut-tip hide-on-mobile">
                <Keyboard size={14} /> <kbd>Enter</kbd> Pilih & Tambah | <kbd>F2</kbd> Proses Bayar | <kbd>F4</kbd> Reset
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
                  onEnterWithoutMatch={handleEnterWithoutMatch}
                  placeholder="Ketik nama barang atau alias..."
                />
              </div>

              <div className="price-qty-grid">
                {/* Harga Barang */}
                <div className="form-group">
                  <label>Harga Satuan</label>
                  <div className="price-input-wrapper">
                    <span className="currency-prefix">Rp</span>
                    <FormattedNumberInput
                      inputRef={priceInputRef}
                      value={itemPrice}
                      onChange={(val) => setItemPrice(val)}
                      placeholder="0"
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
              </div>

              {/* Tambah Button */}
              <button type="submit" className="btn-add-item">
                <Plus size={18} /> Tambah Item
              </button>
            </form>
          </div>

          {/* Card 2: Cart Items Table Card */}
          <div className="cart-card">
            <div className="card-header-title" style={{ marginBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
                Daftar Barang Belanjaan ({cartItems.length} item • {totalQty} pcs)
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

          {/* Card 3: Total Tagihan & Checkout Action Card */}
          <div className="checkout-card">
            {/* Total Ringkasan */}
            <div className="totals-summary">
              <div className="totals-info-left">
                <span className="totals-label">TOTAL TAGIHAN</span>
                <span className="totals-item-count">
                  {cartItems.length} Jenis Barang ({totalQty} Pcs)
                </span>
              </div>
              <span className="totals-amount">{formatRupiah(totalAmount)}</span>
            </div>

            {/* Primary Checkout & Reset Buttons */}
            <div className="checkout-actions-row">
              <button
                type="button"
                className="btn-primary-checkout"
                onClick={handleOpenPaymentModal}
                disabled={cartItems.length === 0}
                title="Buka menu pembayaran, input nama/catatan, dan cetak struk (F2)"
              >
                <CreditCard size={20} />
                <span>Proses Pembayaran<span className="btn-shortcut-tag"> (F2)</span></span>
                <ArrowRight size={18} />
              </button>

              <button
                type="button"
                className="btn-secondary-reset"
                onClick={handleResetTransaction}
                disabled={cartItems.length === 0}
                title="Reset transaksi kasir (F4)"
              >
                <RotateCcw size={16} />
                <span>Reset<span className="btn-shortcut-tag"> (F4)</span></span>
              </button>
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
            cashierName={getCurrentUser()?.name || storeProfile.cashierName}
            notes={notes}
          />
        </div>
      </div>

      {/* Modal Pembayaran & Cetak Struk */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        totalAmount={totalAmount}
        cartItems={cartItems}
        invoiceNo={invoiceNo}
        cashAmount={cashAmount}
        setCashAmount={setCashAmount}
        smartCashSuggestions={smartCashSuggestions}
        numericCash={numericCash}
        changeAmount={changeAmount}
        isInsufficientCash={isInsufficientCash}
        onSaveOnly={handleSaveOnlyTransaction}
        onPrintBluetooth={handlePrintBluetooth}
        isPrintingBt={isPrintingBt}
        onPrintReceipt={handlePrintReceipt}
        onPrintRawBT={handlePrintRawBT}
        onPrintThermer={handlePrintThermer}
        storeProfile={storeProfile}
      />
    </>
  );
};

export default KasirView;
