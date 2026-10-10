import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function PwaUpdater() {
  const { updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      // Periodic update check — every 5 minutes
      const intervalId = window.setInterval(() => {
        registration.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL);

      // Also check when the user returns to the tab
      // (iOS Safari needs this — it doesn't fire its own checks)
      const onVisible = () => {
        if (document.visibilityState === "visible") {
          registration.update().catch(() => {});
        }
      };

      document.addEventListener("visibilitychange", onVisible);

      // Best-effort cleanup — the component is mounted once
      // at the app root, so this rarely runs, but it's correct.
      return () => {
        window.clearInterval(intervalId);
        document.removeEventListener("visibilitychange", onVisible);
      };
    },

    onNeedRefresh() {
      // New SW is waiting — activate it immediately
      updateServiceWorker(true);
    },

    onOfflineReady() {
      // Optional: show a toast like "Ready for offline use"
    },
  });

  return null;
}