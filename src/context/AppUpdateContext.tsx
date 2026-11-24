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

const RUNNING_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '3.1.0';
const RUNNING_BUILD_ID = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : '3.1.0-mobile-auto-update';
const RUNNING_BUILD_TIME =
  typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : '2026-11-24T08:40:00.000Z';

const DEFAULT_NOTES = [
  'সব মোবাইল ডিভাইসে স্বয়ংক্রিয় অ্যাপ আপডেট সিস্টেম (Zero-Stuck Auto-Update ও দ্রুত SW ক্যাশ সিঙ্ক)',
  'লোকেশন ও পূর্বের সফল সার্ভিস ইতিহাস অনুযায়ী সেরা টেকনিশিয়ান সাজেস্ট সিস্টেম',
  'স্টাফ QR আইডি কার্ড, দৈনিক/মাসিক/বাৎসরিক QR PDF স্টেটমেন্ট এবং অ্যাপ পোর্টাল কন্ট্রোল'
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

function isProductionPublicHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return !host.includes('ais-dev-') && !host.includes('localhost') && !host.includes('127.0.0.1');
}

async function waitForServiceWorkerReadyToSwap(
  reg: ServiceWorkerRegistration,
  maxWaitMs = 4500
): Promise<ServiceWorker | null> {
  if (reg.waiting) return reg.waiting;
  const installing = reg.installing;
  if (!installing) return null;

  return new Promise((resolve) => {
    let settled = false;
    const done = (sw: ServiceWorker | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(sw);
    };

    const timer = setTimeout(() => done(reg.waiting || null), maxWaitMs);
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed') {
        done(reg.waiting || installing);
      } else if (installing.state === 'activated' || installing.state === 'redundant') {
        done(reg.waiting || null);
      }
    });
  });
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
  const applyingRef = useRef(false);

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
      return parsed.buildId === buildId && Date.now() - (parsed.ts || 0) < 20000;
    } catch {
      return false;
    }
  };

  const checkVersionJson = useCallback(
    async (manual = false): Promise<boolean> => {
      if (applyingRef.current) return false;

      if (manual) {
        setIsChecking(true);
        setCheckStatusMessage(null);
      }

      try {
        // Force Service Worker byte-check ignoring HTTP cache
        let hasWaitingSw = false;
        if ('serviceWorker' in navigator) {
          let reg = swRegRef.current || (await navigator.serviceWorker.getRegistration());
          if (!reg && isProductionPublicHost()) {
            reg = await navigator.serviceWorker
              .register('/sw.js', { scope: '/', updateViaCache: 'none' })
              .catch(() => undefined);
          }
          if (reg) {
            swRegRef.current = reg;
            await reg.update().catch(() => {});
            if (reg.waiting && navigator.serviceWorker.controller) {
              setWaitingWorker(reg.waiting);
              hasWaitingSw = true;
            }
          }
        }

        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });

        setLastCheckedAt(new Date().toLocaleTimeString('bn-BD'));

        if (res.ok) {
          const contentType = (res.headers.get('content-type') || '').toLowerCase();
          if (!contentType.includes('application/json')) {
            if (manual) {
              setCheckStatusMessage('সার্ভার এখন রিস্টার্ট/বিল্ড হচ্ছে — কিছুক্ষণ পর আবার চেষ্টা করুন।');
            }
            return false;
          }

          const data: VersionInfo = await res.json();
          const incomingBuildId = data.buildId || data.version;
          const isVersionNewer = compareSemver(data.version, RUNNING_VERSION) > 0;
          const isBuildDifferent = Boolean(incomingBuildId && incomingBuildId !== RUNNING_BUILD_ID);

          if (
            (isVersionNewer || isBuildDifferent || hasWaitingSw) &&
            incomingBuildId !== dismissedBuildId &&
            (manual || !isRecentlyReloaded(incomingBuildId))
          ) {
            setVersionInfo(data);
            setUpdateAvailable(true);
            setUpdateSource(isVersionNewer || isBuildDifferent ? 'version_json' : 'service_worker');
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

  // Clean up any stale SW reload query parameter after successful update
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('_updated')) {
        url.searchParams.delete('_updated');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      }
    } catch {
      // ignore
    }
  }, []);

  // Service Worker lifecycle listeners + periodic & app-resume version polling
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let refreshing = false;

    if ('serviceWorker' in navigator) {
      if (isProductionPublicHost()) {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/', updateViaCache: 'none' })
          .catch(() => {});
      }
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
        // Reload automatically when a brand-new SW takes control while user isn't mid-applyUpdate
        if (!refreshing && !applyingRef.current) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    // Immediate startup check (600ms) + periodic polling every 20s + visibility/focus/online
    const initialTimer = setTimeout(() => {
      void checkVersionJson(false);
    }, 600);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void checkVersionJson(false);
      }
    }, 20 * 1000);

    const onResume = () => {
      if (document.visibilityState !== 'hidden') {
        void checkVersionJson(false);
      }
    };

    window.addEventListener('focus', onResume);
    window.addEventListener('online', onResume);
    document.addEventListener('visibilitychange', onResume);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      window.removeEventListener('focus', onResume);
      window.removeEventListener('online', onResume);
      document.removeEventListener('visibilitychange', onResume);
    };
  }, [checkVersionJson]);

  // Real-time Firestore App Release listener (only triggers update when the host itself has a new build or SW waiting)
  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeAppRelease((remoteRelease: AppReleaseInfo | null) => {
      const isDirectorOrAdmin =
        currentUser?.role === 'director' || currentUser?.role === 'admin';
      const canPublishGlobalRelease = isDirectorOrAdmin && isProductionPublicHost();

      if (!remoteRelease) {
        if (!autoSyncTriggeredRef.current && canPublishGlobalRelease) {
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

      // Only auto-announce from the published production host (never from ais-dev preview URLs)
      if (
        !autoSyncTriggeredRef.current &&
        canPublishGlobalRelease &&
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
        // Verify host /version.json & SW update first so stale Firestore push from another host won't loop
        void checkVersionJson(false);
      }
    });

    return () => unsub();
  }, [currentUser?.role, currentUser?.name, dismissedBuildId, checkVersionJson]);

  const applyUpdate = useCallback(() => {
    if (applyingRef.current) return;
    applyingRef.current = true;
    setAutoCountdown(null);
    setIsUpdating(true);
    setUpdateProgress(22);
    setUpdateStageLabel('সার্ভার ও নতুন ভার্সন যাচাই হচ্ছে...');

    const t1 = setTimeout(() => {
      setUpdateProgress(55);
      setUpdateStageLabel('নতুন সার্ভিস ওয়ার্কার ও ফাইল সিঙ্ক হচ্ছে...');
    }, 280);

    const t2 = setTimeout(() => {
      setUpdateProgress(82);
      setUpdateStageLabel('ইনস্টল করা অ্যাপে নতুন সংস্করণ চালু হচ্ছে...');
    }, 620);

    const t3 = setTimeout(async () => {
      // 1. Pre-flight check: verify the origin serves real app HTML and NOT Cloud Run's startup splash
      try {
        const probeRes = await fetch(`/?_sw_probe=${Date.now()}`, {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });
        const probeHtml = probeRes.ok ? await probeRes.text() : '';
        const isStartupSplash =
          !probeRes.ok ||
          !probeHtml.includes('id="root"') ||
          probeHtml.includes('Please wait while your application starts');

        if (isStartupSplash) {
          applyingRef.current = false;
          setIsUpdating(false);
          setUpdateProgress(0);
          setUpdateStageLabel('অপেক্ষমাণ...');
          setCheckStatusMessage(
            'সার্ভারটি এখন চালু/আপডেট হচ্ছে — আপনার চলমান অ্যাপটি নিরাপদে রাখা হয়েছে। কয়েক সেকেন্ড পর আবার চেষ্টা করুন।'
          );
          return;
        }
      } catch {
        applyingRef.current = false;
        setIsUpdating(false);
        setUpdateProgress(0);
        setUpdateStageLabel('অপেক্ষমাণ...');
        setCheckStatusMessage('সার্ভার সংযোগ পাওয়া যায়নি — অফলাইন ক্যাশ নিরাপদে চালু রাখা হয়েছে।');
        return;
      }

      setUpdateProgress(95);

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

      // 2. Ask waiting SW to activate, or cleanly unregister stale SW + clear old precache so old HTML is never served back
      let swSwappedCleanly = false;
      try {
        if ('serviceWorker' in navigator) {
          const reg = swRegRef.current || (await navigator.serviceWorker.getRegistration());
          if (reg) {
            await reg.update().catch(() => {});
            const readySw = waitingWorker || (await waitForServiceWorkerReadyToSwap(reg, 3500));
            if (readySw) {
              readySw.postMessage({ type: 'SKIP_WAITING' });
              swSwappedCleanly = true;
              await new Promise((r) => setTimeout(r, 350));
            } else {
              // Old SW was still holding stale NavigationRoute precache -> unregister it cleanly now that live server is verified
              await reg.unregister().catch(() => {});
            }
          }
        }
      } catch {
        // ignore
      }

      try {
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(
            names
              .filter((name) => {
                if (name.includes('google-fonts') || name.includes('gstatic-fonts')) return false;
                // Keep fresh precache only if the new SW already swapped cleanly
                if (swSwappedCleanly && name.includes('workbox-precache')) return false;
                return true;
              })
              .map((name) => caches.delete(name))
          );
        }
      } catch {
        // ignore
      }

      setUpdateProgress(100);
      const url = new URL(window.location.href);
      url.searchParams.set('_updated', Date.now().toString());
      window.location.replace(url.toString());
    }, 900);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [waitingWorker, versionInfo]);

  // Automatic Google Play style countdown (faster 2s on installed standalone apps)
  useEffect(() => {
    if (!updateAvailable || !autoUpdateEnabled || isUpdating) {
      return;
    }

    const isStandalone =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true);

    if (versionInfo?.buildId && isRecentlyReloaded(versionInfo.buildId)) {
      return;
    }

    setAutoCountdown(isStandalone ? 2 : 4);
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
