export const PUBLISHED_SHARED_URL = 'https://ais-pre-fyeuetew7nlhutdk5vcph2-383821225111.asia-northeast1.run.app';
export const DEFAULT_TROUBLESHOOT_PORTAL_URL = PUBLISHED_SHARED_URL;

const LEGACY_TROUBLESHOOT_HOSTS = [
  'ais-pre-t4povhqa45dibisqbvp3db-73308058930.asia-northeast1.run.app',
  'ais-dev-t4povhqa45dibisqbvp3db-73308058930.asia-northeast1.run.app'
];

export function normalizePortalHttpUrl(raw?: string | null): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('://')) return `http${trimmed}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function isLegacyTroubleshootPortalUrl(raw?: string | null): boolean {
  const normalized = normalizePortalHttpUrl(raw).toLowerCase();
  if (!normalized) return false;
  return LEGACY_TROUBLESHOOT_HOSTS.some((host) => normalized.includes(host));
}

export function getEffectiveTroubleshootPortalUrl(company?: { troubleshootPortalUrl?: string } | null): string {
  const normalized = normalizePortalHttpUrl(company?.troubleshootPortalUrl);
  if (!normalized || isLegacyTroubleshootPortalUrl(normalized)) {
    return DEFAULT_TROUBLESHOOT_PORTAL_URL;
  }
  return normalized;
}

/**
 * Returns the public shareable base URL for Admin, Staff, and Share Partners.
 * Explicitly blocks private AI Studio workspace/editor domains (`aistudio.google.com`)
 * and developer-only sessions (`ais-dev-`) so shared links never show "Page not found".
 */
export function getPublicAppBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (
      origin.startsWith('https://ais-pre-') ||
      (origin.startsWith('http') &&
        !origin.includes('ais-dev-') &&
        !origin.includes('aistudio.google.com') &&
        !origin.includes('localhost') &&
        !origin.includes('127.0.0.1'))
    ) {
      return origin;
    }
  }
  return PUBLISHED_SHARED_URL;
}

/**
 * Unified Official Google Play Store Download & Install App Link
 * Identical across Download, Install, Admin, Staff, Share Partner, and QR shares.
 */
export function getGooglePlayStoreUrl(): string {
  return `${getPublicAppBaseUrl()}/?portal=playstore`;
}

export function getJoiningPortalUrl(role?: 'staff' | 'partner'): string {
  const base = getPublicAppBaseUrl();
  return role ? `${base}/?portal=join&role=${role}` : `${base}/?portal=join`;
}

export function normalizeWhatsAppGroupLink(link?: string): string {
  const trimmed = (link || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function buildWhatsAppUrl(message: string, phone?: string): string {
  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  const intlPhone = cleanPhone ? (cleanPhone.startsWith('0') ? `88${cleanPhone}` : cleanPhone) : '';
  return intlPhone
    ? `https://wa.me/${intlPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export async function shareOrCopyAppLink(title: string, text: string, url: string): Promise<'shared' | 'copied'> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch {
      // User cancelled or Web Share not permitted in iframe; fall back to clipboard
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(url);
  }
  return 'copied';
}

