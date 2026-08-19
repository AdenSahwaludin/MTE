/**
 * Platform helper to detect if running inside an installed PWA, TWA,
 * or native Android / iOS Capacitor container vs standard web browser.
 */
export const isAppOrPwa = (): boolean => {
  if (typeof window === 'undefined') return false;

  // 1. Capacitor Native Android / iOS App
  const isCapacitor = !!(
    (window as any).Capacitor?.isNativePlatform?.() ||
    ((window as any).Capacitor?.getPlatform?.() && (window as any).Capacitor?.getPlatform?.() !== 'web')
  );
  if (isCapacitor) return true;

  // 2. Installed PWA (Standalone / Fullscreen / Minimal-UI)
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: minimal-ui)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    (window.navigator as any)?.standalone === true;
  if (isStandalone) return true;

  // 3. Android TWA (Trusted Web Activity) or launched via Android Intent
  if (
    document.referrer?.includes('android-app://') ||
    window.location.search.includes('source=pwa') ||
    window.location.search.includes('source=twa')
  ) {
    return true;
  }

  return false;
};
