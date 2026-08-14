import React, { useState, useEffect, useCallback } from 'react';
import { Product, Transaction, StoreProfile } from './types';
import {
  getProducts,
  getTransactions,
  getStoreProfile,
} from './services/storageService';
import { Navbar, NavTab } from './components/Navbar';
import { KasirView } from './components/KasirView';
import { ProductListView } from './components/ProductListView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import './styles/main.css';
import './styles/print.css';
import { CheckCircle2, Info } from 'lucide-react';

interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'info';
}

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('kasir');
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [storeProfile, setStoreProfile] = useState<StoreProfile>(getStoreProfile());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Load all initial data
  const loadData = useCallback(() => {
    setProducts(getProducts());
    setTransactions(getTransactions());
    setStoreProfile(getStoreProfile());
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toast notification helper
  const showToast = (text: string, type: 'success' | 'info' = 'info') => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
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

  return (
    <div className="app-container">
      {/* Navigation Header */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        productCount={products.length}
        storeProfile={storeProfile}
      />

      {/* Main Dynamic View */}
      <main className="main-content no-print">
        {currentTab === 'kasir' && (
          <KasirView
            storeProfile={storeProfile}
            onProductUpdated={handleProductUpdated}
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
            showToast={showToast}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            storeProfile={storeProfile}
            onUpdateProfile={handleProfileUpdated}
            showToast={showToast}
            onDataReset={loadData}
          />
        )}
      </main>

      {/* Floating Toast Alerts */}
      <div className="toast-container no-print">
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
    </div>
  );
};

export default App;
