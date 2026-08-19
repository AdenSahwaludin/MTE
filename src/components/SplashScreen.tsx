import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish?: () => void;
  minDuration?: number;
  isPreview?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  minDuration = 1800,
  isPreview = false,
}) => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Memuat sistem...');
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Step-by-step loading progress animation matching mockup (25% -> 60% -> 100%)
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / minDuration) * 100));
      setProgress(pct);

      if (pct < 35) {
        setStatusText('Memuat konfigurasi...');
      } else if (pct < 70) {
        setStatusText('Menyiapkan data produk...');
      } else if (pct < 95) {
        setStatusText('Menghubungkan sistem thermal...');
      } else {
        setStatusText('Siap digunakan!');
      }

      if (elapsed >= minDuration) {
        clearInterval(interval);
        setProgress(100);
        setTimeout(() => {
          setIsFading(true);
          setTimeout(() => {
            if (onFinish) onFinish();
          }, 400);
        }, 250);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [minDuration, onFinish]);

  return (
    <div className={`splash-screen-overlay ${isFading ? 'fade-out' : ''}`}>
      {/* Subtle Circuit Board PCB Pattern Overlay */}
      <div className="splash-circuit-bg" />

      {/* Main Brand Content Container */}
      <div className="splash-content">
        {/* Mascot Character with Glow Aura */}
        <div className="splash-mascot-container">
          <div className="splash-glow-aura" />
          <img
            src="/logo.webp"
            alt="Mega Tehnik Maskot"
            className="splash-mascot-img"
          />
        </div>

        {/* Brand Typography */}
        <div className="splash-brand-text">
          <h1 className="splash-title">MEGA TEHNIK</h1>

          <div className="splash-subtitle-badge">
            <span className="splash-line" />
            <span className="splash-subtitle">ELEKTRONIK</span>
            <span className="splash-line" />
          </div>

          <p className="splash-slogan">Solusi Elektronik, Terpercaya!</p>
        </div>

        {/* Loading Progress Bar Container */}
        <div className="splash-progress-wrapper">
          <div className="splash-progress-track">
            <div
              className="splash-progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="splash-status-row">
            <span className="splash-status-text">{statusText}</span>
            <span className="splash-percent-text">{progress}%</span>
          </div>
        </div>

        {isPreview && (
          <button
            type="button"
            className="splash-close-btn"
            onClick={() => onFinish && onFinish()}
          >
            Tutup Preview
          </button>
        )}
      </div>
    </div>
  );
};
