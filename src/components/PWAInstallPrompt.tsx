import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

const DISMISSED_KEY = 'marhaba-pwa-dismissed';
const RESHOW_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

function wasRecentlyDismissed(): boolean {
  try {
    const value = localStorage.getItem(DISMISSED_KEY);
    if (!value) return false;

    const timestamp = Number(value);
    if (!Number.isFinite(timestamp)) return false;

    return Date.now() - timestamp < RESHOW_AFTER_MS;
  } catch {
    return false;
  }
}

export default function PWAInstallPrompt() {
  const { isInstallable, isInstalled, isIosDevice, promptInstall } =
    usePWAInstall();

  const [dismissed, setDismissed] = useState(wasRecentlyDismissed);
  const [hint, setHint] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  if (isInstalled || dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Ignore localStorage errors.
    }
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (installing) return;
    setInstalling(true);

    try {
      if (isIosDevice) {
        setHint('Tap the Share button, then choose "Add to Home Screen".');
        return;
      }

      if (isInstallable) {
        const installed = await promptInstall();
        if (installed) {
          setDismissed(true);
          return;
        }
      }

      setHint('Use the install icon in your address bar or browser menu.');
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Install Marhaba"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        background: '#ffffff',
        color: '#1a1a2e',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <div
        style={{
          maxWidth: '960px',
          margin: '0 auto',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <img
          src="/icon-192x192.png"
          alt="Marhaba"
          style={{
            width: '40px',
            height: '40px',
            objectFit: 'cover',
            display: 'block',
            flexShrink: 0,
            borderRadius: '8px',
          }}
        />

        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 600,
              lineHeight: 1.3,
            }}
          >
            Install Marhaba
          </div>
          <div
            style={{
              fontSize: '13px',
              color: hint ? '#1a1a2e' : '#6b7280',
              lineHeight: 1.4,
              marginTop: '2px',
            }}
          >
            {hint ?? 'Faster access, right from your device.'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={dismiss}
            style={{
              background: 'transparent',
              color: '#4b5563',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              padding: '9px 16px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Maybe later
          </button>

          <button
            type="button"
            onClick={handleInstall}
            disabled={installing}
            style={{
              background: '#1a1a2e',
              color: '#ffffff',
              border: '1px solid #1a1a2e',
              borderRadius: '8px',
              padding: '9px 20px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: installing ? 'wait' : 'pointer',
              opacity: installing ? 0.7 : 1,
            }}
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}