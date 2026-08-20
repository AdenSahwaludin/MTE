import React, { useState, useEffect, useCallback } from 'react';
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
import { ThermalReceipt } from './components/ThermalReceipt';
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
  const [currentTab, setCurrentTab] = useState<NavTab>('kasir');
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [storeProfile, setStoreProfile] = useState<StoreProfile>(getStoreProfile());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [printTransaction, setPrintTransaction] = useState<Transaction | null>(null);

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
  };

  const handleSelectTab = (tab: NavTab) => {
    if (tab === 'settings' && currentUser?.role === 'kasir') {
      showToast('Akses ditolak: Menu Pengaturan hanya untuk Administrator.', 'info');
      return;
    }
    setCurrentTab(tab);
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

  const handlePrintReceipt = (trx: Transaction) => {
    setPrintTransaction(trx);
    setTimeout(() => {
      window.print();
    }, 100);
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

      <ThermalReceipt
        transaction={printTransaction}
        storeProfile={storeProfile}
      />

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
          {currentTab === 'kasir' && (
            <KasirView
              storeProfile={storeProfile}
              onProductUpdated={handleProductUpdated}
              onTransactionCreated={handleTransactionUpdated}
              onPrintReceipt={handlePrintReceipt}
              showToast={showToast}
            />
          )}

          {currentTab === 'products' && (
            <ProductListView
              products={products}
              onRefresh={handleProductUpdated}
              showToast={showToast}
            />
          )}

          {currentTab === 'history' && (
            <HistoryView
              transactions={transactions}
              storeProfile={storeProfile}
              onRefresh={handleTransactionUpdated}
              onPrintReceipt={handlePrintReceipt}
              showToast={showToast}
            />
          )}

          {currentTab === 'settings' && isAdmin && (
            <SettingsView
              storeProfile={storeProfile}
              onUpdateProfile={handleProfileUpdated}
              showToast={showToast}
              onDataReset={loadData}
              onPreviewSplash={handlePreviewSplash}
            />
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
