import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedFlag = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installedFlag = true;
    notify();
  });
}

function checkStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

export function usePWAInstall() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    deferredPrompt = null; // a prompt can only be used once
    notify();

    return outcome === 'accepted';
  }, []);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIosDevice =
    /iphone|ipad|ipod/i.test(ua) ||
    (ua.includes('Mac') && navigator.maxTouchPoints > 1);

  return {
    isInstallable: deferredPrompt !== null,
    isInstalled: installedFlag || checkStandalone(),
    isIosDevice,
    promptInstall,
  };
}