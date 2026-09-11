import { UserAccount } from '../types';

// 7 Days Session Expiration Duration in milliseconds
export const SESSION_DURATION_DAYS = 7;
export const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;

export const STORAGE_SESSION_KEY = 'mega_teknik_auth_session_v2';
export const LEGACY_AUTH_KEY = 'mega_teknik_auth';
export const LEGACY_SESSION_AUTH_KEY = 'mega_teknik_active_session';

export interface SafeUser {
  id: number | string;
  username: string;
  name: string;
  role: 'admin' | 'kasir';
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthSession {
  user: SafeUser;
  loginAt: number;
  lastActiveAt: number;
  expiresAt: number;
  checksum: string;
}

// cyrb53-like 53-bit hash: distribusi lebih baik dari hash 32-bit lama,
// tetap sinkron & tanpa dependency. BUKAN pengganti verifikasi server:
// token frontend selalu bisa dibaca/dihitung ulang, jadi gate admin
// di frontend hanya UX — enforcement nyata harus di backend/RLS.
const SALT = 'mte_secure_salt_2026_v2';

const hash53 = (str: string, seed = 0): string => {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const result = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return result.toString(36);
};

export const generateChecksum = (user: SafeUser, lastActiveAt: number, expiresAt: number): string => {
  const raw = `${user.id}:${user.username}:${user.role}:${lastActiveAt}:${expiresAt}:${SALT}`;
  return 'chk_' + hash53(raw);
};

// In-memory cache for fast sync access
let currentActiveUser: UserAccount | null = null;

export const toSafeUser = (user: UserAccount): SafeUser => {
  return {
    id: user.id,
    username: (user.username || '').trim().toLowerCase(),
    name: user.name || user.username,
    role: user.role || 'kasir',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export const createAuthSession = (user: UserAccount): AuthSession => {
  const safeUser = toSafeUser(user);
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION_MS;
  const checksum = generateChecksum(safeUser, now, expiresAt);

  const session: AuthSession = {
    user: safeUser,
    loginAt: now,
    lastActiveAt: now,
    expiresAt,
    checksum,
  };

  try {
    const raw = JSON.stringify(session);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_SESSION_KEY, raw);
      localStorage.setItem(LEGACY_AUTH_KEY, 'true');
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_SESSION_KEY, raw);
      sessionStorage.setItem(LEGACY_AUTH_KEY, 'true');
    }
  } catch (err) {
    console.warn('Failed to persist auth session in storage:', err);
  }

  currentActiveUser = {
    ...safeUser,
    password: '',
  };

  return session;
};

export const validateAndRefreshSession = (): UserAccount | null => {
  if (typeof window === 'undefined') return null;

  try {
    let raw: string | null = null;
    if (typeof localStorage !== 'undefined') {
      raw = localStorage.getItem(STORAGE_SESSION_KEY);
    }
    if (!raw && typeof sessionStorage !== 'undefined') {
      raw = sessionStorage.getItem(STORAGE_SESSION_KEY);
    }

    if (!raw) {
      clearAuthSession();
      return null;
    }

    const session: AuthSession = JSON.parse(raw);
    if (!session || !session.user || !session.expiresAt || !session.lastActiveAt) {
      clearAuthSession();
      return null;
    }

    // Tolak role di luar enum yang dikenal (cegah eskalasi via edit manual).
    if (session.user.role !== 'admin' && session.user.role !== 'kasir') {
      clearAuthSession();
      return null;
    }

    const now = Date.now();

    if (now > session.expiresAt) {
      console.info('Auth session expired (inactive for > 7 days). Redirecting to login.');
      clearAuthSession();
      return null;
    }

    const expectedChecksum = generateChecksum(session.user, session.lastActiveAt, session.expiresAt);
    if (session.checksum && session.checksum !== expectedChecksum) {
      console.warn('Auth session checksum mismatch. Purging invalid session.');
      clearAuthSession();
      return null;
    }

    // SLIDING EXPIRATION: perpanjang 7 hari dari sekarang.
    // Throttle tulis storage: hanya tulis ulang jika >60 detik sejak aktivitas
    // terakhir, agar focus/visibility beruntun tidak spam localStorage.
    const shouldRewrite = now - session.lastActiveAt > 60 * 1000;
    session.lastActiveAt = now;
    session.expiresAt = now + SESSION_DURATION_MS;
    session.checksum = generateChecksum(session.user, session.lastActiveAt, session.expiresAt);

    if (shouldRewrite) {
      const updatedRaw = JSON.stringify(session);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_SESSION_KEY, updatedRaw);
        }
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(STORAGE_SESSION_KEY, updatedRaw);
        }
      } catch (err) {
        console.warn('Failed to refresh auth session in storage:', err);
      }
    }

    const activeUser: UserAccount = {
      id: session.user.id,
      username: session.user.username,
      name: session.user.name,
      role: session.user.role,
      password: '',
      createdAt: session.user.createdAt,
      updatedAt: session.user.updatedAt,
    };

    currentActiveUser = activeUser;
    return activeUser;
  } catch (err) {
    console.error('Session validation error:', err);
    clearAuthSession();
    return null;
  }
};

export const clearAuthSession = (): void => {
  currentActiveUser = null;
  if (typeof window === 'undefined') return;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_SESSION_KEY);
      localStorage.removeItem(LEGACY_AUTH_KEY);
      localStorage.removeItem(LEGACY_SESSION_AUTH_KEY);
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STORAGE_SESSION_KEY);
      sessionStorage.removeItem(LEGACY_AUTH_KEY);
      sessionStorage.removeItem(LEGACY_SESSION_AUTH_KEY);
    }
  } catch (err) {
    console.warn('Error while clearing auth session:', err);
  }
};

export const getActiveSessionUser = (): UserAccount | null => {
  if (currentActiveUser) return currentActiveUser;
  return validateAndRefreshSession();
};

// Dipakai storageService untuk gate aksi admin di sisi klien.
// CATATAN: ini hanya UX gate — enforcement nyata wajib di backend.
export const isAdminSession = (): boolean => {
  return getActiveSessionUser()?.role === 'admin';
}
