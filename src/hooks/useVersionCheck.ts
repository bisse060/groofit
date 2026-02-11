import { useState, useEffect, useCallback, useRef } from 'react';

interface VersionInfo {
  version: string;
  buildTime: string;
}

interface UseVersionCheckReturn {
  currentVersion: VersionInfo | null;
  updateAvailable: boolean;
  remoteVersion: VersionInfo | null;
  dismissUpdate: () => void;
  checkNow: () => Promise<void>;
  forceRefresh: () => Promise<void>;
}

const POLL_INTERVAL = 60_000; // 60 seconds
const DISMISS_COOLDOWN = 5 * 60_000; // 5 minutes

export function useVersionCheck(): UseVersionCheckReturn {
  const [currentVersion, setCurrentVersion] = useState<VersionInfo | null>(null);
  const [remoteVersion, setRemoteVersion] = useState<VersionInfo | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const initialVersionRef = useRef<string | null>(null);

  const fetchVersion = useCallback(async (): Promise<VersionInfo | null> => {
    try {
      const res = await fetch(`/version.json?cb=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  const checkNow = useCallback(async () => {
    const remote = await fetchVersion();
    if (!remote) return;

    setRemoteVersion(remote);

    if (!initialVersionRef.current) {
      initialVersionRef.current = remote.version;
      setCurrentVersion(remote);
      if (import.meta.env.DEV) {
        console.log('[VersionCheck] Initial version:', remote.version);
      }
      return;
    }

    if (remote.version !== initialVersionRef.current) {
      setUpdateAvailable(true);
      if (import.meta.env.DEV) {
        console.log('[VersionCheck] Update available!', {
          currentVersion: initialVersionRef.current,
          remoteVersion: remote.version,
        });
      }
    }
  }, [fetchVersion]);

  const dismissUpdate = useCallback(() => {
    setDismissed(true);
    // Re-show after cooldown if still different
    dismissTimeoutRef.current = setTimeout(() => {
      setDismissed(false);
    }, DISMISS_COOLDOWN);
  }, []);

  const forceRefresh = useCallback(async () => {
    try {
      // Try service worker update flow
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update();
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }
      }
    } catch (e) {
      console.error('[VersionCheck] SW update error:', e);
    }

    // iOS PWA fallback: change URL to bust cache
    const isIOSPWA = 
      ('standalone' in navigator && (navigator as any).standalone) ||
      window.matchMedia('(display-mode: standalone)').matches;

    if (isIOSPWA) {
      const baseUrl = window.location.href.split('#')[0].split('?')[0];
      window.location.href = `${baseUrl}?r=${Date.now()}`;
    } else {
      window.location.reload();
    }
  }, []);

  // Initial check + polling
  useEffect(() => {
    checkNow();
    const interval = setInterval(checkNow, POLL_INTERVAL);
    return () => {
      clearInterval(interval);
      if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
    };
  }, [checkNow]);

  return {
    currentVersion,
    updateAvailable: updateAvailable && !dismissed,
    remoteVersion,
    dismissUpdate,
    checkNow,
    forceRefresh,
  };
}
