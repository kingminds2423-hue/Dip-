import { signInWithPopup, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import {
  AppUserAccount,
  AppUserRole,
  Company,
  Partner,
  Staff,
  UserRole,
  UserSession
} from '../types';
import { stripUndefined } from './offlineSync';

export const BOOTSTRAPPED_DIRECTOR_EMAIL = 'zahidulislam53330@gmail.com';

export function isBootstrappedDirectorEmail(email?: string | null): boolean {
  return (email || '').trim().toLowerCase() === BOOTSTRAPPED_DIRECTOR_EMAIL;
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  if (!result.user) {
    throw new Error('Google লগইন সম্পন্ন হয়নি। আবার চেষ্টা করুন।');
  }
  return result.user;
}

export async function ensureOrLoadUserAccount(
  fbUser: User,
  meta?: {
    displayName?: string;
    phone?: string;
    requestedRole?: 'staff' | 'partner' | 'manager' | 'director';
  }
): Promise<AppUserAccount> {
  const uid = fbUser.uid;
  const email = (fbUser.email || '').trim();
  const isDirectorBoot =
    fbUser.emailVerified === true && isBootstrappedDirectorEmail(email);
  const nowIso = new Date().toISOString();
  const userRef = doc(db, 'users', uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(userRef);
  } catch (err) {
    handleFirestoreError(err, 'ensureOrLoadUserAccount:getDoc', OperationType.GET, `users/${uid}`);
    existingSnap = null;
  }

  if (existingSnap && existingSnap.exists()) {
    const existing = existingSnap.data() as AppUserAccount;

    // Ensure bootstrapped director always retains director/approved + admin marker
    if (isDirectorBoot) {
      if (existing.role !== 'director' || existing.status !== 'approved') {
        const updatedDirector: AppUserAccount = {
          ...existing,
          role: 'director',
          status: 'approved',
          updatedAt: nowIso
        };
        await setDoc(userRef, stripUndefined(updatedDirector), { merge: true });
        await ensureAdminMarker(fbUser, 'director');
        return updatedDirector;
      }
      await ensureAdminMarker(fbUser, 'director');
      return existing;
    }

    // Update optional non-privileged profile fields if provided
    const nextDisplay = meta?.displayName?.trim() || fbUser.displayName || existing.displayName;
    const nextPhone = meta?.phone?.trim() || existing.phone;
    const nextPhoto = fbUser.photoURL || existing.photoUrl;
    const nextRequested = meta?.requestedRole || existing.requestedRole;

    if (
      nextDisplay !== existing.displayName ||
      nextPhone !== existing.phone ||
      nextPhoto !== existing.photoUrl ||
      nextRequested !== existing.requestedRole
    ) {
      const patch = stripUndefined({
        displayName: nextDisplay,
        phone: nextPhone,
        photoUrl: nextPhoto,
        requestedRole: nextRequested,
        updatedAt: nowIso
      });
      await updateDoc(userRef, patch).catch(() => {});
      return { ...existing, ...patch };
    }

    return existing;
  }

  // First-time Google sign-in document creation
  if (isDirectorBoot) {
    const newDirector: AppUserAccount = stripUndefined({
      uid,
      email,
      displayName: meta?.displayName?.trim() || fbUser.displayName || 'জাহিদুল ইসলাম (পরিচালক)',
      phone: meta?.phone?.trim() || fbUser.phoneNumber || '01721200049',
      photoUrl: fbUser.photoURL || undefined,
      role: 'director',
      requestedRole: 'director',
      status: 'approved',
      createdAt: nowIso,
      updatedAt: nowIso
    });
    await setDoc(userRef, newDirector);
    await ensureAdminMarker(fbUser, 'director');
    return newDirector;
  }

  const newPendingUser: AppUserAccount = stripUndefined({
    uid,
    email,
    displayName: meta?.displayName?.trim() || fbUser.displayName || email.split('@')[0] || 'নতুন ব্যবহারকারী',
    phone: meta?.phone?.trim() || fbUser.phoneNumber || undefined,
    photoUrl: fbUser.photoURL || undefined,
    role: 'pending',
    requestedRole: meta?.requestedRole || 'staff',
    status: 'pending',
    createdAt: nowIso,
    updatedAt: nowIso
  });

  await setDoc(userRef, newPendingUser);
  return newPendingUser;
}

async function ensureAdminMarker(fbUser: User, role: 'director' | 'admin' = 'director'): Promise<void> {
  const adminRef = doc(db, 'admins', fbUser.uid);
  try {
    const snap = await getDoc(adminRef);
    if (!snap.exists()) {
      await setDoc(adminRef, {
        uid: fbUser.uid,
        email: fbUser.email || BOOTSTRAPPED_DIRECTOR_EMAIL,
        role,
        grantedAt: new Date().toISOString(),
        grantedBy: 'bootstrap'
      });
    }
  } catch (err) {
    handleFirestoreError(err, 'ensureAdminMarker', OperationType.WRITE, `admins/${fbUser.uid}`);
  }
}

export function subscribeMyUserAccount(
  uid: string,
  callback: (account: AppUserAccount | null) => void
): () => void {
  return onSnapshot(
    doc(db, 'users', uid),
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as AppUserAccount);
      } else {
        callback(null);
      }
    },
    (err) => {
      handleFirestoreError(err, 'subscribeMyUserAccount', OperationType.GET, `users/${uid}`);
      callback(null);
    }
  );
}

export function subscribeAllUserAccounts(
  callback: (accounts: AppUserAccount[]) => void
): () => void {
  return onSnapshot(
    collection(db, 'users'),
    (snapshot) => {
      const list: AppUserAccount[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as AppUserAccount);
      });
      list.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      });
      callback(list);
    },
    (err) => {
      handleFirestoreError(err, 'subscribeAllUserAccounts', OperationType.LIST, 'users');
      callback([]);
    }
  );
}

export async function approveUserAccountRole(
  targetUid: string,
  nextRole: Exclude<AppUserRole, 'pending'>,
  approver: UserSession,
  linkOptions?: {
    linkedStaffId?: string;
    linkedPartnerId?: string;
  }
): Promise<void> {
  const userRef = doc(db, 'users', targetUid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    throw new Error('ব্যবহারকারীর প্রোফাইল পাওয়া যায়নি।');
  }
  const existing = snap.data() as AppUserAccount;
  const nowIso = new Date().toISOString();

  const updated: AppUserAccount = stripUndefined({
    ...existing,
    role: nextRole,
    status: 'approved',
    linkedStaffId: linkOptions?.linkedStaffId || existing.linkedStaffId,
    linkedPartnerId: linkOptions?.linkedPartnerId || existing.linkedPartnerId,
    approvedBy: approver.name,
    approvedByUid: approver.uid || approver.id,
    approvedAt: nowIso,
    rejectionReason: undefined,
    createdAt: existing.createdAt || nowIso,
    updatedAt: nowIso
  });

  await setDoc(userRef, updated);

  const adminRef = doc(db, 'admins', targetUid);
  if (nextRole === 'director' || nextRole === 'admin') {
    await setDoc(adminRef, {
      uid: targetUid,
      email: existing.email,
      role: nextRole,
      grantedAt: nowIso,
      grantedBy: approver.uid || approver.id
    });
  } else {
    await deleteDoc(adminRef).catch(() => {});
  }
}

export async function rejectUserAccountRole(
  targetUid: string,
  approver: UserSession,
  reason?: string
): Promise<void> {
  const userRef = doc(db, 'users', targetUid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    throw new Error('ব্যবহারকারীর প্রোফাইল পাওয়া যায়নি।');
  }
  const existing = snap.data() as AppUserAccount;
  const nowIso = new Date().toISOString();

  const updated: AppUserAccount = stripUndefined({
    ...existing,
    role: 'pending',
    status: 'rejected',
    approvedBy: approver.name,
    approvedByUid: approver.uid || approver.id,
    approvedAt: nowIso,
    rejectionReason: (reason || 'পরিচালক কর্তৃক অনুমোদন স্থগিত বা বাতিল করা হয়েছে').slice(0, 280),
    createdAt: existing.createdAt || nowIso,
    updatedAt: nowIso
  });

  await setDoc(userRef, updated);
  await deleteDoc(doc(db, 'admins', targetUid)).catch(() => {});
}

export function buildSessionFromUserAccount(
  account: AppUserAccount,
  fbUser: User,
  staffs: Staff[] = [],
  partners: Partner[] = [],
  company?: Company | null
): UserSession | null {
  if (account.status !== 'approved' || account.role === 'pending') {
    return null;
  }

  const effectiveRole: UserRole =
    account.role === 'admin'
      ? 'director'
      : account.role === 'director' ||
        account.role === 'manager' ||
        account.role === 'staff' ||
        account.role === 'partner'
      ? account.role
      : 'staff';

  if (effectiveRole === 'director') {
    return {
      role: 'director',
      id: account.uid || 'director',
      uid: fbUser.uid,
      email: account.email || fbUser.email || undefined,
      photoUrl: account.photoUrl || fbUser.photoURL || undefined,
      name:
        account.displayName ||
        (company?.ownerName ? `${company.ownerName} (পরিচালক)` : 'জাহিদুল ইসলাম (পরিচালক)'),
      designation: 'প্রধান পরিচালক ও স্বত্বাধিকারী',
      phone: account.phone || company?.phone || '01721200049'
    };
  }

  if (effectiveRole === 'manager') {
    return {
      role: 'manager',
      id: account.linkedStaffId || account.uid,
      uid: fbUser.uid,
      email: account.email || fbUser.email || undefined,
      photoUrl: account.photoUrl || fbUser.photoURL || undefined,
      name: account.displayName || 'শাখা ম্যানেজার',
      designation: 'শাখা ও জেনারেল ম্যানেজার',
      phone: account.phone
    };
  }

  if (effectiveRole === 'partner') {
    const linkedPartner =
      partners.find((p) => p.id === account.linkedPartnerId) ||
      partners.find(
        (p) =>
          (p.email && account.email && p.email.toLowerCase() === account.email.toLowerCase()) ||
          (p.phone && account.phone && p.phone.replace(/\D/g, '') === account.phone.replace(/\D/g, ''))
      );
    return {
      role: 'partner',
      id: linkedPartner?.id || account.linkedPartnerId || account.uid,
      uid: fbUser.uid,
      email: account.email || fbUser.email || undefined,
      photoUrl: linkedPartner?.photoUrl || account.photoUrl || fbUser.photoURL || undefined,
      name: linkedPartner?.name || account.displayName || 'শেয়ার অংশীদার',
      designation: linkedPartner?.role || 'শেয়ার অংশীদার',
      phone: linkedPartner?.phone || account.phone
    };
  }

  // Staff role
  const linkedStaff =
    staffs.find((s) => s.id === account.linkedStaffId) ||
    staffs.find(
      (s) =>
        (s.email && account.email && s.email.toLowerCase() === account.email.toLowerCase()) ||
        (s.phone && account.phone && s.phone.replace(/\D/g, '') === account.phone.replace(/\D/g, ''))
    );

  return {
    role: 'staff',
    id: linkedStaff?.id || account.linkedStaffId || account.uid,
    uid: fbUser.uid,
    email: account.email || fbUser.email || undefined,
    photoUrl: linkedStaff?.photoUrl || account.photoUrl || fbUser.photoURL || undefined,
    name: linkedStaff?.name || account.displayName || 'ফিল্ড স্টাফ',
    designation: linkedStaff?.designation || 'টেকনিশিয়ান ও ফিল্ড স্টাফ',
    phone: linkedStaff?.phone || account.phone,
    allowedPortals: linkedStaff?.allowedPortals,
    actionPermissions: linkedStaff?.actionPermissions
  };
}
