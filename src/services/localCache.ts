/**
 * Fast synchronous localStorage read-through cache layer for DIP BHOLA NETWORK.
 * Ensures instant 0ms UI hydration when reopening the app or PWA while Firestore syncs fresh data in the background.
 */

export const CACHE_KEYS = {
  TRANSACTIONS: 'dip_bhola_cache_transactions_v1',
  STAFFS: 'dip_bhola_cache_staffs_v1',
  PARTNERS: 'dip_bhola_cache_partners_v1',
  COMPANY: 'dip_bhola_cache_company_v1',
  CUSTOMER_DUES: 'dip_bhola_cache_customer_dues_v1',
  COMPLAINTS: 'dip_bhola_cache_complaints_v1',
  CUSTOMERS: 'dip_bhola_cache_customers_v1',
  SETTINGS: 'dip_bhola_cache_settings_v1',
  DIGITAL_NOTICE: 'dip_bhola_cache_notice_v1',
  OFFICERS: 'dip_bhola_cache_officers_v1',
  WHATSAPP_CONFIG: 'dip_bhola_cache_whatsapp_v1',
  JOIN_REQUESTS: 'dip_bhola_cache_join_requests_v1',
  AUDIT_LOGS: 'dip_bhola_cache_audit_logs_v1',
  APP_RELEASE: 'dip_bhola_cache_app_release_v1'
} as const;

interface CacheEnvelope<T> {
  updatedAt: number;
  data: T;
}

/**
 * Reads cached JSON data synchronously from localStorage.
 * Returns fallback if missing, corrupted, or running outside browser.
 */
export function getCachedData<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as CacheEnvelope<T> | T;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'data' in parsed &&
      'updatedAt' in parsed
    ) {
      return (parsed as CacheEnvelope<T>).data ?? fallback;
    }
    return (parsed as T) ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Strips heavy inline base64 data URLs if storage quota is exceeded, keeping all core relational records cached.
 */
function sanitizeHeavyFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeHeavyFields(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const copy: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === 'string' && v.startsWith('data:image/') && v.length > 4096) {
        continue;
      }
      copy[k] = sanitizeHeavyFields(v);
    }
    return copy as T;
  }
  return value;
}

/**
 * Stores data in localStorage with envelope timestamp and QuotaExceeded graceful recovery.
 */
export function setCachedData<T>(key: string, data: T): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const payload: CacheEnvelope<T> = {
    updatedAt: Date.now(),
    data
  };
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    try {
      const lighter: CacheEnvelope<T> = {
        updatedAt: Date.now(),
        data: sanitizeHeavyFields(data)
      };
      window.localStorage.setItem(key, JSON.stringify(lighter));
    } catch {
      // If still full, clear audit logs cache first to preserve essential operational data
      try {
        window.localStorage.removeItem(CACHE_KEYS.AUDIT_LOGS);
        window.localStorage.setItem(key, JSON.stringify({ updatedAt: Date.now(), data: sanitizeHeavyFields(data) }));
      } catch {
        // Ignore non-fatal storage quota failures
      }
    }
  }
}

export function getCacheAgeMinutes(key: string): number | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<unknown>;
    if (parsed && typeof parsed.updatedAt === 'number') {
      return Math.max(0, Math.round((Date.now() - parsed.updatedAt) / 60000));
    }
    return null;
  } catch {
    return null;
  }
}

export function clearAllLocalCache(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  Object.values(CACHE_KEYS).forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  });
}
