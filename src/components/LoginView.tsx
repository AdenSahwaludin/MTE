import React, { useState, useRef, useEffect } from 'react';
import { User, Lock, Eye, EyeOff, Loader2, Globe, AlertCircle, WifiOff } from 'lucide-react';
import { loginWithCredentials, classifyAuthError } from '../services/authService';
import { UserAccount } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: UserAccount) => void;
}

type Language = 'id' | 'en';

const TRANSLATIONS = {
  id: {
    title: 'Login',
    subtitle: 'Mega Tehnik Elektronik',
    desc: 'Silakan masuk untuk mengakses sistem kasir & inventaris.',
    usernameLabel: 'Username',
    usernamePlaceholder: 'Masukkan username',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Masukkan password',
    submitButton: 'Masuk',
    loadingButton: 'Memproses...',
    usernameRequired: 'Username tidak boleh kosong',
    passwordRequired: 'Password tidak boleh kosong',
    authFailed: 'Username atau password yang Anda masukkan salah.',
    sessionDurationHint: 'Login akan tetap aktif selama 7 hari di perangkat ini.',
    hintTitle: 'Akun Tersedia:',
    hintAdmin: 'Admin: admin / admin123',
    hintKasir: 'Kasir: kasir / kasir123',
    footerText: 'Sistem Kasir & Cetak Struk',
  },
  en: {
    title: 'Login',
    subtitle: 'Mega Tehnik Elektronik',
    desc: 'Please sign in to access the cashier & inventory system.',
    usernameLabel: 'Username',
    usernamePlaceholder: 'Enter username',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter password',
    submitButton: 'Sign In',
    loadingButton: 'Signing in...',
    usernameRequired: 'Username cannot be empty',
    passwordRequired: 'Password cannot be empty',
    authFailed: 'The username or password you entered is incorrect.',
    sessionDurationHint: 'Login will stay active for 7 days on this device.',
    hintTitle: 'Available Accounts:',
    hintAdmin: 'Admin: admin / admin123',
    hintKasir: 'Cashier: kasir / kasir123',
    footerText: 'POS & Thermal Print System',
  },
};

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [lang, setLang] = useState<Language>('id');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [usernameError, setUsernameError] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [generalError, setGeneralError] = useState<string>('');
  const [errorCode, setErrorCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const t = TRANSLATIONS[lang];

  useEffect(() => {
    usernameInputRef.current?.focus();
  }, []);

  const handleLanguageToggle = () => {
    const nextLang = lang === 'id' ? 'en' : 'id';
    setLang(nextLang);
    if (usernameError) {
      setUsernameError(TRANSLATIONS[nextLang].usernameRequired);
    }
    if (passwordError) {
      setPasswordError(TRANSLATIONS[nextLang].passwordRequired);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
    if (usernameError) setUsernameError('');
    if (generalError) {
      setGeneralError('');
      setErrorCode('');
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (passwordError) setPasswordError('');
    if (generalError) {
      setGeneralError('');
      setErrorCode('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let hasError = false;
    const trimmedUsername = username.trim().toLowerCase();

    if (!trimmedUsername) {
      setUsernameError(t.usernameRequired);
      hasError = true;
    } else {
      setUsernameError('');
    }

    if (!password) {
      setPasswordError(t.passwordRequired);
      hasError = true;
    } else {
      setPasswordError('');
    }

    if (hasError) {
      if (!trimmedUsername) {
        usernameInputRef.current?.focus();
      } else if (!password) {
        passwordInputRef.current?.focus();
      }
      return;
    }

    setIsLoading(true);
    setGeneralError('');
    setErrorCode('');

    try {
      const user = await loginWithCredentials(username, password);
      setIsLoading(false);
      onLoginSuccess(user);
    } catch (err: any) {
      setIsLoading(false);
      const classified = err?.code ? err : classifyAuthError(err);
      setErrorCode(classified.code || 'UNKNOWN_ERROR');

      const message = lang === 'id'
        ? (classified.messageId || classified.message || t.authFailed)
        : (classified.messageEn || classified.message || t.authFailed);

      setGeneralError(message);

      if (classified.code === 'INVALID_CREDENTIALS') {
        setPassword('');
        passwordInputRef.current?.focus();
      }
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-top-bar">
          <button
            type="button"
            className="login-lang-btn"
            onClick={handleLanguageToggle}
            aria-label="Toggle language"
          >
            <Globe size={14} />
            <span>{lang === 'id' ? 'ID' : 'EN'}</span>
            <span className="login-lang-switch-hint">({lang === 'id' ? 'English' : 'Indonesia'})</span>
          </button>
        </div>

        <div className="login-brand-header">
          <div className="login-logo-container">
            <img src="/logo.webp" alt="Mega Tehnik Elektronik Logo" className="login-logo-img" />
          </div>
          <h1 className="login-title">{t.title}</h1>
          <h2 className="login-subtitle">{t.subtitle}</h2>
          <p className="login-desc">{t.desc}</p>
        </div>

        {generalError && (
          <div className={`login-alert-banner ${errorCode === 'NO_INTERNET' ? 'offline' : ''}`}>
            {errorCode === 'NO_INTERNET' ? (
              <WifiOff size={18} className="login-alert-icon" />
            ) : (
              <AlertCircle size={18} className="login-alert-icon" />
            )}
            <span>{generalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="login-field-group">
            <label className="login-label" htmlFor="login-username">
              {t.usernameLabel}
            </label>
            <div className={`login-input-box ${usernameError ? 'error' : ''}`}>
              <User size={18} className="login-input-prefix-icon" />
              <input
                ref={usernameInputRef}
                id="login-username"
                type="text"
                className="login-input"
                placeholder={t.usernamePlaceholder}
                value={username}
                onChange={handleUsernameChange}
                autoComplete="username"
                autoFocus
                disabled={isLoading}
              />
            </div>
            {usernameError && <span className="login-error-msg">{usernameError}</span>}
          </div>

          <div className="login-field-group">
            <label className="login-label" htmlFor="login-password">
              {t.passwordLabel}
            </label>
            <div className={`login-input-box ${passwordError ? 'error' : ''}`}>
              <Lock size={18} className="login-input-prefix-icon" />
              <input
                ref={passwordInputRef}
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="login-input"
                placeholder={t.passwordPlaceholder}
                value={password}
                onChange={handlePasswordChange}
                autoComplete="current-password"
                disabled={isLoading}
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {passwordError && <span className="login-error-msg">{passwordError}</span>}
          </div>

          <button
            type="submit"
            className="login-submit-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="login-btn-spinner" />
                <span>{t.loadingButton}</span>
              </>
            ) : (
              <span>{t.submitButton}</span>
            )}
          </button>
        </form>

        <div className="login-footer">
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.72rem', color: '#64748b', marginBottom: '4px' }}>
            <Lock size={12} /> {t.sessionDurationHint}
          </span>
          <span>&copy; {new Date().getFullYear()} Mega Tehnik Elektronik &bull; {t.footerText}</span>
        </div>
      </div>
    </div>
  );
};
