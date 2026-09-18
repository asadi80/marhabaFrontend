import { useState, useEffect } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

const DISMISSED_KEY = 'pwa-install-dismissed-at';
const RESHOW_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function wasRecentlyDismissed() {
  const dismissedAt = localStorage.getItem(DISMISSED_KEY);
  if (!dismissedAt) return false;
  return Date.now() - Number(dismissedAt) < RESHOW_AFTER_MS;
}

export default function PWAInstallPrompt() {
  const { isInstallable, isInstalled, isIosDevice, promptInstall } =
    usePWAInstall();
  const [dismissed, setDismissed] = useState(wasRecentlyDismissed());
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  const shouldShowIosBanner =
    isIosDevice && !isInstalled && !dismissed && !showIosInstructions;

  useEffect(() => {
    setDismissed(wasRecentlyDismissed());
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setDismissed(true);
  };

  const handleInstallClick = async () => {
    const accepted = await promptInstall();
    if (!accepted) {
      handleDismiss();
    }
  };

  if (isInstalled || dismissed) return null;
  if (!isInstallable && !isIosDevice) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#1a1a2e',
        color: '#fff',
        padding: '14px 20px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        zIndex: 9998,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        fontSize: '14px',
        maxWidth: '320px',
        width: 'calc(100% - 40px)',
      }}
    >
      {isIosDevice ? (
        shouldShowIosBanner && (
          <>
            <span>
              Install Marhaba: tap <strong>Share</strong> (the box with an arrow) then{' '}
              <strong>"Add to Home Screen"</strong>.
            </span>
            <button
              onClick={handleDismiss}
              style={{
                alignSelf: 'flex-end',
                background: 'transparent',
                color: '#e8c547',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Got it
            </button>
          </>
        )
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ flex: 1 }}>Install Marhaba as an app?</span>
          <button
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              color: '#aaa',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Later
          </button>
          <button
            onClick={handleInstallClick}
            style={{
              background: '#e8c547',
              color: '#1a1a2e',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Install
          </button>
        </div>
      )}
    </div>
  );
}