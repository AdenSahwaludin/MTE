import { Product, Transaction, StoreProfile, UserAccount } from '../types';
import {
  isTursoConfigured,
  initTursoTables,
  fetchAllProductsFromTurso,
  fetchAllTransactionsFromTurso,
  fetchStoreProfileFromTurso,
  fetchAllUsersFromTurso,
  upsertProductToTurso,
  deleteProductFromTurso,
  batchUpsertProductsToTurso,
  insertTransactionToTurso,
  deleteTransactionFromTurso,
  batchInsertTransactionsToTurso,
  upsertStoreProfileToTurso,
  upsertUserToTurso,
  deleteUserFromTurso,
  batchUpsertUsersToTurso,
  fetchLatestTimestampsFromTurso,
  clearAllTursoData,
} from './tursoClient';
import {
  getProducts,
  setInMemoryProducts,
  getTransactions,
  setInMemoryTransactions,
  getStoreProfile,
  setInMemoryStoreProfile,
  getUsers,
  setInMemoryUsers,
  generateSyncActionId,
} from './storageService';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncInfo {
  status: SyncStatus;
  lastSyncedAt: string | null;
  pendingCount: number;
  lastError: string | null;
  isOnline: boolean;
}

export type SyncActionType =
  | 'UPSERT_PRODUCT'
  | 'DELETE_PRODUCT'
  | 'INSERT_TRANSACTION'
  | 'DELETE_TRANSACTION'
  | 'UPSERT_PROFILE'
  | 'UPSERT_USER'
  | 'DELETE_USER';

export interface SyncAction {
  id: string;
  type: SyncActionType;
  payload: any;
  createdAt: string;
  retryCount: number;
}

type SyncListener = (info: SyncInfo) => void;
type DataRefreshListener = () => void;

const isBrowserOnline = (): boolean => {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
};

class SyncService {
  private queue: SyncAction[] = [];
  private status: SyncStatus = 'idle';
  private lastSyncedAt: string | null = null;
  private lastError: string | null = null;
  private syncListeners: Set<SyncListener> = new Set();
  private dataRefreshListeners: Set<DataRefreshListener> = new Set();
  private isProcessingQueue = false;
  private isInitialLoaded = false;
  private periodicTimer: any = null;
  private readonly QUEUE_LS_KEY = 'mega_teknik_sync_queue_v2';

  // Cached local timestamps for smart low-row delta checks
  private localProductTimestamp: string | null = null;
  private localTrxTimestamp: string | null = null;
  private localProfileTimestamp: string | null = null;
  private localUserTimestamp: string | null = null;

  constructor() {
    this.loadQueueFromStorage();
    this.setupNetworkListeners();
  }

  private loadQueueFromStorage() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.QUEUE_LS_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        this.queue = arr.filter((a) => a && typeof a.type === 'string');
      }
    } catch {
      this.queue = [];
    }
  }

  private persistQueue() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      // Batasi 500 aksi agar tidak melebihi kuota localStorage
      const capped = this.queue.slice(-500);
      localStorage.setItem(this.QUEUE_LS_KEY, JSON.stringify(capped));
    } catch (err) {
      console.warn('Failed to persist sync queue:', err);
    }
  }

  private notify() {
    const info = this.getSyncInfo();
    this.syncListeners.forEach((fn) => {
      try {
        fn(info);
      } catch (err) {
        console.error('Error in sync listener:', err);
      }
    });
  }

  private notifyDataRefresh() {
    this.dataRefreshListeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('Error in data refresh listener:', err);
      }
    });
  }

  public subscribe(listener: SyncListener): () => void {
    this.syncListeners.add(listener);
    listener(this.getSyncInfo());
    return () => this.syncListeners.delete(listener);
  }

  public onDataRefresh(listener: DataRefreshListener): () => void {
    this.dataRefreshListeners.add(listener);
    return () => this.dataRefreshListeners.delete(listener);
  }

  public getSyncInfo(): SyncInfo {
    const isOnline = isBrowserOnline();
    return {
      status: !isOnline ? 'offline' : this.status,
      lastSyncedAt: this.lastSyncedAt,
      pendingCount: this.queue.length,
      lastError: this.lastError,
      isOnline,
    };
  }

  private setupNetworkListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.notify();
      this.syncNow();
    });

    window.addEventListener('offline', () => {
      this.notify();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isBrowserOnline()) {
        this.smartHeartbeat();
      }
    });

    // Smart background heartbeat: check timestamps every 90 seconds (consumes only 4 rows read)
    this.periodicTimer = setInterval(() => {
      if (isBrowserOnline() && !this.isProcessingQueue) {
        this.smartHeartbeat();
      }
    }, 90000);
  }

  // Low-row metadata check (Reads only 4 rows instead of entire database)
  public async smartHeartbeat(): Promise<void> {
    if (!isBrowserOnline() || !isTursoConfigured() || this.isProcessingQueue) return;

    if (!this.isInitialLoaded) {
      await this.syncNow();
      return;
    }

    try {
      // First, flush pending offline mutation queue if any
      if (this.queue.length > 0) {
        await this.processQueue();
      }

      const remoteMeta = await fetchLatestTimestampsFromTurso();
      if (!remoteMeta) return;

      let hasChanges = false;

      if (remoteMeta.productMod && remoteMeta.productMod !== this.localProductTimestamp) {
        // Tanpa guard length: hapus-semua-produk di cloud HARUS mengosongkan lokal.
        // (fetch hanya melempar saat error jaringan, jadi [] = data memang kosong.)
        const freshProducts = await fetchAllProductsFromTurso();
        setInMemoryProducts(freshProducts);
        this.localProductTimestamp = remoteMeta.productMod;
        hasChanges = true;
      }

      if (remoteMeta.trxMod && remoteMeta.trxMod !== this.localTrxTimestamp) {
        const freshTransactions = await fetchAllTransactionsFromTurso();
        // Merge, bukan overwrite: pertahankan transaksi lokal yang belum terkirim
        // (id UUID) agar tidak hilang saat heartbeat.
        const pendingIds = new Set(
          this.queue.filter((a) => a.type === 'INSERT_TRANSACTION' && a.payload?.id).map((a) => String(a.payload.id))
        );
        const localOnly = getTransactions().filter(
          (t) => pendingIds.has(t.id) && !freshTransactions.some((f) => f.id === t.id)
        );
        setInMemoryTransactions([...localOnly, ...freshTransactions]);
        this.localTrxTimestamp = remoteMeta.trxMod;
        hasChanges = true;
      }

      if (remoteMeta.profileMod && remoteMeta.profileMod !== this.localProfileTimestamp) {
        const freshProfile = await fetchStoreProfileFromTurso();
        if (freshProfile) {
          setInMemoryStoreProfile(freshProfile);
          this.localProfileTimestamp = remoteMeta.profileMod;
          hasChanges = true;
        }
      }

      if (remoteMeta.userMod && remoteMeta.userMod !== this.localUserTimestamp) {
        const freshUsers = await fetchAllUsersFromTurso();
        // setInMemoryUsers punya fallback DEFAULT_USERS bila [] — aman tanpa guard.
        setInMemoryUsers(freshUsers);
        this.localUserTimestamp = remoteMeta.userMod;
        hasChanges = true;
      }

      this.lastSyncedAt = new Date().toISOString();
      this.status = 'synced';
      this.notify();

      if (hasChanges) {
        this.notifyDataRefresh();
      }
    } catch (err) {
      console.warn('Background heartbeat check notice:', err);
    }
  }

  // Enqueue mutation to be saved directly to Turso
  public enqueue(type: SyncActionType, payload: any) {
    const action: SyncAction = {
      id: generateSyncActionId(),
      type,
      payload,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    if (type === 'UPSERT_PRODUCT' && payload?.id) {
      this.queue = this.queue.filter(
        (a) => !(a.type === 'UPSERT_PRODUCT' && a.payload?.id === payload.id)
      );
    } else if (type === 'UPSERT_PROFILE') {
      this.queue = this.queue.filter((a) => a.type !== 'UPSERT_PROFILE');
    } else if (type === 'UPSERT_USER' && payload?.id) {
      this.queue = this.queue.filter(
        (a) => !(a.type === 'UPSERT_USER' && a.payload?.id === payload.id)
      );
    }

    this.queue.push(action);
    this.persistQueue();
    this.notify();

    if (typeof navigator === 'undefined' || navigator.onLine) {
      setTimeout(() => this.processQueue(), 50);
    }
  }

  // Process all queued actions to Turso
  private async processQueue(): Promise<boolean> {
    if (this.isProcessingQueue || this.queue.length === 0) return true;
    if (!isBrowserOnline() || !isTursoConfigured()) return false;

    this.isProcessingQueue = true;
    this.status = 'syncing';
    this.notify();

    try {
      await initTursoTables(false);

      while (this.queue.length > 0) {
        const item = this.queue[0];
        try {
          switch (item.type) {
            case 'UPSERT_PRODUCT':
              await upsertProductToTurso(item.payload);
              break;
            case 'DELETE_PRODUCT':
              await deleteProductFromTurso(item.payload);
              break;
            case 'INSERT_TRANSACTION':
              await insertTransactionToTurso(item.payload);
              break;
            case 'DELETE_TRANSACTION':
              await deleteTransactionFromTurso(item.payload);
              break;
            case 'UPSERT_PROFILE':
              await upsertStoreProfileToTurso(item.payload);
              break;
            case 'UPSERT_USER':
              await upsertUserToTurso(item.payload);
              break;
            case 'DELETE_USER':
              await deleteUserFromTurso(item.payload);
              break;
          }
          this.queue.shift();
          this.persistQueue();
          this.notify();
        } catch (itemErr: any) {
          console.error(`Failed to process sync item [${item.type}]:`, itemErr);
          item.retryCount = (item.retryCount || 0) + 1;
          if (item.retryCount > 4) {
            // Drop agar antrean tidak buntu selamanya, tapi persist agar konsisten.
            this.queue.shift();
            this.persistQueue();
          } else {
            this.persistQueue();
          }
          throw itemErr;
        }
      }

      this.status = 'synced';
      this.lastSyncedAt = new Date().toISOString();
      this.notify();
      return true;
    } catch (err: any) {
      this.lastError = err?.message || 'Gagal sinkronisasi antrean ke Turso';
      this.status = 'error';
      this.notify();
      return false;
    } finally {
      this.isProcessingQueue = false;
    }
  }

  // Full Initial Load or Force Sync
  public async syncNow(forcePushAll: boolean = false): Promise<{ success: boolean; message?: string }> {
    if (!isBrowserOnline()) {
      this.status = 'offline';
      this.notify();
      return { success: false, message: 'Aplikasi sedang offline' };
    }

    if (!isTursoConfigured()) {
      this.status = 'error';
      this.lastError = 'Konfigurasi Turso belum lengkap di .env';
      this.notify();
      return { success: false, message: this.lastError };
    }

    this.status = 'syncing';
    this.lastError = null;
    this.notify();

    try {
      // 1. Initialize tables if not initialized yet
      await initTursoTables(false);

      if (forcePushAll) {
        const localProducts = getProducts();
        const localTransactions = getTransactions();
        const localProfile = getStoreProfile();
        const localUsers = getUsers();

        if (localProducts.length > 0) {
          await batchUpsertProductsToTurso(localProducts);
        }
        if (localTransactions.length > 0) {
          await batchInsertTransactionsToTurso(localTransactions);
        }
        await upsertStoreProfileToTurso(localProfile);
        if (localUsers.length > 0) {
          await batchUpsertUsersToTurso(localUsers);
        }
        this.queue = [];
        this.persistQueue();
      } else {
        // Process any pending queued mutations first.
        // PENTING: jika masih ada yang gagal terkirim, JANGAN pull-overwrite
        // karena akan menghapus data offline lokal yang belum naik.
        if (this.queue.length > 0) {
          const flushed = await this.processQueue();
          if (!flushed || this.queue.length > 0) {
            return {
              success: false,
              message: `Masih ada ${this.queue.length} perubahan offline yang belum terkirim. Data lokal dipertahankan.`,
            };
          }
        }

        // Pull full data from Turso (only once on load or manual sync button)
        const [freshProducts, freshTransactions, freshProfile, freshUsers] = await Promise.all([
          fetchAllProductsFromTurso(),
          fetchAllTransactionsFromTurso(),
          fetchStoreProfileFromTurso(),
          fetchAllUsersFromTurso(),
        ]);

        // Merge transaksi: fresh + lokal-yang-tidak-ada-di-cloud.
        // Mencegah kasus: transaksi dibuat offline tepat sebelum pull selesai.
        const localTx = getTransactions();
        const freshIds = new Set(freshTransactions.map((t) => t.id));
        const localOnlyTx = localTx.filter((t) => !freshIds.has(t.id));
        const mergedTx =
          localOnlyTx.length > 0 ? [...localOnlyTx, ...freshTransactions] : freshTransactions;

        // Produk: cloud adalah sumber kebenaran SETELAH queue kosong.
        // Jika cloud kosong & lokal ada (DB baru), push lokal ke cloud.
        if (freshProducts.length > 0 || getProducts().length === 0) {
          setInMemoryProducts(freshProducts);
        } else {
          // If Turso was freshly created and empty, push initial default products
          await batchUpsertProductsToTurso(getProducts());
        }

        setInMemoryTransactions(mergedTx);

        if (freshProfile) {
          setInMemoryStoreProfile(freshProfile);
        } else {
          await upsertStoreProfileToTurso(getStoreProfile());
        }

        if (freshUsers.length > 0) {
          setInMemoryUsers(freshUsers);
        }

        // Update cached local timestamps
        const timestamps = await fetchLatestTimestampsFromTurso();
        if (timestamps) {
          this.localProductTimestamp = timestamps.productMod;
          this.localTrxTimestamp = timestamps.trxMod;
          this.localProfileTimestamp = timestamps.profileMod;
          this.localUserTimestamp = timestamps.userMod;
        }

        this.isInitialLoaded = true;
        this.notifyDataRefresh();
      }

      const now = new Date().toISOString();
      this.lastSyncedAt = now;
      this.status = 'synced';
      this.notify();

      return { success: true };
    } catch (err: any) {
      console.error('Sync failed:', err);
      this.lastError = err?.message || 'Gagal sinkronisasi data dengan Cloud Turso';
      this.status = 'error';
      this.notify();
      return { success: false, message: this.lastError || undefined };
    }
  }

  // Upload memory dataset to Turso Cloud
  public async uploadAllLocalDataToTurso(): Promise<{ success: boolean; message?: string }> {
    return this.syncNow(true);
  }

  // Clear all records from Turso Cloud
  public async clearTursoDatabase(clearMemoryToo: boolean = false): Promise<{ success: boolean; message?: string }> {
    if (!isBrowserOnline()) {
      return { success: false, message: 'Aplikasi sedang offline' };
    }
    if (!isTursoConfigured()) {
      return { success: false, message: 'Turso belum terkonfigurasi' };
    }

    this.status = 'syncing';
    this.notify();

    try {
      await clearAllTursoData();
      this.queue = [];
      this.persistQueue();

      if (clearMemoryToo) {
        setInMemoryProducts([]);
        setInMemoryTransactions([]);
        this.notifyDataRefresh();
      }

      this.lastSyncedAt = new Date().toISOString();
      this.status = 'synced';
      this.notify();

      return { success: true };
    } catch (err: any) {
      console.error('Failed to clear Turso database:', err);
      this.status = 'error';
      this.lastError = err?.message || 'Gagal mengosongkan Turso Cloud';
      this.notify();
      return { success: false, message: this.lastError || undefined };
    }
  }
}

export const syncService = new SyncService();
