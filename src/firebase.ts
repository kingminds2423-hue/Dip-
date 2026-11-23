import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  enableNetwork,
  doc,
  getDocFromServer,
  Firestore
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with Long-Polling transport so restricted proxies, iframes, and mobile WebAPKs connect reliably without WebChannel handshake failures
const rawConfig = firebaseConfig as Record<string, any>;
const firestoreDbId: string | undefined = rawConfig.firestoreDatabaseId || undefined;
const isBrowser = typeof window !== 'undefined';

let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      ...(isBrowser
        ? {
            experimentalForceLongPolling: true
          }
        : {}),
      ignoreUndefinedProperties: true,
      localCache: isBrowser
        ? persistentLocalCache({
            tabManager: persistentMultipleTabManager()
          })
        : memoryLocalCache()
    },
    firestoreDbId
  );
} catch {
  try {
    firestoreInstance = initializeFirestore(
      app,
      {
        ...(isBrowser
          ? {
              experimentalForceLongPolling: true
            }
          : {}),
        ignoreUndefinedProperties: true,
        localCache: memoryLocalCache()
      },
      firestoreDbId
    );
  } catch {
    firestoreInstance = firestoreDbId
      ? getFirestore(app, firestoreDbId)
      : getFirestore(app);
  }
}

export const db = firestoreInstance;

// Validate initial connection to Firestore server cleanly after cold-start network stabilizes
async function testConnection() {
  if (!isBrowser || !navigator.onLine) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    window.dispatchEvent(
      new CustomEvent('dip_bhola_firestore_cloud_sync', {
        detail: { at: new Date().toISOString() }
      })
    );
  } catch (error) {
    const errCode = (error as { code?: string } | null)?.code || '';
    const errMsg = error instanceof Error ? error.message : String(error || '');
    if (errMsg.includes('the client is offline') || errCode === 'unavailable') {
      try {
        await enableNetwork(db).catch(() => {});
      } catch {
        // non-fatal; offline cache remains active
      }
      console.warn('Operating with Firestore offline cache until server connection stabilizes.');
    }
  }
}
if (isBrowser) {
  window.setTimeout(() => {
    void testConnection();
  }, 1500);
  window.addEventListener('online', () => {
    void enableNetwork(db)
      .then(() => testConnection())
      .catch(() => {});
  });
}

// Initialize Firebase Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  code: string;
  message: string;
  operation: string;
  timestamp: string;
  operationType?: OperationType | string;
  path?: string | null;
  authInfo?: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: Array<{
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }>;
  };
}

const errorListeners = new Set<(info: FirestoreErrorInfo | null) => void>();
let lastFirestoreError: FirestoreErrorInfo | null = null;

export function subscribeFirestoreErrors(cb: (info: FirestoreErrorInfo | null) => void): () => void {
  errorListeners.add(cb);
  cb(lastFirestoreError);
  return () => {
    errorListeners.delete(cb);
  };
}

export function clearFirestoreError(): void {
  lastFirestoreError = null;
  errorListeners.forEach((cb) => {
    try {
      cb(null);
    } catch {
      // ignore
    }
  });
}

export function handleFirestoreError(
  error: unknown,
  operation: string,
  operationType: OperationType | string = OperationType.GET,
  path: string | null = null
): FirestoreErrorInfo {
  const err = error as { code?: string; message?: string };
  const info: FirestoreErrorInfo = {
    code: err.code || 'unknown',
    message: err.message || 'একটি অপ্রত্যাশিত সমস্যা দেখা দিয়েছে',
    operation,
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: (auth.currentUser?.providerData || []).map((provider) => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL,
      })),
    },
    timestamp: new Date().toISOString(),
  };

  console.error(`Firestore [${operation}] ত্রুটি:`, JSON.stringify(info), error);

  // Surface critical Firestore errors (permission denied, quota exceeded, failed precondition)
  if (
    info.code === 'permission-denied' ||
    info.code === 'resource-exhausted' ||
    info.code === 'failed-precondition' ||
    info.code === 'unauthenticated'
  ) {
    lastFirestoreError = info;
    errorListeners.forEach((cb) => {
      try {
        cb(info);
      } catch {
        // ignore
      }
    });
  }

  return info;
}

export default app;
