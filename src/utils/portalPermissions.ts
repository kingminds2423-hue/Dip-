import {
  AdminAuth,
  CustomPortalLink,
  PortalControlConfig,
  Staff,
  StaffActionPermissionKey,
  StaffActionPermissions,
  UserSession
} from '../types';
import { toEnglishDigits } from './formatters';

export interface PortalPermissionMeta {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  defaultForStaff?: boolean;
}

export interface StaffActionPermissionDef {
  key: StaffActionPermissionKey;
  portalId: string;
  groupLabel: string;
  label: string;
  shortLabel: string;
  kind: 'view' | 'add' | 'edit' | 'delete' | 'work';
  defaultEnabled: boolean;
}

export interface TemporaryPortalOverride {
  portalId: string;
  userId: string;
  grantedAt: number;
  expiresAt: number;
  durationMinutes: number;
}

export interface PortalAccessOptions {
  overridePin?: string | null;
  adminAuth?: AdminAuth | null;
  grantedOverridePortals?: string[];
  portalControl?: PortalControlConfig | null;
}

export function isPortalDeletedByAdmin(
  portalId: string,
  portalControl?: PortalControlConfig | null
): boolean {
  if (!portalId || portalId === 'erp_hub' || portalId === 'join') return false;
  return Boolean(portalControl?.deletedPortalIds?.includes(portalId));
}

export function isPortalDisabledByAdmin(
  portalId: string,
  portalControl?: PortalControlConfig | null
): boolean {
  if (!portalId || portalId === 'erp_hub' || portalId === 'join') return false;
  return Boolean(portalControl?.disabledPortalIds?.includes(portalId));
}

export function canUserAccessCustomPortal(
  customPortal: CustomPortalLink,
  user: UserSession | null | undefined
): boolean {
  if (!user || !customPortal.active) return false;
  if (user.role === 'director' || user.role === 'admin') return true;
  if (!customPortal.allowedRoles || customPortal.allowedRoles.length === 0) return true;
  return customPortal.allowedRoles.includes(user.role as 'director' | 'manager' | 'staff' | 'partner');
}

export const DEFAULT_OVERRIDE_DURATION_MINUTES = 15;
const OVERRIDE_STORAGE_KEY = 'dip_bhola_portal_overrides_v1';

export const ERP_PORTAL_PERMISSIONS: PortalPermissionMeta[] = [
  {
    id: 'transactions',
    label: 'হিসাব খাতা (জমা ও খরচ এন্ট্রি)',
    shortLabel: 'হিসাব খাতা',
    description: 'দৈনিক জমা-খরচ দেখা ও নতুন লেনদেন এন্ট্রি করা',
    defaultForStaff: true
  },
  {
    id: 'complaints',
    label: 'অভিযোগ ও লাইন সার্ভিস',
    shortLabel: 'অভিযোগ ও লাইন',
    description: 'গ্রাহক অভিযোগ দেখা, নতুন অভিযোগ এন্ট্রি ও সমাধান আপডেট',
    defaultForStaff: true
  },
  {
    id: 'customers',
    label: 'গ্রাহক CRM (সদস্য ডিরেক্টরি)',
    shortLabel: 'গ্রাহক CRM',
    description: 'সদস্য তালিকা দেখা এবং নতুন গ্রাহক যোগ/আপডেট করা'
  },
  {
    id: 'dues',
    label: 'বাকি ও বিল কালেকশন',
    shortLabel: 'বাকি ও বিল',
    description: 'গ্রাহকের বকেয়া হিসাব দেখা, নতুন বকেয়া ও বিল আদায় এন্ট্রি'
  },
  {
    id: 'troubleshoot_portal',
    label: 'সমস্যা অনুসন্ধান ও সমাধান পোর্টাল',
    shortLabel: 'সমস্যা সমাধান',
    description: 'সহজে সমস্যা খুঁজে বের করে দ্রুত সমাধান করার ওয়েব পোর্টাল',
    defaultForStaff: true
  },
  {
    id: 'reports',
    label: 'রিপোর্ট ও PDF',
    shortLabel: 'রিপোর্ট ও PDF',
    description: 'দৈনিক/মাসিক রিপোর্ট ও প্রিন্ট স্টুডিও দেখা'
  },
  {
    id: 'dashboard',
    label: 'দৈনিক নির্বাহী ড্যাশবোর্ড',
    shortLabel: 'ড্যাশবোর্ড',
    description: 'মোট আয়-ব্যয় সামারি, গ্রাফ ও ক্যাশ ব্যালেন্স'
  },
  {
    id: 'staff',
    label: 'স্টাফ ও বেতন',
    shortLabel: 'স্টাফ ও বেতন',
    description: 'স্টাফ তালিকা ও বেতন তথ্য দেখা'
  },
  {
    id: 'partners',
    label: 'অংশীদার ও মূলধন',
    shortLabel: 'অংশীদার',
    description: 'বিনিয়োগ ও শেয়ার অংশীদার হিসাব'
  },
  {
    id: 'officers',
    label: 'কর্মকর্তা (ম্যানেজার/অডিটর)',
    shortLabel: 'কর্মকর্তা',
    description: 'দায়িত্বপ্রাপ্ত ম্যানেজার ও অডিটর তথ্য'
  },
  {
    id: 'display',
    label: 'ডিজিটাল LED ডিসপ্লে',
    shortLabel: 'LED ডিসপ্লে',
    description: 'অফিস ডিজিটাল নোটিশ ডিসপ্লে বোর্ড'
  },
  {
    id: 'backup',
    label: 'ব্যাকআপ ও ক্লাউড ড্রাইভ',
    shortLabel: 'ব্যাকআপ',
    description: 'Google Drive এবং JSON/CSV ব্যাকআপ'
  },
  {
    id: 'security',
    label: 'সিকিউরিটি ও সেটআপ',
    shortLabel: 'সিকিউরিটি',
    description: 'পিন কন্ট্রোল, অডিট লগ ও কোম্পানি সেটআপ'
  }
];

export const ALL_ERP_PORTAL_IDS = ERP_PORTAL_PERMISSIONS.map((p) => p.id);

export const DIRECTOR_ONLY_PORTALS = ['security', 'backup'];

export const STAFF_ASSIGNABLE_PORTALS = ERP_PORTAL_PERMISSIONS.filter(
  (p) => !DIRECTOR_ONLY_PORTALS.includes(p.id)
);

export const STAFF_ASSIGNABLE_PORTAL_IDS = STAFF_ASSIGNABLE_PORTALS.map((p) => p.id);

export const DEFAULT_STAFF_ALLOWED_PORTALS = ERP_PORTAL_PERMISSIONS.filter(
  (p) => p.defaultForStaff && !DIRECTOR_ONLY_PORTALS.includes(p.id)
).map((p) => p.id);

export const PARTNER_ALLOWED_PORTALS = ['partners', 'reports'];

// Runtime temporary Director Override PIN store (session-scoped, memory + sessionStorage)
let memoryOverrides: TemporaryPortalOverride[] = [];
const overrideListeners = new Set<() => void>();
let expiryTimerId: ReturnType<typeof setTimeout> | null = null;

function readOverridesStore(): TemporaryPortalOverride[] {
  const now = Date.now();
  let list: TemporaryPortalOverride[] = memoryOverrides;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(OVERRIDE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          list = parsed;
        }
      }
    }
  } catch {
    // fallback to memoryOverrides
  }
  const active = list.filter(
    (item) =>
      item &&
      typeof item.portalId === 'string' &&
      typeof item.userId === 'string' &&
      typeof item.expiresAt === 'number' &&
      item.expiresAt > now
  );
  memoryOverrides = active;
  return active;
}

function writeOverridesStore(list: TemporaryPortalOverride[]) {
  const now = Date.now();
  const active = list.filter((item) => item.expiresAt > now);
  memoryOverrides = active;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (active.length === 0) {
        window.sessionStorage.removeItem(OVERRIDE_STORAGE_KEY);
      } else {
        window.sessionStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(active));
      }
    }
  } catch {
    // ignore storage quota errors
  }
  scheduleNextExpiryNotification(active);
  overrideListeners.forEach((cb) => cb());
}

function scheduleNextExpiryNotification(active: TemporaryPortalOverride[]) {
  if (expiryTimerId) {
    clearTimeout(expiryTimerId);
    expiryTimerId = null;
  }
  if (active.length === 0) return;
  const now = Date.now();
  const earliestExpiry = Math.min(...active.map((o) => o.expiresAt));
  const waitMs = Math.max(250, Math.min(earliestExpiry - now + 50, 2_147_483_647));
  expiryTimerId = setTimeout(() => {
    const remaining = readOverridesStore();
    writeOverridesStore(remaining);
  }, waitMs);
}

export function subscribePortalOverrides(cb: () => void): () => void {
  overrideListeners.add(cb);
  return () => {
    overrideListeners.delete(cb);
  };
}

export function verifyDirectorOverridePin(
  enteredPin: string | null | undefined,
  adminAuth?: AdminAuth | null
): boolean {
  const cleanEntered = toEnglishDigits(enteredPin || '').trim();
  if (!cleanEntered) return false;
  const targetPin = toEnglishDigits(adminAuth?.pin || '1234').trim();
  if (!targetPin) return false;
  return cleanEntered === targetPin;
}

export function isPortalOverridableForUser(
  portalId: string,
  user: UserSession | null | undefined
): boolean {
  if (!user || user.role !== 'staff') return false;
  if (!portalId || portalId === 'erp_hub' || portalId === 'join') return false;
  if (DIRECTOR_ONLY_PORTALS.includes(portalId)) return false;
  return true;
}

export function grantTemporaryPortalOverride(
  portalId: string,
  user: UserSession | null | undefined,
  enteredPin: string,
  adminAuth?: AdminAuth | null,
  durationMinutes: number = DEFAULT_OVERRIDE_DURATION_MINUTES
): { success: boolean; expiresAt?: number; error?: string } {
  if (!user || user.role !== 'staff') {
    return { success: false, error: 'শুধুমাত্র স্টাফ অ্যাকাউন্টের জন্য সাময়িক পোর্টাল ওভাররাইড প্রযোজ্য।' };
  }
  if (DIRECTOR_ONLY_PORTALS.includes(portalId)) {
    return {
      success: false,
      error: 'এই সিকিউরিটি/ব্যাকআপ পোর্টালটি স্টাফের জন্য স্থায়ীভাবে লক করা আছে।'
    };
  }
  if (!verifyDirectorOverridePin(enteredPin, adminAuth)) {
    return {
      success: false,
      error: 'ভুল পরিচালক ওভাররাইড পিন! সঠিক পিন দিন।'
    };
  }

  const safeMinutes = Math.max(1, Math.min(240, Number(durationMinutes) || DEFAULT_OVERRIDE_DURATION_MINUTES));
  const now = Date.now();
  const expiresAt = now + safeMinutes * 60_000;
  const current = readOverridesStore().filter(
    (item) => !(item.portalId === portalId && item.userId === user.id)
  );
  current.push({
    portalId,
    userId: user.id,
    grantedAt: now,
    expiresAt,
    durationMinutes: safeMinutes
  });
  writeOverridesStore(current);
  return { success: true, expiresAt };
}

export function hasActivePortalOverride(
  portalId: string,
  user: UserSession | null | undefined
): boolean {
  if (!user || user.role !== 'staff') return false;
  if (DIRECTOR_ONLY_PORTALS.includes(portalId)) return false;
  const active = readOverridesStore();
  return active.some((item) => item.portalId === portalId && item.userId === user.id);
}

export function getActivePortalOverrideExpiresAt(
  portalId: string,
  user: UserSession | null | undefined
): number | null {
  if (!user || user.role !== 'staff') return null;
  if (DIRECTOR_ONLY_PORTALS.includes(portalId)) return null;
  const found = readOverridesStore().find(
    (item) => item.portalId === portalId && item.userId === user.id
  );
  return found ? found.expiresAt : null;
}

export function getActiveOverridesForUser(
  user: UserSession | null | undefined
): TemporaryPortalOverride[] {
  if (!user || user.role !== 'staff') return [];
  return readOverridesStore().filter(
    (item) => item.userId === user.id && !DIRECTOR_ONLY_PORTALS.includes(item.portalId)
  );
}

export function revokeTemporaryPortalOverride(portalId: string, userId?: string): void {
  const current = readOverridesStore();
  const next = userId
    ? current.filter((item) => !(item.portalId === portalId && item.userId === userId))
    : current.filter((item) => item.portalId !== portalId);
  writeOverridesStore(next);
}

export function clearTemporaryPortalOverrides(): void {
  writeOverridesStore([]);
}

function normalizePhoneDigits(phone?: string | null): string {
  const digits = toEnglishDigits(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('880') && digits.length >= 13) return digits.slice(2);
  if (digits.length === 10 && digits.startsWith('1')) return `0${digits}`;
  return digits;
}

export function findMatchingStaffRecord(
  user: UserSession | null | undefined,
  staffs: Staff[] = []
): Staff | undefined {
  if (!user || user.role !== 'staff') return undefined;
  const byId = staffs.find((s) => s.id === user.id);
  if (byId) return byId;
  const targetPhone = normalizePhoneDigits(user.phone);
  if (!targetPhone) return undefined;
  return staffs.find((s) => normalizePhoneDigits(s.phone) === targetPhone);
}

export function getAllowedPortalsForUser(
  user: UserSession | null | undefined,
  staffs: Staff[] = [],
  portalControl?: PortalControlConfig | null
): string[] {
  if (!user) return [];
  const isBlocked = (id: string) =>
    isPortalDeletedByAdmin(id, portalControl) || isPortalDisabledByAdmin(id, portalControl);

  if (user.role === 'director' || user.role === 'admin') {
    return ALL_ERP_PORTAL_IDS.filter((id) => !isPortalDeletedByAdmin(id, portalControl));
  }
  if (user.role === 'manager') {
    return ALL_ERP_PORTAL_IDS.filter(
      (id) => !DIRECTOR_ONLY_PORTALS.includes(id) && !isBlocked(id)
    );
  }
  if (user.role === 'partner') {
    return PARTNER_ALLOWED_PORTALS.filter((id) => !isBlocked(id));
  }
  // Staff: prefer real-time Firestore Staff record and always strip director-only portals
  const liveStaff = findMatchingStaffRecord(user, staffs);
  if (liveStaff && Array.isArray(liveStaff.allowedPortals)) {
    return liveStaff.allowedPortals.filter(
      (id) => !DIRECTOR_ONLY_PORTALS.includes(id) && !isBlocked(id)
    );
  }
  if (Array.isArray(user.allowedPortals)) {
    return user.allowedPortals.filter(
      (id) => !DIRECTOR_ONLY_PORTALS.includes(id) && !isBlocked(id)
    );
  }
  return DEFAULT_STAFF_ALLOWED_PORTALS.filter((id) => !isBlocked(id));
}

export function canUserAccessPortal(
  portalId: string,
  user: UserSession | null | undefined,
  staffs: Staff[] = [],
  options?: PortalAccessOptions
): boolean {
  if (!user) return false;
  if (portalId === 'erp_hub' || portalId === 'join') return true;

  // Handle custom linked portals (`custom:<id>`)
  if (portalId.startsWith('custom:') && options?.portalControl?.customPortals) {
    const customId = portalId.slice('custom:'.length);
    const custom = options.portalControl.customPortals.find((c) => c.id === customId);
    if (!custom) return false;
    return canUserAccessCustomPortal(custom, user);
  }

  if (isPortalDeletedByAdmin(portalId, options?.portalControl)) {
    return false;
  }
  if (user.role === 'director' || user.role === 'admin') {
    return !isPortalDisabledByAdmin(portalId, options?.portalControl);
  }
  if (isPortalDisabledByAdmin(portalId, options?.portalControl)) {
    return false;
  }
  if (DIRECTOR_ONLY_PORTALS.includes(portalId)) return false;

  // Dynamic Director Override PIN support for staff members:
  // 1) Explicit runtime overridePin verified against Director adminAuth
  if (
    user.role === 'staff' &&
    options?.overridePin &&
    verifyDirectorOverridePin(options.overridePin, options.adminAuth)
  ) {
    return true;
  }
  // 2) Explicitly passed granted override portal list
  if (
    user.role === 'staff' &&
    Array.isArray(options?.grantedOverridePortals) &&
    options.grantedOverridePortals.includes(portalId)
  ) {
    return true;
  }
  // 3) Active temporary override unlocked at the portal entry gate
  if (user.role === 'staff' && hasActivePortalOverride(portalId, user)) {
    return true;
  }

  if (portalId === 'playstore') {
    return user.role === 'manager';
  }
  const allowed = getAllowedPortalsForUser(user, staffs, options?.portalControl);
  return allowed.includes(portalId);
}

export function getPortalBengaliLabel(portalId: string): string {
  return ERP_PORTAL_PERMISSIONS.find((p) => p.id === portalId)?.label || portalId;
}

export const STAFF_ACTION_PERMISSION_DEFS: StaffActionPermissionDef[] = [
  // ১. হিসাব খাতা (Transactions Ledger)
  {
    key: 'canAddTransaction',
    portalId: 'transactions',
    groupLabel: 'হিসাব খাতা (জমা ও খরচ)',
    label: 'নতুন জমা ও খরচ এন্ট্রি',
    shortLabel: 'হিসাব এন্ট্রি (যোগ)',
    kind: 'add',
    defaultEnabled: true
  },
  {
    key: 'canEditTransaction',
    portalId: 'transactions',
    groupLabel: 'হিসাব খাতা (জমা ও খরচ)',
    label: 'আগের জমা/খরচ এডিট করা',
    shortLabel: 'হিসাব এডিট',
    kind: 'edit',
    defaultEnabled: false
  },
  {
    key: 'canDeleteTransaction',
    portalId: 'transactions',
    groupLabel: 'হিসাব খাতা (জমা ও খরচ)',
    label: 'জমা/খরচ ডিলিট করা',
    shortLabel: 'হিসাব ডিলিট',
    kind: 'delete',
    defaultEnabled: false
  },
  {
    key: 'canViewFinancialTotals',
    portalId: 'transactions',
    groupLabel: 'হিসাব খাতা (জমা ও খরচ)',
    label: 'মোট আয়, ব্যয় ও ক্যাশ ব্যালেন্স দেখা',
    shortLabel: 'মোট ক্যাশ ব্যালেন্স দেখা',
    kind: 'view',
    defaultEnabled: false
  },
  // ২. অভিযোগ ও লাইন সার্ভিস (Complaints)
  {
    key: 'canAddComplaint',
    portalId: 'complaints',
    groupLabel: 'গ্রাহক অভিযোগ ও লাইন সার্ভিস',
    label: 'নতুন অভিযোগ এন্ট্রি',
    shortLabel: 'অভিযোগ এন্ট্রি',
    kind: 'add',
    defaultEnabled: true
  },
  {
    key: 'canUpdateComplaintStatus',
    portalId: 'complaints',
    groupLabel: 'গ্রাহক অভিযোগ ও লাইন সার্ভিস',
    label: 'কাজ শুরু ও সমাধান আপডেট',
    shortLabel: 'অভিযোগ সমাধান আপডেট',
    kind: 'work',
    defaultEnabled: true
  },
  {
    key: 'canEditComplaint',
    portalId: 'complaints',
    groupLabel: 'গ্রাহক অভিযোগ ও লাইন সার্ভিস',
    label: 'অভিযোগের বিবরণ এডিট করা',
    shortLabel: 'অভিযোগ এডিট',
    kind: 'edit',
    defaultEnabled: false
  },
  {
    key: 'canDeleteComplaint',
    portalId: 'complaints',
    groupLabel: 'গ্রাহক অভিযোগ ও লাইন সার্ভিস',
    label: 'অভিযোগ ডিলিট করা',
    shortLabel: 'অভিযোগ ডিলিট',
    kind: 'delete',
    defaultEnabled: false
  },
  {
    key: 'canViewAllComplaints',
    portalId: 'complaints',
    groupLabel: 'গ্রাহক অভিযোগ ও লাইন সার্ভিস',
    label: 'সকল স্টাফের সব অভিযোগ দেখা',
    shortLabel: 'সব অভিযোগ দেখা',
    kind: 'view',
    defaultEnabled: false
  },
  // ৩. গ্রাহক CRM ডিরেক্টরি (Customers)
  {
    key: 'canAddCustomer',
    portalId: 'customers',
    groupLabel: 'গ্রাহক CRM ডিরেক্টরি',
    label: 'নতুন গ্রাহক যোগ ও Excel ইমপোর্ট',
    shortLabel: 'গ্রাহক যোগ',
    kind: 'add',
    defaultEnabled: true
  },
  {
    key: 'canEditCustomer',
    portalId: 'customers',
    groupLabel: 'গ্রাহক CRM ডিরেক্টরি',
    label: 'গ্রাহকের তথ্য/প্যাকেজ এডিট',
    shortLabel: 'গ্রাহক এডিট',
    kind: 'edit',
    defaultEnabled: false
  },
  {
    key: 'canDeleteCustomer',
    portalId: 'customers',
    groupLabel: 'গ্রাহক CRM ডিরেক্টরি',
    label: 'গ্রাহক ডিলিট ও ডুপ্লিকেট ক্লিন',
    shortLabel: 'গ্রাহক ডিলিট',
    kind: 'delete',
    defaultEnabled: false
  },
  // ৪. বাকি ও বিল কালেকশন (Customer Dues)
  {
    key: 'canAddDue',
    portalId: 'dues',
    groupLabel: 'বাকি ও বিল কালেকশন',
    label: 'নতুন বকেয়া হিসাব যোগ',
    shortLabel: 'বকেয়া যোগ',
    kind: 'add',
    defaultEnabled: true
  },
  {
    key: 'canCollectDue',
    portalId: 'dues',
    groupLabel: 'বাকি ও বিল কালেকশন',
    label: 'বকেয়া বিল টাকা আদায় এন্ট্রি',
    shortLabel: 'বিল আদায়',
    kind: 'work',
    defaultEnabled: true
  },
  {
    key: 'canEditDue',
    portalId: 'dues',
    groupLabel: 'বাকি ও বিল কালেকশন',
    label: 'বকেয়া তথ্য এডিট করা',
    shortLabel: 'বকেয়া এডিট',
    kind: 'edit',
    defaultEnabled: false
  },
  {
    key: 'canDeleteDue',
    portalId: 'dues',
    groupLabel: 'বাকি ও বিল কালেকশন',
    label: 'বকেয়া রেকর্ড ডিলিট করা',
    shortLabel: 'বকেয়া ডিলিট',
    kind: 'delete',
    defaultEnabled: false
  },
  // ৫. রিপোর্ট ও টিম ম্যানেজমেন্ট
  {
    key: 'canExportOrPrintReports',
    portalId: 'reports',
    groupLabel: 'রিপোর্ট ও টিম ম্যানেজমেন্ট',
    label: 'রিপোর্ট প্রিন্ট, PDF ও Excel ডাউনলোড',
    shortLabel: 'PDF/Excel ও প্রিন্ট',
    kind: 'work',
    defaultEnabled: true
  },
  {
    key: 'canAddStaffOrManageTeam',
    portalId: 'staff',
    groupLabel: 'রিপোর্ট ও টিম ম্যানেজমেন্ট',
    label: 'স্টাফ নিয়োগ/তথ্য এডিট ও বেতন এন্ট্রি',
    shortLabel: 'স্টাফ ম্যানেজ',
    kind: 'edit',
    defaultEnabled: false
  }
];

export const DEFAULT_STAFF_ACTION_PERMISSIONS: Required<StaffActionPermissions> = {
  canAddTransaction: true,
  canEditTransaction: false,
  canDeleteTransaction: false,
  canViewFinancialTotals: false,
  canAddComplaint: true,
  canUpdateComplaintStatus: true,
  canEditComplaint: false,
  canDeleteComplaint: false,
  canViewAllComplaints: false,
  canAddCustomer: true,
  canEditCustomer: false,
  canDeleteCustomer: false,
  canAddDue: true,
  canCollectDue: true,
  canEditDue: false,
  canDeleteDue: false,
  canExportOrPrintReports: true,
  canAddStaffOrManageTeam: false
};

export const READONLY_STAFF_ACTION_PERMISSIONS: Required<StaffActionPermissions> = {
  canAddTransaction: false,
  canEditTransaction: false,
  canDeleteTransaction: false,
  canViewFinancialTotals: false,
  canAddComplaint: false,
  canUpdateComplaintStatus: false,
  canEditComplaint: false,
  canDeleteComplaint: false,
  canViewAllComplaints: false,
  canAddCustomer: false,
  canEditCustomer: false,
  canDeleteCustomer: false,
  canAddDue: false,
  canCollectDue: false,
  canEditDue: false,
  canDeleteDue: false,
  canExportOrPrintReports: false,
  canAddStaffOrManageTeam: false
};

export const ENTRY_AND_EDIT_STAFF_ACTION_PERMISSIONS: Required<StaffActionPermissions> = {
  canAddTransaction: true,
  canEditTransaction: true,
  canDeleteTransaction: false,
  canViewFinancialTotals: true,
  canAddComplaint: true,
  canUpdateComplaintStatus: true,
  canEditComplaint: true,
  canDeleteComplaint: false,
  canViewAllComplaints: true,
  canAddCustomer: true,
  canEditCustomer: true,
  canDeleteCustomer: false,
  canAddDue: true,
  canCollectDue: true,
  canEditDue: true,
  canDeleteDue: false,
  canExportOrPrintReports: true,
  canAddStaffOrManageTeam: false
};

export const FULL_STAFF_ACTION_PERMISSIONS: Required<StaffActionPermissions> = {
  canAddTransaction: true,
  canEditTransaction: true,
  canDeleteTransaction: true,
  canViewFinancialTotals: true,
  canAddComplaint: true,
  canUpdateComplaintStatus: true,
  canEditComplaint: true,
  canDeleteComplaint: true,
  canViewAllComplaints: true,
  canAddCustomer: true,
  canEditCustomer: true,
  canDeleteCustomer: true,
  canAddDue: true,
  canCollectDue: true,
  canEditDue: true,
  canDeleteDue: true,
  canExportOrPrintReports: true,
  canAddStaffOrManageTeam: true
};

export function normalizeStaffActionPermissions(
  raw?: StaffActionPermissions | null
): Required<StaffActionPermissions> {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_STAFF_ACTION_PERMISSIONS };
  }
  const merged = { ...DEFAULT_STAFF_ACTION_PERMISSIONS };
  (Object.keys(DEFAULT_STAFF_ACTION_PERMISSIONS) as StaffActionPermissionKey[]).forEach((key) => {
    if (typeof raw[key] === 'boolean') {
      merged[key] = Boolean(raw[key]);
    }
  });
  return merged;
}

export function getStaffActionPermissions(
  user: UserSession | null | undefined,
  staffs: Staff[] = []
): Required<StaffActionPermissions> {
  if (!user) return { ...READONLY_STAFF_ACTION_PERMISSIONS };
  if (user.role === 'director' || user.role === 'admin' || user.role === 'manager') {
    return { ...FULL_STAFF_ACTION_PERMISSIONS };
  }
  if (user.role === 'partner') {
    return { ...READONLY_STAFF_ACTION_PERMISSIONS };
  }
  const liveStaff = findMatchingStaffRecord(user, staffs);
  if (liveStaff?.actionPermissions) {
    return normalizeStaffActionPermissions(liveStaff.actionPermissions);
  }
  if (user.actionPermissions) {
    return normalizeStaffActionPermissions(user.actionPermissions);
  }
  return { ...DEFAULT_STAFF_ACTION_PERMISSIONS };
}

export function canUserPerformAction(
  actionKey: StaffActionPermissionKey,
  user: UserSession | null | undefined,
  staffs: Staff[] = []
): boolean {
  if (!user) return false;
  if (user.role === 'director' || user.role === 'admin') return true;
  if (user.role === 'manager') return true;
  if (user.role === 'partner') return false;
  const perms = getStaffActionPermissions(user, staffs);
  return Boolean(perms[actionKey]);
}

export function countGrantedActions(perms?: StaffActionPermissions | null): {
  granted: number;
  total: number;
  canEditAny: boolean;
  canDeleteAny: boolean;
} {
  const normalized = normalizeStaffActionPermissions(perms);
  const keys = Object.keys(DEFAULT_STAFF_ACTION_PERMISSIONS) as StaffActionPermissionKey[];
  const granted = keys.filter((k) => normalized[k]).length;
  const canEditAny =
    normalized.canEditTransaction ||
    normalized.canEditComplaint ||
    normalized.canEditCustomer ||
    normalized.canEditDue ||
    normalized.canAddStaffOrManageTeam;
  const canDeleteAny =
    normalized.canDeleteTransaction ||
    normalized.canDeleteComplaint ||
    normalized.canDeleteCustomer ||
    normalized.canDeleteDue;
  return { granted, total: keys.length, canEditAny, canDeleteAny };
}

