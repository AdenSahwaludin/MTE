import { UserAccount } from '../types';
import { fetchAllUsersFromTurso, isTursoConfigured } from './tursoClient';
import { getUsers, setInMemoryUsers } from './storageService';
import {
  SESSION_DURATION_DAYS,
  SESSION_DURATION_MS,
  STORAGE_SESSION_KEY,
  LEGACY_AUTH_KEY,
  LEGACY_SESSION_AUTH_KEY,
  SafeUser,
  AuthSession,
  generateChecksum,
  toSafeUser,
  createAuthSession,
  validateAndRefreshSession,
  clearAuthSession,
  getActiveSessionUser,
  isAdminSession,
} from './sessionStore';

// Re-export session API agar import lama (App, LoginView) tetap jalan.
// Implementasi tunggal ada di sessionStore (memecah circular import
// storageService <-> authService yang lama).
export {
  SESSION_DURATION_DAYS,
  SESSION_DURATION_MS,
  STORAGE_SESSION_KEY,
  LEGACY_AUTH_KEY,
  LEGACY_SESSION_AUTH_KEY,
  generateChecksum,
  toSafeUser,
  createAuthSession,
  validateAndRefreshSession,
  clearAuthSession,
  getActiveSessionUser,
  isAdminSession,
};
export type { SafeUser, AuthSession };

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
// AUTHENTICATION LOGIN EXECUTION (dengan fallback offline)
// =========================================================

/**
 * Login dengan strategi:
 * 1. Jika online + Turso terkonfigurasi: coba ambil user terbaru (timeout 8 dtk).
 * 2. Jika gagal/offline: FALLBACK ke user lokal (localStorage) agar kasir
 *    tetap bisa login saat internet mati (sebelumnya langsung throw NO_INTERNET).
 * 3. Jika cocok lokal -> sesi dibuat. Jika tidak cocok dan ada network error
 *    -> lempar network error (lebih akurat dari "password salah").
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

  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

  let freshUsers: UserAccount[] = [];
  let networkError: AuthErrorResult | null = null;

  // 1. Coba refresh dari Turso hanya jika online & terkonfigurasi
  if (isOnline && isTursoConfigured()) {
    try {
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
      console.warn('Turso login verification encountered error (fallback ke lokal):', tursoErr);
      networkError = classifyAuthError(tursoErr);
    }
  }

  // 2. Match terhadap pool (fresh Turso atau lokal tersimpan)
  const userPool = freshUsers.length > 0 ? freshUsers : getUsers();
  const matched = userPool.find((u) => {
    const uName = (u.username || '').trim().toLowerCase();
    const uPass = (u.password || '').trim();
    return uName === trimmedUsername && (uPass === trimmedPassword || u.password === passwordInput);
  });

  if (matched) {
    createAuthSession(matched);
    return matched;
  }

  // 3. Tidak cocok: jika ada network error, laporkan itu (bukan password salah)
  if (networkError) {
    throw networkError;
  }

  throw {
    code: 'INVALID_CREDENTIALS',
    messageId: isOnline
      ? 'Username atau password yang Anda masukkan salah.'
      : 'Username atau password salah (mode offline — memakai data lokal tersimpan).',
    messageEn: 'The username or password you entered is incorrect.',
  };
};
