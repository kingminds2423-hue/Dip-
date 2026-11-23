import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppReleaseInfo, UserSession } from '../types';
import { subscribeAppRelease, publishAppRelease, addAuditLog } from '../services/dataService';

export interface VersionInfo {
  version: string;
  buildId: string;
  buildTime: string;
  releaseNotes: string[];
  publishedBy?: string;
}

interface AppUpdateContextValue {
  currentVersion: string;
  currentBuildId: string;
  currentBuildTime: string;
  updateAvailable: boolean;
  updateSource: 'service_worker' | 'version_json' | 'firestore' | null;
  versionInfo: VersionInfo | null;
  isUpdating: boolean;
  updateProgress: number;
  updateStageLabel: string;
  isChecking: boolean;
  checkStatusMessage: string | null;
  lastCheckedAt: string | null;
  autoUpdateEnabled: boolean;
  setAutoUpdateEnabled: (enabled: boolean) => void;
  autoCountdown: number | null;
  cancelAutoCountdown: () => void;
  isUpdateModalOpen: boolean;
  openUpdateModal: () => void;
  closeUpdateModal: () => void;
  applyUpdate: () => void;
  dismissUpdate: () => void;
  triggerManualCheck: () => Promise<boolean>;
  isPushingRelease: boolean;
  pushLiveUpdateToDevices: (customNote?: string) => Promise<boolean>;
}

const SESSION_RELOADING_BUILD_KEY = 'dip_bhola_reloading_build_ts';
const LOCAL_AUTO_UPDATE_KEY = 'dip_bhola_auto_update_enabled';

const RUNNING_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '3.0.0';
const RUNNING_BUILD_ID = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : '3.0.0-auto-tech-assign-pwa-v3';
const RUNNING_BUILD_TIME =
  typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : '2026-11-23T06:00:00.000Z';

const DEFAULT_NOTES = [
  'লোকেশন ও OLT PON জোন অনুযায়ী অভিযোগ আসার সাথে সাথে অটো-টেকনিশিয়ান অ্যাসাইন সিস্টেম',
  'মোবাইলে PWA অ্যাপ ইনস্টল সমস্যার সম্পূর্ণ সমাধান (crossorigin=use-credentials ও VitePWA সার্ভিস ওয়ার্কার)',
  'Google Picker, Google Tasks ও ইনস্টল করা অ্যাপে অটো-আপডেট ডেলিভারি উন্নয়ন'
];

function compareSemver(a: string, b: string): number {
  const pa = String(a || '0').replace(/[^\d.]/g, '').split('.').map(Number);
  const pb = String(b || '0').replace(/[^\d.]/g, '').split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

const AppUpdateContext = createContext<AppUpdateContextValue | null>(null);

export const AppUpdateProvider: React.FC<{
  children: React.ReactNode;
  currentUser?: UserSession | null;
}> = ({ children, currentUser }) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateSource, setUpdateSource] = useState<'service_worker' | 'version_json' | 'firestore' | null>(null);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({
    version: RUNNING_VERSION,
    buildId: RUNNING_BUILD_ID,
    buildTime: RUNNING_BUILD_TIME,
    releaseNotes: DEFAULT_NOTES,
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStageLabel, setUpdateStageLabel] = useState('অপেক্ষমাণ...');
  const [isChecking, setIsChecking] = useState(false);
  const [checkStatusMessage, setCheckStatusMessage] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isPushingRelease, setIsPushingRelease] = useState(false);
  const [dismissedBuildId, setDismissedBuildId] = useState<string | null>(null);
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);

  const [autoUpdateEnabled, setAutoUpdateEnabledState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_AUTO_UPDATE_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);
  const autoSyncTriggeredRef = useRef(false);

  const setAutoUpdateEnabled = useCallback((enabled: boolean) => {
    setAutoUpdateEnabledState(enabled);
    try {
      localStorage.setItem(LOCAL_AUTO_UPDATE_KEY, String(enabled));
    } catch {
      // ignore
    }
    if (!enabled) {
      setAutoCountdown(null);
    }
  }, []);

  const cancelAutoCountdown = useCallback(() => {
    setAutoCountdown(null);
  }, []);

  const isRecentlyReloaded = (buildId: string): boolean => {
    try {
      const raw = sessionStorage.getItem(SESSION_RELOADING_BUILD_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { buildId?: string; ts?: number };
      return parsed.buildId === buildId && Date.now() - (parsed.ts || 0) < 15000;
    } catch {
      return false;
    }
  };

  const checkVersionJson = useCallback(
    async (manual = false): Promise<boolean> => {
      if (manual) {
        setIsChecking(true);
        setCheckStatusMessage(null);
      }

      try {
        // Force Service Worker byte-check on /sw.js
        if ('serviceWorker' in navigator) {
          const reg = swRegRef.current || (await navigator.serviceWorker.getRegistration());
          if (reg) {
            swRegRef.current = reg;
            await reg.update().catch(() => {});
            if (reg.waiting && navigator.serviceWorker.controller) {
              setWaitingWorker(reg.waiting);
              setUpdateAvailable(true);
              setUpdateSource('service_worker');
            }
          }
        }

        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });

        setLastCheckedAt(new Date().toLocaleTimeString('bn-BD'));

        if (res.ok) {
          const data: VersionInfo = await res.json();
          const incomingBuildId = data.buildId || data.version;
          const isVersionNewer = compareSemver(data.version, RUNNING_VERSION) > 0;
          const isBuildDifferent = Boolean(incomingBuildId && incomingBuildId !== RUNNING_BUILD_ID);

          if (
            (isVersionNewer || isBuildDifferent) &&
            incomingBuildId !== dismissedBuildId &&
            (manual || !isRecentlyReloaded(incomingBuildId))
          ) {
            setVersionInfo(data);
            setUpdateAvailable(true);
            setUpdateSource('version_json');
            if (manual) {
              setCheckStatusMessage(`নতুন আপডেট পাওয়া গেছে! (ভার্সন v${data.version})`);
            }
            return true;
          } else {
            if (manual) {
              setCheckStatusMessage(
                `আপনার অ্যাপটি সম্পূর্ণ আপ-টু-ডেট (সর্বশেষ সংস্করণ v${RUNNING_VERSION} চলছে)।`
              );
            }
            return false;
          }
        }
      } catch {
        if (manual) {
          setCheckStatusMessage('সার্ভারের সাথে সংযোগ করতে সমস্যা হয়েছে। ইন্টারনেট পরীক্ষা করুন।');
        }
      } finally {
        if (manual) setIsChecking(false);
      }

      return false;
    },
    [dismissedBuildId]
  );

  // Service Worker lifecycle listeners + periodic version polling
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let refreshing = false;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        swRegRef.current = reg;

        if (reg.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(reg.waiting);
          setUpdateAvailable(true);
          setUpdateSource('service_worker');
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(newWorker);
              setUpdateAvailable(true);
              setUpdateSource('service_worker');
            }
          });
        });
      });

      const handleSwMessage = (event: MessageEvent) => {
        if (event.data?.type === 'SW_ACTIVATED' && event.data.buildId && event.data.buildId !== RUNNING_BUILD_ID) {
          void checkVersionJson(false);
        }
      };

      navigator.serviceWorker.addEventListener('message', handleSwMessage);

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    // Immediate startup check (1s) + periodic polling every 25s + window focus/online
    const initialTimer = setTimeout(() => {
      void checkVersionJson(false);
    }, 1000);

    const interval = setInterval(() => {
      void checkVersionJson(false);
    }, 25 * 1000);

    const onFocus = () => {
      void checkVersionJson(false);
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
    };
  }, [checkVersionJson]);

  // Real-time Firestore App Release listener (Instant push to all installed devices, gated behind authenticated user)
  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeAppRelease((remoteRelease: AppReleaseInfo | null) => {
      const isDirectorOrAdmin =
        currentUser?.role === 'director' || currentUser?.role === 'admin';

      if (!remoteRelease) {
        if (!autoSyncTriggeredRef.current && isDirectorOrAdmin) {
          autoSyncTriggeredRef.current = true;
          publishAppRelease({
            version: RUNNING_VERSION,
            buildId: RUNNING_BUILD_ID,
            buildTime: RUNNING_BUILD_TIME,
            releaseNotes: DEFAULT_NOTES,
            publishedBy: currentUser?.name || 'Director',
            forceAutoUpdate: false,
          }).catch(() => {});
        }
        return;
      }

      const remoteTime = Date.parse(remoteRelease.buildTime || '') || 0;
      const runningTime = Date.parse(RUNNING_BUILD_TIME) || 0;
      const semverDiff = compareSemver(RUNNING_VERSION, remoteRelease.version);

      // If this Director build is strictly newer in version or buildTime, auto-announce to all installed phones
      if (
        !autoSyncTriggeredRef.current &&
        isDirectorOrAdmin &&
        (semverDiff > 0 || runningTime > remoteTime + 15000)
      ) {
        autoSyncTriggeredRef.current = true;
        publishAppRelease({
          version: RUNNING_VERSION,
          buildId: RUNNING_BUILD_ID,
          buildTime: RUNNING_BUILD_TIME,
          releaseNotes: DEFAULT_NOTES,
          publishedBy: currentUser?.name || 'Director',
          forceAutoUpdate: true,
        }).catch(() => {});
        return;
      }

      const isRemoteNewer =
        remoteRelease.buildId &&
        remoteRelease.buildId !== RUNNING_BUILD_ID &&
        remoteRelease.buildId !== dismissedBuildId &&
        !isRecentlyReloaded(remoteRelease.buildId) &&
        (semverDiff < 0 || remoteTime > runningTime + 2000 || remoteRelease.forceAutoUpdate === true);

      if (isRemoteNewer) {
        setVersionInfo({
          version: remoteRelease.version || RUNNING_VERSION,
          buildId: remoteRelease.buildId,
          buildTime: remoteRelease.buildTime,
          releaseNotes:
            remoteRelease.releaseNotes && remoteRelease.releaseNotes.length > 0
              ? remoteRelease.releaseNotes
              : DEFAULT_NOTES,
          publishedBy: remoteRelease.publishedBy,
        });
        setUpdateAvailable(true);
        setUpdateSource('firestore');
      }
    });

    return () => unsub();
  }, [currentUser?.role, currentUser?.name, dismissedBuildId]);

  const applyUpdate = useCallback(() => {
    setAutoCountdown(null);
    setIsUpdating(true);
    setUpdateProgress(20);
    setUpdateStageLabel('নতুন আপডেট ফাইল ডাউনলোড হচ্ছে...');

    const t1 = setTimeout(() => {
      setUpdateProgress(55);
      setUpdateStageLabel('পুরোনো ক্যাশ ও সার্ভিস ওয়ার্কার পরিষ্কার হচ্ছে...');
    }, 320);

    const t2 = setTimeout(() => {
      setUpdateProgress(88);
      setUpdateStageLabel('ইনস্টল করা অ্যাপে নতুন সংস্করণ চালু হচ্ছে...');
    }, 700);

    const t3 = setTimeout(async () => {
      setUpdateProgress(100);
      try {
        if (versionInfo?.buildId) {
          sessionStorage.setItem(
            SESSION_RELOADING_BUILD_KEY,
            JSON.stringify({ buildId: versionInfo.buildId, ts: Date.now() })
          );
        }
      } catch {
        // ignore
      }

      if (waitingWorker) {
        try {
          waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        } catch {
          // ignore
        }
      }

      try {
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(
            names
              .filter((name) => !name.includes('google-fonts') && !name.includes('gstatic-fonts'))
              .map((name) => caches.delete(name))
          );
        }
      } catch {
        // ignore
      }

      try {
        if ('serviceWorker' in navigator) {
          const reg = swRegRef.current || (await navigator.serviceWorker.getRegistration());
          if (reg) {
            await reg.update().catch(() => {});
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          }
        }
      } catch {
        // ignore
      }

      // Hard cache-busted navigation to load the fresh HTML shell & bundle immediately
      const url = new URL(window.location.href);
      url.searchParams.set('_updated', Date.now().toString());
      window.location.replace(url.toString());
    }, 1050);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [waitingWorker, versionInfo]);

  // Automatic 6-second Google Play countdown when autoUpdateEnabled is ON
  useEffect(() => {
    if (!updateAvailable || !autoUpdateEnabled || isUpdating) {
      return;
    }

    const isStandalone =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true);

    if (!isStandalone && updateSource !== 'firestore' && updateSource !== 'service_worker' && updateSource !== 'version_json') {
      return;
    }

    // Wait only if already reloaded within 15s (safety anti-loop)
    if (versionInfo?.buildId && isRecentlyReloaded(versionInfo.buildId)) {
      return;
    }

    setAutoCountdown(isStandalone ? 4 : 6);
    const interval = setInterval(() => {
      setAutoCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          applyUpdate();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [updateAvailable, autoUpdateEnabled, isUpdating, updateSource, versionInfo?.buildId, applyUpdate]);

  const dismissUpdate = useCallback(() => {
    setAutoCountdown(null);
    setUpdateAvailable(false);
    if (versionInfo?.buildId) {
      setDismissedBuildId(versionInfo.buildId);
    }
  }, [versionInfo]);

  const triggerManualCheck = useCallback(async () => {
    return checkVersionJson(true);
  }, [checkVersionJson]);

  const pushLiveUpdateToDevices = useCallback(
    async (customNote?: string): Promise<boolean> => {
      setIsPushingRelease(true);
      try {
        const pushBuildId = `${RUNNING_BUILD_ID}-push-${Date.now()}`;
        const notes = customNote?.trim()
          ? [customNote.trim(), ...DEFAULT_NOTES.slice(0, 3)]
          : DEFAULT_NOTES;

        try {
          sessionStorage.setItem(
            SESSION_RELOADING_BUILD_KEY,
            JSON.stringify({ buildId: pushBuildId, ts: Date.now() })
          );
        } catch {
          // ignore
        }

        await publishAppRelease({
          version: RUNNING_VERSION,
          buildId: pushBuildId,
          buildTime: new Date().toISOString(),
          releaseNotes: notes,
          publishedBy: currentUser?.name || 'জাহিদুল ইসলাম (পরিচালক)',
          forceAutoUpdate: true,
        });

        if (currentUser) {
          await addAuditLog({
            action: 'app_release_push',
            actionBengali: 'অ্যাপ অটো-আপডেট পুশ',
            performedBy: currentUser.name,
            performedById: currentUser.id,
            role: currentUser.role,
            details: `সকল ইনস্টল করা ডিভাইসে নতুন আপডেট (v${RUNNING_VERSION}) পাঠানো হয়েছে।`,
          });
        }

        setCheckStatusMessage('সকল ইনস্টল করা অ্যাপে নতুন আপডেট নোটিফিকেশন সফলভাবে পাঠানো হয়েছে!');
        return true;
      } catch (err) {
        console.warn('Push update error:', err);
        setCheckStatusMessage('আপডেট পুশ করতে সমস্যা হয়েছে।');
        return false;
      } finally {
        setIsPushingRelease(false);
      }
    },
    [currentUser]
  );

  return (
    <AppUpdateContext.Provider
      value={{
        currentVersion: RUNNING_VERSION,
        currentBuildId: RUNNING_BUILD_ID,
        currentBuildTime: RUNNING_BUILD_TIME,
        updateAvailable,
        updateSource,
        versionInfo,
        isUpdating,
        updateProgress,
        updateStageLabel,
        isChecking,
        checkStatusMessage,
        lastCheckedAt,
        autoUpdateEnabled,
        setAutoUpdateEnabled,
        autoCountdown,
        cancelAutoCountdown,
        isUpdateModalOpen,
        openUpdateModal: () => setIsUpdateModalOpen(true),
        closeUpdateModal: () => setIsUpdateModalOpen(false),
        applyUpdate,
        dismissUpdate,
        triggerManualCheck,
        isPushingRelease,
        pushLiveUpdateToDevices,
      }}
    >
      {children}
    </AppUpdateContext.Provider>
  );
};

export function useAppUpdate(): AppUpdateContextValue {
  const ctx = useContext(AppUpdateContext);
  if (!ctx) {
    throw new Error('useAppUpdate must be used within AppUpdateProvider');
  }
  return ctx;
}
