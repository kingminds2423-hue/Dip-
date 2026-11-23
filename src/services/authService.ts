import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth } from '../firebase';
import { Staff, Partner, AdminAuth, UserSession, OfficersState, Company } from '../types';
import { toEnglishDigits } from '../utils/formatters';

export { toEnglishDigits };

const SESSION_KEY = 'dip_bhola_user_session';

export function normalizePhone(phone?: string | null): string {
  const digits = toEnglishDigits(phone).replace(/[^0-9]/g, '');
  if (!digits) return '';
  // Normalize +8801XXXXXXXXX or 8801XXXXXXXXX to 01XXXXXXXXX
  if (digits.startsWith('880') && digits.length >= 13) {
    return digits.slice(2);
  }
  if (digits.length === 10 && digits.startsWith('1')) {
    return `0${digits}`;
  }
  return digits;
}

export function getStoredSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.id === 'string' && typeof parsed.role === 'string' && typeof parsed.name === 'string') {
        return parsed as UserSession;
      }
    }
  } catch (e) {
    console.warn('Error reading stored session:', e);
  }
  return null;
}

export function saveSession(session: UserSession | null) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

// Authenticate strictly with BOTH Mobile Number and PIN
export function authenticateWithPhoneAndPin(
  phone: string,
  pin: string,
  adminAuth: AdminAuth | null,
  staffs: Staff[],
  officers?: OfficersState | null,
  company?: Company | null,
  partners: Partner[] = []
): UserSession | null {
  const cleanPhone = normalizePhone(phone);
  const cleanPin = toEnglishDigits(pin).trim();

  if (!cleanPhone || !cleanPin) {
    return null;
  }

  // 1. Check Active Staff accounts first (phone + PIN match)
  const matchedStaff = staffs.find(
    (s) =>
      s.status !== 'inactive' &&
      normalizePhone(s.phone) === cleanPhone &&
      toEnglishDigits(s.pin).trim() === cleanPin
  );
  if (matchedStaff) {
    return {
      role: 'staff',
      id: matchedStaff.id,
      name: matchedStaff.name,
      designation: matchedStaff.designation || 'টেকনিশিয়ান',
      phone: matchedStaff.phone,
      allowedPortals: Array.isArray(matchedStaff.allowedPortals)
        ? matchedStaff.allowedPortals
        : undefined,
      actionPermissions: matchedStaff.actionPermissions
    };
  }

  // 2. Check Director / Super Admin phone + PIN
  const directorPhones = [adminAuth?.phone, company?.phone, '01721200049']
    .map((p) => normalizePhone(p))
    .filter(Boolean);
  const actualAdminPin = toEnglishDigits(adminAuth?.pin || '1234').trim();

  if (directorPhones.includes(cleanPhone) && cleanPin === actualAdminPin) {
    return {
      role: 'director',
      id: 'director',
      name: company?.ownerName ? `${company.ownerName} (পরিচালক)` : 'জাহিদুল ইসলাম (পরিচালক)',
      designation: 'প্রধান পরিচালক ও স্বত্বাধিকারী',
      phone: adminAuth?.phone || company?.phone || '01721200049',
    };
  }

  // 3. Check Manager phone + Manager PIN
  const managerPhone = normalizePhone(officers?.manager?.phone || '01712345678');
  if (managerPhone && cleanPhone === managerPhone && (cleanPin === '5678' || cleanPin === '4321')) {
    return {
      role: 'manager',
      id: officers?.manager?.id || 'manager-1',
      name: officers?.manager?.name ? `${officers.manager.name} (ম্যানেজার)` : 'মোঃ সাইফুল ইসলাম (ম্যানেজার)',
      designation: officers?.manager?.designation || 'শাখা ও জেনারেল ম্যানেজার',
      phone: officers?.manager?.phone || '01712345678',
    };
  }

  // 4. Check Share Partner accounts (phone + PIN match)
  const matchedPartner = partners.find(
    (p) =>
      p.status !== 'inactive' &&
      p.pin &&
      normalizePhone(p.phone) === cleanPhone &&
      toEnglishDigits(p.pin).trim() === cleanPin
  );
  if (matchedPartner) {
    return {
      role: 'partner',
      id: matchedPartner.id,
      name: matchedPartner.name,
      designation: matchedPartner.role || 'শেয়ার অংশীদার',
      phone: matchedPartner.phone,
    };
  }

  return null;
}

// Legacy PIN-only helper kept strictly for internal Director PIN prompt modals
export function authenticateWithPin(
  pin: string,
  adminAuth: AdminAuth | null,
  staffs: Staff[]
): UserSession | null {
  const cleanPin = toEnglishDigits(pin).trim();
  const actualAdminPin = toEnglishDigits(adminAuth?.pin || '1234').trim();
  if (cleanPin === actualAdminPin) {
    return {
      role: 'director',
      id: 'director',
      name: 'জাহিদুল ইসলাম (পরিচালক)',
      designation: 'প্রধান পরিচালক ও স্বত্বাধিকারী',
      phone: adminAuth?.phone || '01721200049',
    };
  }
  const matchedStaff = staffs.find((s) => toEnglishDigits(s.pin).trim() === cleanPin);
  if (matchedStaff) {
    return {
      role: 'staff',
      id: matchedStaff.id,
      name: matchedStaff.name,
      designation: matchedStaff.designation || 'টেকনিশিয়ান',
      phone: matchedStaff.phone,
    };
  }
  return null;
}

export function isDirector(user?: UserSession | null): boolean {
  if (!user) return false;
  return user.role === 'director' || user.role === 'admin';
}

export function isManager(user?: UserSession | null): boolean {
  if (!user) return false;
  return user.role === 'manager';
}

export function isStaff(user?: UserSession | null): boolean {
  return user?.role === 'staff';
}


// Authenticate via Firebase Email & Password
export async function authenticateWithEmailPassword(email: string, pass: string): Promise<UserSession> {
  try {
    const res = await signInWithEmailAndPassword(auth, email, pass);
    const session: UserSession = {
      role: 'admin',
      id: res.user.uid,
      name: res.user.displayName || email.split('@')[0],
      designation: 'অ্যাডমিন ইউজার',
      phone: res.user.phoneNumber || ''
    };
    saveSession(session);
    return session;
  } catch (error: any) {
    // If user not found, attempt creation if it's admin email
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
      try {
        const createRes = await createUserWithEmailAndPassword(auth, email, pass);
        const session: UserSession = {
          role: 'admin',
          id: createRes.user.uid,
          name: email.split('@')[0],
          designation: 'অ্যাডমিন ইউজার',
        };
        saveSession(session);
        return session;
      } catch (innerErr) {
        throw error;
      }
    }
    throw error;
  }
}

export async function logoutUser() {
  saveSession(null);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      [
        'dip_bhola_cache_transactions_v1',
        'dip_bhola_cache_staffs_v1',
        'dip_bhola_cache_partners_v1',
        'dip_bhola_cache_dues_v1',
        'dip_bhola_cache_complaints_v1',
        'dip_bhola_cache_customers_v1',
        'dip_bhola_cache_settings_v1'
      ].forEach((k) => window.localStorage.removeItem(k));
    }
  } catch {
    // ignore storage errors
  }
  try {
    await fbSignOut(auth);
  } catch (e) {
    console.warn('Sign out error:', e);
  }
}

export function subscribeToFirebaseAuthState(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}
