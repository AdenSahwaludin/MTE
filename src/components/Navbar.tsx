import React from 'react';
import { ShoppingCart, Package, History, Settings, LogOut, ShieldCheck, User } from 'lucide-react';
import { StoreProfile, UserAccount } from '../types';
import { SyncBadge } from './SyncBadge';

export type NavTab = 'kasir' | 'products' | 'history' | 'settings';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  productCount: number;
  storeProfile: StoreProfile;
  currentUser: UserAccount | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  productCount,
  storeProfile,
  currentUser,
  onLogout,
}) => {
  const isAdmin = currentUser?.role === 'admin';

  return (
    <>
      <header className="navbar no-print">
        <div className="brand-section">
          <div className="brand-icon">
            <img className="brand-logo-img" src="/logo.webp" alt="Logo Mega Tehnik Elektronik" />
          </div>
          <div className="brand-info">
            <h1 className="brand-title">{storeProfile.name || 'Mega Tehnik Elektronik'}</h1>
            <span className="brand-tagline">{storeProfile.tagline || 'Solusi Elektronik, Terpercaya!'}</span>
          </div>
        </div>

        {/* Desktop Navigation Links (Visible on Laptop/PC >= 1024px) */}
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

          {isAdmin && (
            <button
              type="button"
              className={`nav-btn ${currentTab === 'settings' ? 'active' : ''}`}
              onClick={() => onSelectTab('settings')}
            >
              <Settings size={18} />
              <span>Pengaturan</span>
            </button>
          )}
        </nav>

        {/* Right Section: User Badge, Sync Status, and Logout */}
        <div className="navbar-right-section">
          {currentUser && (
            <div
              className={`user-badge-pill ${isAdmin ? 'admin' : 'kasir'}`}
              title={`Masuk sebagai ${currentUser.name} (${currentUser.role})`}
            >
              {isAdmin ? <ShieldCheck size={14} color="#60a5fa" /> : <User size={14} color="#34d399" />}
              <span className="user-badge-name-full">
                {isAdmin ? 'Admin' : 'Kasir'}: {currentUser.name || currentUser.username}
              </span>
              <span className="user-badge-name-compact">
                {currentUser.name ? currentUser.name.split(' ')[0] : currentUser.username}
              </span>
            </div>
          )}

          <SyncBadge />

          {onLogout && (
            <button
              type="button"
              className="btn-logout"
              onClick={onLogout}
              title="Keluar / Logout dari Akun"
            >
              <LogOut size={16} />
              <span className="logout-label">Keluar</span>
            </button>
          )}
        </div>
      </header>

      {/* Bottom Nav for Mobile & Tablets / iPad (< 1024px) */}
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

        {isAdmin && (
          <button
            type="button"
            className={`mobile-nav-item ${currentTab === 'settings' ? 'active' : ''}`}
            onClick={() => onSelectTab('settings')}
          >
            <Settings size={20} />
            <span>Setting</span>
          </button>
        )}
      </div>
    </>
  );
};
