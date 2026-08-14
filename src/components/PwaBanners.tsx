import React, { useEffect, useState } from 'react';
import { Download, Share, WifiOff, X } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

export const InstallBanner: React.FC = () => {
  const { canInstall, isInstalled, isIOSDevice, dismissed, promptInstall, dismiss } =
    usePwaInstall();

  if (isInstalled || dismissed || !(canInstall || isIOSDevice)) return null;

  const handleInstall = async () => {
    const ok = await promptInstall();
    if (ok) dismiss();
  };

  return (
    <div className="pwa-install-card no-print">
      <button type="button" className="pwa-install-close" onClick={dismiss} aria-label="Tutup">
        <X size={16} />
      </button>
      <img
        className="pwa-install-logo"
        src="/logo-mega-tehnik.webp"
        alt="Mega Tehnik Elektronik"
        width={176}
        height={78}
      />
      {canInstall ? (
        <>
          <p className="pwa-install-title">Pasang Aplikasi Mega Tehnik Elektronik</p>
          <p className="pwa-install-desc">
            Buka langsung dari Layar Utama tanpa browser, tetap bisa dipakai saat offline.
          </p>
          <button type="button" className="pwa-install-btn" onClick={handleInstall}>
            <Download size={16} />
            Install Aplikasi
          </button>
        </>
      ) : (
        <>
          <p className="pwa-install-title">Pasang ke Layar Utama</p>
          <p className="pwa-install-desc">
            Tekan tombol <Share size={13} className="pwa-share-icon" /> Bagikan di Safari, lalu
            pilih <strong>&quot;Tambah ke Layar Utama&quot;</strong>.
          </p>
        </>
      )}
    </div>
  );
};

export const OfflineBanner: React.FC = () => {
  const [offline, setOffline] = useState<boolean>(() => !navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline-banner no-print" role="status">
      <WifiOff size={15} />
      <span>
        Mode Offline — aplikasi tetap berjalan, semua data tersimpan aman di perangkat ini.
      </span>
    </div>
  );
};