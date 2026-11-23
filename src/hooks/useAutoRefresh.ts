import { useState, useEffect, useCallback, useRef } from 'react';

export type AutoRefreshIntervalSec = 0 | 10 | 30 | 60 | 300;

export interface AutoRefreshState {
  intervalSec: AutoRefreshIntervalSec;
  secondsRemaining: number;
  isRefreshing: boolean;
  lastRefreshedAt: string;
  refreshCount: number;
  keepaliveKey: string;
  setIntervalSec: (sec: AutoRefreshIntervalSec) => void;
  triggerNow: () => Promise<void>;
}

const STORAGE_KEY = 'dip_bhola_freetier_keepalive_sec_v1';
const DEFAULT_INTERVAL_SEC: AutoRefreshIntervalSec = 300; // 5 minutes (300,000 ms) keepalive default
const VALID_INTERVALS: AutoRefreshIntervalSec[] = [0, 10, 30, 60, 300];

function readSavedInterval(): AutoRefreshIntervalSec {
  if (typeof window === 'undefined') return DEFAULT_INTERVAL_SEC;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_INTERVAL_SEC;
    const parsed = Number(raw) as AutoRefreshIntervalSec;
    if (VALID_INTERVALS.includes(parsed)) return parsed;
  } catch {
    // ignore storage errors
  }
  return DEFAULT_INTERVAL_SEC;
}

export function formatCountdownShort(sec: number): string {
  if (sec <= 0) return '0স';
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  if (mins > 0) {
    return rem > 0 ? `${mins}মি ${rem}স` : `${mins}মি`;
  }
  return `${rem}স`;
}

export function useAutoRefresh(
  onRefresh: () => Promise<void> | void,
  enabled = true
): AutoRefreshState {
  const [intervalSec, setIntervalSecState] = useState<AutoRefreshIntervalSec>(() => readSavedInterval());
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => readSavedInterval());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(() => new Date().toISOString());
  const [refreshCount, setRefreshCount] = useState(0);

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const inFlightRef = useRef(false);
  const nextTriggerAtRef = useRef<number>(Date.now() + readSavedInterval() * 1000);

  const setIntervalSec = useCallback((sec: AutoRefreshIntervalSec) => {
    setIntervalSecState(sec);
    setSecondsRemaining(sec);
    nextTriggerAtRef.current = sec > 0 ? Date.now() + sec * 1000 : 0;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(sec));
      } catch {
        // ignore storage errors
      }
    }
  }, []);

  const triggerNow = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsRefreshing(true);
    try {
      await onRefreshRef.current();
      setLastRefreshedAt(new Date().toISOString());
      setRefreshCount((c) => c + 1);
    } catch {
      // non-fatal
    } finally {
      inFlightRef.current = false;
      setIsRefreshing(false);
      if (intervalSec > 0) {
        nextTriggerAtRef.current = Date.now() + intervalSec * 1000;
        setSecondsRemaining(intervalSec);
      }
    }
  }, [intervalSec]);

  useEffect(() => {
    if (!enabled || intervalSec <= 0) {
      setSecondsRemaining(0);
      nextTriggerAtRef.current = 0;
      return;
    }

    nextTriggerAtRef.current = Date.now() + intervalSec * 1000;
    setSecondsRemaining(intervalSec);

    const timer = window.setInterval(() => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }

      const remainingMs = nextTriggerAtRef.current - Date.now();
      if (remainingMs <= 0) {
        nextTriggerAtRef.current = Date.now() + intervalSec * 1000;
        setSecondsRemaining(intervalSec);
        void triggerNow();
      } else {
        setSecondsRemaining(Math.max(1, Math.ceil(remainingMs / 1000)));
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [enabled, intervalSec, triggerNow]);

  return {
    intervalSec,
    secondsRemaining,
    isRefreshing,
    lastRefreshedAt,
    refreshCount,
    keepaliveKey: 'freetier_keepalive',
    setIntervalSec,
    triggerNow
  };
}
