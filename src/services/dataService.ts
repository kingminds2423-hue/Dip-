import {
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  getDocsFromServer,
  getDocFromServer,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  deleteField
} from 'firebase/firestore';
import {
  DEFAULT_TROUBLESHOOT_PORTAL_URL,
  isLegacyTroubleshootPortalUrl,
  normalizePortalHttpUrl
} from '../utils/appUrls';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  stripUndefined,
  commitDocOfflineSafe,
  deleteDocOfflineSafe,
  getOfflineQueuedDocsForCollection,
  getOfflineDeletedIdsForCollection,
  getOfflineQueue,
  getTombstones,
  addTombstonesBulk,
  enqueueOfflineWrite,
  removeOfflineWrite,
  purgeOfflineCollectionWrites,
  enqueueOfflineDeletesBulk,
  removeOfflineWritesBulk,
  mergeTombstonesFromRemote,
  clearAllTombstones,
  subscribeOfflineSyncState,
  recordSuccessfulCloudSync,
  TombstonesMap
} from './offlineSync';
import {
  getTodayString,
  getComplaintDateKey,
  getTransactionDateKey,
  parseNumericInput,
  toEnglishDigits
} from '../utils/formatters';
import {
  getCachedData,
  setCachedData,
  CACHE_KEYS
} from './localCache';
import {
  Company,
  Partner,
  Staff,
  Transaction,
  CustomerDue,
  CustomerMember,
  AdminAuth,
  BackupData,
  DigitalNotice,
  AppointedOfficer,
  OfficersState,
  AuditLog,
  CustomerComplaint,
  AppReleaseInfo,
  WhatsAppGroupConfig,
  JoinRequest,
  NotificationControl,
  PortalControlConfig
} from '../types';

import { collection } from 'firebase/firestore';

export const COMPANY_DOC_ID = 'dip-bhola-network';
export const SETTINGS_DOC_ID = 'auth';
export const NOTICE_DOC_ID = 'digital_notice';
export const OFFICERS_DOC_ID = 'appointed_officers';
export const APP_RELEASE_DOC_ID = 'app_release';
export const WHATSAPP_GROUP_DOC_ID = 'whatsapp_group';
export const NOTIFICATION_CONTROL_DOC_ID = 'notification_control';
export const DELETED_TOMBSTONES_DOC_ID = 'deleted_tombstones';
export const SEED_META_DOC_ID = 'seed_meta';
export const PORTAL_CONTROL_DOC_ID = 'portal_control';

const LOCAL_NOTIF_CONTROL_KEY = 'dip_bhola_notif_control_v1';
const LOCAL_COMPLAINTS_SEEDED_KEY = 'dip_bhola_complaints_seeded_v1';
const LOCAL_PORTAL_CONTROL_KEY = 'dip_bhola_portal_control_v1';

export const DEFAULT_PORTAL_CONTROL: PortalControlConfig = {
  deletedPortalIds: [],
  disabledPortalIds: [],
  customPortals: [],
  portalOverrides: {},
  updatedAt: ''
};

export const DEFAULT_NOTIFICATION_CONTROL: NotificationControl = {
  clearedAt: '',
  clearedBy: '',
  clearedKeys: [],
  updatedAt: ''
};

let tombstoneListenerActive = false;
function ensureTombstoneSyncListener() {
  if (tombstoneListenerActive || typeof window === 'undefined' || !auth.currentUser) return;
  tombstoneListenerActive = true;
  try {
    onSnapshot(
      doc(db, 'settings', DELETED_TOMBSTONES_DOC_ID),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as TombstonesMap;
          mergeTombstonesFromRemote(data);
        }
      },
      () => {
        tombstoneListenerActive = false;
      }
    );
  } catch {
    tombstoneListenerActive = false;
  }
}

/**
 * Revalidates Firestore server connectivity and pulls latest tombstones for live auto-refresh cycles.
 */
export async function refreshLiveCloudConnection(): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator.onLine || !auth.currentUser) return false;
  try {
    const [companySnap, tombstoneSnap] = await Promise.all([
      getDocFromServer(doc(db, 'companies', COMPANY_DOC_ID)).catch(() => null),
      getDocFromServer(doc(db, 'settings', DELETED_TOMBSTONES_DOC_ID)).catch(() => null),
    ]);
    if (tombstoneSnap && tombstoneSnap.exists()) {
      mergeTombstonesFromRemote(tombstoneSnap.data() as TombstonesMap);
    }
    if (companySnap || tombstoneSnap) {
      recordSuccessfulCloudSync(undefined, 0);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getStoredNotificationControl(): NotificationControl {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_CONTROL;
  try {
    const raw = window.localStorage.getItem(LOCAL_NOTIF_CONTROL_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_CONTROL;
    const parsed = JSON.parse(raw) as Partial<NotificationControl>;
    return {
      clearedAt: parsed.clearedAt || '',
      clearedBy: parsed.clearedBy || '',
      clearedKeys: Array.isArray(parsed.clearedKeys) ? parsed.clearedKeys : [],
      updatedAt: parsed.updatedAt || ''
    };
  } catch {
    return DEFAULT_NOTIFICATION_CONTROL;
  }
}

function saveStoredNotificationControl(ctrl: NotificationControl): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_NOTIF_CONTROL_KEY, JSON.stringify(ctrl));
  } catch {
    // ignore storage quota errors
  }
}

export const DEFAULT_WHATSAPP_GROUP_CONFIG: WhatsAppGroupConfig = {
  groupName: 'DIP BHOLA NETWORK - Complain Group',
  groupInviteLink: '',
  staffGroupName: 'DIP BHOLA NETWORK - Staff Team',
  staffGroupInviteLink: '',
  partnerGroupName: 'DIP BHOLA NETWORK - Share Partners',
  partnerGroupInviteLink: '',
  smsAlertPhone: '',
  autoOpenWhatsAppOnSubmit: true,
  webhookUrl: ''
};

export const DEFAULT_DIGITAL_NOTICE: DigitalNotice = {
  text: 'স্বাগতম! DIP BHOLA NETWORK কেন্দ্রীয় সার্ভার ও হাই-স্পিড অপটিক্যাল ফাইবার সংযোগ',
  subText: 'লাইভ মনিটরিং সক্রিয় • যেকোনো জরুরি লাইন মেইনটেন্যান্স ও সহায়তায় যোগাযোগ করুন: ০১৭২১২০০০৪৯ (২৪ ঘণ্টা সেবা চালু)',
  showClock: true,
  fontSize: 'large',
  color: 'emerald',
  mode: 'scroll',
  speed: 'slow',
  customSpeedPxPerSec: 22,
  pauseOnHover: true,
  showRow3Notifications: true,
  row3FontSize: 'large',
  row3Mode: 'slow_scroll',
  row3SpeedPxPerSec: 16,
  row3SlideIntervalSec: 6,
  active: true,
  updatedAt: new Date().toISOString(),
  updatedBy: 'জাহিদুল ইসলাম (পরিচালক)'
};

// Auth check/init helper
export async function ensureAuth(): Promise<void> {
  ensureTombstoneSyncListener();
  return Promise.resolve();
}

// Subscribe to transactions (with instant localStorage cache + live offline pending-sync merge & metadata detection)
export function subscribeTransactions(callback: (transactions: Transaction[]) => void) {
  ensureAuth();
  let lastSnapshotList: Transaction[] = getCachedData<Transaction[]>(CACHE_KEYS.TRANSACTIONS, []);

  const mergeAndFormat = (baseList: Transaction[]) => {
    const queuedDocs = getOfflineQueuedDocsForCollection<Transaction>('transactions');
    const deletedIds = getOfflineDeletedIdsForCollection('transactions');
    const byId = new Map<string, Transaction>();

    baseList.forEach((tx) => {
      if (!deletedIds.has(tx.id)) {
        byId.set(tx.id, tx);
      }
    });
    queuedDocs.forEach((qTx) => {
      if (!deletedIds.has(qTx.id)) {
        const existing = byId.get(qTx.id);
        byId.set(qTx.id, { ...(existing || {}), ...qTx, _pendingSync: true });
      }
    });

    return Array.from(byId.values())
      .map((tx) => {
        const normalizedDate = getTransactionDateKey(tx) || getTodayString();
        return tx.date === normalizedDate ? tx : { ...tx, date: normalizedDate };
      })
      .sort((a, b) => {
        const dateCmp = (b.date || '').localeCompare(a.date || '');
        if (dateCmp !== 0) return dateCmp;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
  };

  // Emit cached data synchronously first so screen renders instantaneously
  if (lastSnapshotList.length > 0) {
    callback(mergeAndFormat(lastSnapshotList));
  }

  const emitMerged = (persist = false) => {
    const merged = mergeAndFormat(lastSnapshotList);
    if (persist) {
      setCachedData(CACHE_KEYS.TRANSACTIONS, lastSnapshotList);
    }
    callback(merged);
  };

  let hadServerEmit = false;
  const unsubSnap = onSnapshot(
    collection(db, 'transactions'),
    (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((d) => {
        list.push({
          ...d.data(),
          id: d.id,
          _pendingSync: d.metadata.hasPendingWrites
        } as Transaction);
      });
      const prevLen = lastSnapshotList.length;
      lastSnapshotList = list;
      if (!snapshot.metadata.fromCache) {
        hadServerEmit = true;
        recordSuccessfulCloudSync();
      }
      emitMerged(!snapshot.metadata.fromCache || prevLen === 0 || !hadServerEmit);
    },
    (err) => {
      handleFirestoreError(err, 'subscribeTransactions', OperationType.LIST, 'transactions');
      emitMerged(false);
    }
  );

  const unsubOffline = subscribeOfflineSyncState(() => {
    emitMerged(false);
  });

  return () => {
    unsubSnap();
    unsubOffline();
  };
}

// Subscribe to staff members (instant localStorage cache + offline-safe & tombstone-filtered)
export function subscribeStaffs(callback: (staffs: Staff[]) => void) {
  ensureAuth();
  let lastSnapshotList: Staff[] = getCachedData<Staff[]>(CACHE_KEYS.STAFFS, []);

  const emitMerged = (persist = false) => {
    const queuedDocs = getOfflineQueuedDocsForCollection<Staff>('staffs');
    const deletedIds = getOfflineDeletedIdsForCollection('staffs');
    const byId = new Map<string, Staff>();

    lastSnapshotList.forEach((s) => {
      if (!deletedIds.has(s.id)) byId.set(s.id, s);
    });
    queuedDocs.forEach((qStaff) => {
      if (!deletedIds.has(qStaff.id)) {
        byId.set(qStaff.id, { ...(byId.get(qStaff.id) || {}), ...qStaff });
      }
    });
    if (persist) setCachedData(CACHE_KEYS.STAFFS, lastSnapshotList);
    callback(Array.from(byId.values()));
  };

  if (lastSnapshotList.length > 0) emitMerged(false);

  const unsubSnap = onSnapshot(
    collection(db, 'staffs'),
    (snapshot) => {
      const list: Staff[] = [];
      snapshot.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as Staff);
      });
      lastSnapshotList = list;
      if (!snapshot.metadata.fromCache) {
        recordSuccessfulCloudSync();
      }
      emitMerged(true);
    },
    (err) => {
      handleFirestoreError(err, 'subscribeStaffs');
      emitMerged(false);
    }
  );

  const unsubOffline = subscribeOfflineSyncState(() => {
    emitMerged(false);
  });

  return () => {
    unsubSnap();
    unsubOffline();
  };
}

// Subscribe to partners (instant localStorage cache + offline-safe & tombstone-filtered)
export function subscribePartners(callback: (partners: Partner[]) => void) {
  ensureAuth();
  let lastSnapshotList: Partner[] = getCachedData<Partner[]>(CACHE_KEYS.PARTNERS, []);

  const emitMerged = (persist = false) => {
    const queuedDocs = getOfflineQueuedDocsForCollection<Partner>('partners');
    const deletedIds = getOfflineDeletedIdsForCollection('partners');
    const byId = new Map<string, Partner>();

    lastSnapshotList.forEach((p) => {
      if (!deletedIds.has(p.id)) byId.set(p.id, p);
    });
    queuedDocs.forEach((qPartner) => {
      if (!deletedIds.has(qPartner.id)) {
        byId.set(qPartner.id, { ...(byId.get(qPartner.id) || {}), ...qPartner });
      }
    });

    if (persist) setCachedData(CACHE_KEYS.PARTNERS, lastSnapshotList);
    const list = Array.from(byId.values()).sort((a, b) => b.investment - a.investment);
    callback(list);
  };

  if (lastSnapshotList.length > 0) emitMerged(false);

  const unsubSnap = onSnapshot(
    collection(db, 'partners'),
    (snapshot) => {
      const list: Partner[] = [];
      snapshot.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as Partner);
      });
      lastSnapshotList = list;
      if (!snapshot.metadata.fromCache) {
        recordSuccessfulCloudSync();
      }
      emitMerged(true);
    },
    (err) => {
      handleFirestoreError(err, 'subscribePartners');
      emitMerged(false);
    }
  );

  const unsubOffline = subscribeOfflineSyncState(() => {
    emitMerged(false);
  });

  return () => {
    unsubSnap();
    unsubOffline();
  };
}

let legacyPortalMigrationDone = false;

function normalizeCompanyRecord(
  raw: Company & { membersDirectoryUrl?: string; oltManagementUrl?: string }
): {
  company: Company;
  hadLegacyFields: boolean;
  wasMissingTroubleshootUrl: boolean;
} {
  const hadLegacyFields = 'membersDirectoryUrl' in raw || 'oltManagementUrl' in raw;
  const {
    membersDirectoryUrl: _legacyMemberUrl,
    oltManagementUrl: _legacyOltUrl,
    ...cleanRaw
  } = raw;
  const parsedTroubleshootUrl = normalizePortalHttpUrl(cleanRaw.troubleshootPortalUrl);
  const wasLegacyTroubleshootUrl = isLegacyTroubleshootPortalUrl(parsedTroubleshootUrl);
  const wasMissingTroubleshootUrl = !parsedTroubleshootUrl || wasLegacyTroubleshootUrl;
  const effectiveTroubleshootUrl =
    !parsedTroubleshootUrl || wasLegacyTroubleshootUrl
      ? DEFAULT_TROUBLESHOOT_PORTAL_URL
      : parsedTroubleshootUrl;
  const normalizedLogo =
    !cleanRaw.logoUrl || cleanRaw.logoUrl.includes('dip-bhola-logo.svg')
      ? '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg'
      : cleanRaw.logoUrl;

  return {
    company: {
      ...cleanRaw,
      troubleshootPortalUrl: effectiveTroubleshootUrl,
      logoUrl: normalizedLogo
    },
    hadLegacyFields,
    wasMissingTroubleshootUrl
  };
}

// Subscribe to company info (with instant localStorage cache & auto-migration)
export function subscribeCompany(callback: (company: Company | null) => void) {
  ensureAuth();
  const cached = getCachedData<
    (Company & { membersDirectoryUrl?: string; oltManagementUrl?: string }) | null
  >(CACHE_KEYS.COMPANY, null);
  if (cached) {
    const { company: normalizedCached, hadLegacyFields, wasMissingTroubleshootUrl } =
      normalizeCompanyRecord(cached);
    if (hadLegacyFields || wasMissingTroubleshootUrl) {
      setCachedData(CACHE_KEYS.COMPANY, normalizedCached);
    }
    callback(normalizedCached);
  }

  return onSnapshot(
    doc(db, 'companies', COMPANY_DOC_ID),
    (snapshot) => {
      if (!snapshot.metadata.fromCache) {
        recordSuccessfulCloudSync();
      }
      if (snapshot.exists()) {
        const raw = snapshot.data() as Company & {
          membersDirectoryUrl?: string;
          oltManagementUrl?: string;
        };
        const { company: data, hadLegacyFields, wasMissingTroubleshootUrl } =
          normalizeCompanyRecord(raw);

        setCachedData(CACHE_KEYS.COMPANY, data);
        callback(data);

        // One-time auto-cleanup: strip legacy Web Billing / OLT fields, obsolete docs, and migrate old portal URL
        if (!legacyPortalMigrationDone) {
          legacyPortalMigrationDone = true;
          if (hadLegacyFields || wasMissingTroubleshootUrl) {
            setDoc(
              doc(db, 'companies', COMPANY_DOC_ID),
              {
                troubleshootPortalUrl: data.troubleshootPortalUrl,
                membersDirectoryUrl: deleteField(),
                oltManagementUrl: deleteField(),
                updatedAt: new Date().toISOString()
              },
              { merge: true }
            ).catch(() => {});
          }
          deleteDoc(doc(db, 'settings', 'portal_summary')).catch(() => {});
          deleteDoc(doc(db, 'settings', 'portal_session_vault')).catch(() => {});
          deleteDoc(doc(db, 'settings', 'billing_portal')).catch(() => {});
          deleteDoc(doc(db, 'settings', 'web_billing')).catch(() => {});
          deleteDoc(doc(db, 'settings', 'olt_portal')).catch(() => {});
        }
      } else {
        callback(null);
      }
    },
    (err) => {
      handleFirestoreError(err, 'subscribeCompany');
    }
  );
}

// Subscribe to customer dues (instant localStorage cache + offline-safe & tombstone-filtered)
export function subscribeCustomerDues(callback: (dues: CustomerDue[]) => void) {
  ensureAuth();
  let lastSnapshotList: CustomerDue[] = getCachedData<CustomerDue[]>(CACHE_KEYS.CUSTOMER_DUES, []);

  const emitMerged = (persist = false) => {
    const queuedDocs = getOfflineQueuedDocsForCollection<CustomerDue>('customerDues');
    const deletedIds = getOfflineDeletedIdsForCollection('customerDues');
    const byId = new Map<string, CustomerDue>();

    lastSnapshotList.forEach((d) => {
      if (!deletedIds.has(d.id)) byId.set(d.id, d);
    });
    queuedDocs.forEach((qDue) => {
      if (!deletedIds.has(qDue.id)) {
        byId.set(qDue.id, { ...(byId.get(qDue.id) || {}), ...qDue });
      }
    });
    const mergedList = Array.from(byId.values());
    if (persist) setCachedData(CACHE_KEYS.CUSTOMER_DUES, mergedList);
    callback(mergedList);
  };

  if (lastSnapshotList.length > 0) emitMerged(false);

  const unsubSnap = onSnapshot(
    collection(db, 'customerDues'),
    (snapshot) => {
      const list: CustomerDue[] = [];
      snapshot.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as CustomerDue);
      });
      lastSnapshotList = list;
      if (!snapshot.metadata.fromCache) {
        recordSuccessfulCloudSync();
      }
      emitMerged(true);
    },
    (err) => {
      handleFirestoreError(err, 'subscribeCustomerDues');
      emitMerged(false);
    }
  );

  const unsubOffline = subscribeOfflineSyncState(() => {
    emitMerged(false);
  });

  return () => {
    unsubSnap();
    unsubOffline();
  };
}

// Subscribe to settings (with localStorage cache)
export function subscribeSettings(callback: (settings: AdminAuth | null) => void) {
  ensureAuth();
  const cached = getCachedData<AdminAuth | null>(CACHE_KEYS.SETTINGS, null);
  if (cached) callback(cached);

  return onSnapshot(
    doc(db, 'settings', SETTINGS_DOC_ID),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as AdminAuth;
        setCachedData(CACHE_KEYS.SETTINGS, data);
        callback(data);
      } else {
        callback(null);
      }
    },
    (err) => {
      handleFirestoreError(err, 'subscribeSettings');
    }
  );
}

// Subscribe to Digital Display Notice (with localStorage cache)
export function subscribeDigitalNotice(callback: (notice: DigitalNotice) => void) {
  ensureAuth();
  const cached = getCachedData<DigitalNotice | null>(CACHE_KEYS.DIGITAL_NOTICE, null);
  if (cached) callback(cached);

  return onSnapshot(
    doc(db, 'settings', NOTICE_DOC_ID),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as DigitalNotice;
        setCachedData(CACHE_KEYS.DIGITAL_NOTICE, data);
        callback(data);
      } else {
        callback(DEFAULT_DIGITAL_NOTICE);
      }
    },
    (err) => {
      handleFirestoreError(err, 'subscribeDigitalNotice');
      callback(cached || DEFAULT_DIGITAL_NOTICE);
    }
  );
}

export async function saveDigitalNotice(notice: Partial<DigitalNotice>) {
  await ensureAuth();
  await setDoc(
    doc(db, 'settings', NOTICE_DOC_ID),
    stripUndefined({
      ...notice,
      updatedAt: new Date().toISOString()
    }),
    { merge: true }
  );
}

// Subscribe to Cloud App Release (Real-time Auto-Update Sync from AI Studio)
export function subscribeAppRelease(callback: (release: AppReleaseInfo | null) => void) {
  ensureAuth();
  return onSnapshot(
    doc(db, 'settings', APP_RELEASE_DOC_ID),
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as AppReleaseInfo);
      } else {
        callback(null);
      }
    },
    (err) => {
      handleFirestoreError(err, 'subscribeAppRelease');
      callback(null);
    }
  );
}

export async function publishAppRelease(release: AppReleaseInfo) {
  await ensureAuth();
  await setDoc(
    doc(db, 'settings', APP_RELEASE_DOC_ID),
    stripUndefined({
      ...release,
      updatedAt: new Date().toISOString()
    }),
    { merge: true }
  );
}

// Subscribe & Save WhatsApp SMS Group Settings for Complain, Staff & Share Partner Joining
export function subscribeWhatsAppGroupConfig(callback: (config: WhatsAppGroupConfig) => void) {
  ensureAuth();
  return onSnapshot(
    doc(db, 'settings', WHATSAPP_GROUP_DOC_ID),
    (snapshot) => {
      if (snapshot.exists()) {
        callback({ ...DEFAULT_WHATSAPP_GROUP_CONFIG, ...(snapshot.data() as Partial<WhatsAppGroupConfig>) });
      } else {
        callback(DEFAULT_WHATSAPP_GROUP_CONFIG);
      }
    },
    (err) => {
      handleFirestoreError(err, 'subscribeWhatsAppGroupConfig');
      callback(DEFAULT_WHATSAPP_GROUP_CONFIG);
    }
  );
}

export async function saveWhatsAppGroupConfig(config: Partial<WhatsAppGroupConfig>) {
  await ensureAuth();
  await commitDocOfflineSafe(
    'settings',
    WHATSAPP_GROUP_DOC_ID,
    stripUndefined({
      ...config,
      updatedAt: new Date().toISOString()
    }),
    true
  );
}

// Subscribe & Save Global Installed App Portal Control (delete/hide/add/link portals across all installed apps)
export function getStoredPortalControl(): PortalControlConfig {
  if (typeof window === 'undefined') return DEFAULT_PORTAL_CONTROL;
  try {
    const raw = window.localStorage.getItem(LOCAL_PORTAL_CONTROL_KEY);
    if (!raw) return DEFAULT_PORTAL_CONTROL;
    const parsed = JSON.parse(raw) as Partial<PortalControlConfig>;
    return {
      deletedPortalIds: Array.isArray(parsed.deletedPortalIds) ? parsed.deletedPortalIds : [],
      disabledPortalIds: Array.isArray(parsed.disabledPortalIds) ? parsed.disabledPortalIds : [],
      customPortals: Array.isArray(parsed.customPortals) ? parsed.customPortals : [],
      portalOverrides:
        parsed.portalOverrides && typeof parsed.portalOverrides === 'object'
          ? parsed.portalOverrides
          : {},
      updatedAt: parsed.updatedAt || '',
      updatedBy: parsed.updatedBy
    };
  } catch {
    return DEFAULT_PORTAL_CONTROL;
  }
}

function saveStoredPortalControl(ctrl: PortalControlConfig): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_PORTAL_CONTROL_KEY, JSON.stringify(ctrl));
  } catch {
    // ignore storage errors
  }
}

export function subscribePortalControl(callback: (ctrl: PortalControlConfig) => void) {
  ensureAuth();
  const cached = getStoredPortalControl();
  if (cached.updatedAt || cached.deletedPortalIds.length > 0 || cached.customPortals.length > 0) {
    callback(cached);
  }
  return onSnapshot(
    doc(db, 'settings', PORTAL_CONTROL_DOC_ID),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Partial<PortalControlConfig>;
        const normalized: PortalControlConfig = {
          deletedPortalIds: Array.isArray(data.deletedPortalIds) ? data.deletedPortalIds : [],
          disabledPortalIds: Array.isArray(data.disabledPortalIds) ? data.disabledPortalIds : [],
          customPortals: Array.isArray(data.customPortals) ? data.customPortals : [],
          portalOverrides:
            data.portalOverrides && typeof data.portalOverrides === 'object'
              ? data.portalOverrides
              : {},
          updatedAt: data.updatedAt || '',
          updatedBy: data.updatedBy
        };
        saveStoredPortalControl(normalized);
        callback(normalized);
      } else {
        callback(cached || DEFAULT_PORTAL_CONTROL);
      }
    },
    (err) => {
      handleFirestoreError(err, 'subscribePortalControl', OperationType.GET, `settings/${PORTAL_CONTROL_DOC_ID}`);
      callback(cached || DEFAULT_PORTAL_CONTROL);
    }
  );
}

export async function savePortalControl(config: PortalControlConfig): Promise<PortalControlConfig> {
  await ensureAuth();
  const payload: PortalControlConfig = stripUndefined({
    deletedPortalIds: Array.from(new Set(config.deletedPortalIds || [])),
    disabledPortalIds: Array.from(new Set(config.disabledPortalIds || [])),
    customPortals: config.customPortals || [],
    portalOverrides: config.portalOverrides || {},
    updatedAt: new Date().toISOString(),
    updatedBy: config.updatedBy
  });
  saveStoredPortalControl(payload);
  await setDoc(doc(db, 'settings', PORTAL_CONTROL_DOC_ID), payload);
  return payload;
}

// Helper: Check if a notification item was cleared/deleted globally by Admin
export function isNotificationCleared(
  key: string,
  itemTimestamp?: string | null,
  control?: NotificationControl | null
): boolean {
  if (!control || !control.clearedAt) return false;
  if (Array.isArray(control.clearedKeys) && control.clearedKeys.includes(key)) {
    if (!itemTimestamp) return true;
    return itemTimestamp <= control.clearedAt;
  }
  if (itemTimestamp && itemTimestamp <= control.clearedAt) {
    return true;
  }
  return false;
}

// Subscribe to Cloud Notification Control (Admin Delete All Notifications sync with localStorage shield)
export function subscribeNotificationControl(callback: (control: NotificationControl) => void) {
  ensureAuth();
  const path = `settings/${NOTIFICATION_CONTROL_DOC_ID}`;
  const initialLocal = getStoredNotificationControl();
  if (initialLocal.updatedAt || initialLocal.clearedAt) {
    callback(initialLocal);
  }

  return onSnapshot(
    doc(db, 'settings', NOTIFICATION_CONTROL_DOC_ID),
    (snapshot) => {
      const localCtrl = getStoredNotificationControl();
      const hasPendingLocalWrite = getOfflineQueue().some(
        (q) => q.collectionName === 'settings' && q.docId === NOTIFICATION_CONTROL_DOC_ID
      );

      if (snapshot.exists()) {
        const data = snapshot.data() as Partial<NotificationControl>;
        const serverCtrl: NotificationControl = {
          clearedAt: data.clearedAt || '',
          clearedBy: data.clearedBy || '',
          clearedKeys: Array.isArray(data.clearedKeys) ? data.clearedKeys : [],
          updatedAt: data.updatedAt || ''
        };

        // Keep newer local state if a local clear/restore hasn't finished syncing or has newer timestamp
        if (hasPendingLocalWrite || (localCtrl.updatedAt && serverCtrl.updatedAt && localCtrl.updatedAt > serverCtrl.updatedAt)) {
          callback(localCtrl);
          return;
        }

        // Preserve union of clearedKeys if both share or refine recent clears without a newer explicit restore
        if (serverCtrl.clearedAt && localCtrl.clearedAt && serverCtrl.clearedAt === localCtrl.clearedAt) {
          const mergedKeys = Array.from(new Set([...localCtrl.clearedKeys, ...serverCtrl.clearedKeys]));
          const mergedCtrl: NotificationControl = { ...serverCtrl, clearedKeys: mergedKeys };
          saveStoredNotificationControl(mergedCtrl);
          callback(mergedCtrl);
          return;
        }

        saveStoredNotificationControl(serverCtrl);
        callback(serverCtrl);
      } else {
        if (hasPendingLocalWrite || localCtrl.clearedAt) {
          callback(localCtrl);
        } else {
          callback(DEFAULT_NOTIFICATION_CONTROL);
        }
      }
    },
    (err) => {
      handleFirestoreError(err, 'subscribeNotificationControl', OperationType.GET, path);
      callback(getStoredNotificationControl());
    }
  );
}

// Admin-only: Clear/Delete ALL current notifications globally across all sessions & Digital Display Row 3
export async function clearAllNotificationsInCloud(
  clearedBy: string,
  keysToClear: string[]
): Promise<NotificationControl> {
  await ensureAuth();
  const path = `settings/${NOTIFICATION_CONTROL_DOC_ID}`;
  const nowIso = new Date().toISOString();
  const existingLocal = getStoredNotificationControl();
  const boundedKeys = Array.from(
    new Set([
      ...(Array.isArray(existingLocal.clearedKeys) ? existingLocal.clearedKeys : []),
      ...keysToClear.filter((k) => typeof k === 'string' && k.length > 0)
    ])
  ).slice(-600);

  const payload: NotificationControl = {
    clearedAt: nowIso,
    clearedBy,
    clearedKeys: boundedKeys,
    updatedAt: nowIso
  };

  // Persist locally synchronously BEFORE network call so offline/reconnect never revives deleted items
  saveStoredNotificationControl(payload);

  try {
    await commitDocOfflineSafe('settings', NOTIFICATION_CONTROL_DOC_ID, payload, false);
    return payload;
  } catch (err) {
    handleFirestoreError(err, 'clearAllNotificationsInCloud', OperationType.WRITE, path);
    return payload;
  }
}

// Admin-only: Restore previously cleared notifications
export async function restoreNotificationsInCloud(restoredBy: string): Promise<NotificationControl> {
  await ensureAuth();
  const path = `settings/${NOTIFICATION_CONTROL_DOC_ID}`;
  const payload: NotificationControl = {
    clearedAt: '',
    clearedBy: restoredBy,
    clearedKeys: [],
    updatedAt: new Date().toISOString()
  };
  saveStoredNotificationControl(payload);
  try {
    await commitDocOfflineSafe('settings', NOTIFICATION_CONTROL_DOC_ID, payload, false);
    return payload;
  } catch (err) {
    handleFirestoreError(err, 'restoreNotificationsInCloud', OperationType.WRITE, path);
    return payload;
  }
}

export const DEFAULT_OFFICERS: OfficersState = {
  manager: {
    id: 'off-mgr-1',
    type: 'manager',
    name: 'মোঃ সাইফুল ইসলাম',
    designation: 'শাখা ও জেনারেল ম্যানেজার',
    phone: '01712345678',
    email: 'manager.dipbhola@gmail.com',
    nid: '19920911855000123',
    fatherName: 'মোঃ আব্দুল মান্নান',
    motherName: 'মোসাঃ রাশিদা বেগম',
    address: 'জাংগালিয়া মিঝি বাড়ি, ৩নং পশ্চিম ইলিশা, ভোলা সদর, ভোলা',
    permanentAddress: 'জাংগালিয়া মিঝি বাড়ি, ৩নং পশ্চিম ইলিশা, ভোলা সদর, ভোলা',
    education: 'স্নাতকোত্তর (মাস্টার্স)',
    appointmentDate: '2026-01-01',
    salaryOrFee: 15000,
    scopeOfWork: 'শাখার সকল ক্লায়েন্ট সংযোগ, দৈনিক ক্যাশ কালেকশন তদারকি, লাইনম্যান ও টেকনিশিয়ানদের কর্মবণ্টন এবং কেন্দ্রীয় বিলিং ব্যবস্থাপনা।',
    status: 'active',
    appointedBy: 'জাহিদুল ইসলাম (প্রধান পরিচালক)',
    terms: [
      'শাখার সার্বিক পরিচালনা, কর্মী মনিটরিং ও দৈনিক কালেকশন তত্ত্বাবধান করবেন।',
      'প্রতিদিনের আয়-ব্যয় কেন্দ্রীয় ক্যাশ খাতায় নির্ভুলভাবে এন্ট্রি নিশ্চিত করবেন।',
      'গ্রাহক সেবা, অভিযোগ নিস্পত্তি ও জরুরি লাইন মেরামতে সার্বক্ষণিক সক্রিয় থাকবেন।'
    ],
    updatedAt: new Date().toISOString()
  },
  auditor: {
    id: 'off-aud-1',
    type: 'auditor',
    name: 'মোঃ কাওসার আহমেদ',
    designation: 'অভ্যন্তরীণ হিসাব নিরীক্ষক (অডিট কর্মকর্তা)',
    phone: '01812345678',
    email: 'auditor.dipbhola@gmail.com',
    nid: '19890911855000456',
    fatherName: 'মরহুম মোঃ সামসুল হক',
    motherName: 'মোসাঃ সালেহা বেগম',
    address: 'ভোলা সদর, ভোলা',
    permanentAddress: 'ভোলা সদর, ভোলা',
    education: 'এম.কম (অ্যাকাউন্টিং) / সিএ সিসি',
    appointmentDate: '2026-01-01',
    salaryOrFee: 6000,
    scopeOfWork: 'মাসিক সকল খরচের ভাউচার নিরীক্ষণ, ক্যাশ ও ব্যাংক হিসাব প্রতিপাদন, অডিট রিপোর্ট প্রণয়ন ও আর্থিক স্বচ্ছতা নিশ্চিতকরণ।',
    status: 'active',
    appointedBy: 'জাহিদুল ইসলাম (প্রধান পরিচালক)',
    terms: [
      'প্রতি মাসের হিসাব ও ব্যয় ভাউচার স্বাধীন ও নিরপেক্ষভাবে নিরীক্ষা করবেন।',
      'আর্থিক কোনো অসঙ্গতি বা ঘাটতি পরিলক্ষিত হলে তাৎক্ষণিক লিখিতভাবে পরিচালককে অবহিত করবেন।',
      'মাসিক আর্থিক বিবরণীতে নিরীক্ষা প্রত্যয়ন ও বৈধ স্বাক্ষর প্রদান করবেন।'
    ],
    updatedAt: new Date().toISOString()
  },
  history: []
};

// Subscribe to Appointed Officers (Manager & Auditor)
export function subscribeOfficers(callback: (officers: OfficersState) => void) {
  ensureAuth();
  return onSnapshot(
    doc(db, 'settings', OFFICERS_DOC_ID),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as OfficersState;
        callback({
          manager: data.manager || DEFAULT_OFFICERS.manager,
          auditor: data.auditor || DEFAULT_OFFICERS.auditor,
          history: data.history || []
        });
      } else {
        callback(DEFAULT_OFFICERS);
      }
    },
    (err) => {
      handleFirestoreError(err, 'subscribeOfficers');
      callback(DEFAULT_OFFICERS);
    }
  );
}

// Save complete officers state
export async function saveOfficers(officers: OfficersState) {
  await ensureAuth();
  await setDoc(
    doc(db, 'settings', OFFICERS_DOC_ID),
    officers,
    { merge: true }
  );
}

// Appoint or Change Officer (Manager or Auditor) with automatic history tracking
export async function appointOfficer(
  type: 'manager' | 'auditor',
  newOfficerData: Omit<AppointedOfficer, 'id' | 'status' | 'updatedAt'>,
  currentOfficers: OfficersState
) {
  await ensureAuth();
  const currentActive = type === 'manager' ? currentOfficers.manager : currentOfficers.auditor;

  const previousOfficerRecord: AppointedOfficer = {
    ...currentActive,
    status: 'previous',
    updatedAt: new Date().toISOString()
  };

  const newOfficer: AppointedOfficer = {
    ...newOfficerData,
    id: `off-${type}-${Date.now()}`,
    type,
    status: 'active',
    updatedAt: new Date().toISOString()
  };

  const updatedHistory = [
    previousOfficerRecord,
    ...(currentOfficers.history || [])
  ];

  const updatedState: OfficersState = {
    ...currentOfficers,
    [type]: newOfficer,
    history: updatedHistory
  };

  await setDoc(
    doc(db, 'settings', OFFICERS_DOC_ID),
    updatedState,
    { merge: true }
  );
  return newOfficer;
}


// Transaction operations (Offline-safe with instant local save & auto-online sync)
export async function addTransaction(tx: Omit<Transaction, 'id' | 'createdAt'> & { id?: string }) {
  await ensureAuth();
  const txId = tx.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const nowIso = new Date().toISOString();
  const normalizedDate = getTransactionDateKey({ date: tx.date, createdAt: nowIso }) || getTodayString();
  const normalizedAmount = parseNumericInput(tx.amount);
  const fullTx = stripUndefined({
    ...tx,
    id: txId,
    addedByUid: tx.addedByUid || auth.currentUser?.uid || undefined,
    date: normalizedDate,
    amount: normalizedAmount,
    createdAt: nowIso
  }) as Transaction;
  const res = await commitDocOfflineSafe('transactions', txId, fullTx, false);
  return { ...fullTx, _pendingSync: !res.syncedOnline };
}

export async function updateTransaction(id: string, updates: Partial<Transaction>) {
  await ensureAuth();
  await commitDocOfflineSafe('transactions', id, stripUndefined(updates), true);
}

export async function deleteTransaction(id: string) {
  await ensureAuth();
  await deleteDocOfflineSafe('transactions', id);
}

// Staff operations
export async function addStaff(staff: Staff) {
  await ensureAuth();
  const id = staff.id || `staff-${Date.now()}`;
  const fullStaff = stripUndefined({ ...staff, id }) as Staff;
  await commitDocOfflineSafe('staffs', id, fullStaff, false);
  return fullStaff;
}

export async function updateStaff(id: string, updates: Partial<Staff>) {
  await ensureAuth();
  await commitDocOfflineSafe('staffs', id, stripUndefined(updates), true);
}

export async function deleteStaff(id: string) {
  await ensureAuth();
  await deleteDocOfflineSafe('staffs', id);
}

// Partner operations
export async function addPartner(partner: Partner) {
  await ensureAuth();
  const id = partner.id || `partner-${Date.now()}`;
  const fullPartner = stripUndefined({ ...partner, id }) as Partner;
  await commitDocOfflineSafe('partners', id, fullPartner, false);
  return fullPartner;
}

export async function updatePartner(id: string, updates: Partial<Partner>) {
  await ensureAuth();
  await commitDocOfflineSafe('partners', id, stripUndefined(updates), true);
}

export async function deletePartner(id: string) {
  await ensureAuth();
  await deleteDocOfflineSafe('partners', id);
}

export async function addPartnerInvestment(partnerId: string, partner: Partner, amount: number, note: string, date: string) {
  await ensureAuth();
  const invRecord = {
    id: `inv-${Date.now()}`,
    date,
    amount,
    note
  };
  const newHistory = [...(partner.investmentHistory || []), invRecord];
  const newTotalInvestment = partner.investment + amount;
  await setDoc(doc(db, 'partners', partnerId), stripUndefined({
    investment: newTotalInvestment,
    investmentHistory: newHistory
  }), { merge: true });
}

// Customer Dues operations
export async function addCustomerDue(due: Omit<CustomerDue, 'id' | 'updatedAt'> & { id?: string }) {
  await ensureAuth();
  const id = due.id || `due-${Date.now()}`;
  const fullDue = stripUndefined({
    ...due,
    id,
    updatedAt: new Date().toISOString()
  }) as CustomerDue;
  await commitDocOfflineSafe('customerDues', id, fullDue, false);
  return fullDue;
}

export async function updateCustomerDue(id: string, updates: Partial<CustomerDue>) {
  await ensureAuth();
  await commitDocOfflineSafe('customerDues', id, stripUndefined({
    ...updates,
    updatedAt: new Date().toISOString()
  }), true);
}

export async function deleteCustomerDue(id: string) {
  await ensureAuth();
  await deleteDocOfflineSafe('customerDues', id);
}

/**
 * Permanently deletes ALL customer dues from local cache, offline queue, IndexedDB, and Firestore.
 */
export async function deleteAllCustomerDues(knownIds: string[] = []): Promise<number> {
  await ensureAuth();

  const idSet = new Set<string>(knownIds.filter((id) => typeof id === 'string' && id.length > 0));
  getOfflineQueuedDocsForCollection<CustomerDue>('customerDues').forEach((d) => {
    if (d.id) idSet.add(d.id);
  });

  try {
    const cacheSnap = await getDocs(collection(db, 'customerDues'));
    cacheSnap.forEach((d) => idSet.add(d.id));
  } catch {
    // ignore cache read error
  }

  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const serverSnap = await Promise.race([
        getDocsFromServer(collection(db, 'customerDues')),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
      ]);
      if (serverSnap) {
        serverSnap.forEach((d) => idSet.add(d.id));
      }
    } catch {
      // fallback to offline queued deletes
    }
  }

  const allIds = Array.from(idSet);
  purgeOfflineCollectionWrites('customerDues');
  setCachedData(CACHE_KEYS.CUSTOMER_DUES, []);

  if (allIds.length === 0) {
    return 0;
  }

  const updatedTombstones = addTombstonesBulk('customerDues', allIds);
  const tombstonePayload = {
    customerDues: updatedTombstones.customerDues || allIds.slice(-2500),
    updatedAt: new Date().toISOString()
  };

  enqueueOfflineWrite({
    docId: DELETED_TOMBSTONES_DOC_ID,
    collectionName: 'settings',
    op: 'set',
    merge: true,
    data: tombstonePayload,
    queuedAt: new Date().toISOString()
  });

  setDoc(doc(db, 'settings', DELETED_TOMBSTONES_DOC_ID), tombstonePayload, { merge: true })
    .then(() => {
      removeOfflineWrite('settings', DELETED_TOMBSTONES_DOC_ID);
    })
    .catch(() => {});

  enqueueOfflineDeletesBulk('customerDues', allIds);

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (isOnline) {
    for (let i = 0; i < allIds.length; i += 400) {
      const chunk = allIds.slice(i, i + 400);
      try {
        const batch = writeBatch(db);
        chunk.forEach((id) => {
          batch.delete(doc(db, 'customerDues', id));
        });
        const commitPromise = batch.commit().then(() => {
          removeOfflineWritesBulk('customerDues', chunk);
        });
        await Promise.race([
          commitPromise,
          new Promise<void>((resolve) => setTimeout(resolve, 6000))
        ]);
      } catch (err) {
        handleFirestoreError(err, 'deleteAllCustomerDues', OperationType.DELETE, 'customerDues');
      }
    }
  }

  return allIds.length;
}

// ==========================================
// Customers / Members Directory Operations
// (গ্রাহক ও সদস্য তালিকা — লাইন সমস্যায় সদস্য নাম্বার সার্চে অটো-ফিল)
// ==========================================
const customerMemberIdCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function subscribeCustomers(callback: (customers: CustomerMember[]) => void) {
  ensureAuth();
  let lastSnapshotList: CustomerMember[] = getCachedData<CustomerMember[]>(CACHE_KEYS.CUSTOMERS, []);

  const emitMerged = (persist = false) => {
    const queuedDocs = getOfflineQueuedDocsForCollection<CustomerMember>('customers');
    const deletedIds = getOfflineDeletedIdsForCollection('customers');
    const byId = new Map<string, CustomerMember>();

    lastSnapshotList.forEach((c) => {
      if (!deletedIds.has(c.id)) {
        byId.set(c.id, c);
      }
    });
    queuedDocs.forEach((qCust) => {
      if (!deletedIds.has(qCust.id)) {
        const existing = byId.get(qCust.id);
        byId.set(qCust.id, { ...(existing || {}), ...qCust, _pendingSync: true });
      }
    });

    const merged = Array.from(byId.values()).sort((a, b) =>
      customerMemberIdCollator.compare(a.memberId || '', b.memberId || '')
    );

    if (persist) setCachedData(CACHE_KEYS.CUSTOMERS, merged);

    callback(merged);
  };

  if (lastSnapshotList.length > 0) emitMerged(false);

  let hadServerEmit = false;
  const unsubSnap = onSnapshot(
    collection(db, 'customers'),
    (snapshot) => {
      const list: CustomerMember[] = [];
      snapshot.forEach((d) => {
        list.push({
          ...d.data(),
          id: d.id,
          _pendingSync: d.metadata.hasPendingWrites
        } as CustomerMember);
      });
      const prevLen = lastSnapshotList.length;
      lastSnapshotList = list;
      if (!snapshot.metadata.fromCache) {
        hadServerEmit = true;
        recordSuccessfulCloudSync(undefined, 1500);
      }
      emitMerged(!snapshot.metadata.fromCache || prevLen === 0 || !hadServerEmit);
    },
    (err) => {
      handleFirestoreError(err, 'subscribeCustomers', OperationType.LIST, 'customers');
      emitMerged(false);
    }
  );

  const unsubOffline = subscribeOfflineSyncState(() => {
    emitMerged(false);
  });

  return () => {
    unsubSnap();
    unsubOffline();
  };
}

export async function addCustomer(
  customer: Omit<CustomerMember, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<CustomerMember> {
  await ensureAuth();
  const id = customer.id || `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const fullCustomer = stripUndefined({
    ...customer,
    id,
    memberId: (customer.memberId || '').trim(),
    name: (customer.name || '').trim(),
    phone: (customer.phone || '').trim(),
    address: (customer.address || '').trim(),
    status: customer.status || 'active',
    createdAt: now,
    updatedAt: now
  }) as CustomerMember;
  const res = await commitDocOfflineSafe('customers', id, fullCustomer, false);
  return { ...fullCustomer, _pendingSync: !res.syncedOnline };
}

export async function updateCustomer(id: string, updates: Partial<CustomerMember>): Promise<void> {
  await ensureAuth();
  await commitDocOfflineSafe(
    'customers',
    id,
    stripUndefined({
      ...updates,
      updatedAt: new Date().toISOString()
    }),
    true
  );
}

export async function deleteCustomer(id: string): Promise<void> {
  await ensureAuth();
  await deleteDocOfflineSafe('customers', id);
}

/**
 * Permanently deletes ALL customer records from local cache, offline queue, IndexedDB, and Firestore
 * so stale/old customers can be wiped cleanly before syncing fresh billing/OLT data.
 */
export async function deleteAllCustomers(knownIds: string[] = []): Promise<number> {
  await ensureAuth();

  const idSet = new Set<string>(knownIds.filter((id) => typeof id === 'string' && id.length > 0));
  getOfflineQueuedDocsForCollection<CustomerMember>('customers').forEach((c) => {
    if (c.id) idSet.add(c.id);
  });

  try {
    const cacheSnap = await getDocs(collection(db, 'customers'));
    cacheSnap.forEach((d) => idSet.add(d.id));
  } catch {
    // ignore cache read error
  }

  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const serverSnap = await Promise.race([
        getDocsFromServer(collection(db, 'customers')),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
      ]);
      if (serverSnap) {
        serverSnap.forEach((d) => idSet.add(d.id));
      }
    } catch {
      // fallback to offline queued deletes
    }
  }

  const allIds = Array.from(idSet);

  // 1. Purge queued offline writes for customers & wipe localStorage cache immediately
  purgeOfflineCollectionWrites('customers');
  setCachedData(CACHE_KEYS.CUSTOMERS, []);

  if (allIds.length === 0) {
    return 0;
  }

  // 2. Record tombstones so cached snapshots never resurrect old entries
  const updatedTombstones = addTombstonesBulk('customers', allIds);
  const tombstonePayload = {
    customers: updatedTombstones.customers || allIds.slice(-2500),
    updatedAt: new Date().toISOString()
  };

  enqueueOfflineWrite({
    docId: DELETED_TOMBSTONES_DOC_ID,
    collectionName: 'settings',
    op: 'set',
    merge: true,
    data: tombstonePayload,
    queuedAt: new Date().toISOString()
  });

  setDoc(doc(db, 'settings', DELETED_TOMBSTONES_DOC_ID), tombstonePayload, { merge: true })
    .then(() => {
      removeOfflineWrite('settings', DELETED_TOMBSTONES_DOC_ID);
    })
    .catch(() => {});

  // 3. Enqueue deletes synchronously so listeners drop all rows immediately
  enqueueOfflineDeletesBulk('customers', allIds);

  // 4. Delete from Firestore in chunks of 400 sequentially
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (isOnline) {
    for (let i = 0; i < allIds.length; i += 400) {
      const chunk = allIds.slice(i, i + 400);
      try {
        const batch = writeBatch(db);
        chunk.forEach((id) => {
          batch.delete(doc(db, 'customers', id));
        });
        const commitPromise = batch.commit().then(() => {
          removeOfflineWritesBulk('customers', chunk);
        });
        await Promise.race([
          commitPromise,
          new Promise<void>((resolve) => setTimeout(resolve, 6000))
        ]);
      } catch (err) {
        handleFirestoreError(err, 'deleteAllCustomers', OperationType.DELETE, 'customers');
      }
    }
  }

  return allIds.length;
}

/**
 * Bulk import/upsert customers from Excel sheet in deduplicated Firestore writeBatch chunks of 400.
 * Matches existing records by normalized memberId so re-importing updates rather than duplicating.
 */
export async function importCustomersBatch(
  entries: Array<Omit<CustomerMember, 'id' | 'createdAt' | 'updatedAt'>>,
  existingCustomers: CustomerMember[]
): Promise<{ addedCount: number; updatedCount: number; totalProcessed: number }> {
  await ensureAuth();
  if (!entries || entries.length === 0) {
    return { addedCount: 0, updatedCount: 0, totalProcessed: 0 };
  }

  const normalizeKey = (raw: string) => toEnglishDigits((raw || '').trim().toLowerCase());
  const isPlaceholder = (raw?: string) => {
    const t = (raw || '').trim().toLowerCase();
    return !t || t === '-' || t === '--' || t === '---' || t === 'n/a' || t === 'na' || t === 'null' || t === 'undefined';
  };
  const cleanField = (raw?: string) => (isPlaceholder(raw) ? '' : (raw || '').trim());
  const normMac = (raw?: string) => {
    const cleaned = (raw || '').trim().toUpperCase();
    if (!cleaned || isPlaceholder(cleaned)) return '';
    if (/^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/.test(cleaned)) return cleaned.replace(/-/g, ':');
    if (/^[0-9A-F]{12}$/.test(cleaned)) return cleaned.match(/.{2}/g)?.join(':') || cleaned;
    if (/^(?=.*\d)[A-Z0-9]{8,16}$/.test(cleaned)) return cleaned;
    return '';
  };

  const existingByKey = new Map<string, CustomerMember>();
  const existingByMac = new Map<string, CustomerMember>();
  const existingByName = new Map<string, CustomerMember | null>();
  const existingByPhone = new Map<string, CustomerMember>();
  const normPhone = (raw?: string) => {
    const digits = toEnglishDigits((raw || '').trim()).replace(/[^0-9]/g, '');
    if (!digits) return '';
    if (/^01[3-9]\d{8}$/.test(digits)) return digits;
    if (/^(?:88|0088)01[3-9]\d{8}$/.test(digits)) return digits.slice(-11);
    if (/^1[3-9]\d{8}$/.test(digits)) return `0${digits}`;
    return digits;
  };
  const isJunkMemberIdLocal = (rawId: string): boolean => {
    const s = cleanField(rawId);
    if (!s || s.length < 2 || s.length > 36) return true;
    const low = toEnglishDigits(s).toLowerCase();
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(low)) return true;
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(low)) return true;
    if (/^\d{1,2}:\d{2}(?::\d{2})?/.test(low)) return true;
    if (/^(?:inv|trx|tx|rec|vch|pay|bill)[-_#]?\d+$/i.test(low)) return true;
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(low)) return true;
    if (low.includes('@') || /(?:৳|bdt|\btk\b)/.test(low) || /^[\d,]+\.\d{1,2}$/.test(low)) return true;
    return false;
  };
  existingCustomers.forEach((c) => {
    const k = normalizeKey(c.memberId);
    if (k) {
      existingByKey.set(k, c);
      const stripped = k.replace(/^(?:dbn|id|uid|mem)[-_]?/i, '');
      if (stripped && stripped !== k && /^\d{2,6}$/.test(stripped) && !existingByKey.has(stripped)) {
        existingByKey.set(stripped, c);
      }
    }
    const m = normMac(c.onuMac).toLowerCase();
    if (m) existingByMac.set(m, c);
    const nm = normalizeKey(c.name);
    if (nm && nm.length >= 3) {
      existingByName.set(nm, existingByName.has(nm) ? null : c);
    }
    const ph = normPhone(c.phone);
    if (ph && ph.length >= 10) existingByPhone.set(ph, c);
  });

  const findExistingMatch = (
    memberIdRaw?: string,
    onuMacRaw?: string,
    nameRaw?: string,
    notesRaw?: string,
    phoneRaw?: string
  ): CustomerMember | undefined => {
    const idClean = cleanField(memberIdRaw);
    if (idClean) {
      const nk = normalizeKey(idClean);
      const byId = existingByKey.get(nk);
      if (byId) return byId;
      const stripped = nk.replace(/^(?:dbn|id|uid|mem)[-_]?/i, '');
      if (stripped && /^\d{2,6}$/.test(stripped) && existingByKey.has(stripped)) {
        return existingByKey.get(stripped);
      }
    }
    const mKey = normMac(onuMacRaw || idClean).toLowerCase();
    if (mKey && existingByMac.has(mKey)) {
      return existingByMac.get(mKey);
    }
    const tokenSource = toEnglishDigits(`${idClean} ${cleanField(notesRaw)} ${cleanField(nameRaw)}`);
    const idTokens = tokenSource.match(/\b(?:[A-Za-z]{1,6}[-_]?)?\d{2,6}\b/g);
    if (idTokens) {
      for (const tok of idTokens) {
        const hit = existingByKey.get(tok.toLowerCase());
        if (hit) return hit;
        const bare = tok.toLowerCase().replace(/^[a-z]+[-_]?/, '');
        if (bare && existingByKey.has(bare)) return existingByKey.get(bare);
      }
    }
    const ph = normPhone(phoneRaw);
    if (ph && ph.length >= 10 && existingByPhone.has(ph)) {
      return existingByPhone.get(ph);
    }
    const nameCandidates = [nameRaw, notesRaw, idClean]
      .map((v) => normalizeKey(cleanField(v)))
      .filter((v) => v.length >= 3);
    for (const nm of nameCandidates) {
      const hit = existingByName.get(nm);
      if (hit) return hit;
    }
    return undefined;
  };

  // Merge duplicate rows inside the same batch cleanly instead of discarding non-empty fields
  const dedupedByKey = new Map<string, Omit<CustomerMember, 'id' | 'createdAt' | 'updatedAt'>>();
  entries.forEach((rawEntry) => {
    const memberIdClean = cleanField(rawEntry.memberId) || normMac(rawEntry.onuMac) || cleanField(rawEntry.name);
    if (!memberIdClean || isJunkMemberIdLocal(memberIdClean)) return;
    const matchedExisting = findExistingMatch(
      memberIdClean,
      rawEntry.onuMac,
      rawEntry.name,
      rawEntry.notes,
      rawEntry.phone
    );
    const canonicalKey = matchedExisting ? normalizeKey(matchedExisting.memberId) : normalizeKey(memberIdClean);
    const prev = dedupedByKey.get(canonicalKey);

    const isWeakPhoneOrIdName = (cand: string, memId: string, mac?: string): boolean => {
      const cleaned = cleanField(cand);
      if (!cleaned) return true;
      const nk = normalizeKey(cleaned);
      if (nk === normalizeKey(memId)) return true;
      if (mac && nk === normalizeKey(mac)) return true;
      const compact = toEnglishDigits(cleaned).replace(/[\s\-()]/g, '');
      if (/^(?:\+?88)?01[3-9]\d*(?:\.{2,}|…)?$/i.test(compact)) return true;
      if (/^\d{4,}(?:\.{2,}|…)?$/.test(compact)) return true;
      return false;
    };

    const incomingName = cleanField(rawEntry.name);
    const prevName = prev ? cleanField(prev.name) : '';
    const isIncomingBareId =
      isWeakPhoneOrIdName(incomingName, memberIdClean, rawEntry.onuMac) ||
      Boolean(matchedExisting && normalizeKey(incomingName) === normalizeKey(matchedExisting.memberId));
    const isPrevBareId =
      isWeakPhoneOrIdName(prevName, memberIdClean, prev?.onuMac) ||
      Boolean(matchedExisting && normalizeKey(prevName) === normalizeKey(matchedExisting.memberId));

    const mergedName = !isIncomingBareId
      ? incomingName
      : !isPrevBareId
      ? prevName
      : incomingName || prevName;

    const mergedStatusLabel = cleanField(rawEntry.statusLabel) || cleanField(prev?.statusLabel);
    const mergedStatus = cleanField(rawEntry.statusLabel)
      ? rawEntry.status
      : prev && cleanField(prev.statusLabel)
      ? prev.status
      : rawEntry.status || prev?.status || 'active';

    const merged: Omit<CustomerMember, 'id' | 'createdAt' | 'updatedAt'> = {
      ...(prev || {}),
      ...rawEntry,
      memberId: matchedExisting?.memberId || memberIdClean || prev?.memberId || '',
      name: mergedName,
      phone: cleanField(rawEntry.phone) || cleanField(prev?.phone),
      address: cleanField(rawEntry.address) || cleanField(prev?.address),
      packageName: cleanField(rawEntry.packageName) || cleanField(prev?.packageName),
      monthlyFee:
        rawEntry.monthlyFee !== undefined && rawEntry.monthlyFee > 0
          ? rawEntry.monthlyFee
          : prev?.monthlyFee,
      oltInfo: cleanField(rawEntry.oltInfo) || cleanField(prev?.oltInfo),
      oltPower: cleanField(rawEntry.oltPower) || cleanField(prev?.oltPower),
      onuMac: normMac(rawEntry.onuMac) || cleanField(rawEntry.onuMac) || prev?.onuMac,
      rxPower: cleanField(rawEntry.rxPower) || cleanField(prev?.rxPower),
      txPower: cleanField(rawEntry.txPower) || cleanField(prev?.txPower),
      fiberLength: cleanField(rawEntry.fiberLength) || cleanField(prev?.fiberLength),
      pingLatency: cleanField(rawEntry.pingLatency) || cleanField(prev?.pingLatency),
      downloadSpeed: cleanField(rawEntry.downloadSpeed) || cleanField(prev?.downloadSpeed),
      uploadSpeed: cleanField(rawEntry.uploadSpeed) || cleanField(prev?.uploadSpeed),
      tjBox: cleanField(rawEntry.tjBox) || cleanField(prev?.tjBox),
      tjLoss: cleanField(rawEntry.tjLoss) || cleanField(prev?.tjLoss),
      splitterName: cleanField(rawEntry.splitterName) || cleanField(prev?.splitterName),
      splitterLoss: cleanField(rawEntry.splitterLoss) || cleanField(prev?.splitterLoss),
      issueReason: cleanField(rawEntry.issueReason) || cleanField(prev?.issueReason),
      lossStatus: rawEntry.lossStatus || prev?.lossStatus,
      status: mergedStatus,
      ...(mergedStatusLabel ? { statusLabel: mergedStatusLabel } : {})
    };
    dedupedByKey.set(canonicalKey, merged);
  });

  const now = new Date().toISOString();
  const baseTs = Date.now();
  let addedCount = 0;
  let updatedCount = 0;

  interface PreparedDoc {
    id: string;
    isUpdate: boolean;
    payload: CustomerMember;
  }

  const prepared: PreparedDoc[] = [];
  let seq = 0;

  dedupedByKey.forEach((entry, key) => {
    const macKey = normMac(entry.onuMac || entry.memberId).toLowerCase();
    const existing =
      existingByKey.get(key) ||
      findExistingMatch(entry.memberId, entry.onuMac, entry.name, entry.notes, entry.phone);

    const entryPhone = toEnglishDigits(cleanField(entry.phone));
    const entryNameClean = cleanField(entry.name);
    // Do not create phantom customers from bare OLT rows that have neither name nor phone
    if (!existing && !entryNameClean && !entryPhone) {
      return;
    }

    const id = existing?.id || `cust-${baseTs}-${seq++}-${Math.random().toString(36).substring(2, 6)}`;
    const isUpdate = Boolean(existing);
    if (isUpdate) {
      updatedCount += 1;
    } else {
      addedCount += 1;
    }

    const isWeakNameVal = (cand?: string) => {
      const cleaned = cleanField(cand);
      if (!cleaned) return true;
      const nk = normalizeKey(cleaned);
      if (
        nk === normalizeKey(entry.memberId) ||
        (existing && nk === normalizeKey(existing.memberId)) ||
        (macKey && nk === macKey)
      ) {
        return true;
      }
      const compact = toEnglishDigits(cleaned).replace(/[\s\-()]/g, '');
      return /^(?:\+?88)?01[3-9]\d*(?:\.{2,}|…)?$/i.test(compact) || /^\d{4,}(?:\.{2,}|…)?$/.test(compact);
    };

    const incomingNameIsWeak = isWeakNameVal(entryNameClean);
    const existingNameIsWeak = existing ? isWeakNameVal(existing.name) : true;

    const safeName =
      existing && !existingNameIsWeak && incomingNameIsWeak
        ? existing.name
        : !incomingNameIsWeak
        ? entryNameClean
        : cleanField(existing?.name) || entryNameClean || entry.memberId;

    const hasExplicitStatus = Boolean(cleanField(entry.statusLabel)) || !entry.addedBy?.includes('অটো-সিঙ্ক');
    const safeStatus = existing
      ? hasExplicitStatus
        ? entry.status || existing.status
        : existing.status
      : entry.status || 'active';
    const safeStatusLabel = cleanField(entry.statusLabel) || existing?.statusLabel;

    const payload = stripUndefined({
      ...(existing || {}),
      ...entry,
      id,
      memberId: existing?.memberId || cleanField(entry.memberId),
      name: safeName,
      phone: (entryPhone && entryPhone !== 'দেওয়া হয়নি' ? entryPhone : '') || existing?.phone || 'দেওয়া হয়নি',
      address: cleanField(entry.address) || existing?.address || 'ভোলা সদর',
      packageName: cleanField(entry.packageName) || existing?.packageName,
      monthlyFee:
        entry.monthlyFee !== undefined && entry.monthlyFee > 0 ? entry.monthlyFee : existing?.monthlyFee,
      oltInfo: cleanField(entry.oltInfo) || existing?.oltInfo,
      oltPower: cleanField(entry.oltPower) || existing?.oltPower,
      onuMac: cleanField(entry.onuMac) || existing?.onuMac,
      rxPower: cleanField(entry.rxPower) || existing?.rxPower,
      txPower: cleanField(entry.txPower) || existing?.txPower,
      fiberLength: cleanField(entry.fiberLength) || existing?.fiberLength,
      pingLatency: cleanField(entry.pingLatency) || existing?.pingLatency,
      downloadSpeed: cleanField(entry.downloadSpeed) || existing?.downloadSpeed,
      uploadSpeed: cleanField(entry.uploadSpeed) || existing?.uploadSpeed,
      tjBox: cleanField(entry.tjBox) || existing?.tjBox,
      tjLoss: cleanField(entry.tjLoss) || existing?.tjLoss,
      splitterName: cleanField(entry.splitterName) || existing?.splitterName,
      splitterLoss: cleanField(entry.splitterLoss) || existing?.splitterLoss,
      issueReason: cleanField(entry.issueReason) || existing?.issueReason,
      lossStatus: entry.lossStatus || existing?.lossStatus,
      expiryDate: cleanField(entry.expiryDate) || existing?.expiryDate,
      dueAmount:
        entry.dueAmount !== undefined && entry.dueAmount > 0 ? entry.dueAmount : existing?.dueAmount,
      status: safeStatus,
      ...(safeStatusLabel ? { statusLabel: safeStatusLabel } : {}),
      createdAt: existing?.createdAt || now,
      updatedAt: now
    }) as CustomerMember;

    prepared.push({ id, isUpdate, payload });
  });

  if (prepared.length === 0) {
    return { addedCount: 0, updatedCount: 0, totalProcessed: 0 };
  }

  // Update local cache immediately for instant UI responsiveness
  const mergedCacheMap = new Map<string, CustomerMember>();
  existingCustomers.forEach((c) => mergedCacheMap.set(c.id, c));
  prepared.forEach(({ id, payload }) => mergedCacheMap.set(id, payload));
  setCachedData(CACHE_KEYS.CUSTOMERS, Array.from(mergedCacheMap.values()));

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (isOnline) {
    for (let i = 0; i < prepared.length; i += 400) {
      const chunk = prepared.slice(i, i + 400);
      try {
        const batch = writeBatch(db);
        chunk.forEach(({ id, isUpdate, payload }) => {
          batch.set(doc(db, 'customers', id), payload, { merge: isUpdate });
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, 'importCustomersBatch', OperationType.WRITE, 'customers');
        for (const item of chunk) {
          await commitDocOfflineSafe('customers', item.id, item.payload, item.isUpdate);
        }
      }
    }
  } else {
    for (const item of prepared) {
      await commitDocOfflineSafe('customers', item.id, item.payload, item.isUpdate);
    }
  }

  return {
    addedCount,
    updatedCount,
    totalProcessed: prepared.length
  };
}

// ==========================================
// Customer Complaints Ticketing Operations
// (গ্রাহক অভিযোগ ব্যবস্থাপনা ও অফলাইন-অনলাইন অটো সিঙ্ক + localStorage ক্যাশ)
// ==========================================
export function subscribeComplaints(callback: (complaints: CustomerComplaint[]) => void) {
  ensureAuth();
  let lastSnapshotList: CustomerComplaint[] = getCachedData<CustomerComplaint[]>(CACHE_KEYS.COMPLAINTS, []);

  const emitMerged = (persist = false) => {
    const queuedDocs = getOfflineQueuedDocsForCollection<CustomerComplaint>('complaints');
    const deletedIds = getOfflineDeletedIdsForCollection('complaints');
    const byId = new Map<string, CustomerComplaint>();

    lastSnapshotList.forEach((c) => {
      if (!deletedIds.has(c.id)) {
        byId.set(c.id, c);
      }
    });
    queuedDocs.forEach((qCmp) => {
      if (!deletedIds.has(qCmp.id)) {
        const existing = byId.get(qCmp.id);
        byId.set(qCmp.id, { ...(existing || {}), ...qCmp, _pendingSync: true });
      }
    });

    const merged = Array.from(byId.values()).sort((a, b) => {
      const dateCmp = getComplaintDateKey(b).localeCompare(getComplaintDateKey(a));
      if (dateCmp !== 0) return dateCmp;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    if (persist) setCachedData(CACHE_KEYS.COMPLAINTS, merged);
    callback(merged);
  };

  if (lastSnapshotList.length > 0) emitMerged(false);

  const unsubSnap = onSnapshot(
    collection(db, 'complaints'),
    { includeMetadataChanges: true },
    (snapshot) => {
      const list: CustomerComplaint[] = [];
      snapshot.forEach((d) => {
        list.push({
          ...d.data(),
          id: d.id,
          _pendingSync: d.metadata.hasPendingWrites
        } as CustomerComplaint);
      });
      lastSnapshotList = list;
      emitMerged(true);
    },
    (err) => {
      handleFirestoreError(err, 'subscribeComplaints', OperationType.LIST, 'complaints');
      emitMerged(false);
    }
  );

  const unsubOffline = subscribeOfflineSyncState(() => {
    emitMerged(false);
  });

  return () => {
    unsubSnap();
    unsubOffline();
  };
}

export async function addComplaint(
  complaint: Omit<CustomerComplaint, 'id' | 'createdAt'> & { id?: string }
): Promise<CustomerComplaint> {
  await ensureAuth();
  const id = complaint.id || `cmp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const dateStr = complaint.date && /^\d{4}-\d{2}-\d{2}$/.test(complaint.date) ? complaint.date : getTodayString();
  const fullComplaint = stripUndefined({
    ...complaint,
    id,
    date: dateStr,
    createdAt: now,
    updatedAt: now
  }) as CustomerComplaint;
  const res = await commitDocOfflineSafe('complaints', id, fullComplaint, false);
  return { ...fullComplaint, _pendingSync: !res.syncedOnline };
}

export async function updateComplaint(id: string, updates: Partial<CustomerComplaint>): Promise<void> {
  await ensureAuth();
  await commitDocOfflineSafe(
    'complaints',
    id,
    stripUndefined({
      ...updates,
      updatedAt: new Date().toISOString()
    }),
    true
  );
}

export async function deleteComplaint(id: string): Promise<void> {
  await markComplaintsSeeded();
  await ensureAuth();
  await deleteDocOfflineSafe('complaints', id);
}

/**
 * Permanently deletes ALL customer complaints from app state, offline queue, IndexedDB, and Firestore,
 * recording persistent tombstones & seed_meta locks so deleted complaints NEVER reappear.
 */
export async function deleteAllComplaints(knownIds: string[] = []): Promise<number> {
  await markComplaintsSeeded();
  await ensureAuth();

  const idSet = new Set<string>(knownIds.filter((id) => typeof id === 'string' && id.length > 0));
  getOfflineQueuedDocsForCollection<CustomerComplaint>('complaints').forEach((c) => {
    if (c.id) idSet.add(c.id);
  });

  try {
    const cacheSnap = await getDocs(collection(db, 'complaints'));
    cacheSnap.forEach((d) => idSet.add(d.id));
  } catch {
    // ignore cache read error
  }

  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const serverSnap = await Promise.race([
        getDocsFromServer(collection(db, 'complaints')),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))
      ]);
      if (serverSnap) {
        serverSnap.forEach((d) => idSet.add(d.id));
      }
    } catch {
      // fallback to offline queued deletes
    }
  }

  const allIds = Array.from(idSet);

  // 1. Purge any queued set/update writes for complaints so nothing recreates deleted items on sync
  purgeOfflineCollectionWrites('complaints');

  if (allIds.length === 0) {
    return 0;
  }

  // 2. Record permanent tombstones locally and sync to Firestore settings/deleted_tombstones
  const updatedTombstones = addTombstonesBulk('complaints', allIds);
  const tombstonePayload = {
    complaints: updatedTombstones.complaints || allIds,
    updatedAt: new Date().toISOString()
  };

  enqueueOfflineWrite({
    docId: DELETED_TOMBSTONES_DOC_ID,
    collectionName: 'settings',
    op: 'set',
    merge: true,
    data: tombstonePayload,
    queuedAt: new Date().toISOString()
  });

  setDoc(doc(db, 'settings', DELETED_TOMBSTONES_DOC_ID), tombstonePayload, { merge: true })
    .then(() => {
      removeOfflineWrite('settings', DELETED_TOMBSTONES_DOC_ID);
    })
    .catch(() => {});

  // 3. Enqueue deletes so listeners update synchronously & offline devices flush later
  enqueueOfflineDeletesBulk('complaints', allIds);

  // 4. Execute Firestore batch deletes in chunks of 400
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (isOnline) {
    for (let i = 0; i < allIds.length; i += 400) {
      const chunk = allIds.slice(i, i + 400);
      try {
        const batch = writeBatch(db);
        chunk.forEach((id) => {
          batch.delete(doc(db, 'complaints', id));
        });
        const commitPromise = batch.commit().then(() => {
          removeOfflineWritesBulk('complaints', chunk);
        });
        await Promise.race([
          commitPromise,
          new Promise<void>((resolve) => setTimeout(resolve, 5000))
        ]);
      } catch (err) {
        handleFirestoreError(err, 'deleteAllComplaints', OperationType.DELETE, 'complaints');
      }
    }
  }

  return allIds.length;
}

// ==========================================
// Staff & Share Partner Joining Requests Operations
// ==========================================
export function subscribeJoinRequests(callback: (requests: JoinRequest[]) => void) {
  ensureAuth();
  let lastSnapshotList: JoinRequest[] = [];

  const emitMerged = () => {
    const queuedDocs = getOfflineQueuedDocsForCollection<JoinRequest>('joinRequests');
    const deletedIds = getOfflineDeletedIdsForCollection('joinRequests');
    const byId = new Map<string, JoinRequest>();

    lastSnapshotList.forEach((r) => {
      if (!deletedIds.has(r.id)) {
        byId.set(r.id, r);
      }
    });
    queuedDocs.forEach((qReq) => {
      if (!deletedIds.has(qReq.id)) {
        const existing = byId.get(qReq.id);
        byId.set(qReq.id, { ...(existing || {}), ...qReq, _pendingSync: true });
      }
    });

    const merged = Array.from(byId.values()).sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );
    callback(merged);
  };

  const q = query(collection(db, 'joinRequests'), orderBy('createdAt', 'desc'));
  const unsubSnap = onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      const list: JoinRequest[] = [];
      snapshot.forEach((d) => {
        list.push({
          ...d.data(),
          id: d.id,
          _pendingSync: d.metadata.hasPendingWrites
        } as JoinRequest);
      });
      lastSnapshotList = list;
      emitMerged();
    },
    (err) => {
      handleFirestoreError(err, 'subscribeJoinRequests');
      emitMerged();
    }
  );

  const unsubOffline = subscribeOfflineSyncState(() => {
    emitMerged();
  });

  return () => {
    unsubSnap();
    unsubOffline();
  };
}

export async function addJoinRequest(
  reqData: Omit<JoinRequest, 'id' | 'status' | 'createdAt'> & { id?: string }
): Promise<JoinRequest> {
  await ensureAuth();
  const id = reqData.id || `join-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const fullReq = stripUndefined({
    ...reqData,
    id,
    uid: reqData.uid || auth.currentUser?.uid || undefined,
    email: reqData.email || auth.currentUser?.email || undefined,
    status: 'pending' as const,
    createdAt: new Date().toISOString()
  }) as JoinRequest;
  const res = await commitDocOfflineSafe('joinRequests', id, fullReq, false);
  return { ...fullReq, _pendingSync: !res.syncedOnline };
}

export async function updateJoinRequest(id: string, updates: Partial<JoinRequest>): Promise<void> {
  await ensureAuth();
  await commitDocOfflineSafe('joinRequests', id, stripUndefined(updates), true);
}

export async function deleteJoinRequest(id: string): Promise<void> {
  await ensureAuth();
  await deleteDocOfflineSafe('joinRequests', id);
}

/**
 * Permanently deletes ALL joining requests from local cache, offline queue, and Firestore.
 */
export async function deleteAllJoinRequests(knownIds: string[] = []): Promise<number> {
  await ensureAuth();

  const idSet = new Set<string>(knownIds.filter((id) => typeof id === 'string' && id.length > 0));
  getOfflineQueuedDocsForCollection<JoinRequest>('joinRequests').forEach((r) => {
    if (r.id) idSet.add(r.id);
  });

  try {
    const cacheSnap = await getDocs(collection(db, 'joinRequests'));
    cacheSnap.forEach((d) => idSet.add(d.id));
  } catch {
    // ignore cache read error
  }

  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const serverSnap = await Promise.race([
        getDocsFromServer(collection(db, 'joinRequests')),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
      ]);
      if (serverSnap) {
        serverSnap.forEach((d) => idSet.add(d.id));
      }
    } catch {
      // fallback to offline queued deletes
    }
  }

  const allIds = Array.from(idSet);
  purgeOfflineCollectionWrites('joinRequests');
  setCachedData(CACHE_KEYS.JOIN_REQUESTS, []);

  if (allIds.length === 0) {
    return 0;
  }

  const updatedTombstones = addTombstonesBulk('joinRequests', allIds);
  const tombstonePayload = {
    joinRequests: updatedTombstones.joinRequests || allIds.slice(-2500),
    updatedAt: new Date().toISOString()
  };

  enqueueOfflineWrite({
    docId: DELETED_TOMBSTONES_DOC_ID,
    collectionName: 'settings',
    op: 'set',
    merge: true,
    data: tombstonePayload,
    queuedAt: new Date().toISOString()
  });

  setDoc(doc(db, 'settings', DELETED_TOMBSTONES_DOC_ID), tombstonePayload, { merge: true })
    .then(() => {
      removeOfflineWrite('settings', DELETED_TOMBSTONES_DOC_ID);
    })
    .catch(() => {});

  enqueueOfflineDeletesBulk('joinRequests', allIds);

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (isOnline) {
    for (let i = 0; i < allIds.length; i += 400) {
      const chunk = allIds.slice(i, i + 400);
      try {
        const batch = writeBatch(db);
        chunk.forEach((id) => {
          batch.delete(doc(db, 'joinRequests', id));
        });
        const commitPromise = batch.commit().then(() => {
          removeOfflineWritesBulk('joinRequests', chunk);
        });
        await Promise.race([
          commitPromise,
          new Promise<void>((resolve) => setTimeout(resolve, 6000))
        ]);
      } catch (err) {
        handleFirestoreError(err, 'deleteAllJoinRequests', OperationType.DELETE, 'joinRequests');
      }
    }
  }

  return allIds.length;
}

export interface PortalPurgeOptions {
  wipeCustomers?: boolean;
  wipeCustomerDues?: boolean;
  wipeComplaints?: boolean;
  wipeJoinRequests?: boolean;
  wipeLegacySettings?: boolean;
  knownCustomerIds?: string[];
  knownDueIds?: string[];
  knownComplaintIds?: string[];
  knownJoinRequestIds?: string[];
}

export interface PortalPurgeResult {
  deletedCustomers: number;
  deletedDues: number;
  deletedComplaints: number;
  deletedJoinRequests: number;
  cleanedLegacyDocs: boolean;
}

/**
 * Director-only full cleanup of legacy portal records, imported subscriber/due/complaint collections,
 * obsolete Firestore settings docs (`portal_summary`, `billing_portal`, `web_billing`, `olt_portal`),
 * legacy fields on `companies/main_company`, and stale local caches — while preserving core accounting
 * (`transactions`), `staffs`, `partners`, and login credentials (`settings/admin_auth`).
 */
export async function purgeLegacyPortalInformation(
  options: PortalPurgeOptions
): Promise<PortalPurgeResult> {
  await ensureAuth();

  let deletedCustomers = 0;
  let deletedDues = 0;
  let deletedComplaints = 0;
  let deletedJoinRequests = 0;
  let cleanedLegacyDocs = false;

  if (options.wipeCustomers) {
    deletedCustomers = await deleteAllCustomers(options.knownCustomerIds || []);
  }
  if (options.wipeCustomerDues) {
    deletedDues = await deleteAllCustomerDues(options.knownDueIds || []);
  }
  if (options.wipeComplaints) {
    deletedComplaints = await deleteAllComplaints(options.knownComplaintIds || []);
  }
  if (options.wipeJoinRequests) {
    deletedJoinRequests = await deleteAllJoinRequests(options.knownJoinRequestIds || []);
  }

  if (options.wipeLegacySettings !== false) {
    const legacySettingDocIds = [
      'portal_summary',
      'portal_session_vault',
      'billing_portal',
      'web_billing',
      'olt_portal'
    ];
    await Promise.all(
      legacySettingDocIds.map((docId) =>
        Promise.race([
          deleteDoc(doc(db, 'settings', docId)),
          new Promise<void>((resolve) => setTimeout(resolve, 3500))
        ]).catch(() => {})
      )
    );

    try {
      const compSnap = await getDoc(doc(db, 'companies', COMPANY_DOC_ID));
      if (compSnap.exists()) {
        const raw = compSnap.data() as Company & {
          membersDirectoryUrl?: string;
          oltManagementUrl?: string;
        };
        const { company: normalized } = normalizeCompanyRecord(raw);
        setCachedData(CACHE_KEYS.COMPANY, normalized);
        await Promise.race([
          setDoc(
            doc(db, 'companies', COMPANY_DOC_ID),
            {
              troubleshootPortalUrl: normalized.troubleshootPortalUrl || DEFAULT_TROUBLESHOOT_PORTAL_URL,
              membersDirectoryUrl: deleteField(),
              oltManagementUrl: deleteField(),
              updatedAt: new Date().toISOString()
            },
            { merge: true }
          ),
          new Promise<void>((resolve) => setTimeout(resolve, 3500))
        ]).catch(() => {});
      }
    } catch {
      // ignore non-fatal company cleanup errors
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        if (options.wipeCustomers) window.localStorage.removeItem(CACHE_KEYS.CUSTOMERS);
        if (options.wipeCustomerDues) window.localStorage.removeItem(CACHE_KEYS.CUSTOMER_DUES);
        if (options.wipeComplaints) window.localStorage.removeItem(CACHE_KEYS.COMPLAINTS);
        if (options.wipeJoinRequests) window.localStorage.removeItem(CACHE_KEYS.JOIN_REQUESTS);
        window.localStorage.removeItem(CACHE_KEYS.COMPANY);
      } catch {
        // ignore storage errors
      }
    }

    cleanedLegacyDocs = true;
  }

  return {
    deletedCustomers,
    deletedDues,
    deletedComplaints,
    deletedJoinRequests,
    cleanedLegacyDocs
  };
}

// Company info & Settings
export async function updateCompany(company: Company) {
  await ensureAuth();
  const {
    membersDirectoryUrl: _legacyMemberUrl,
    oltManagementUrl: _legacyOltUrl,
    ...cleanCompany
  } = company as Company & { membersDirectoryUrl?: string; oltManagementUrl?: string };
  const normalizedUrl = normalizePortalHttpUrl(cleanCompany.troubleshootPortalUrl);
  const effectiveUrl =
    !normalizedUrl || isLegacyTroubleshootPortalUrl(normalizedUrl)
      ? DEFAULT_TROUBLESHOOT_PORTAL_URL
      : normalizedUrl;
  const cachePayload = stripUndefined({
    ...cleanCompany,
    troubleshootPortalUrl: effectiveUrl,
    updatedAt: new Date().toISOString()
  });
  setCachedData(CACHE_KEYS.COMPANY, cachePayload);
  try {
    await setDoc(
      doc(db, 'companies', COMPANY_DOC_ID),
      {
        ...cachePayload,
        membersDirectoryUrl: deleteField(),
        oltManagementUrl: deleteField()
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, 'updateCompany', OperationType.WRITE, `companies/${COMPANY_DOC_ID}`);
    throw err;
  }
}

export async function updateSettings(settings: AdminAuth) {
  await ensureAuth();
  await setDoc(doc(db, 'settings', SETTINGS_DOC_ID), stripUndefined(settings), { merge: true });
}

export async function shouldSeedComplaintsOnce(): Promise<boolean> {
  if (typeof window !== 'undefined' && window.localStorage.getItem(LOCAL_COMPLAINTS_SEEDED_KEY) === '1') {
    return false;
  }
  if (getTombstones('complaints').size > 0) {
    await markComplaintsSeeded();
    return false;
  }
  try {
    const [metaSnap, tombstoneSnap, existingSnap] = await Promise.all([
      getDoc(doc(db, 'settings', SEED_META_DOC_ID)),
      getDoc(doc(db, 'settings', DELETED_TOMBSTONES_DOC_ID)),
      getDocs(collection(db, 'complaints'))
    ]);
    const deletedComplaints = tombstoneSnap.exists() ? tombstoneSnap.data()?.complaints : [];
    if (
      (metaSnap.exists() && metaSnap.data()?.complaintsSeeded === true) ||
      (Array.isArray(deletedComplaints) && deletedComplaints.length > 0) ||
      !existingSnap.empty
    ) {
      await markComplaintsSeeded();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function markComplaintsSeeded(): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LOCAL_COMPLAINTS_SEEDED_KEY, '1');
    } catch {
      // ignore
    }
  }
  await setDoc(
    doc(db, 'settings', SEED_META_DOC_ID),
    { complaintsSeeded: true, updatedAt: new Date().toISOString() },
    { merge: true }
  ).catch(() => {});
}

// Seed or Sync backup data from JSON file into Firestore (never re-seeds deleted data unless force=true)
export async function seedInitialDataIfEmpty(force = false): Promise<boolean> {
  await ensureAuth();
  try {
    const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

    if (!force) {
      // Check live Firestore metadata first so stale localStorage flags never block seeding, without hammering the whole collection every boot
      try {
        const [metaSnap, tombstoneSnap] = await Promise.all([
          isOnline
            ? getDocFromServer(doc(db, 'settings', SEED_META_DOC_ID)).catch(() =>
                getDoc(doc(db, 'settings', SEED_META_DOC_ID))
              )
            : getDoc(doc(db, 'settings', SEED_META_DOC_ID)),
          isOnline
            ? getDocFromServer(doc(db, 'settings', DELETED_TOMBSTONES_DOC_ID)).catch(() =>
                getDoc(doc(db, 'settings', DELETED_TOMBSTONES_DOC_ID))
              )
            : getDoc(doc(db, 'settings', DELETED_TOMBSTONES_DOC_ID))
        ]);

        const deletedTx = tombstoneSnap.exists() ? tombstoneSnap.data()?.transactions : [];
        if (
          (metaSnap.exists() && metaSnap.data()?.transactionsSeeded === true) ||
          (Array.isArray(deletedTx) && deletedTx.length > 0)
        ) {
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem('dip_bhola_seeded_v1', '1');
            } catch {
              // ignore
            }
          }
          return false;
        }

        const existingSnap = isOnline
          ? await getDocsFromServer(collection(db, 'transactions')).catch(() =>
              getDocs(collection(db, 'transactions'))
            )
          : await getDocs(collection(db, 'transactions'));

        if (!existingSnap.empty) {
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem('dip_bhola_seeded_v1', '1');
            } catch {
              // ignore
            }
          }
          await setDoc(
            doc(db, 'settings', SEED_META_DOC_ID),
            { transactionsSeeded: true, updatedAt: new Date().toISOString() },
            { merge: true }
          ).catch(() => {});
          return false;
        }
      } catch (checkErr) {
        console.warn('Seed check warning, continuing check:', checkErr);
        if (typeof window !== 'undefined' && window.localStorage.getItem('dip_bhola_seeded_v1') === '1') {
          return false;
        }
      }
    }

    // On explicit force reset/restore by Admin (or clean DB seed), clear stale deletion tombstones for transactions
    if (force) {
      clearAllTombstones();
      await setDoc(doc(db, 'settings', DELETED_TOMBSTONES_DOC_ID), { updatedAt: new Date().toISOString() }).catch(() => {});
    }

    // Load backup JSON
    let backup: BackupData | null = null;
    try {
      const res = await fetch('/default_backup.json');
      if (res.ok) {
        backup = await res.json();
      }
    } catch (e) {
      console.warn('Could not fetch default backup file:', e);
    }

    if (!backup) {
      return false;
    }

    const batch = writeBatch(db);

    // Seed Company
    if (backup.company) {
      const compRef = doc(db, 'companies', COMPANY_DOC_ID);
      const {
        partners,
        membersDirectoryUrl: _legacyMemberUrl,
        oltManagementUrl: _legacyOltUrl,
        ...compData
      } = backup.company as Company & {
        partners?: Partner[];
        membersDirectoryUrl?: string;
        oltManagementUrl?: string;
      };
      compData.logoUrl = '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg';
      const parsedBackupUrl = normalizePortalHttpUrl(compData.troubleshootPortalUrl);
      compData.troubleshootPortalUrl =
        !parsedBackupUrl || isLegacyTroubleshootPortalUrl(parsedBackupUrl)
          ? DEFAULT_TROUBLESHOOT_PORTAL_URL
          : parsedBackupUrl;
      batch.set(compRef, stripUndefined(compData));

      // Seed Partners
      if (partners && Array.isArray(partners)) {
        for (const p of partners) {
          const pRef = doc(db, 'partners', p.id);
          batch.set(pRef, stripUndefined(p));
        }
      }
    }

    // Seed Admin Auth
    if (backup.adminAuth) {
      const setRef = doc(db, 'settings', SETTINGS_DOC_ID);
      batch.set(setRef, stripUndefined(backup.adminAuth));
    }

    // Seed Staff
    if (backup.staffs && Array.isArray(backup.staffs)) {
      for (const s of backup.staffs) {
        const sRef = doc(db, 'staffs', s.id);
        batch.set(sRef, stripUndefined(s));
      }
    }

    // Seed Transactions
    if (backup.transactions && Array.isArray(backup.transactions)) {
      for (const t of backup.transactions) {
        const tRef = doc(db, 'transactions', t.id);
        batch.set(tRef, stripUndefined(t));
      }
    }

    // Seed Customer Dues
    if (backup.customerDues && Array.isArray(backup.customerDues)) {
      for (const cd of backup.customerDues) {
        const cdRef = doc(db, 'customerDues', cd.id);
        batch.set(cdRef, stripUndefined(cd));
      }
    }

    // Record seed completion permanently in settings/seed_meta
    batch.set(
      doc(db, 'settings', SEED_META_DOC_ID),
      { transactionsSeeded: true, updatedAt: new Date().toISOString() },
      { merge: true }
    );

    await batch.commit();
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('dip_bhola_seeded_v1', '1');
      } catch {
        // ignore
      }
    }
    return true;
  } catch (err) {
    handleFirestoreError(err, 'seedInitialData', OperationType.WRITE, 'transactions');
    return false;
  }
}

// Export Full Backup JSON matching user schema
export function generateBackupJson(
  company: Company,
  partners: Partner[],
  adminAuth: AdminAuth,
  staffs: Staff[],
  transactions: Transaction[],
  customerDues: CustomerDue[]
): BackupData {
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    company: {
      ...company,
      partners: partners || []
    },
    adminAuth: adminAuth || { pin: '1234', phone: '01700000000' },
    staffs: staffs || [],
    transactions: transactions || [],
    customerDues: customerDues || []
  };
}

// Export CSV in the exact format from user instructions
export function generateCsvData(transactions: Transaction[], companyName = 'DIP BHOLA NETWORK', monthStr?: string): string {
  const header = 'ক্রমিক (SL),তারিখ (Date),ধরন (Type),বিবরণ (Title),ক্যাটাগরি (Category),টাকার পরিমাণ (Amount BDT),পেমেন্ট মাধ্যম (Payment Method),এন্ট্রিদাতা (Added By),মন্তব্য / নোট (Note),লেনদেন আইডি (ID)\n';

  let totalIncome = 0;
  let totalExpense = 0;

  const rows = transactions.map((t, idx) => {
    const isIncome = t.type === 'income';
    if (isIncome) totalIncome += t.amount;
    else totalExpense += t.amount;

    const typeLabel = isIncome ? 'আয় (Income)' : 'ব্যয় (Expense)';
    const cleanTitle = `"${(t.title || '').replace(/"/g, '""')}"`;
    const cleanCat = `"${(t.category || '').replace(/"/g, '""')}"`;
    const cleanPayment = `"${t.paymentMethod === 'bkash' ? 'বিকাশ (bKash)' : t.paymentMethod === 'nagad' ? 'নগদ (Nagad)' : t.paymentMethod === 'bank' ? 'ব্যাংক (Bank)' : 'নগদ (Cash)'}"`;
    const cleanAdded = `"${(t.addedBy || '').replace(/"/g, '""')}"`;
    const cleanNote = `"${(t.note || '').replace(/"/g, '""')}"`;
    const cleanId = `"${t.id}"`;

    return `${idx + 1},${t.date},${typeLabel},${cleanTitle},${cleanCat},${t.amount},${cleanPayment},${cleanAdded},${cleanNote},${cleanId}`;
  }).join('\n');

  const netBalance = totalIncome - totalExpense;
  const todayStr = new Date().toISOString().split('T')[0];
  const targetMonth = monthStr || todayStr.substring(0, 7);

  const summary = `\n---,---,---,---,---,---,---,---,---,---\n` +
    `হিসাবের সারসংক্ষেপ (Financial Summary),,,,,,,,,\n` +
    `মোট লেনদেন সংখ্যা (Total Records):,${transactions.length},,,,,,,,\n` +
    `মোট আয় / জমা (Total Income):,৳ ${totalIncome},,,,,,,,\n` +
    `মোট ব্যয় / খরচ (Total Expense):,৳ ${totalExpense},,,,,,,,\n` +
    `নিট ব্যালেন্স / ক্যাশ ইন হ্যান্ড (Net Balance):,৳ ${netBalance},,,,,,,,\n` +
    `প্রতিষ্ঠান:,"${companyName}",হিসাবের মাস:,${targetMonth},ডাউনলোড তারিখ:,${todayStr},,,,\n`;

  return header + rows + summary;
}

// Audit Log operations (stores recent security and operational changes)
export function subscribeAuditLogs(callback: (logs: AuditLog[]) => void) {
  ensureAuth();
  const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: AuditLog[] = [];
      snapshot.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as AuditLog);
      });
      callback(list);
    },
    (err) => {
      handleFirestoreError(err, 'subscribeAuditLogs');
    }
  );
}

export async function addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>) {
  try {
    await ensureAuth();
    if (!auth.currentUser) return null;
    const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const fullLog = stripUndefined({
      ...log,
      id,
      performedByUid: log.performedByUid || auth.currentUser.uid,
      timestamp: new Date().toISOString()
    }) as AuditLog;
    // Non-blocking audit log write so offline transactions/complaints never stall
    commitDocOfflineSafe('auditLogs', id, fullLog, false).catch(() => {});
    return fullLog;
  } catch (e) {
    console.warn('Audit log write error:', e);
    return null;
  }
}

// ==========================================
// Customer Database Bloat Analyzer & Deduplication / Cleanup
// ==========================================
export interface CustomerDatabaseBloatReport {
  totalDb: number;
  portalExpectedTotal: number | null;
  duplicateGroupCount: number;
  duplicateDocIds: string[];
  phantomDocIds: string[];
  staleNotInPortalIds: string[];
  cleanupCandidateIds: string[];
  excessOverPortal: number;
  hasSignificantBloat: boolean;
  mergedPairsPreview: Array<{ keep: CustomerMember; dropIds: string[] }>;
}

function normStrClean(raw?: string): string {
  return toEnglishDigits((raw || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()).toLowerCase();
}

function normPhone11ForBloat(raw?: string): string {
  const digits = normStrClean(raw).replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (/^01[3-9]\d{8}$/.test(digits)) return digits;
  if (/^(?:88|0088)01[3-9]\d{8}$/.test(digits)) return digits.slice(-11);
  if (/^1[3-9]\d{8}$/.test(digits)) return `0${digits}`;
  return digits.length >= 10 ? digits : '';
}

function normMacForBloat(raw?: string): string {
  const u = (raw || '').trim().toUpperCase();
  if (!u || u === '-' || u === 'N/A') return '';
  if (/^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/.test(u)) return u.replace(/-/g, ':').toLowerCase();
  if (/^[0-9A-F]{12}$/.test(u)) return (u.match(/.{2}/g)?.join(':') || u).toLowerCase();
  return '';
}

function isPhantomOrJunkCustomerDoc(c: CustomerMember): boolean {
  const id = normStrClean(c.memberId);
  const nm = normStrClean(c.name);
  const ph = normPhone11ForBloat(c.phone);

  if (!id) return true;
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(id)) return true;
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(id)) return true;
  if (/^\d{1,2}:\d{2}(?::\d{2})?/.test(id)) return true;
  if (/^(?:inv|trx|tx|rec|vch|pay|bill)[-_#]?\d+$/i.test(id)) return true;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(id)) return true;
  if (id.includes('@') || /(?:৳|bdt|\btk\b)/.test(id) || /^[\d,]+\.\d{1,2}$/.test(id)) return true;

  // Bare MAC/serial auto-created ghost row with placeholder phone and weak/missing real name
  const hasRealPhone = Boolean(ph && /^01[3-9]\d{8}$/.test(ph));
  const idLooksLikeMac = Boolean(normMacForBloat(c.memberId));
  const nameLooksWeak = !nm || nm === id || nm === 'দেওয়া হয়নি' || Boolean(normMacForBloat(c.name));
  if (idLooksLikeMac && !hasRealPhone && nameLooksWeak) {
    return true;
  }
  // Bare weak record with no valid name and no valid phone
  if (nameLooksWeak && !hasRealPhone && (c.addedBy || '').includes('অটো-সিঙ্ক')) {
    return true;
  }
  return false;
}

function scoreCustomerRichness(c: CustomerMember): number {
  let score = 0;
  const nm = normStrClean(c.name);
  const id = normStrClean(c.memberId);
  const ph = normPhone11ForBloat(c.phone);
  if (nm && nm !== id && !/^01[3-9]/.test(nm) && !normMacForBloat(c.name)) score += 35;
  if (ph && /^01[3-9]\d{8}$/.test(ph)) score += 25;
  if (/^\d{2,6}$/.test(id) || /^[a-z]{1,5}[-_]?\d{2,6}$/i.test(id)) score += 15;
  if (c.oltInfo) score += 10;
  if (c.rxPower || c.oltPower) score += 10;
  if (c.onuMac) score += 8;
  if (c.packageName) score += 5;
  if (c.monthlyFee && c.monthlyFee > 0) score += 5;
  if (c.address && c.address !== 'ভোলা সদর') score += 4;
  if (c.statusLabel) score += 4;
  return score;
}

export function analyzeCustomerDatabaseBloat(
  customers: CustomerMember[],
  cachedPortalRows?: Array<Omit<CustomerMember, 'id' | 'createdAt' | 'updatedAt'>>
): CustomerDatabaseBloatReport {
  const totalDb = customers.length;
  const portalExpectedTotal: number | null = null;

  // Union-Find grouping to cluster exact & normalized duplicates (memberId, stripped-prefix ID, phone, MAC)
  const parent = new Map<string, string>();
  const findRoot = (id: string): string => {
    const p = parent.get(id) ?? id;
    if (p === id) return id;
    const r = findRoot(p);
    parent.set(id, r);
    return r;
  };
  const unionDocs = (a: string, b: string) => {
    const ra = findRoot(a);
    const rb = findRoot(b);
    if (ra !== rb) parent.set(rb, ra);
  };

  customers.forEach((c) => parent.set(c.id, c.id));

  const byIdKey = new Map<string, string>();
  const byPhoneKey = new Map<string, string>();
  const byMacKey = new Map<string, string>();

  customers.forEach((c) => {
    const rawId = normStrClean(c.memberId);
    if (rawId) {
      if (byIdKey.has(rawId)) unionDocs(byIdKey.get(rawId)!, c.id);
      else byIdKey.set(rawId, c.id);

      const stripped = rawId.replace(/^(?:dbn|id|uid|mem)[-_]?/i, '');
      if (stripped && stripped !== rawId && /^\d{2,6}$/.test(stripped)) {
        if (byIdKey.has(stripped)) unionDocs(byIdKey.get(stripped)!, c.id);
        else byIdKey.set(stripped, c.id);
      }
    }
    const ph = normPhone11ForBloat(c.phone);
    if (ph && /^01[3-9]\d{8}$/.test(ph)) {
      if (byPhoneKey.has(ph)) unionDocs(byPhoneKey.get(ph)!, c.id);
      else byPhoneKey.set(ph, c.id);
    }
    const mac = normMacForBloat(c.onuMac);
    if (mac) {
      if (byMacKey.has(mac)) unionDocs(byMacKey.get(mac)!, c.id);
      else byMacKey.set(mac, c.id);
    }
  });

  const groups = new Map<string, CustomerMember[]>();
  customers.forEach((c) => {
    const root = findRoot(c.id);
    const arr = groups.get(root) || [];
    arr.push(c);
    groups.set(root, arr);
  });

  const duplicateDocIds: string[] = [];
  const mergedPairsPreview: Array<{ keep: CustomerMember; dropIds: string[] }> = [];
  let duplicateGroupCount = 0;

  groups.forEach((members) => {
    if (members.length <= 1) return;
    duplicateGroupCount += 1;
    const sorted = [...members].sort((a, b) => {
      const diff = scoreCustomerRichness(b) - scoreCustomerRichness(a);
      if (diff !== 0) return diff;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
    const keep = sorted[0];
    const dropIds = sorted.slice(1).map((m) => m.id);
    duplicateDocIds.push(...dropIds);
    mergedPairsPreview.push({ keep, dropIds });
  });

  const dupSet = new Set(duplicateDocIds);
  const phantomDocIds = customers
    .filter((c) => !dupSet.has(c.id) && isPhantomOrJunkCustomerDoc(c))
    .map((c) => c.id);

  // Compare against cachedPortalRows when it looks like a reasonably full member snapshot
  const staleNotInPortalIds: string[] = [];
  if (Array.isArray(cachedPortalRows) && cachedPortalRows.length >= 25) {
    const minAuthThreshold = portalExpectedTotal ? Math.floor(portalExpectedTotal * 0.55) : 25;
    if (cachedPortalRows.length >= Math.min(minAuthThreshold, 25)) {
      const portalIds = new Set<string>();
      const portalPhones = new Set<string>();
      const portalMacs = new Set<string>();
      cachedPortalRows.forEach((r) => {
        const rid = normStrClean(r.memberId);
        if (rid) {
          portalIds.add(rid);
          const stripped = rid.replace(/^(?:dbn|id|uid|mem)[-_]?/i, '');
          if (stripped) portalIds.add(stripped);
        }
        const rph = normPhone11ForBloat(r.phone);
        if (rph) portalPhones.add(rph);
        const rmac = normMacForBloat(r.onuMac);
        if (rmac) portalMacs.add(rmac);
      });

      const alreadyMarked = new Set([...duplicateDocIds, ...phantomDocIds]);
      customers.forEach((c) => {
        if (alreadyMarked.has(c.id)) return;
        const cid = normStrClean(c.memberId);
        const stripped = cid.replace(/^(?:dbn|id|uid|mem)[-_]?/i, '');
        const cph = normPhone11ForBloat(c.phone);
        const cmac = normMacForBloat(c.onuMac);
        const matched =
          (cid && portalIds.has(cid)) ||
          (stripped && portalIds.has(stripped)) ||
          (cph && portalPhones.has(cph)) ||
          (cmac && portalMacs.has(cmac));
        if (!matched) {
          staleNotInPortalIds.push(c.id);
        }
      });
    }
  }

  const cleanupCandidateIds = Array.from(new Set([...duplicateDocIds, ...phantomDocIds]));
  const excessOverPortal =
    portalExpectedTotal !== null && portalExpectedTotal > 0 ? Math.max(0, totalDb - portalExpectedTotal) : 0;
  const hasSignificantBloat =
    cleanupCandidateIds.length > 0 ||
    staleNotInPortalIds.length > 5 ||
    (portalExpectedTotal !== null && portalExpectedTotal > 0 && totalDb > portalExpectedTotal * 1.15 + 15);

  return {
    totalDb,
    portalExpectedTotal,
    duplicateGroupCount,
    duplicateDocIds,
    phantomDocIds,
    staleNotInPortalIds,
    cleanupCandidateIds,
    excessOverPortal,
    hasSignificantBloat,
    mergedPairsPreview
  };
}

function mergeTwoCustomerDocs(keep: CustomerMember, drop: CustomerMember): CustomerMember {
  const bestStr = (a?: string, b?: string) => {
    const sa = (a || '').trim();
    const sb = (b || '').trim();
    if (sa && sa !== '-' && sa !== 'দেওয়া হয়নি') return sa;
    return sb && sb !== '-' && sb !== 'দেওয়া হয়নি' ? sb : sa || sb || '';
  };
  const keepWeakName = !keep.name || normStrClean(keep.name) === normStrClean(keep.memberId);
  const dropWeakName = !drop.name || normStrClean(drop.name) === normStrClean(drop.memberId);
  return stripUndefined({
    ...drop,
    ...keep,
    id: keep.id,
    memberId: bestStr(keep.memberId, drop.memberId),
    name: !keepWeakName ? keep.name : !dropWeakName ? drop.name : keep.name || drop.name,
    phone: normPhone11ForBloat(keep.phone) || normPhone11ForBloat(drop.phone) || bestStr(keep.phone, drop.phone) || 'দেওয়া হয়নি',
    address: bestStr(keep.address, drop.address) || 'ভোলা সদর',
    packageName: bestStr(keep.packageName, drop.packageName) || undefined,
    monthlyFee: keep.monthlyFee && keep.monthlyFee > 0 ? keep.monthlyFee : drop.monthlyFee,
    oltInfo: bestStr(keep.oltInfo, drop.oltInfo) || undefined,
    oltPower: bestStr(keep.oltPower, drop.oltPower) || undefined,
    onuMac: normMacForBloat(keep.onuMac).toUpperCase() || normMacForBloat(drop.onuMac).toUpperCase() || bestStr(keep.onuMac, drop.onuMac) || undefined,
    rxPower: bestStr(keep.rxPower, drop.rxPower) || undefined,
    txPower: bestStr(keep.txPower, drop.txPower) || undefined,
    fiberLength: bestStr(keep.fiberLength, drop.fiberLength) || undefined,
    pingLatency: bestStr(keep.pingLatency, drop.pingLatency) || undefined,
    downloadSpeed: bestStr(keep.downloadSpeed, drop.downloadSpeed) || undefined,
    uploadSpeed: bestStr(keep.uploadSpeed, drop.uploadSpeed) || undefined,
    tjBox: bestStr(keep.tjBox, drop.tjBox) || undefined,
    tjLoss: bestStr(keep.tjLoss, drop.tjLoss) || undefined,
    splitterName: bestStr(keep.splitterName, drop.splitterName) || undefined,
    splitterLoss: bestStr(keep.splitterLoss, drop.splitterLoss) || undefined,
    issueReason: bestStr(keep.issueReason, drop.issueReason) || undefined,
    expiryDate: bestStr(keep.expiryDate, drop.expiryDate) || undefined,
    updatedAt: new Date().toISOString()
  }) as CustomerMember;
}

export async function cleanupAndDeduplicateCustomers(
  customers: CustomerMember[],
  options: {
    mergeDuplicates?: boolean;
    deletePhantoms?: boolean;
    extraDocIdsToDelete?: string[];
  } = { mergeDuplicates: true, deletePhantoms: true }
): Promise<{ mergedGroupCount: number; deletedCount: number; remainingCount: number }> {
  await ensureAuth();
  const report = analyzeCustomerDatabaseBloat(customers);
  const byId = new Map(customers.map((c) => [c.id, c]));

  const updatedCanonicalDocs: CustomerMember[] = [];
  const docIdsToDeleteSet = new Set<string>(options.extraDocIdsToDelete || []);

  if (options.mergeDuplicates !== false) {
    report.mergedPairsPreview.forEach(({ keep, dropIds }) => {
      let merged = keep;
      dropIds.forEach((did) => {
        const dropDoc = byId.get(did);
        if (dropDoc) {
          merged = mergeTwoCustomerDocs(merged, dropDoc);
        }
        docIdsToDeleteSet.add(did);
      });
      updatedCanonicalDocs.push(merged);
    });
  }

  if (options.deletePhantoms !== false) {
    report.phantomDocIds.forEach((pid) => docIdsToDeleteSet.add(pid));
  }

  // Never delete a doc we are keeping as canonical merge target
  updatedCanonicalDocs.forEach((docItem) => docIdsToDeleteSet.delete(docItem.id));

  const docIdsToDelete = Array.from(docIdsToDeleteSet);
  if (docIdsToDelete.length === 0 && updatedCanonicalDocs.length === 0) {
    return { mergedGroupCount: 0, deletedCount: 0, remainingCount: customers.length };
  }

  // Update local cache immediately
  const nextCacheList = customers
    .filter((c) => !docIdsToDeleteSet.has(c.id))
    .map((c) => updatedCanonicalDocs.find((u) => u.id === c.id) || c);
  setCachedData(CACHE_KEYS.CUSTOMERS, nextCacheList);

  if (docIdsToDelete.length > 0) {
    removeOfflineWritesBulk('customers', docIdsToDelete);
    const updatedTombstones = addTombstonesBulk('customers', docIdsToDelete);
    const colTombstonesPayload = {
      customers: updatedTombstones.customers || docIdsToDelete,
      updatedAt: new Date().toISOString()
    };
    setDoc(doc(db, 'settings', DELETED_TOMBSTONES_DOC_ID), colTombstonesPayload, { merge: true }).catch(() => {});
  }

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (isOnline) {
    for (let i = 0; i < updatedCanonicalDocs.length; i += 400) {
      const chunk = updatedCanonicalDocs.slice(i, i + 400);
      try {
        const batch = writeBatch(db);
        chunk.forEach((item) => batch.set(doc(db, 'customers', item.id), stripUndefined(item), { merge: true }));
        await batch.commit();
      } catch {
        for (const item of chunk) {
          await commitDocOfflineSafe('customers', item.id, item, true);
        }
      }
    }
    for (let i = 0; i < docIdsToDelete.length; i += 400) {
      const chunk = docIdsToDelete.slice(i, i + 400);
      try {
        const batch = writeBatch(db);
        chunk.forEach((id) => batch.delete(doc(db, 'customers', id)));
        await batch.commit();
      } catch {
        enqueueOfflineDeletesBulk('customers', chunk);
      }
    }
  } else {
    for (const item of updatedCanonicalDocs) {
      await commitDocOfflineSafe('customers', item.id, item, true);
    }
    if (docIdsToDelete.length > 0) {
      enqueueOfflineDeletesBulk('customers', docIdsToDelete);
    }
  }

  return {
    mergedGroupCount: updatedCanonicalDocs.length,
    deletedCount: docIdsToDelete.length,
    remainingCount: nextCacheList.length
  };
}


export interface MobileDuplicateGroup {
  normalizedPhone: string;
  recommendedKeepId: string;
  members: CustomerMember[];
}

export function detectDuplicateMembersByMobile(customers: CustomerMember[]): MobileDuplicateGroup[] {
  const byPhone = new Map<string, CustomerMember[]>();
  customers.forEach((c) => {
    const normPh = normPhone11ForBloat(c.phone);
    if (!normPh || normPh.length < 10) return;
    // Ignore obvious all-zero / sequential placeholder numbers
    if (/^0+$/.test(normPh) || /^010{8,9}$/.test(normPh)) return;
    const arr = byPhone.get(normPh) || [];
    arr.push(c);
    byPhone.set(normPh, arr);
  });

  const groups: MobileDuplicateGroup[] = [];
  byPhone.forEach((members, normalizedPhone) => {
    if (members.length <= 1) return;
    const sorted = [...members].sort((a, b) => {
      const scoreDiff = scoreCustomerRichness(b) - scoreCustomerRichness(a);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
    groups.push({
      normalizedPhone,
      recommendedKeepId: sorted[0].id,
      members: sorted
    });
  });

  return groups.sort((a, b) => b.members.length - a.members.length || a.normalizedPhone.localeCompare(b.normalizedPhone));
}

export async function deleteRedundantMembersBulk(
  docIdsToDelete: string[],
  allCustomers: CustomerMember[]
): Promise<{ deletedCount: number; remainingCount: number }> {
  await ensureAuth();
  if (docIdsToDelete.length === 0) {
    return { deletedCount: 0, remainingCount: allCustomers.length };
  }
  return cleanupAndDeduplicateCustomers(allCustomers, {
    mergeDuplicates: false,
    deletePhantoms: false,
    extraDocIdsToDelete: docIdsToDelete
  });
}

export async function mergeDuplicateMembersByMobileGroup(
  keepId: string,
  groupMembers: CustomerMember[],
  allCustomers: CustomerMember[]
): Promise<{ mergedCustomer: CustomerMember; deletedCount: number }> {
  await ensureAuth();
  const primary = groupMembers.find((m) => m.id === keepId) || groupMembers[0];
  const redundant = groupMembers.filter((m) => m.id !== primary.id);
  let merged = primary;
  for (const dropItem of redundant) {
    merged = mergeTwoCustomerDocs(merged, dropItem);
  }
  const dropIds = redundant.map((r) => r.id);

  // Persist merged primary doc first (offline-safe)
  await commitDocOfflineSafe('customers', merged.id, stripUndefined(merged), true);

  // Update local cache immediately and delete redundant entries cleanly
  if (dropIds.length > 0) {
    const dropSet = new Set(dropIds);
    const updatedList = allCustomers
      .filter((c) => !dropSet.has(c.id))
      .map((c) => (c.id === merged.id ? merged : c));
    setCachedData(CACHE_KEYS.CUSTOMERS, updatedList);
    removeOfflineWritesBulk('customers', dropIds);
    const updatedTombstones = addTombstonesBulk('customers', dropIds);
    setDoc(
      doc(db, 'settings', DELETED_TOMBSTONES_DOC_ID),
      {
        customers: updatedTombstones.customers || dropIds,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    ).catch(() => {});

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (isOnline) {
      for (let i = 0; i < dropIds.length; i += 400) {
        const chunk = dropIds.slice(i, i + 400);
        try {
          const batch = writeBatch(db);
          chunk.forEach((id) => batch.delete(doc(db, 'customers', id)));
          await batch.commit();
        } catch {
          enqueueOfflineDeletesBulk('customers', chunk);
        }
      }
    } else {
      enqueueOfflineDeletesBulk('customers', dropIds);
    }
  }

  return { mergedCustomer: merged, deletedCount: dropIds.length };
}

