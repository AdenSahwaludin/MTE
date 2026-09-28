import React, { useState, useEffect } from 'react';
import { syncService, SyncInfo } from '../services/syncService';
import { Cloud, CloudOff, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

interface SyncBadgeProps {
  compact?: boolean;
  showButton?: boolean;
  onSyncTriggered?: () => void;
}

export const SyncBadge: React.FC<SyncBadgeProps> = ({
  compact = false,
  showButton = true,
  onSyncTriggered,
}) => {
  const [syncInfo, setSyncInfo] = useState<SyncInfo>(syncService.getSyncInfo());
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = syncService.subscribe((info) => {
      setSyncInfo(info);
    });
    return () => unsubscribe();
  }, []);

  const handleManualSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isManualSyncing || syncInfo.status === 'syncing') return;

    setIsManualSyncing(true);
    try {
      await syncService.syncNow();
      if (onSyncTriggered) onSyncTriggered();
    } finally {
      setIsManualSyncing(false);
    }
  };

  const isSyncing = syncInfo.status === 'syncing' || isManualSyncing;

  let badgeColor = '#10b981'; // Green
  let badgeBg = 'rgba(16, 185, 129, 0.15)';
  let badgeBorder = 'rgba(16, 185, 129, 0.3)';
  let icon = <CheckCircle2 size={13} color="#10b981" />;
  let labelText = 'Online';
  let actionText = '• Perbarui';

  if (!syncInfo.isOnline || syncInfo.status === 'offline') {
    badgeColor = '#94a3b8';
    badgeBg = 'rgba(148, 163, 184, 0.15)';
    badgeBorder = 'rgba(148, 163, 184, 0.3)';
    icon = <CloudOff size={13} color="#94a3b8" />;
    labelText = 'Offline';
    actionText = '';
  } else if (isSyncing) {
    badgeColor = '#38bdf8';
    badgeBg = 'rgba(56, 189, 248, 0.15)';
    badgeBorder = 'rgba(56, 189, 248, 0.3)';
    icon = <RefreshCw size={13} className="spin-animation" color="#38bdf8" />;
    labelText = 'Mengirim data...';
    actionText = '';
  } else if (syncInfo.status === 'error') {
    badgeColor = '#f87171';
    badgeBg = 'rgba(248, 113, 113, 0.15)';
    badgeBorder = 'rgba(248, 113, 113, 0.3)';
    icon = <AlertCircle size={13} color="#f87171" />;
    labelText = syncInfo.pendingCount > 0 ? `${syncInfo.pendingCount} belum terkirim` : 'Gagal, coba lagi';
    actionText = '• Coba lagi';
  }

  return (
    <div
      className={`turso-sync-badge ${compact ? 'compact' : ''} ${isSyncing ? 'syncing' : ''}`}
      onClick={handleManualSync}
      title={
        isSyncing
          ? 'Sedang mengirim data ke penyimpanan online...'
          : syncInfo.status === 'error'
          ? 'Ada data yang belum terkirim. Klik untuk coba kirim lagi.'
          : !syncInfo.isOnline || syncInfo.status === 'offline'
          ? 'Tidak ada internet. Data tersimpan di perangkat ini dan akan terkirim otomatis saat online.'
          : syncInfo.lastSyncedAt
          ? `Data aman. Terakhir dikirim: ${new Date(syncInfo.lastSyncedAt).toLocaleTimeString('id-ID')}. Klik untuk perbarui sekarang.`
          : 'Data tersimpan aman. Klik untuk perbarui sekarang.'
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: compact ? '4px 8px' : '5px 10px',
        borderRadius: '9999px',
        backgroundColor: badgeBg,
        border: `1px solid ${badgeBorder}`,
        color: badgeColor,
        fontSize: '0.75rem',
        fontWeight: 600,
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'all 0.2s ease',
      }}
    >
      {icon}
      <span className="sync-badge-text">{labelText}</span>
      {syncInfo.pendingCount > 0 && !isSyncing && (
        <span
          className="sync-pending-pill"
          style={{
            background: '#f59e0b',
            color: '#000',
            fontSize: '9px',
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: '10px',
            lineHeight: 1.2,
          }}
        >
          {syncInfo.pendingCount}
        </span>
      )}
      {showButton && !compact && !isSyncing && actionText && (
        <span className="sync-badge-dot" style={{ opacity: 0.7, fontSize: '10px', marginLeft: '2px' }}>
          {actionText}
        </span>
      )}
    </div>
  );
};
