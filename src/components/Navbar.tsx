import React from 'react';
import { ShoppingCart, Package, History, Settings, Wrench } from 'lucide-react';
import { StoreProfile } from '../types';

export type NavTab = 'kasir' | 'products' | 'history' | 'settings';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  productCount: number;
  storeProfile: StoreProfile;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  productCount,
  storeProfile,
}) => {
  return (
    <>
      {/* Top Navbar */}
      <header className="navbar no-print">
        <div className="brand-section">
          <div className="brand-icon">
            <Wrench size={20} />
          </div>
          <div className="brand-info">
            <h1>{storeProfile.name}</h1>
            <span>POS Thermal 58mm</span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="nav-links-desktop">
          <button
            type="button"
            className={`nav-btn ${currentTab === 'kasir' ? 'active' : ''}`}
            onClick={() => onSelectTab('kasir')}
          >
            <ShoppingCart size={18} />
            <span>Kasir & Struk</span>
          </button>

          <button
            type="button"
            className={`nav-btn ${currentTab === 'products' ? 'active' : ''}`}
            onClick={() => onSelectTab('products')}
          >
            <Package size={18} />
            <span>Daftar Produk</span>
            <span className="nav-badge">{productCount}</span>
          </button>

          <button
            type="button"
            className={`nav-btn ${currentTab === 'history' ? 'active' : ''}`}
            onClick={() => onSelectTab('history')}
          >
            <History size={18} />
            <span>Riwayat Struk</span>
          </button>

          <button
            type="button"
            className={`nav-btn ${currentTab === 'settings' ? 'active' : ''}`}
            onClick={() => onSelectTab('settings')}
          >
            <Settings size={18} />
            <span>Pengaturan</span>
          </button>
        </nav>
      </header>

      {/* Mobile Bottom Navigation Bar (Thumb Friendly) */}
      <div className="mobile-bottom-nav no-print">
        <button
          type="button"
          className={`mobile-nav-item ${currentTab === 'kasir' ? 'active' : ''}`}
          onClick={() => onSelectTab('kasir')}
        >
          <ShoppingCart size={20} />
          <span>Kasir</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-item ${currentTab === 'products' ? 'active' : ''}`}
          onClick={() => onSelectTab('products')}
        >
          <Package size={20} />
          <span>Produk</span>
          {productCount > 0 && <span className="mobile-nav-badge">{productCount}</span>}
        </button>

        <button
          type="button"
          className={`mobile-nav-item ${currentTab === 'history' ? 'active' : ''}`}
          onClick={() => onSelectTab('history')}
        >
          <History size={20} />
          <span>Riwayat</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-item ${currentTab === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectTab('settings')}
        >
          <Settings size={20} />
          <span>Setting</span>
        </button>
      </div>
    </>
  );
};
