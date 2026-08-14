import React, { useState } from 'react';
import { StoreProfile } from '../types';
import { saveStoreProfile, exportDataJSON, importDataJSON } from '../services/storageService';
import {
  Settings,
  Store,
  Printer,
  Save,
  Download,
  Upload,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';

interface SettingsViewProps {
  storeProfile: StoreProfile;
  onUpdateProfile: (newProfile: StoreProfile) => void;
  showToast: (msg: string, type?: 'success' | 'info') => void;
  onDataReset: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  storeProfile,
  onUpdateProfile,
  showToast,
  onDataReset,
}) => {
  const [profile, setProfile] = useState<StoreProfile>({ ...storeProfile });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoreProfile(profile);
    onUpdateProfile(profile);
    showToast('Pengaturan toko & printer berhasil disimpan!', 'success');
  };

  const handleExport = () => {
    const jsonStr = exportDataJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_full_mega_teknik_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup seluruh data berhasil diunduh', 'success');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importDataJSON(content);
        if (success) {
          onDataReset();
          showToast('Data berhasil dipulihkan dari backup!', 'success');
        } else {
          showToast('File JSON tidak valid', 'info');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="product-view-container">
      <div className="page-header-row">
        <div className="page-title">
          <h2>
            <Settings size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} color="#2563eb" />
            Pengaturan Toko & Printer Thermal
          </h2>
          <p>Sesuaikan nama toko, ukuran kertas thermal, dan teks struk kasir.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="settings-grid">
          {/* Info Toko */}
          <div className="settings-card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Store size={18} color="#2563eb" /> Profil Toko
            </h3>

            <div className="form-group">
              <label>Nama Toko *</label>
              <input
                type="text"
                className="form-input"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Slogan / Tagline Toko</label>
              <input
                type="text"
                className="form-input"
                value={profile.tagline}
                onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
                placeholder="Contoh: Solusi Alat Teknik & Bahan Bangunan"
              />
            </div>

            <div className="form-group">
              <label>Alamat Toko</label>
              <input
                type="text"
                className="form-input"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                placeholder="Jl. Raya Teknik No. 88..."
              />
            </div>

            <div className="form-group">
              <label>No. Telepon / WhatsApp</label>
              <input
                type="text"
                className="form-input"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="0812-xxxx-xxxx"
              />
            </div>

            <div className="form-group">
              <label>Nama Kasir Default</label>
              <input
                type="text"
                className="form-input"
                value={profile.cashierName}
                onChange={(e) => setProfile({ ...profile, cashierName: e.target.value })}
              />
            </div>
          </div>

          {/* Pengaturan Printer & Struk */}
          <div className="settings-card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Printer size={18} color="#2563eb" /> Format Struk & Printer Thermal
            </h3>

            <div className="form-group">
              <label>Ukuran Kertas Printer Thermal</label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '2px solid #2563eb',
                  background: '#eff6ff',
                }}
              >
                <div style={{ background: '#2563eb', color: 'white', padding: '4px 8px', borderRadius: '4px', fontWeight: 800, fontSize: '0.8rem' }}>
                  58 MM
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
                    Standar Mini Thermal Printer (58mm)
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Kompatibel dengan semua printer thermal mini 58mm (USB, Bluetooth, POS-58, Panda, Eppos, Xprinter, VSC, dll.)
                  </div>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Pesan Penutup Struk (Footer)</label>
              <textarea
                className="form-input"
                style={{ height: '80px', resize: 'vertical' }}
                value={profile.footerNote}
                onChange={(e) => setProfile({ ...profile, footerNote: e.target.value })}
                placeholder="Contoh: Barang yang sudah dibeli tidak dapat ditukar/dikembalikan..."
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={profile.autoSaveProducts}
                  onChange={(e) => setProfile({ ...profile, autoSaveProducts: e.target.checked })}
                />
                <strong>Auto-Save Produk Baru</strong> (Otomatis simpan barang & harga saat diketik di kasir)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={profile.showDateTime}
                  onChange={(e) => setProfile({ ...profile, showDateTime: e.target.checked })}
                />
                Tampilkan Tanggal & Waktu di Struk
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={profile.showCashierName}
                  onChange={(e) => setProfile({ ...profile, showCashierName: e.target.checked })}
                />
                Tampilkan Nama Kasir di Struk
              </label>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
                <Save size={18} /> Simpan Pengaturan
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Backup & Restore Box */}
      <div className="settings-card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
          Cadangkan & Pulihkan Data (Backup / Restore)
        </h3>
        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Simpan seluruh basis data (semua produk, nama lain/alias, transaksi, dan pengaturan) ke dalam satu file backup JSON agar aman atau dapat dipindahkan ke komputer/laptop lain.
        </p>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-outline" onClick={handleExport}>
            <Download size={16} /> Unduh File Backup (Export JSON)
          </button>
          <label className="btn-outline" style={{ cursor: 'pointer', margin: 0 }}>
            <Upload size={16} /> Pulihkan dari File (Import JSON)
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </label>
        </div>
      </div>
    </div>
  );
};
