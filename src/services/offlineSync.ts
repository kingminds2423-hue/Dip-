import { doc, setDoc, deleteDoc, waitForPendingWrites } from 'firebase/firestore';
import { db } from '../firebase';

const OFFLINE_QUEUE_KEY = 'dip_bhola_offline_queue_v1';
const DELETED_TOMBSTONES_KEY = 'dip_bhola_deleted_tombstones_v1';
const LAST_CLOUD_SYNC_AT_KEY = 'dip_bhola_last_cloud_sync_at_v1';

export type TombstonesMap = Record<string, string[]>;

function readTombstonesMap(): TombstonesMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(DELETED_TOMBSTONES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeTombstonesMap(map: TombstonesMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DELETED_TOMBSTONES_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Tombstone storage error:', e);
  }
}

export function getTombstones(collectionName: string): Set<string> {
  const map = readTombstonesMap();
  const arr = map[collectionName];
  return new Set(Array.isArray(arr) ? arr : []);
}

export function getAllTombstonesMap(): TombstonesMap {
  return readTombstonesMap();
}

export function addTombstone(collectionName: string, docId: string): TombstonesMap {
  const map = readTombstonesMap();
  const prev = Array.isArray(map[collectionName]) ? map[collectionName] : [];
  if (!prev.includes(docId)) {
    map[collectionName] = [...prev, docId].slice(-2500);
    writeTombstonesMap(map);
  }
  return map;
}

export function addTombstonesBulk(collectionName: string, docIds: string[]): TombstonesMap {
  const map = readTombstonesMap();
  const prev = Array.isArray(map[collectionName]) ? map[collectionName] : [];
  const merged = Array.from(new Set([...prev, ...docIds.filter((id) => typeof id === 'string' && id.length > 0)])).slice(-2500);
  map[collectionName] = merged;
  writeTombstonesMap(map);
  return map;
}

export function removeTombstone(collectionName: string, docId: string): TombstonesMap {
  const map = readTombstonesMap();
  const prev = Array.isArray(map[collectionName]) ? map[collectionName] : [];
  if (prev.includes(docId)) {
    map[collectionName] = prev.filter((id) => id !== docId);
    writeTombstonesMap(map);
  }
  return map;
}

export function mergeTombstonesFromRemote(remoteMap: TombstonesMap | null | undefined): boolean {
  if (!remoteMap || typeof remoteMap !== 'object') return false;
  const localMap = readTombstonesMap();
  let changed = false;
  const nextMap: TombstonesMap = { ...localMap };

  for (const [col, ids] of Object.entries(remoteMap)) {
    if (!Array.isArray(ids)) continue;
    const localSet = new Set(Array.isArray(nextMap[col]) ? nextMap[col] : []);
    const beforeSize = localSet.size;
    ids.forEach((id) => {
      if (typeof id === 'string' && id.length > 0) localSet.add(id);
    });
    if (localSet.size !== beforeSize) {
      changed = true;
    }
    nextMap[col] = Array.from(localSet).slice(-2500);
  }

  if (changed) {
    writeTombstonesMap(nextMap);
    notifyListeners();
  }
  return changed;
}

export function clearAllTombstones(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(DELETED_TOMBSTONES_KEY);
    notifyListeners();
  } catch {
    // ignore
  }
}

export interface OfflineQueuedWrite {
  docId: string;
  collectionName: string;
  op: 'set' | 'delete';
  merge?: boolean;
  data?: Record<string, any>;
  queuedAt: string;
}

export interface OfflineSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  pendingDocIds: string[];
  lastAutoSyncedCount: number;
  lastSyncedAt: string | null;
}

/**
 * Recursively removes keys with `undefined` values (and transient `_pendingSync` markers)
 * so Firestore `setDoc` never throws `Unsupported field value: undefined`.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [key, val] of Object.entries(value as Record<string, any>)) {
      if (val !== undefined && key !== '_pendingSync') {
        out[key] = stripUndefined(val);
      }
    }
    return out as T;
  }
  return value;
}

function readQueue(): OfflineQueuedWrite[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: OfflineQueuedWrite[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('Offline queue storage error:', e);
  }
}

export function getOfflineQueue(): OfflineQueuedWrite[] {
  return readQueue();
}

export function getOfflineQueuedDocsForCollection<T extends { id: string }>(
  collectionName: string
): Array<T & { _pendingSync: boolean }> {
  const tombstones = getTombstones(collectionName);
  return readQueue()
    .filter((item) => item.collectionName === collectionName && item.op === 'set' && item.data && !tombstones.has(item.docId))
    .map((item) => ({
      ...(item.data as T),
      id: item.docId,
      _pendingSync: true
    }));
}

export function getOfflineDeletedIdsForCollection(collectionName: string): Set<string> {
  const ids = getTombstones(collectionName);
  readQueue()
    .filter((item) => item.collectionName === collectionName && item.op === 'delete')
    .forEach((item) => ids.add(item.docId));
  return ids;
}

function readPersistedLastSyncedAt(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_CLOUD_SYNC_AT_KEY);
    if (!raw || Number.isNaN(Date.parse(raw))) return null;
    return raw;
  } catch {
    return null;
  }
}

function writePersistedLastSyncedAt(iso: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_CLOUD_SYNC_AT_KEY, iso);
  } catch {
    // ignore storage quota errors
  }
}

let isSyncingNow = false;
let lastAutoSyncedCount = 0;
let lastSyncedAt: string | null = readPersistedLastSyncedAt();
let lastSyncRecordPerfMs = 0;
const listeners = new Set<(state: OfflineSyncState) => void>();

export function recordSuccessfulCloudSync(isoTimestamp?: string, throttleMs = 1500): void {
  const nowMs = Date.now();
  if (throttleMs > 0 && lastSyncedAt && nowMs - lastSyncRecordPerfMs < throttleMs) {
    return;
  }
  const iso = isoTimestamp || new Date().toISOString();
  lastSyncRecordPerfMs = nowMs;
  lastSyncedAt = iso;
  writePersistedLastSyncedAt(iso);
  notifyListeners();
}

export function getOfflineSyncState(): OfflineSyncState {
  const queue = readQueue();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  return {
    isOnline,
    isSyncing: isSyncingNow,
    pendingCount: queue.length,
    pendingDocIds: queue.map((q) => q.docId),
    lastAutoSyncedCount,
    lastSyncedAt
  };
}

function notifyListeners(): void {
  const state = getOfflineSyncState();
  listeners.forEach((cb) => {
    try {
      cb(state);
    } catch {
      // ignore subscriber errors
    }
  });
}

export function subscribeOfflineSyncState(cb: (state: OfflineSyncState) => void): () => void {
  listeners.add(cb);
  cb(getOfflineSyncState());
  return () => {
    listeners.delete(cb);
  };
}

export function enqueueOfflineWrite(entry: OfflineQueuedWrite): void {
  const current = readQueue();
  const existingIdx = current.findIndex(
    (q) => q.collectionName === entry.collectionName && q.docId === entry.docId
  );

  if (existingIdx >= 0) {
    const existing = current[existingIdx];
    if (entry.op === 'set' && entry.merge && existing.op === 'set' && existing.data) {
      current[existingIdx] = {
        ...entry,
        data: { ...existing.data, ...(entry.data || {}) },
        merge: existing.merge
      };
    } else {
      current[existingIdx] = entry;
    }
  } else {
    current.push(entry);
  }

  writeQueue(current);
  notifyListeners();
}

export function removeOfflineWrite(collectionName: string, docId: string): void {
  const current = readQueue();
  const next = current.filter(
    (q) => !(q.collectionName === collectionName && q.docId === docId)
  );
  if (next.length !== current.length) {
    writeQueue(next);
    notifyListeners();
  }
}

export function purgeOfflineCollectionWrites(collectionName: string): void {
  const current = readQueue();
  const next = current.filter((q) => q.collectionName !== collectionName);
  if (next.length !== current.length) {
    writeQueue(next);
    notifyListeners();
  }
}

export function enqueueOfflineDeletesBulk(collectionName: string, docIds: string[]): void {
  if (docIds.length === 0) return;
  const idSet = new Set(docIds);
  const current = readQueue().filter(
    (q) => !(q.collectionName === collectionName && idSet.has(q.docId))
  );
  const nowIso = new Date().toISOString();
  docIds.forEach((docId) => {
    current.push({
      docId,
      collectionName,
      op: 'delete',
      queuedAt: nowIso
    });
  });
  writeQueue(current);
  notifyListeners();
}

export function removeOfflineWritesBulk(collectionName: string, docIds: string[]): void {
  if (docIds.length === 0) return;
  const idSet = new Set(docIds);
  const current = readQueue();
  const next = current.filter(
    (q) => !(q.collectionName === collectionName && idSet.has(q.docId))
  );
  if (next.length !== current.length) {
    writeQueue(next);
    notifyListeners();
  }
}

export function clearLastAutoSyncedNotice(): void {
  lastAutoSyncedCount = 0;
  notifyListeners();
}

/**
 * Offline-safe Firestore write:
 * 1. Strips all `undefined` properties so Firestore never rejects payloads.
 * 2. Saves to local offline queue immediately so offline entries survive app closes/reloads.
 * 3. Writes to Firestore persistent IndexedDB cache and waits up to 2.5s for server ACK.
 *    If offline or slow network, returns cleanly without hanging the UI and auto-syncs on reconnect.
 */
export async function commitDocOfflineSafe(
  collectionName: string,
  docId: string,
  rawData: Record<string, any>,
  merge = false
): Promise<{ syncedOnline: boolean }> {
  const cleanData = stripUndefined({ ...rawData });
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  removeTombstone(collectionName, docId);

  enqueueOfflineWrite({
    docId,
    collectionName,
    op: 'set',
    merge,
    data: cleanData,
    queuedAt: new Date().toISOString()
  });

  const ref = doc(db, collectionName, docId);
  const writePromise = merge
    ? setDoc(ref, cleanData, { merge: true })
    : setDoc(ref, cleanData);

  writePromise
    .then(() => {
      removeOfflineWrite(collectionName, docId);
      recordSuccessfulCloudSync(undefined, 0);
    })
    .catch((err) => {
      console.warn(`Queued write [${collectionName}/${docId}] awaiting online sync:`, err);
    });

  if (!isOnline) {
    return { syncedOnline: false };
  }

  const outcome = await Promise.race([
    writePromise.then(() => 'synced' as const).catch(() => 'queued' as const),
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 2600))
  ]);

  if (outcome === 'synced') {
    removeOfflineWrite(collectionName, docId);
    recordSuccessfulCloudSync(undefined, 0);
    return { syncedOnline: true };
  }

  return { syncedOnline: false };
}

export async function deleteDocOfflineSafe(
  collectionName: string,
  docId: string
): Promise<{ syncedOnline: boolean }> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Record persistent tombstone immediately so deleted items NEVER reappear offline or online
  const updatedTombstones = addTombstone(collectionName, docId);
  const colTombstonesPayload = {
    [collectionName]: updatedTombstones[collectionName] || [docId],
    updatedAt: new Date().toISOString()
  };
  enqueueOfflineWrite({
    docId: 'deleted_tombstones',
    collectionName: 'settings',
    op: 'set',
    merge: true,
    data: colTombstonesPayload,
    queuedAt: new Date().toISOString()
  });

  // Persist tombstone doc to Firestore as well (non-blocking merge so other collections are preserved)
  setDoc(doc(db, 'settings', 'deleted_tombstones'), colTombstonesPayload, { merge: true })
    .then(() => {
      removeOfflineWrite('settings', 'deleted_tombstones');
    })
    .catch(() => {});

  const existingQueue = readQueue();
  const isOnlyQueuedOffline = existingQueue.some(
    (q) => q.collectionName === collectionName && q.docId === docId && q.op === 'set' && !q.merge
  );

  if (isOnlyQueuedOffline) {
    removeOfflineWrite(collectionName, docId);
    deleteDoc(doc(db, collectionName, docId)).catch(() => {});
    notifyListeners();
    return { syncedOnline: isOnline };
  }

  enqueueOfflineWrite({
    docId,
    collectionName,
    op: 'delete',
    queuedAt: new Date().toISOString()
  });

  const delPromise = deleteDoc(doc(db, collectionName, docId))
    .then(() => {
      removeOfflineWrite(collectionName, docId);
      recordSuccessfulCloudSync(undefined, 0);
    })
    .catch((err) => {
      console.warn(`Queued delete [${collectionName}/${docId}] awaiting online sync:`, err);
    });

  if (!isOnline) {
    return { syncedOnline: false };
  }

  const outcome = await Promise.race([
    delPromise.then(() => 'synced' as const).catch(() => 'queued' as const),
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 2600))
  ]);

  return { syncedOnline: outcome === 'synced' };
}

/**
 * Automatically flushes all offline entries to Firestore when internet connectivity returns.
 */
export async function flushOfflineQueue(): Promise<number> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    notifyListeners();
    return 0;
  }
  if (isSyncingNow) return 0;

  const queue = readQueue();
  if (queue.length === 0) {
    notifyListeners();
    return 0;
  }

  isSyncingNow = true;
  notifyListeners();

  let syncedCount = 0;

  try {
    for (const item of queue) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) break;
      try {
        const ref = doc(db, item.collectionName, item.docId);
        if (item.op === 'delete') {
          await deleteDoc(ref);
        } else if (item.data) {
          const clean = stripUndefined(item.data);
          await (item.merge ? setDoc(ref, clean, { merge: true }) : setDoc(ref, clean));
        }
        removeOfflineWrite(item.collectionName, item.docId);
        syncedCount += 1;
      } catch (err) {
        console.warn(`Auto-sync item [${item.collectionName}/${item.docId}] deferred:`, err);
      }
    }

    try {
      await Promise.race([
        waitForPendingWrites(db),
        new Promise((resolve) => setTimeout(resolve, 4000))
      ]);
    } catch {
      // ignore waitForPendingWrites timeout
    }

    if (syncedCount > 0) {
      lastAutoSyncedCount = syncedCount;
      recordSuccessfulCloudSync(undefined, 0);
    }
  } finally {
    isSyncingNow = false;
    notifyListeners();
  }

  return syncedCount;
}

let listenersInitialized = false;

export function initOfflineAutoSync(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (listenersInitialized) return () => {};
  listenersInitialized = true;

  const handleOnline = () => {
    notifyListeners();
    setTimeout(() => {
      flushOfflineQueue();
    }, 600);
  };

  const handleOffline = () => {
    notifyListeners();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      flushOfflineQueue();
    }
  };

  const handleCloudSyncEvent = (e: Event) => {
    const customEvt = e as CustomEvent<{ at?: string }>;
    recordSuccessfulCloudSync(customEvt?.detail?.at, 0);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('dip_bhola_firestore_cloud_sync', handleCloudSyncEvent);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  const periodicTimer = window.setInterval(() => {
    if (navigator.onLine && readQueue().length > 0 && !isSyncingNow) {
      flushOfflineQueue();
    }
  }, 15000);

  // Run an initial check on boot if online
  if (navigator.onLine && readQueue().length > 0) {
    setTimeout(() => flushOfflineQueue(), 1200);
  }

  return () => {
    listenersInitialized = false;
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    window.removeEventListener('dip_bhola_firestore_cloud_sync', handleCloudSyncEvent);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.clearInterval(periodicTimer);
  };
}
