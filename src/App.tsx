import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Product, Transaction, StoreProfile, UserAccount } from './types';
import {
  getProducts,
  getTransactions,
  getStoreProfile,
} from './services/storageService';
import {
  validateAndRefreshSession,
  clearAuthSession,
} from './services/authService';
import { syncService } from './services/syncService';
import { Navbar, NavTab } from './components/Navbar';
import { KasirView } from './components/KasirView';
import { ProductListView } from './components/ProductListView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { InstallBanner, OfflineBanner } from './components/PwaBanners';
import { SplashScreen } from './components/SplashScreen';
import { LoginView } from './components/LoginView';
import { isAppOrPwa } from './utils/platform';
import './styles/main.css';
import './styles/print.css';
import { CheckCircle2, Info } from 'lucide-react';

interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'info';
}

export const App: React.FC = () => {
  const [currentUser, setCurrentUserState] = useState<UserAccount | null>(() => {
    return validateAndRefreshSession();
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(validateAndRefreshSession());
  });
  const [showSplash, setShowSplash] = useState<boolean>(() => isAppOrPwa() && Boolean(validateAndRefreshSession()));
  const [isSplashPreview, setIsSplashPreview] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<NavTab>(() => {
    try {
      const savedTab = sessionStorage.getItem('mte_active_tab') as NavTab;
      if (savedTab && ['kasir', 'products', 'history', 'settings'].includes(savedTab)) {
        return savedTab;
      }
    } catch {}
    return 'kasir';
  });
  const scrollPositions = useRef<Record<string, number>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [storeProfile, setStoreProfile] = useState<StoreProfile>(getStoreProfile());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const loadData = useCallback(() => {
    setProducts(getProducts());
    setTransactions(getTransactions());
    setStoreProfile(getStoreProfile());
  }, []);

  // Sliding session expiration renewal on window focus and app visibility
  useEffect(() => {
    const handleSlidingSessionCheck = () => {
      const activeUser = validateAndRefreshSession();
      if (!activeUser && isAuthenticated) {
        setIsAuthenticated(false);
        setCurrentUserState(null);
        showToast('Sesi login telah berakhir (kedaluwarsa 7 hari). Silakan login kembali.', 'info');
      } else if (activeUser) {
        setCurrentUserState(activeUser);
      }
    };

    window.addEventListener('focus', handleSlidingSessionCheck);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleSlidingSessionCheck();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Periodic heartbeat check every 30 minutes
    const interval = setInterval(handleSlidingSessionCheck, 30 * 60 * 1000);

    return () => {
      window.removeEventListener('focus', handleSlidingSessionCheck);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    loadData();

    const unsubRefresh = syncService.onDataRefresh(() => {
      loadData();
    });

    syncService.syncNow().catch((err) => {
      console.warn('Initial Turso sync background notice:', err);
    });

    return () => {
      unsubRefresh();
    };
  }, [isAuthenticated, loadData]);

  const showToast = (text: string, type: 'success' | 'info' = 'info') => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUserState(user);
    setIsAuthenticated(true);
    showToast(`Selamat datang, ${user.name}! Masuk sebagai ${user.role === 'admin' ? 'Administrator' : 'Kasir'}.`, 'success');
  };

  const handleLogout = () => {
    clearAuthSession();
    setCurrentUserState(null);
    setIsAuthenticated(false);
    setCurrentTab('kasir');
    try {
      sessionStorage.removeItem('mte_active_tab');
      sessionStorage.removeItem('mte_pos_pending_cart');
    } catch {}
  };

  const handleSelectTab = (tab: NavTab) => {
    if (tab === 'settings' && currentUser?.role === 'kasir') {
      showToast('Akses ditolak: Menu Pengaturan hanya untuk Administrator.', 'info');
      return;
    }
    // Simpan posisi scroll menu saat ini
    scrollPositions.current[currentTab] = window.scrollY;

    setCurrentTab(tab);
    try {
      sessionStorage.setItem('mte_active_tab', tab);
    } catch {}

    // Pulihkan posisi scroll menu yang dituju
    setTimeout(() => {
      const savedY = scrollPositions.current[tab] || 0;
      window.scrollTo({ top: savedY, behavior: 'instant' });
    }, 0);
  };

  const handleProductUpdated = () => {
    setProducts(getProducts());
  };

  const handleTransactionUpdated = () => {
    setTransactions(getTransactions());
  };

  const handleProfileUpdated = (newProfile: StoreProfile) => {
    setStoreProfile(newProfile);
  };

  const handlePreviewSplash = () => {
    setIsSplashPreview(true);
    setShowSplash(true);
  };

  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const isAdmin = currentUser?.role === 'admin';

  return (
    <>
      {showSplash && (
        <SplashScreen
          minDuration={isSplashPreview ? 2200 : 1800}
          isPreview={isSplashPreview}
          onFinish={() => {
            setShowSplash(false);
            setIsSplashPreview(false);
          }}
        />
      )}

      <div className="app-container no-print">
        <OfflineBanner />

        <Navbar
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          productCount={products.length}
          storeProfile={storeProfile}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        <main className="main-content">
          {/* Menu Kasir: Komponen tetap mounted agar isi keranjang, nego, bayar, & inputan tidak hilang */}
          <div
            className="tab-panel tab-panel-kasir"
            style={{ display: currentTab === 'kasir' ? 'block' : 'none' }}
          >
            <KasirView
              storeProfile={storeProfile}
              onProductUpdated={handleProductUpdated}
              onTransactionCreated={handleTransactionUpdated}
              showToast={showToast}
              isActive={currentTab === 'kasir'}
            />
          </div>

          {/* Menu Produk: Komponen tetap mounted agar pencarian & kategori filter tidak hilang */}
          <div
            className="tab-panel tab-panel-products"
            style={{ display: currentTab === 'products' ? 'block' : 'none' }}
          >
            <ProductListView
              products={products}
              onRefresh={handleProductUpdated}
              showToast={showToast}
            />
          </div>

          {/* Menu Riwayat: Komponen tetap mounted agar pencarian & detail struk yang dibuka tidak hilang */}
          <div
            className="tab-panel tab-panel-history"
            style={{ display: currentTab === 'history' ? 'block' : 'none' }}
          >
            <HistoryView
              transactions={transactions}
              storeProfile={storeProfile}
              onRefresh={handleTransactionUpdated}
              showToast={showToast}
            />
          </div>

          {/* Menu Pengaturan: Komponen tetap mounted agar isian form & status printer tidak hilang */}
          {isAdmin && (
            <div
              className="tab-panel tab-panel-settings"
              style={{ display: currentTab === 'settings' ? 'block' : 'none' }}
            >
              <SettingsView
                storeProfile={storeProfile}
                onUpdateProfile={handleProfileUpdated}
                showToast={showToast}
                onDataReset={loadData}
                onPreviewSplash={handlePreviewSplash}
              />
            </div>
          )}
        </main>

        <div className="toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast ${toast.type}`}>
              {toast.type === 'success' ? (
                <CheckCircle2 size={18} color="#10b981" />
              ) : (
                <Info size={18} color="#38bdf8" />
              )}
              <span>{toast.text}</span>
            </div>
          ))}
        </div>

        <InstallBanner />
      </div>
    </>
  );
};

export default App;
