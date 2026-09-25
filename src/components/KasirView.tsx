import React, { useState, useEffect, useRef } from 'react';
import { Product, CartItem, Transaction, StoreProfile } from '../types';
import {
  findProductByNameOrAlias,
  addOrUpdateProduct,
  saveTransaction,
  generateInvoiceNumber,
  generateTransactionId,
  generateCartItemId,
  getCurrentUser,
} from '../services/storageService';
import { printViaThermer } from '../services/directPrintService';
import { printDirectBluetooth } from '../services/bluetoothPrintService';
import {
  isNativePrinterAvailable,
  printNativeDirect,
} from '../services/nativePrintService';
import { syncService } from '../services/syncService';
import { AutocompleteInput } from './AutocompleteInput';
import { FormattedNumberInput } from './FormattedNumberInput';
import { ReceiptPreview } from './ReceiptPreview';
import { PaymentModal } from './PaymentModal';
import { NegoModal } from './NegoModal';
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
  Tag,
} from 'lucide-react';

interface KasirViewProps {
  storeProfile: StoreProfile;
  onProductUpdated: () => void;
  onTransactionCreated?: () => void;
  showToast: (msg: string, type?: 'success' | 'info') => void;
}

export const KasirView: React.FC<KasirViewProps> = ({
  storeProfile,
  onProductUpdated,
  onTransactionCreated,
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
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qris'>('cash');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showMobilePreview, setShowMobilePreview] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [negoTargetItem, setNegoTargetItem] = useState<CartItem | null>(null);
  const [isNegoModalOpen, setIsNegoModalOpen] = useState<boolean>(false);

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

  // Nomor struk bisa basi bila sync/heartbeat menarik transaksi device lain
  // selagi kasir membuka halaman. Regenerasi saat data refresh TAPI hanya
  // bila keranjang kosong (jangan ubah nomor struk yang sedang diketik).
  const cartEmptyRef = useRef(true);
  cartEmptyRef.current = cartItems.length === 0;
  useEffect(() => {
    const unsub = syncService.onDataRefresh(() => {
      if (cartEmptyRef.current) {
        setInvoiceNo(generateInvoiceNumber());
      }
    });
    return () => unsub();
  }, []);

  // Calculate Total & Change
  const totalAmount = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  const numericCash = parseNumberFromInput(cashAmount);
  const changeAmount = numericCash - totalAmount;

  // Guard anti-duplikat: cegah double-save akibat double keydown listener
  // (KasirView + PaymentModal), double-click, atau key-repeat.
  // saveTransaction sendiri juga idempotent per id (lihat storageService).
  const processingTxRef = useRef(false);
  const tryBeginTx = (): boolean => {
    if (processingTxRef.current) return false;
    processingTxRef.current = true;
    return true;
  };
  const endTxSoon = () => {
    setTimeout(() => {
      processingTxRef.current = false;
    }, 800);
  };

  // Keyboard shortcut global (F2 = Buka Bayar, F4 = Reset).
  // F3 (Simpan) sengaja TIDAK ditangani di sini saat modal terbuka —
  // ditangani PaymentModal agar tidak double-fire 2 listener.
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        if (isPaymentModalOpen) return; // biarkan PaymentModal yang handle
        e.preventDefault();
        handleOpenPaymentModal();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleResetTransaction();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isPaymentModalOpen]);

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
        id: generateCartItemId(),
        productId: prod.id,
        name: prod.name.trim(),
        price: priceNum,
        originalPrice: priceNum,
        isNego: false,
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
        id: generateCartItemId(),
        productId: finalProductId,
        name: trimmedName,
        price: priceNum,
        originalPrice: priceNum,
        isNego: false,
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

  const handleOpenNegoModal = (item: CartItem) => {
    setNegoTargetItem(item);
    setIsNegoModalOpen(true);
  };

  const handleApplyNego = (itemId: string, newPrice: number, resetToOriginal?: boolean) => {
    setCartItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== itemId) return item;
        const baseOriginal =
          item.originalPrice && item.originalPrice > 0 ? item.originalPrice : item.price;
        if (resetToOriginal || newPrice === baseOriginal) {
          return {
            ...item,
            price: baseOriginal,
            originalPrice: undefined,
            isNego: false,
            subtotal: baseOriginal * item.qty,
          };
        }
        return {
          ...item,
          originalPrice: baseOriginal,
          price: newPrice,
          isNego: true,
          subtotal: newPrice * item.qty,
        };
      })
    );
    showToast(
      resetToOriginal
        ? 'Harga barang dikembalikan ke harga normal'
        : `Harga nego ${formatRupiah(newPrice)} berhasil diterapkan!`,
      'success'
    );
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

  const isInsufficientCash =
    paymentMethod === 'cash' && numericCash > 0 && numericCash < totalAmount;

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
    setPaymentMethod('cash');
    setCashAmount('');
    setCustomerName('');
    setNotes('');
    setSelectedProduct(null);
    setInvoiceNo(generateInvoiceNumber());
    setIsPaymentModalOpen(false);
    setIsNegoModalOpen(false);
    setNegoTargetItem(null);
    focusInputIfDesktop(nameInputRef);
  };

  const createCurrentTransaction = (): Transaction | null => {
    if (cartItems.length === 0) {
      showToast('Keranjang masih kosong, tambahkan barang terlebih dahulu', 'info');
      focusInputIfDesktop(nameInputRef);
      return null;
    }

    const isNonCash = paymentMethod === 'qris' || paymentMethod === 'transfer';
    if (!isNonCash && numericCash > 0 && numericCash < totalAmount) {
      showToast(
        `Uang diterima (${formatRupiah(numericCash)}) kurang dari total tagihan (${formatRupiah(totalAmount)})`,
        'info'
      );
      return null;
    }

    const finalCash = isNonCash ? totalAmount : numericCash > 0 ? numericCash : totalAmount;
    const finalChange = isNonCash ? 0 : Math.max(0, finalCash - totalAmount);
    const activeUser = getCurrentUser();

    const transactionData: Transaction = {
      id: generateTransactionId(),
      invoiceNo,
      date: new Date().toISOString(),
      items: [...cartItems],
      totalAmount,
      cashAmount: finalCash,
      changeAmount: finalChange,
      paymentMethod,
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
    if (!tryBeginTx()) return;
    try {
      const trx = createCurrentTransaction();
      if (!trx) return;

      showToast(`Transaksi ${trx.invoiceNo} berhasil disimpan ke database!`, 'success');
      handleResetTransaction();
    } finally {
      endTxSoon();
    }
  };

  // 2. Direct Web Bluetooth Print (Android Chrome / PC Web Bluetooth - No 3rd party app needed!)
  const [isPrintingBt, setIsPrintingBt] = useState(false);

  const handlePrintBluetooth = async () => {
    if (!tryBeginTx()) return;
    const trx = createCurrentTransaction();
    if (!trx) {
      endTxSoon();
      return;
    }

    try {
      setIsPrintingBt(true);

      // 1. Kalau di APK native -> print LANGSUNG via Bluetooth Classic SPP
      if (isNativePrinterAvailable()) {
        showToast('Mencetak langsung ke printer Bluetooth...', 'info');
        const result = await printNativeDirect(trx, storeProfile);
        showToast(`Struk tercetak via ${result.address}!`, 'success');
        handleResetTransaction();
        return;
      }

      // 2. Kalau di Chrome / PWA -> Web Bluetooth (BLE)
      showToast('Menghubungkan ke printer Bluetooth (VSC MP-58M Pro)...', 'info');
      await printDirectBluetooth(trx, storeProfile);
      showToast('Struk berhasil dicetak ke printer Bluetooth!', 'success');
      handleResetTransaction();
    } catch (err: any) {
      console.error('Bluetooth print error:', err);
      // Transaksi SUDAH tersimpan (createCurrentTransaction menyimpan sebelum cetak).
      // Keranjang wajib direset: kalau dibiarkan, tombol cetak yang ditekan lagi
      // membuat transaksi BARU dengan item yang sama (duplikat omzet).
      // Cetak ulang struk yang benar cukup lewat menu Riwayat (transaksi terbaru).
      handleResetTransaction();
      const msg: string = err?.message || 'Gagal koneksi Bluetooth.';
      // Pesan khusus kalau Web Bluetooth tidak didukung (artinya lagi di APK lama / WebView)
      if (msg.includes('tidak mendukung Web Bluetooth') || msg.includes('GATT')) {
        showToast(`Transaksi ${trx.invoiceNo} sudah tersimpan. Web Bluetooth tidak didukung di sini — pakai Thermer (iOS), atau cetak ulang dari Riwayat.`, 'info');
      } else {
        showToast(`Transaksi ${trx.invoiceNo} sudah tersimpan. Cetak gagal: ${msg} Periksa printer, lalu cetak ulang dari Riwayat.`, 'info');
      }
    } finally {
      setIsPrintingBt(false);
      endTxSoon();
    }
  };

  // 3. Direct Thermer Print (iOS Companion App)
  const handlePrintThermer = () => {
    if (!tryBeginTx()) return;
    try {
      const trx = createCurrentTransaction();
      if (!trx) return;

      const sent = printViaThermer(trx, storeProfile);
      if (sent) {
        showToast('Membuka aplikasi Thermer iOS (POS-58)...', 'success');
        handleResetTransaction();
      } else {
        // Cooldown Thermer (1.5s): URL scheme tidak terkirim kali ini.
        // Transaksi sudah tersimpan — reset + arahkan Riwayat agar retry tidak dobel.
        handleResetTransaction();
        showToast(`Transaksi ${trx.invoiceNo} sudah tersimpan. Thermer belum siap (tunggu ±2 detik), cetak ulang dari Riwayat.`, 'info');
      }
    } finally {
      endTxSoon();
    }
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
                        <td style={{ textAlign: 'right' }}>
                          <div className="cart-price-cell">
                            {item.isNego && item.originalPrice && item.originalPrice !== item.price && (
                              <span className="cart-original-price">
                                {formatRupiah(item.originalPrice)}
                              </span>
                            )}
                            <div className="cart-current-price-row">
                              <span className={`cart-current-price ${item.isNego ? 'is-nego' : ''}`}>
                                {formatRupiah(item.price)}
                              </span>
                              <button
                                type="button"
                                className={`btn-table-nego ${item.isNego ? 'active' : ''}`}
                                onClick={() => handleOpenNegoModal(item)}
                                title={
                                  item.isNego
                                    ? 'Harga dinego, klik untuk ubah atau reset'
                                    : 'Nego / ubah harga satuan barang ini'
                                }
                              >
                                <Tag size={10} />
                                <span>{item.isNego ? 'Nego' : 'Nego'}</span>
                              </button>
                            </div>
                          </div>
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
            paymentMethod={paymentMethod}
          />
        </div>

        {/* Mobile Sticky Checkout Bar (Menempel di atas bottom-nav pada HP/Tablet < 1024px) */}
        {cartItems.length > 0 && (
          <div className="mobile-sticky-checkout-bar no-print">
            <div className="mobile-sticky-info">
              <span className="mobile-sticky-label">TOTAL TAGIHAN</span>
              <div className="mobile-sticky-values">
                <span className="mobile-sticky-amount">{formatRupiah(totalAmount)}</span>
                <span className="mobile-sticky-items">
                  ({cartItems.length} item • {totalQty} pcs)
                </span>
              </div>
            </div>
            <div className="mobile-sticky-actions">
              <button
                type="button"
                className="btn-mobile-sticky-pay"
                onClick={handleOpenPaymentModal}
                title="Buka menu pembayaran (F2)"
              >
                <CreditCard size={18} />
                <span>Bayar (F2)</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Pembayaran & Cetak Struk */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        totalAmount={totalAmount}
        cartItems={cartItems}
        invoiceNo={invoiceNo}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        cashAmount={cashAmount}
        setCashAmount={setCashAmount}
        smartCashSuggestions={smartCashSuggestions}
        numericCash={numericCash}
        changeAmount={changeAmount}
        isInsufficientCash={isInsufficientCash}
        customerName={customerName}
        setCustomerName={setCustomerName}
        notes={notes}
        setNotes={setNotes}
        onSaveOnly={handleSaveOnlyTransaction}
        onPrintBluetooth={handlePrintBluetooth}
        isPrintingBt={isPrintingBt}
        onPrintThermer={handlePrintThermer}
        storeProfile={storeProfile}
      />

      {/* Modal Nego / Potongan Harga Barang */}
      <NegoModal
        isOpen={isNegoModalOpen}
        item={negoTargetItem}
        onClose={() => {
          setIsNegoModalOpen(false);
          setNegoTargetItem(null);
        }}
        onApplyNego={handleApplyNego}
      />
    </>
  );
};

export default KasirView;
