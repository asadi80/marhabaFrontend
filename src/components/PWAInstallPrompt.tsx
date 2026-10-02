
import { useEffect, useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

const DISMISSED_KEY = 'marhaba-pwa-dismissed';
const RESHOW_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function wasRecentlyDismissed() {
  try {
    const value = localStorage.getItem(DISMISSED_KEY);

    if (!value) {
      return false;
    }

    const timestamp = Number(value);

    if (!Number.isFinite(timestamp)) {
      return false;
    }

    return Date.now() - timestamp < RESHOW_AFTER_MS;
  } catch {
    return false;
  }
}

export default function PWAInstallPrompt() {
  const {
    isInstallable,
    isInstalled,
    isIosDevice,
    promptInstall,
  } = usePWAInstall();

  const [dismissed, setDismissed] = useState(
    wasRecentlyDismissed()
  );

  const [showInstructions, setShowInstructions] =
    useState(false);

  useEffect(() => {
    setDismissed(wasRecentlyDismissed());
  }, []);

  /*
   * Don't show anything if the app is already installed.
   */
  if (isInstalled) {
    return null;
  }

  /*
   * Don't show if the user dismissed it recently.
   */
  if (dismissed) {
    return null;
  }

  const dismiss = () => {
    try {
      localStorage.setItem(
        DISMISSED_KEY,
        String(Date.now())
      );
    } catch {
      // Ignore storage errors
    }

    setDismissed(true);
  };

  const install = async () => {
    /*
     * iPhone / iPad
     */
    if (isIosDevice) {
      setShowInstructions(true);
      return;
    }

    /*
     * Chrome / Edge / Android / supported browsers
     */
    if (isInstallable) {
      const installed = await promptInstall();

      if (installed) {
        setDismissed(true);
        return;
      }
    }

    /*
     * The browser hasn't supplied the native prompt.
     * Show our installation instructions instead.
     */
    setShowInstructions(true);
  };

  return (
    <>
      {/* Main install popup */}
      {!showInstructions && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              background: '#f7f6f2',
              color: '#1a1a2e',
              borderRadius: '20px',
              padding: '28px',
              boxShadow:
                '0 15px 50px rgba(0,0,0,0.3)',
              textAlign: 'center',
            }}
          >
            {/* App icon */}
            <div
              style={{
                width: '72px',
                height: '72px',
                margin: '0 auto 18px',
                borderRadius: '18px',
                overflow: 'hidden',
                boxShadow:
                  '0 5px 15px rgba(0,0,0,0.15)',
              }}
            >
              <img
                src="/icon-192x192.png"
                alt="Marhaba"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>

            <h2
              style={{
                margin: '0 0 8px',
                fontSize: '24px',
                fontWeight: 700,
              }}
            >
              Install Marhaba
            </h2>

            <p
              style={{
                margin: '0 auto 22px',
                maxWidth: '340px',
                color: '#555',
                lineHeight: 1.5,
                fontSize: '15px',
              }}
            >
              Install Marhaba on your device for
              faster access to stays, bookings, and
              your dashboard.
            </p>

            <button
              onClick={install}
              style={{
                width: '100%',
                background: '#e8c547',
                color: '#1a1a2e',
                border: 'none',
                borderRadius: '12px',
                padding: '13px 20px',
                fontSize: '16px',
                fontWeight: 700,
                cursor: 'pointer',
                marginBottom: '10px',
              }}
            >
              Install Marhaba
            </button>

            <button
              onClick={dismiss}
              style={{
                width: '100%',
                background: 'transparent',
                color: '#666',
                border: 'none',
                padding: '10px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}

      {/* Installation instructions */}
      {showInstructions && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '430px',
              background: '#f7f6f2',
              color: '#1a1a2e',
              borderRadius: '20px',
              padding: '28px',
              boxShadow:
                '0 15px 50px rgba(0,0,0,0.3)',
            }}
          >
            <h2
              style={{
                margin: '0 0 8px',
                fontSize: '22px',
              }}
            >
              Install Marhaba
            </h2>

            {isIosDevice ? (
              <>
                <p
                  style={{
                    color: '#555',
                    lineHeight: 1.5,
                  }}
                >
                  To install Marhaba on your iPhone
                  or iPad:
                </p>

                <ol
                  style={{
                    paddingLeft: '22px',
                    lineHeight: 1.8,
                    color: '#333',
                  }}
                >
                  <li>
                    Tap the <strong>Share</strong>{' '}
                    button.
                  </li>

                  <li>
                    Select{' '}
                    <strong>
                      Add to Home Screen
                    </strong>
                    .
                  </li>

                  <li>
                    Tap <strong>Add</strong>.
                  </li>
                </ol>
              </>
            ) : (
              <>
                <p
                  style={{
                    color: '#555',
                    lineHeight: 1.5,
                  }}
                >
                  Your browser does not currently
                  provide the automatic install dialog.
                </p>

                <p
                  style={{
                    color: '#555',
                    lineHeight: 1.5,
                  }}
                >
                  Look for the{' '}
                  <strong>Install</strong> button or
                  install icon in your browser's address
                  bar or browser menu.
                </p>
              </>
            )}

            <button
              onClick={() => setShowInstructions(false)}
              style={{
                width: '100%',
                background: '#1a1a2e',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 20px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: '12px',
              }}
            >
              Back
            </button>

            <button
              onClick={dismiss}
              style={{
                width: '100%',
                background: 'transparent',
                color: '#666',
                border: 'none',
                padding: '10px',
                cursor: 'pointer',
              }}
            >
              Don't show again
            </button>
          </div>
        </div>
      )}
    </>
  );
}
