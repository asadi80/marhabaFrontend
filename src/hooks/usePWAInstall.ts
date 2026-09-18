// src/hooks/usePWAInstall.ts
import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isIos() {
  return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
}

function isInStandaloneMode() {
  // Covers both the standard PWA check and iOS Safari's proprietary flag.
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(isInStandaloneMode());
  const [isIosDevice] = useState(isIos());

  useEffect(() => {
    // Already running as an installed app — nothing to prompt.
    if (isInstalled) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      // Stops Chrome's automatic mini-infobar so we control the UI instead.
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isInstalled]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    // The prompt can only be used once — clear it either way.
    setDeferredPrompt(null);
    setIsInstallable(false);

    return outcome === 'accepted';
  }, [deferredPrompt]);

  return {
    isInstallable, // true on Chrome/Edge/Android once eligible
    isInstalled, // true if already running standalone
    isIosDevice, // true on iOS, where there's no native prompt at all
    promptInstall, // call this from a button's onClick
  };
}