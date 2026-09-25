import React, { useState, useEffect } from 'react';
import { StoreProfile, UserAccount, Transaction } from '../types';
import {
  saveStoreProfile,
  exportDataJSON,
  importDataJSON,
  getUsers,
  addOrUpdateUser,
  deleteUser,
  getCurrentUser,
} from '../services/storageService';
import { syncService, SyncInfo } from '../services/syncService';
import { testTursoConnection, getTursoConfig } from '../services/tursoClient';
import { printDirectBluetooth } from '../services/bluetoothPrintService';
import {
  isNativePrinterAvailable,
  listPairedPrinters,
  getSavedPrinterAddress,
  savePrinterAddress,
  printNativeDirect,
  PairedPrinter,
} from '../services/nativePrintService';
import {
  Settings,
  Store,
  Printer,
  Save,
  Download,
  Upload,
  CheckCircle,
  RefreshCw,
  Zap,
  Activity,
  Server,
  AlertCircle,
  Database,
  Trash2,
  Users,
  UserPlus,
  ShieldCheck,
  User,
  Edit2,
  Lock,
} from 'lucide-react';

interface SettingsViewProps {
  storeProfile: StoreProfile;
  onUpdateProfile: (newProfile: StoreProfile) => void;
  showToast: (msg: string, type?: 'success' | 'info') => void;
  onDataReset: () => void;
  onPreviewSplash?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  storeProfile,
  onUpdateProfile,
  showToast,
  onDataReset,
  onPreviewSplash,
}) => {
  const [profile, setProfile] = useState<StoreProfile>({
    ...storeProfile,
    address: storeProfile.address || 'Blok Gebangmampang, Desa Margamulya, Kec. Bongas',
    phone: storeProfile.phone || '0852-2429-7545',
  });

  const [syncInfo, setSyncInfo] = useState<SyncInfo>(syncService.getSyncInfo());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploadingAll, setIsUploadingAll] = useState(false);
  const [isClearingTurso, setIsClearingTurso] = useState(false);
  const [pingState, setPingState] = useState<{
    testing: boolean;
    latencyMs?: number;
    success?: boolean;
    error?: string;
  }>({ testing: false });

  const [usersList, setUsersList] = useState<UserAccount[]>(() => getUsers());
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | string | null>(null);
  const [userFormData, setUserFormData] = useState<{
    username: string;
    password: string;
    name: string;
    role: 'admin' | 'kasir';
  }>({
    username: '',
    password: '',
    name: '',
    role: 'kasir',
  });

  const loggedUser = getCurrentUser();
  const tursoConfig = getTursoConfig();

  // Tandai form kotor agar sync background tidak menimpa ketikan user.
  const [isProfileDirty, setIsProfileDirty] = useState(false);
  const updateProfile = (patch: Partial<StoreProfile>) => {
    setIsProfileDirty(true);
    setProfile((prev) => ({ ...prev, ...patch }));
  };

  // Ikuti perubahan profil dari server KECUALI user sedang mengetik.
  useEffect(() => {
    if (isProfileDirty) return;
    setProfile({
      ...storeProfile,
      address: storeProfile.address || 'Blok Gebangmampang, Desa Margamulya, Kec. Bongas',
      phone: storeProfile.phone || '0852-2429-7545',
    });
  }, [storeProfile, isProfileDirty]);

  const [printers, setPrinters] = useState<PairedPrinter[]>([]);
  const [savedPrinter, setSavedPrinter] = useState<string>(() => getSavedPrinterAddress());
  const [isScanningPrinter, setIsScanningPrinter] = useState(false);
  const isNativePrinter = isNativePrinterAvailable();

  const handleScanPrinters = async () => {
    setIsScanningPrinter(true);
    try {
      const list = await listPairedPrinters();
      setPrinters(list);
      if (list.length === 0) {
        showToast('Tidak ada printer ketemu. Nyalakan printer + Bluetooth HP, lalu Scan Printer lagi.', 'info');
      } else {
        showToast(`Ketemu ${list.length} perangkat Bluetooth — pilih yang namanya printer.`, 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Gagal scan printer.', 'info');
    } finally {
      setIsScanningPrinter(false);
    }
  };

  const [isTestingPrint, setIsTestingPrint] = useState(false);

  const handleTestPrint = async () => {
    setIsTestingPrint(true);
    const testTrx: Transaction = {
      id: 'test-print-' + Date.now(),
      invoiceNo: 'TEST-001',
      date: new Date().toISOString(),
      items: [
        {
          id: 'test-item-1',
          name: 'TES KONEKSI PRINTER 58MM',
          price: 15000,
          qty: 1,
          subtotal: 15000,
        },
        {
          id: 'test-item-2',
          name: 'STATUS: SIAP TRANSAKSI',
          price: 0,
          qty: 1,
          subtotal: 0,
        },
      ],
      totalAmount: 15000,
      cashAmount: 15000,
      changeAmount: 0,
      paymentMethod: 'cash',
      cashierName: profile.cashierName || 'Tes Kasir',
      notes: 'Uji Coba Printer Bluetooth OK',
    };

    try {
      if (isNativePrinter) {
        showToast('Mengirim cetak sampel ke printer APK...', 'info');
        await printNativeDirect(testTrx, profile);
        showToast('Berhasil mencetak struk uji coba via APK!', 'success');
      } else {
        showToast('Menghubungkan printer Bluetooth untuk cetak sampel...', 'info');
        await printDirectBluetooth(testTrx, profile);
        showToast('Berhasil mencetak struk uji coba Bluetooth!', 'success');
      }
    } catch (err: any) {
      console.error('Test print error:', err);
      showToast(
        (err?.message || 'Gagal tes cetak.') + ' Pastikan printer Bluetooth menyala & siap.',
        'info'
      );
    } finally {
      setIsTestingPrint(false);
    }
  };

  const handleSelectPrinter = (address: string) => {
    savePrinterAddress(address);
    setSavedPrinter(address);
    showToast('Printer default tersimpan!', 'success');
  };

  useEffect(() => {
    const unsub = syncService.subscribe((info) => {
      setSyncInfo(info);
    });
    // Refresh daftar user + profil saat ada data baru dari cloud (heartbeat/sync).
    const unsubRefresh = syncService.onDataRefresh(() => {
      setUsersList(getUsers());
    });
    return () => {
      unsub();
      unsubRefresh();
    };
  }, []);

  const handleTestConnection = async () => {
    setPingState({ testing: true });
    const res = await testTursoConnection();
    setPingState({
      testing: false,
      latencyMs: res.latencyMs,
      success: res.success,
      error: res.error,
    });
    if (res.success) {
      showToast(`Koneksi Turso Cloud Berhasil! Respon: ${res.latencyMs} ms`, 'success');
    } else {
      showToast(`Koneksi Gagal: ${res.error}`, 'info');
    }
  };

  const handleManualSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await syncService.syncNow();
      if (res.success) {
        showToast('Sinkronisasi dengan Turso Cloud berhasil!', 'success');
        onDataReset();
        setUsersList(getUsers());
        setIsProfileDirty(false);
      } else {
        showToast(`Sinkronisasi gagal: ${res.message}`, 'info');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUploadAllToTurso = async () => {
    if (!window.confirm('Unggah seluruh produk, transaksi, dan profil toko lokal ke Database Cloud Turso?')) {
      return;
    }
    setIsUploadingAll(true);
    try {
      const res = await syncService.uploadAllLocalDataToTurso();
      if (res.success) {
        showToast('Seluruh data lokal berhasil diunggah ke Turso Cloud!', 'success');
      } else {
        showToast(`Gagal mengunggah ke Turso: ${res.message}`, 'info');
      }
    } finally {
      setIsUploadingAll(false);
    }
  };

  const handleClearTurso = async () => {
    if (!window.confirm('PERINGATAN: Apakah Anda yakin ingin MENGHAPUS SEMUA DATA di Database Cloud Turso? Tindakan ini akan mengosongkan seluruh tabel di cloud.')) {
      return;
    }
    setIsClearingTurso(true);
    try {
      const res = await syncService.clearTursoDatabase(false);
      if (res.success) {
        showToast('Database Cloud Turso berhasil dikosongkan 100%!', 'success');
      } else {
        showToast(`Gagal mengosongkan Turso: ${res.message}`, 'info');
      }
    } finally {
      setIsClearingTurso(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoreProfile(profile);
    onUpdateProfile(profile);
    setIsProfileDirty(false);
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
          setUsersList(getUsers());
          showToast('Data berhasil dipulihkan dari backup!', 'success');
        } else {
          showToast('File JSON tidak valid', 'info');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleOpenAddUser = () => {
    setEditingUserId(null);
    setUserFormData({
      username: '',
      password: '',
      name: '',
      role: 'kasir',
    });
    setShowUserModal(true);
  };

  const handleOpenEditUser = (user: UserAccount) => {
    setEditingUserId(user.id);
    setUserFormData({
      username: user.username,
      password: user.password,
      name: user.name,
      role: user.role,
    });
    setShowUserModal(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.username.trim() || !userFormData.name.trim()) {
      showToast('Username dan Nama Lengkap wajib diisi', 'info');
      return;
    }

    if (!editingUserId && !userFormData.password.trim()) {
      showToast('Password wajib diisi untuk pengguna baru', 'info');
      return;
    }

    try {
      addOrUpdateUser(userFormData, editingUserId || undefined);
    } catch (err: any) {
      showToast(err?.messageId || err?.messageEn || 'Anda tidak memiliki izin untuk mengelola pengguna.', 'info');
      return;
    }
    setUsersList(getUsers());
    setShowUserModal(false);
    showToast(`Pengguna "${userFormData.name}" berhasil disimpan!`, 'success');
  };

  const handleDeleteUserClick = (user: UserAccount) => {
    if (loggedUser && String(loggedUser.id) === String(user.id)) {
      showToast('Tidak dapat menghapus akun Anda sendiri yang sedang aktif!', 'info');
      return;
    }

    if (!window.confirm(`Hapus pengguna "${user.name}" (${user.username})?`)) {
      return;
    }

    const success = deleteUser(user.id);
    if (success) {
      setUsersList(getUsers());
      showToast(`Pengguna "${user.name}" berhasil dihapus.`, 'success');
    } else {
      showToast('Gagal menghapus pengguna. Minimal harus ada 1 akun Admin di sistem.', 'info');
    }
  };

  return (
    <div className="product-view-container">
      <div className="page-header-row">
        <div className="page-title">
          <h2>
            <Settings size={22} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} color="#2563eb" />
            Pengaturan
          </h2>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="settings-grid">
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
                onChange={(e) => updateProfile({ name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Slogan / Tagline</label>
              <input
                type="text"
                className="form-input"
                value={profile.tagline}
                onChange={(e) => updateProfile({ tagline: e.target.value })}
                placeholder="Contoh: Solusi Elektronik, Terpercaya!"
              />
            </div>

            <div className="form-group">
              <label>Alamat</label>
              <input
                type="text"
                className="form-input"
                value={profile.address}
                onChange={(e) => updateProfile({ address: e.target.value })}
                placeholder="Contoh: Blok Gebangmampang, Margamulya"
              />
            </div>

            <div className="form-group">
              <label>WhatsApp / No. Telp</label>
              <input
                type="text"
                className="form-input"
                value={profile.phone}
                onChange={(e) => updateProfile({ phone: e.target.value })}
                placeholder="Contoh: 0852-2429-7545"
              />
            </div>

            <div className="form-group">
              <label>Kasir Default</label>
              <input
                type="text"
                className="form-input"
                value={profile.cashierName}
                onChange={(e) => updateProfile({ cashierName: e.target.value })}
                placeholder="Contoh: Kasir 01"
              />
            </div>
          </div>

          <div className="settings-card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Printer size={18} color="#2563eb" /> Format Struk & Printer
            </h3>

            <div className="form-group" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '12px' }}>
              <label style={{ fontWeight: 700 }}>Printer Bluetooth (58mm)</label>
              {!isNativePrinter ? (
                <p style={{ fontSize: '0.82rem', color: '#475569', margin: '6px 0 0 0' }}>
                  Gunakan tombol Bluetooth di kasir untuk koneksi printer thermal.
                </p>
              ) : (
                <>
                  <p style={{ fontSize: '0.82rem', color: '#0369a1', margin: '6px 0 10px 0' }}>
                    Pairing printer di Bluetooth perangkat, lalu pilih di bawah:
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <button type="button" className="btn-outline" onClick={handleScanPrinters} disabled={isScanningPrinter} style={{ fontSize: '0.82rem' }}>
                      {isScanningPrinter ? 'Mencari...' : 'Cari Printer Bluetooth'}
                    </button>
                    {savedPrinter && (
                      <span style={{ fontSize: '0.78rem', background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '999px', fontWeight: 700 }}>
                        Tersimpan: {savedPrinter}
                      </span>
                    )}
                  </div>
                  {printers.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {printers.map((p) => (
                        <label key={p.address} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', background: '#fff', border: savedPrinter === p.address ? '2px solid #22c55e' : '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="default-printer"
                            checked={savedPrinter === p.address}
                            onChange={() => handleSelectPrinter(p.address)}
                          />
                          <span><strong>{p.name || 'Printer'}</strong> <span style={{ color: '#64748b', fontFamily: 'monospace' }}>{p.address}</span></span>
                        </label>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Tombol Uji Coba Cetak (Test Print 58mm) */}
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: '#0369a1' }}>
                  Tes respon & cetak kertas printer 58mm.
                </div>
                <button
                  type="button"
                  className="btn-test-print"
                  onClick={handleTestPrint}
                  disabled={isTestingPrint}
                  title="Cetak struk uji coba 58mm"
                >
                  <Printer size={15} />
                  <span>{isTestingPrint ? 'Mencetak...' : 'Tes Cetak 58mm'}</span>
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Ukuran Kertas</label>
              <div className="paper-size-selector">
                <label className={`paper-option ${profile.paperSize === '58mm' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="paperSize"
                    value="58mm"
                    checked={profile.paperSize === '58mm'}
                    onChange={() => updateProfile({ paperSize: '58mm' })}
                  />
                  <div className="paper-option-content">
                    <div className="paper-size-badge">58 MM</div>
                    <div>
                      <strong>Standar Thermal 58mm</strong>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label>Catatan Kaki Struk</label>
              <textarea
                className="form-input"
                style={{ height: '70px', resize: 'vertical' }}
                value={profile.footerNote}
                onChange={(e) => updateProfile({ footerNote: e.target.value })}
                placeholder="Contoh: Terima Kasih Atas Kunjungan Anda"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={profile.autoSaveProducts}
                  onChange={(e) => updateProfile({ autoSaveProducts: e.target.checked })}
                />
                <strong>Auto-Simpan Produk Baru</strong> (Otomatis simpan barang dari kasir)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={profile.showDateTime}
                  onChange={(e) => updateProfile({ showDateTime: e.target.checked })}
                />
                Tampilkan Tanggal & Waktu
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={profile.showCashierName}
                  onChange={(e) => updateProfile({ showCashierName: e.target.checked })}
                />
                Tampilkan Nama Kasir
              </label>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
                <Save size={18} /> Simpan
              </button>
            </div>
          </div>
        </div>
      </form>

      <div className="settings-card" style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #1565c0, #0d47a1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <Users size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Kelola Pengguna
              </h3>
            </div>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={handleOpenAddUser}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <UserPlus size={16} /> Tambah Pengguna
          </button>
        </div>

        <div className="cart-table-wrapper" style={{ border: '1px solid #e2e8f0', borderRadius: '10px' }}>
          <table className="cart-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Pengguna</th>
                <th>Username</th>
                <th style={{ width: '130px' }}>Role</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {usersList.map((u) => {
                const isCurrent = loggedUser?.id === u.id;
                const isAdmin = u.role === 'admin';
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: isAdmin ? '#eff6ff' : '#ecfdf5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isAdmin ? '#2563eb' : '#10b981',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                          }}
                        >
                          {isAdmin ? <ShieldCheck size={16} /> : <User size={16} />}
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{u.name}</strong>
                          {isCurrent && (
                            <span style={{ marginLeft: '6px', fontSize: '11px', color: '#15803d', background: '#dcfce7', padding: '1px 6px', borderRadius: '6px', fontWeight: 600 }}>
                              Akun Anda
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#475569' }}>
                        {u.username}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 8px',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: isAdmin ? '#dbeafe' : '#d1fae5',
                          color: isAdmin ? '#1e40af' : '#065f46',
                        }}
                      >
                        {isAdmin ? (
                          <>
                            <ShieldCheck size={13} /> Administrator
                          </>
                        ) : (
                          <>
                            <User size={13} /> Kasir
                          </>
                        )}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn-outline"
                          onClick={() => handleOpenEditUser(u)}
                          style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                          title="Edit Pengguna"
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                        <button
                          type="button"
                          className="btn-outline"
                          onClick={() => handleDeleteUserClick(u)}
                          disabled={isCurrent}
                          style={{
                            padding: '4px 8px',
                            fontSize: '0.78rem',
                            color: isCurrent ? '#94a3b8' : '#ef4444',
                            borderColor: isCurrent ? '#e2e8f0' : '#fca5a5',
                          }}
                          title={isCurrent ? 'Tidak bisa menghapus akun yang aktif' : 'Hapus Pengguna'}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {showUserModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              padding: '1rem',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '420px',
                padding: '1.5rem',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>
                {editingUserId ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}
              </h3>

              <form onSubmit={handleSaveUser}>
                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                  <label>Nama Lengkap *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Contoh: Budi Kasir / Admin Toko"
                    value={userFormData.name}
                    onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                  <label>Username (Huruf kecil) *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Contoh: kasir02"
                    value={userFormData.username}
                    onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value.toLowerCase() })}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                  <label>{editingUserId ? 'Password Baru (Kosongkan jika tidak diubah)' : 'Password *'}</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Masukkan password"
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    required={!editingUserId}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label>Role / Hak Akses *</label>
                  <select
                    className="form-input"
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as 'admin' | 'kasir' })}
                  >
                    <option value="kasir">Kasir</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setShowUserModal(false)}
                  >
                    Batal
                  </button>
                  <button type="submit" className="btn-primary">
                    <Save size={16} /> Simpan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <div className="turso-settings-card" style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <Database size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Database Cloud (Turso)
              </h3>
            </div>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={handleManualSyncNow}
            disabled={isSyncing}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={15} className={isSyncing ? 'spin-animation' : ''} />
            {isSyncing ? 'Sinkron...' : 'Sinkronkan'}
          </button>
        </div>

        <div className="turso-stat-grid">
          <div className="turso-stat-box">
            <div className="turso-stat-label">Host Cloud</div>
            <div className="turso-stat-value" style={{ fontSize: '0.82rem', wordBreak: 'break-all' }}>
              <Server size={14} color="#0284c7" />
              {tursoConfig.databaseHost || 'Turso Cloud'}
            </div>
          </div>

          <div className="turso-stat-box">
            <div className="turso-stat-label">Status</div>
            <div className="turso-stat-value">
              {syncInfo.status === 'synced' && (
                <>
                  <CheckCircle size={15} color="#10b981" />
                  <span style={{ color: '#10b981' }}>Tersinkronisasi</span>
                </>
              )}
              {syncInfo.status === 'syncing' && (
                <>
                  <RefreshCw size={15} className="spin-animation" color="#0284c7" />
                  <span style={{ color: '#0284c7' }}>Sedang Sinkron...</span>
                </>
              )}
              {syncInfo.status === 'offline' && (
                <>
                  <AlertCircle size={15} color="#f59e0b" />
                  <span style={{ color: '#f59e0b' }}>Mode Offline (Lokal)</span>
                </>
              )}
              {syncInfo.status === 'error' && (
                <>
                  <AlertCircle size={15} color="#ef4444" />
                  <span style={{ color: '#ef4444' }}>Perlu Sinkronisasi</span>
                </>
              )}
              {syncInfo.status === 'idle' && (
                <>
                  <CheckCircle size={15} color="#64748b" />
                  <span style={{ color: '#64748b' }}>Siap</span>
                </>
              )}
            </div>
          </div>

          <div className="turso-stat-box">
            <div className="turso-stat-label">Terakhir</div>
            <div className="turso-stat-value" style={{ fontSize: '0.85rem' }}>
              {syncInfo.lastSyncedAt
                ? new Date(syncInfo.lastSyncedAt).toLocaleString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
                : 'Belum pernah'}
            </div>
          </div>

          <div className="turso-stat-box">
            <div className="turso-stat-label">Antrean Offline</div>
            <div className="turso-stat-value">
              {syncInfo.pendingCount > 0 ? (
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>{syncInfo.pendingCount} tertunda</span>
              ) : (
                <span style={{ color: '#10b981' }}>0 (Tersimpan)</span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.85rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-outline"
            onClick={handleTestConnection}
            disabled={pingState.testing}
            style={{ fontSize: '0.85rem' }}
          >
            <Activity size={15} />
            {pingState.testing ? 'Menguji...' : 'Uji Koneksi'}
            {pingState.latencyMs !== undefined && !pingState.testing && (
              <span
                style={{
                  marginLeft: '4px',
                  background: pingState.success ? '#dcfce7' : '#fee2e2',
                  color: pingState.success ? '#15803d' : '#b91c1c',
                  padding: '2px 6px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                {pingState.latencyMs} ms
              </span>
            )}
          </button>

          <button
            type="button"
            className="btn-outline"
            onClick={handleUploadAllToTurso}
            disabled={isUploadingAll || isSyncing || isClearingTurso}
            style={{ fontSize: '0.85rem' }}
          >
            <Upload size={15} />
            {isUploadingAll ? 'Mengunggah...' : 'Upload Data Lokal ke Cloud'}
          </button>

          <button
            type="button"
            className="btn-outline"
            onClick={handleClearTurso}
            disabled={isClearingTurso || isSyncing}
            style={{
              fontSize: '0.85rem',
              color: '#ef4444',
              borderColor: '#fecaca',
              backgroundColor: '#fef2f2',
            }}
          >
            <Trash2 size={15} color="#ef4444" />
            {isClearingTurso ? 'Mengosongkan...' : 'Kosongkan Cloud'}
          </button>
        </div>
      </div>

      <div className="settings-card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
          Cadangkan & Pulihkan (Backup)
        </h3>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-outline" onClick={handleExport}>
            <Download size={16} /> Export Backup (JSON)
          </button>
          <label className="btn-outline" style={{ cursor: 'pointer', margin: 0 }}>
            <Upload size={16} /> Import Backup (JSON)
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </label>
        </div>
      </div>

      <div className="settings-card" style={{ marginTop: '1.5rem', background: '#0a1224', color: '#ffffff', border: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <img
              src="/pwa/icon-192.png"
              alt="Icon Mega Tehnik"
              style={{ width: '56px', height: '56px', borderRadius: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
            />
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-brand)' }}>
                Mega Tehnik Elektronik
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#90CAF9', margin: 0 }}>
                Solusi Elektronik, Terpercaya! &bull; Android & PWA App Ready
              </p>
            </div>
          </div>
          {onPreviewSplash && (
            <button
              type="button"
              className="btn-primary"
              onClick={onPreviewSplash}
              style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', background: 'linear-gradient(135deg, #1565C0, #2196F3)' }}
            >
              Preview Splash Screen
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
