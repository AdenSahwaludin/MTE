import { UserAccount } from '../types';
import { fetchAllUsersFromTurso, isTursoConfigured } from './tursoClient';
import { getUsers, setInMemoryUsers } from './storageService';

// 7 Days Session Expiration Duration in milliseconds
export const SESSION_DURATION_DAYS = 7;
export const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000; // 604,800,000 ms

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
  loginAt: number;      // Initial login timestamp (ms)
  lastActiveAt: number; // Last activity timestamp (ms)
  expiresAt: number;    // Expiration timestamp (ms) = lastActiveAt + 7 days
  checksum: string;     // Integrity validation checksum
}

// Simple deterministic hash checksum for tamper detection without heavy crypto library
const generateChecksum = (user: SafeUser, lastActiveAt: number, expiresAt: number): string => {
  const raw = `${user.id}:${user.username}:${user.role}:${lastActiveAt}:${expiresAt}:mte_secure_salt_2026`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return 'chk_' + Math.abs(hash).toString(36);
};

// In-memory cache for fast sync access
let currentActiveUser: UserAccount | null = null;

// =========================================================
// ERROR CLASSIFICATION & USER-FRIENDLY MAPPING
// =========================================================

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'NO_INTERNET'
  | 'SERVER_UNREACHABLE'
  | 'DATABASE_ERROR'
  | 'REQUEST_TIMEOUT'
  | 'INTERNAL_SERVER_ERROR'
  | 'UNAUTHORIZED_SESSION'
  | 'FORBIDDEN'
  | 'SERVICE_UNAVAILABLE'
  | 'UNKNOWN_ERROR';

export interface AuthErrorResult {
  code: AuthErrorCode;
  messageId: string;
  messageEn: string;
  originalError?: any;
}

export const classifyAuthError = (err: any): AuthErrorResult => {
  // 1. Check Offline / No Internet Connection
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      code: 'NO_INTERNET',
      messageId: 'Tidak dapat terhubung ke internet. Periksa koneksi Anda lalu coba lagi.',
      messageEn: 'Cannot connect to the internet. Please check your connection and try again.',
      originalError: err,
    };
  }

  const errStr = String(err?.message || err || '').toLowerCase();
  const errName = String(err?.name || '').toLowerCase();
  const statusCode = err?.status || err?.statusCode || err?.response?.status || err?.status_code;

  // 2. Network Fetch Failure
  if (
    errStr.includes('failed to fetch') ||
    errStr.includes('networkerror') ||
    errStr.includes('net::err_internet_disconnected') ||
    errStr.includes('net::err_name_not_resolved') ||
    errStr.includes('network request failed') ||
    errStr.includes('offline')
  ) {
    return {
      code: 'NO_INTERNET',
      messageId: 'Tidak dapat terhubung ke internet. Periksa koneksi Anda lalu coba lagi.',
      messageEn: 'Cannot connect to the internet. Please check your connection and try again.',
      originalError: err,
    };
  }

  // 3. Request Timeout
  if (
    errName.includes('abort') ||
    errStr.includes('timeout') ||
    errStr.includes('timed out') ||
    errStr.includes('deadline_exceeded') ||
    errStr.includes('etimedout')
  ) {
    return {
      code: 'REQUEST_TIMEOUT',
      messageId: 'Permintaan melebihi batas waktu. Silakan coba kembali.',
      messageEn: 'Request timed out. Please try again.',
      originalError: err,
    };
  }

  // 4. HTTP Status Code Mapping
  if (statusCode === 401) {
    return {
      code: 'UNAUTHORIZED_SESSION',
      messageId: 'Sesi login tidak valid. Silakan login kembali.',
      messageEn: 'Invalid login session. Please log in again.',
      originalError: err,
    };
  }

  if (statusCode === 403) {
    return {
      code: 'FORBIDDEN',
      messageId: 'Anda tidak memiliki izin untuk mengakses layanan ini.',
      messageEn: 'You do not have permission to access this service.',
      originalError: err,
    };
  }

  if (statusCode === 500) {
    return {
      code: 'INTERNAL_SERVER_ERROR',
      messageId: 'Terjadi kesalahan pada server.',
      messageEn: 'Internal server error occurred.',
      originalError: err,
    };
  }

  if (statusCode === 503 || errStr.includes('503') || errStr.includes('service unavailable')) {
    return {
      code: 'SERVICE_UNAVAILABLE',
      messageId: 'Layanan sedang dalam perawatan.',
      messageEn: 'Service is currently under maintenance.',
      originalError: err,
    };
  }

  if (
    statusCode === 502 ||
    statusCode === 504 ||
    errStr.includes('econnrefused') ||
    errStr.includes('connection refused') ||
    errStr.includes('bad gateway') ||
    errStr.includes('gateway timeout')
  ) {
    return {
      code: 'SERVER_UNREACHABLE',
      messageId: 'Server sedang tidak dapat dihubungi. Silakan coba beberapa saat lagi.',
      messageEn: 'Server is unreachable. Please try again in a few moments.',
      originalError: err,
    };
  }

  // 5. Database Connection / Query Failure
  if (
    errStr.includes('sqlite') ||
    errStr.includes('database') ||
    errStr.includes('libsql') ||
    errStr.includes('hrana') ||
    errStr.includes('corrupt') ||
    errStr.includes('sql')
  ) {
    return {
      code: 'DATABASE_ERROR',
      messageId: 'Terjadi gangguan pada server. Silakan coba lagi nanti.',
      messageEn: 'Server disruption occurred. Please try again later.',
      originalError: err,
    };
  }

  // 6. Fallback Unknown Error (Never show stack trace to user)
  return {
    code: 'UNKNOWN_ERROR',
    messageId: 'Terjadi kesalahan saat memproses login. Silakan coba beberapa saat lagi.',
    messageEn: 'An error occurred while processing login. Please try again later.',
    originalError: err,
  };
};

// =========================================================
// 7-DAY SLIDING EXPIRATION SESSION MANAGEMENT
// =========================================================

/**
 * Strips sensitive data (password) and constructs a safe user object
 */
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

/**
 * Creates and stores a new 7-day sliding expiration session
 */
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

/**
 * Validates stored session with 7-day Sliding Expiration:
 * - If valid and not expired: extends expiresAt to now + 7 days (sliding window)
 * - If expired (not accessed for > 7 days) or tampered: purges session and returns null
 */
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
      // Clean up any stale legacy tokens if no modern session exists
      clearAuthSession();
      return null;
    }

    const session: AuthSession = JSON.parse(raw);
    if (!session || !session.user || !session.expiresAt || !session.lastActiveAt) {
      clearAuthSession();
      return null;
    }

    const now = Date.now();

    // Check expiration: If more than 7 days have passed since last access
    if (now > session.expiresAt) {
      console.info('Auth session expired (inactive for > 7 days). Redirecting to login.');
      clearAuthSession();
      return null;
    }

    // Verify integrity checksum
    const expectedChecksum = generateChecksum(session.user, session.lastActiveAt, session.expiresAt);
    if (session.checksum && session.checksum !== expectedChecksum) {
      console.warn('Auth session checksum mismatch. Purging invalid session.');
      clearAuthSession();
      return null;
    }

    // SLIDING EXPIRATION: Reset validity window to 7 days from right now!
    session.lastActiveAt = now;
    session.expiresAt = now + SESSION_DURATION_MS;
    session.checksum = generateChecksum(session.user, session.lastActiveAt, session.expiresAt);

    // Save updated sliding session
    const updatedRaw = JSON.stringify(session);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_SESSION_KEY, updatedRaw);
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_SESSION_KEY, updatedRaw);
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

/**
 * Fully purges all auth sessions and tokens
 */
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

// =========================================================
// AUTHENTICATION LOGIN EXECUTION
// =========================================================

/**
 * Authenticates user credentials with accurate error mapping and sliding session initialization
 */
export const loginWithCredentials = async (
  usernameInput: string,
  passwordInput: string
): Promise<UserAccount> => {
  const trimmedUsername = (usernameInput || '').trim().toLowerCase();
  const trimmedPassword = (passwordInput || '').trim();

  if (!trimmedUsername || !trimmedPassword) {
    throw {
      code: 'INVALID_CREDENTIALS',
      messageId: 'Username atau password tidak boleh kosong.',
      messageEn: 'Username and password cannot be empty.',
    };
  }

  // 1. If device is explicitly offline, check network status immediately
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw {
      code: 'NO_INTERNET',
      messageId: 'Tidak dapat terhubung ke internet. Periksa koneksi Anda lalu coba lagi.',
      messageEn: 'Cannot connect to the internet. Please check your connection and try again.',
    };
  }

  let freshUsers: UserAccount[] = [];

  // 2. If Turso is configured, attempt to fetch fresh user pool with timeout
  if (isTursoConfigured()) {
    try {
      // 8-second timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          const timeoutErr = new Error('Request timeout while connecting to authentication server.');
          timeoutErr.name = 'AbortError';
          reject(timeoutErr);
        }, 8000);
      });

      freshUsers = await Promise.race([fetchAllUsersFromTurso(), timeoutPromise]);
      if (freshUsers && freshUsers.length > 0) {
        setInMemoryUsers(freshUsers);
      }
    } catch (tursoErr: any) {
      console.warn('Turso login verification encountered error:', tursoErr);
      const classified = classifyAuthError(tursoErr);

      // If it's a severe network/server/db error, throw it directly so the user gets accurate feedback!
      if (
        classified.code === 'NO_INTERNET' ||
        classified.code === 'REQUEST_TIMEOUT' ||
        classified.code === 'INTERNAL_SERVER_ERROR' ||
        classified.code === 'SERVICE_UNAVAILABLE' ||
        classified.code === 'SERVER_UNREACHABLE' ||
        classified.code === 'DATABASE_ERROR'
      ) {
        throw classified;
      }
    }
  }

  // 3. Match against user pool (fresh Turso or local in-memory)
  const userPool = freshUsers.length > 0 ? freshUsers : getUsers();
  const matched = userPool.find((u) => {
    const uName = (u.username || '').trim().toLowerCase();
    const uPass = (u.password || '').trim();
    return uName === trimmedUsername && (uPass === trimmedPassword || u.password === passwordInput);
  });

  if (!matched) {
    throw {
      code: 'INVALID_CREDENTIALS',
      messageId: 'Username atau password yang Anda masukkan salah.',
      messageEn: 'The username or password you entered is incorrect.',
    };
  }

  // 4. Create 7-day sliding expiration session
  createAuthSession(matched);
  return matched;
};
