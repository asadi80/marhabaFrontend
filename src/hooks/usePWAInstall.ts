
import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms?: string[];

  prompt: () => Promise<void>;

  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

// Keep this outside React.
// The browser's beforeinstallprompt event is a one-time event.
let deferredPrompt: BeforeInstallPromptEvent | null = null;

function detectIOS(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();

  return (
    /iphone|ipad|ipod/.test(userAgent) ||
    (
      window.navigator.platform === 'MacIntel' &&
      window.navigator.maxTouchPoints > 1
    )
  );
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const standaloneMedia = window.matchMedia(
    '(display-mode: standalone)'
  ).matches;

  const iosStandalone =
    (window.navigator as Navigator & {
      standalone?: boolean;
    }).standalone === true;

  return standaloneMedia || iosStandalone;
}

export function usePWAInstall() {
  const [isIOS] = useState(() => detectIOS());

  const [isInstalled, setIsInstalled] = useState(() =>
    detectStandalone()
  );

  const [isInstallable, setIsInstallable] = useState(
    deferredPrompt !== null
  );

  useEffect(() => {
    /*
     * Browser says the app can be installed.
     */
    const handleBeforeInstallPrompt = (event: Event) => {
      console.log(
        '[PWA] Install prompt available'
      );

      event.preventDefault();

      deferredPrompt =
        event as BeforeInstallPromptEvent;

      setIsInstallable(true);
    };

    /*
     * App was successfully installed.
     */
    const handleAppInstalled = () => {
      console.log('[PWA] App installed');

      deferredPrompt = null;

      setIsInstallable(false);
      setIsInstalled(true);
    };

    /*
     * User may have installed the app outside
     * our React session.
     */
    const handleDisplayModeChange = () => {
      const standalone = detectStandalone();

      setIsInstalled(standalone);

      if (standalone) {
        deferredPrompt = null;
        setIsInstallable(false);
      }
    };

    window.addEventListener(
      'beforeinstallprompt',
      handleBeforeInstallPrompt
    );

    window.addEventListener(
      'appinstalled',
      handleAppInstalled
    );

    const mediaQuery = window.matchMedia(
      '(display-mode: standalone)'
    );

    mediaQuery.addEventListener(
      'change',
      handleDisplayModeChange
    );

    /*
     * The event may already exist.
     */
    if (deferredPrompt) {
      setIsInstallable(true);
    }

    /*
     * Check standalone mode once on mount.
     */
    if (detectStandalone()) {
      setIsInstalled(true);
      setIsInstallable(false);
    }

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );

      window.removeEventListener(
        'appinstalled',
        handleAppInstalled
      );

      mediaQuery.removeEventListener(
        'change',
        handleDisplayModeChange
      );
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    /*
     * There is no native prompt available.
     *
     * This is normal on iOS and some browsers.
     */
    if (!deferredPrompt) {
      console.log(
        '[PWA] Native install prompt unavailable'
      );

      return false;
    }

    try {
      const prompt = deferredPrompt;

      /*
       * The browser requires prompt() to be called
       * from a user interaction.
       */
      await prompt.prompt();

      const result = await prompt.userChoice;

      console.log(
        '[PWA] Install result:',
        result.outcome
      );

      /*
       * The event can only be used once.
       */
      deferredPrompt = null;

      setIsInstallable(false);

      if (result.outcome === 'accepted') {
        setIsInstalled(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error(
        '[PWA] Install failed:',
        error
      );

      deferredPrompt = null;
      setIsInstallable(false);

      return false;
    }
  }, []);

  return {
    isInstallable,
    isInstalled,

    /*
     * iOS has no beforeinstallprompt.
     */
    isIosDevice: isIOS,

    /*
     * Native browser installation.
     */
    promptInstall: install,
  };
}

