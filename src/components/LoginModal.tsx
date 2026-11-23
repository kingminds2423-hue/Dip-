import React, { useMemo, useState } from 'react';
import {
  X,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Smartphone,
  LogOut,
  RefreshCw,
  Clock,
  Ban,
  UserPlus,
  Loader2,
  Lock
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { AppUserAccount, Company, UserSession } from '../types';
import {
  BOOTSTRAPPED_DIRECTOR_EMAIL,
  signInWithGoogle
} from '../services/userRoleService';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  company?: Company | null;
  isLocked?: boolean;
  firebaseUser?: User | null;
  appUserAccount?: AppUserAccount | null;
  authLoading?: boolean;
  currentUser?: UserSession | null;
  onOpenPlayStore?: () => void;
  onOpenJoinPortal?: () => void;
  onSignOut?: () => Promise<void> | void;
  onRefreshAccount?: () => Promise<void> | void;
}

interface PublicPortalInfo {
  id: string;
  shortLabel: string;
  title: string;
  summary: string;
  drawIcon: () => React.ReactNode;
}

const PUBLIC_ERP_PORTALS: PublicPortalInfo[] = [
  {
    id: 'dashboard',
    shortLabel: 'ড্যাশবোর্ড',
    title: 'দৈনিক নির্বাহী ড্যাশবোর্ড',
    summary: 'আয়-ব্যয় সামারি, ক্যাশ ব্যালেন্স ও দৈনিক লেনদেন চার্ট। লগইন করে আসল হিসাব দেখুন।',
    drawIcon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 sm:w-5 sm:h-5">
        <circle cx="12" cy="7.5" r="3.5" />
        <path d="M5.5 20.5c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
      </svg>
    )
  },
  {
    id: 'staff',
    shortLabel: 'স্টাফ ও বেতন',
    title: 'স্টাফ ও বেতন ব্যবস্থাপনা',
    summary: 'কর্মরত স্টাফ প্রোফাইল, মাসিক বেতন ও ছবি সহ QR ID কার্ড।',
    drawIcon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 sm:w-5 sm:h-5">
        <circle cx="12" cy="6.5" r="3" />
        <circle cx="6.2" cy="16.5" r="3" />
        <circle cx="17.8" cy="16.5" r="3" />
      </svg>
    )
  },
  {
    id: 'reports',
    shortLabel: 'রিপোর্ট ও PDF',
    title: 'আর্থিক রিপোর্ট ও QR PDF বিশ্লেষণ',
    summary: 'দৈনিক, মাসিক ও বাৎসরিক অডিট স্টেটমেন্ট, QR স্ক্যান ও A4 প্রিন্ট।',
    drawIcon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 sm:w-5 sm:h-5">
        <rect x="4" y="3.5" width="16" height="17" rx="2" />
        <path d="M8 8h8M8 12h4M7 17l3-3 2.5 1.5L17 11" />
      </svg>
    )
  },
  {
    id: 'ledger',
    shortLabel: 'হিসাব খাতা',
    title: 'দৈনিক আয়-ব্যয় হিসাব খাতা',
    summary: 'প্রতিদিনের জমা-খরচ ভাউচার, নগদ ও ব্যাংক হিসাব পরিচালনা।',
    drawIcon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 sm:w-5 sm:h-5">
        <path d="M14.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7L14.5 3.5z" />
        <path d="M9 12h6M9 15.5h4" />
      </svg>
    )
  },
  {
    id: 'dues',
    shortLabel: 'বাকি ও বিল',
    title: 'গ্রাহক বকেয়া ও বিল কালেকশন',
    summary: 'বকেয়া লেজার ও আংশিক/পূর্ণ বিল আদায়।',
    drawIcon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 sm:w-5 sm:h-5">
        <path d="M3.5 4v16h17" />
        <path d="M6.5 15l4-4 3.5 2.5 5.5-6" />
      </svg>
    )
  },
  {
    id: 'backup',
    shortLabel: 'ব্যাকআপ',
    title: 'ক্লাউড ড্রাইভ ও ডাটা ব্যাকআপ',
    summary: 'Google Drive PDF/CSV ব্যাকআপ ও রিস্টোর সিস্টেম।',
    drawIcon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 sm:w-5 sm:h-5">
        <path d="M7.5 15.5h9a3.5 3.5 0 0 0 .5-6.95A5 5 0 0 0 7.2 7.4 3.5 3.5 0 0 0 7.5 15.5z" />
        <path d="M12 15.5v4.5M9 15.5l-2.5 3M15 15.5l2.5 3" />
      </svg>
    )
  },
  {
    id: 'officers',
    shortLabel: 'কর্মকর্তা',
    title: 'ম্যানেজার ও অডিটর প্যানেল',
    summary: 'হিসাবরক্ষক, ম্যানেজার ও অডিটর অনুমোদন পোর্টাল।',
    drawIcon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 sm:w-5 sm:h-5">
        <rect x="9.5" y="3.5" width="5" height="4" rx="0.8" />
        <rect x="4" y="16" width="4.5" height="4" rx="0.8" />
        <rect x="15.5" y="16" width="4.5" height="4" rx="0.8" />
        <path d="M12 7.5v4.5M6.25 12h11.5M6.25 12v4M17.75 12v4" />
      </svg>
    )
  },
  {
    id: 'partners',
    shortLabel: 'অংশীদার',
    title: 'অংশীদার ও মূলধন পোর্টাল',
    summary: 'বিনিয়োগ ও শেয়ার অনুপাতে লভ্যাংশ হিসাব।',
    drawIcon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 sm:w-5 sm:h-5">
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="1.2" />
      </svg>
    )
  },
  {
    id: 'customers',
    shortLabel: 'গ্রাহক CRM',
    title: 'গ্রাহক ও মেম্বার ডিরেক্টরি',
    summary: 'সদস্য প্রোফাইল, প্যাকেজ ও অনু স্ট্যাটাস।',
    drawIcon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 sm:w-5 sm:h-5">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="M15.3 15.3L20.5 20.5" />
      </svg>
    )
  },
  {
    id: 'troubleshoot_portal',
    shortLabel: 'সমস্যা সমাধান',
    title: 'সমস্যা অনুসন্ধান ও সমাধান পোর্টাল',
    summary: 'সহজে সমস্যা খুঁজে বের করে দ্রুত সমাধান করার ওয়েব পোর্টাল।',
    drawIcon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 sm:w-5 sm:h-5">
        <circle cx="12" cy="12" r="8" />
        <ellipse cx="12" cy="12" rx="3.5" ry="8" />
        <path d="M4.5 12h15" />
      </svg>
    )
  },
  {
    id: 'complaints',
    shortLabel: 'অভিযোগ',
    title: 'অভিযোগ ও সার্ভিস ডেস্ক',
    summary: 'লাইন ফল্ট টিকেট, স্টাফ অ্যাসাইন ও সমাধান।',
    drawIcon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 sm:w-5 sm:h-5">
        <path d="M5 17.5a7 7 0 0 1 0-11M19 6.5a7 7 0 0 1 0 11" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    )
  }
];

const GoogleGIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  company,
  isLocked = false,
  firebaseUser = null,
  appUserAccount = null,
  authLoading = false,
  currentUser = null,
  onOpenPlayStore,
  onOpenJoinPortal,
  onSignOut,
  onRefreshAccount
}) => {
  const [signingIn, setSigningIn] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const [previewPortalId, setPreviewPortalId] = useState<string | null>(null);

  const orbitPortals = useMemo(() => {
    const count = PUBLIC_ERP_PORTALS.length;
    const radiusPct = 38.5;
    return PUBLIC_ERP_PORTALS.map((portal, index) => {
      const angleRad = (index / count) * Math.PI * 2 - Math.PI / 2;
      return {
        portal,
        xPct: 50 + radiusPct * Math.cos(angleRad),
        yPct: 50 + radiusPct * Math.sin(angleRad)
      };
    });
  }, []);

  if (!isOpen) return null;

  const companyName = company?.name || 'DIP BHOLA NETWORK';
  const activePreviewPortal = PUBLIC_ERP_PORTALS.find((p) => p.id === previewPortalId) || null;

  const handleGoogleLogin = async () => {
    setError('');
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setError('Google সাইন-ইন পপআপটি বন্ধ করা হয়েছে। সম্পূর্ণ লগইন করতে আবার চেষ্টা করুন।');
      } else if (code === 'auth/popup-blocked') {
        setError('ব্রাউজার পপআপ ব্লক করেছে। অনুগ্রহ করে পপআপ অনুমতি দিয়ে আবার Google লগইনে চাপ দিন।');
      } else {
        setError(err?.message || 'Google দিয়ে সাইন-ইন করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOutClick = async () => {
    setError('');
    setSigningOut(true);
    try {
      await onSignOut?.();
    } catch (err: any) {
      setError(err?.message || 'সাইন আউট করতে সমস্যা হয়েছে।');
    } finally {
      setSigningOut(false);
    }
  };

  const handleRefreshClick = async () => {
    if (!onRefreshAccount) return;
    setError('');
    setRefreshing(true);
    try {
      await onRefreshAccount();
    } catch (err: any) {
      setError(err?.message || 'রোল যাচাই রিফ্রেশ করতে সমস্যা হয়েছে।');
    } finally {
      setRefreshing(false);
    }
  };

  const renderUserProfileCard = () => {
    if (!firebaseUser) return null;
    const displayName = appUserAccount?.displayName || firebaseUser.displayName || 'ব্যবহারকারী';
    const email = appUserAccount?.email || firebaseUser.email || '';
    const photoUrl = appUserAccount?.photoUrl || firebaseUser.photoURL || '';
    return (
      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={displayName}
            referrerPolicy="no-referrer"
            className="w-11 h-11 rounded-full object-cover border-2 border-cyan-500/60 shrink-0"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-black flex items-center justify-center shrink-0">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-slate-900 dark:text-white truncate">{displayName}</div>
          <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 truncate">{email}</div>
        </div>
      </div>
    );
  };

  const renderAuthCard = () => (
    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-cyan-500/35 dark:border-slate-800 overflow-hidden mx-auto">
      {/* Header with Brand DB Logo */}
      <div className="px-5 py-4 bg-gradient-to-r from-[#020e21] via-[#05234d] to-[#031630] text-white flex items-center justify-between border-b border-cyan-500/30">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#041d42] border border-cyan-300/60 overflow-hidden shadow-md shrink-0 flex items-center justify-center">
            <img src="/db-logo-192.png" alt={companyName} className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="text-base font-black tracking-wide">{companyName}</h3>
            <p className="text-xs text-cyan-300 font-medium">
              {isLocked ? 'নিরাপদ Google Sign-In ও রোল অনুমোদন' : 'সক্রিয় Google অ্যাকাউন্ট ও নিরাপত্তা'}
            </p>
          </div>
        </div>
        {!isLocked && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {authLoading ? (
          <div className="py-10 flex flex-col items-center justify-center gap-3 text-slate-600 dark:text-slate-300">
            <Loader2 className="w-7 h-7 animate-spin text-sky-600" />
            <span className="text-xs font-bold">নিরাপদ সেশন ও রোল অনুমোদন যাচাই হচ্ছে...</span>
          </div>
        ) : firebaseUser && !firebaseUser.emailVerified ? (
          <div className="space-y-4">
            {renderUserProfileCard()}
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
              <div className="font-black flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>ভেরিফায়েড Google ইমেইল প্রয়োজন</span>
              </div>
              <p>নিরাপত্তার স্বার্থে আপনার অ্যাকাউন্টটির ইমেইল ভেরিফিকেশন সম্পন্ন থাকতে হবে। অনুগ্রহ করে ভেরিফায়েড Google অ্যাকাউন্ট দিয়ে সাইন-ইন করুন।</p>
            </div>
            <button
              type="button"
              onClick={handleSignOutClick}
              disabled={signingOut}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{signingOut ? 'লগআউট হচ্ছে...' : 'অন্য Google অ্যাকাউন্ট দিয়ে প্রবেশ করুন'}</span>
            </button>
          </div>
        ) : firebaseUser && appUserAccount?.status === 'rejected' ? (
          <div className="space-y-4">
            {renderUserProfileCard()}
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 space-y-2">
              <div className="font-black flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                <Ban className="w-4 h-4 shrink-0" />
                <span>অ্যাক্সেস অনুমোদন স্থগিত বা বাতিল করা হয়েছে</span>
              </div>
              <p>
                {appUserAccount.rejectionReason ||
                  'প্রধান পরিচালক কর্তৃক এই অ্যাকাউন্টটির অ্যাক্সেস বর্তমানে স্থগিত রাখা হয়েছে। বিস্তারিত জানতে পরিচালকের সাথে যোগাযোগ করুন।'}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleRefreshClick}
                disabled={refreshing}
                className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>পুনরায় স্ট্যাটাস যাচাই করুন</span>
              </button>
              <button
                type="button"
                onClick={handleSignOutClick}
                disabled={signingOut}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>অন্য Google অ্যাকাউন্ট দিয়ে সাইন-ইন</span>
              </button>
            </div>
          </div>
        ) : firebaseUser && (!appUserAccount || appUserAccount.status === 'pending') ? (
          <div className="space-y-4">
            {renderUserProfileCard()}
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-xs text-amber-950 dark:text-amber-200 space-y-2">
              <div className="font-black flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                <Clock className="w-4 h-4 shrink-0" />
                <span>পরিচালকের রোল অনুমোদনের অপেক্ষায় (Pending Approval)</span>
              </div>
              <p className="leading-relaxed">
                আপনার Google অ্যাকাউন্ট যাচাই সম্পন্ন হয়েছে। প্রধান পরিচালক (<strong>{BOOTSTRAPPED_DIRECTOR_EMAIL}</strong>) অ্যাডমিন সিকিউরিটি ড্যাশবোর্ড থেকে আপনার নির্ধারিত রোল অনুমোদন করলেই স্বয়ংক্রিয়ভাবে ERP পোর্টাল খুলে যাবে।
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {onRefreshAccount && (
                <button
                  type="button"
                  onClick={handleRefreshClick}
                  disabled={refreshing}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>{refreshing ? 'যাচাই হচ্ছে...' : 'অনুমোদন স্ট্যাটাস রিফ্রেশ করুন'}</span>
                </button>
              )}

              {onOpenJoinPortal && (
                <button
                  type="button"
                  onClick={onOpenJoinPortal}
                  className="w-full py-2.5 px-4 rounded-xl bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 text-sky-900 dark:text-sky-200 border border-sky-200 dark:border-sky-800 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>নতুন Staff বা Partner তথ্য জমা দিন</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSignOutClick}
                disabled={signingOut}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{signingOut ? 'সাইন আউট হচ্ছে...' : 'সাইন আউট / অন্য Google অ্যাকাউন্ট'}</span>
              </button>
            </div>
          </div>
        ) : firebaseUser && currentUser && !isLocked ? (
          <div className="space-y-4">
            {renderUserProfileCard()}
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="font-black">সক্রিয় রোল: {currentUser.designation || currentUser.role}</div>
                <div className="text-[11px] opacity-85">সব ডেটাবেস নিয়ম ও নিরাপত্তা সক্রিয় রয়েছে।</div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={signingIn}
                className="w-full py-2.5 px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <GoogleGIcon className="w-4 h-4" />
                <span>{signingIn ? 'সুইচ হচ্ছে...' : 'অন্য Google অ্যাকাউন্টে পরিবর্তন করুন'}</span>
              </button>
              <button
                type="button"
                onClick={handleSignOutClick}
                disabled={signingOut}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{signingOut ? 'লগআউট হচ্ছে...' : 'সম্পূর্ণ লগআউট করুন'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-sky-50/90 dark:bg-sky-950/35 border border-sky-200 dark:border-sky-800/60 text-xs text-sky-950 dark:text-sky-200 flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-black text-sky-900 dark:text-sky-100">
                  সবচেয়ে নিরাপদ ভেরিফায়েড প্রবেশ ব্যবস্থা
                </div>
                <p className="leading-relaxed">
                  শুধুমাত্র অনুমোদিত <strong>Google অ্যাকাউন্ট</strong> দিয়েই ডেটা দেখা ও পরিবর্তন করা যায়। প্রধান পরিচালক (<strong>{BOOTSTRAPPED_DIRECTOR_EMAIL}</strong>) স্বয়ংক্রিয়ভাবে সুপার-অ্যাডমিন হিসেবে সক্রিয় হবেন।
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={signingIn}
              className="w-full py-3.5 px-4 bg-[#05234d] hover:bg-[#07316c] text-white font-black rounded-2xl text-sm flex items-center justify-center gap-3 shadow-lg transition-transform active:scale-95 cursor-pointer disabled:opacity-60 border border-cyan-400/40"
            >
              {signingIn ? (
                <Loader2 className="w-5 h-5 animate-spin text-cyan-300" />
              ) : (
                <span className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0">
                  <GoogleGIcon className="w-4 h-4" />
                </span>
              )}
              <span>{signingIn ? 'Google যাচাই চলছে...' : 'Google দিয়ে নিরাপদ লগইন করুন'}</span>
            </button>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2">
              <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
              <span>
                নতুন স্টাফ, ম্যানেজার বা পার্টনার প্রথমবার লগইন করলে পরিচালকের অনুমোদনের আগ পর্যন্ত ব্যক্তিগত ও আর্থিক ডেটা সম্পূর্ণ সুরক্ষিত ও লক থাকে।
              </span>
            </div>

            {(onOpenPlayStore || onOpenJoinPortal) && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center gap-2 text-center">
                {onOpenJoinPortal && (
                  <button
                    type="button"
                    onClick={onOpenJoinPortal}
                    className="w-full py-2.5 px-3 rounded-xl bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/70 text-sky-900 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-xs font-bold transition-colors cursor-pointer"
                  >
                    নতুন Staff বা Share Partner? জয়েনিং ও WhatsApp গ্রুপে যুক্ত হোন
                  </button>
                )}
                {onOpenPlayStore && (
                  <button
                    type="button"
                    onClick={onOpenPlayStore}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>মোবাইলে অ্যাপ ইনস্টল করতে Play Store পেজে যান</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Account info / switch modal when already inside app
  if (!isLocked) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        {renderAuthCard()}
      </div>
    );
  }

  // Startup Locked Gate: Midnight-Blue Radial ERP System Wheel + Portal Overview + Google Sign-In
  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-gradient-to-br from-[#020a18] via-[#041d42] to-[#020e21] text-white flex items-center justify-center p-3 sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(rgba(125, 211, 252, 0.5) 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      />

      <div className="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: Luminous Midnight-Blue Radial ERP Wheel (Public Portal Previews Only) */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center">
          <div className="relative w-full max-w-[540px] aspect-square mx-auto">
            <svg
              viewBox="0 0 600 600"
              className="w-full h-full pointer-events-none select-none"
              aria-hidden="true"
            >
              <defs>
                <radialGradient id="loginErpGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                  <stop offset="55%" stopColor="#0284c7" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="#020a18" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="300" cy="300" r="290" fill="url(#loginErpGlow)" />
              <circle cx="300" cy="300" r="278" fill="none" stroke="#38bdf8" strokeOpacity="0.2" strokeWidth="1.2" strokeDasharray="4 6" />
              <circle cx="300" cy="300" r="231" fill="none" stroke="#7dd3fc" strokeOpacity="0.32" strokeWidth="1.5" strokeDasharray="14 8 3 8" />
              <circle cx="300" cy="300" r="176" fill="none" stroke="#38bdf8" strokeOpacity="0.45" strokeWidth="3.2" strokeDasharray="42 14 16 14" />
              <circle cx="300" cy="300" r="150" fill="none" stroke="#bae6fd" strokeOpacity="0.78" strokeWidth="8.5" strokeDasharray="6 6.5" />
              <circle cx="300" cy="300" r="122" fill="#031532" stroke="#7dd3fc" strokeOpacity="0.9" strokeWidth="3.5" />
              <circle cx="300" cy="300" r="107" fill="none" stroke="#f0f9ff" strokeOpacity="0.95" strokeWidth="2.5" strokeDasharray="96 16 48 12" />
              {orbitPortals.map(({ portal, xPct, yPct }) => {
                const isSelected = previewPortalId === portal.id;
                return (
                  <line
                    key={`login-spoke-${portal.id}`}
                    x1="300"
                    y1="300"
                    x2={(xPct / 100) * 600}
                    y2={(yPct / 100) * 600}
                    stroke={isSelected ? '#e0f2fe' : '#38bdf8'}
                    strokeOpacity={isSelected ? 0.92 : 0.16}
                    strokeWidth={isSelected ? 2.4 : 1}
                    strokeDasharray={isSelected ? undefined : '3 5'}
                  />
                );
              })}
            </svg>

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[31%] h-[31%] rounded-full flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-[8px] sm:text-[10px] font-mono font-semibold tracking-[0.2em] text-cyan-300/90 uppercase">
                {companyName.slice(0, 12)}
              </span>
              <span
                className="text-3xl sm:text-5xl font-black italic tracking-tight text-white leading-none my-0.5"
                style={{
                  textShadow: '0 0 22px rgba(56, 189, 248, 0.9), 0 0 6px rgba(224, 242, 254, 0.85)'
                }}
              >
                ERP
              </span>
              <span className="text-[8px] sm:text-[10px] text-cyan-200/80 tracking-wider">SYSTEM</span>
            </div>

            {orbitPortals.map(({ portal, xPct, yPct }) => {
              const isSelected = previewPortalId === portal.id;
              return (
                <button
                  key={`login-node-${portal.id}`}
                  type="button"
                  onClick={() => {
                    setPreviewPortalId((prev) => (prev === portal.id ? null : portal.id));
                  }}
                  style={{ left: `${xPct}%`, top: `${yPct}%` }}
                  className={`group absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer focus:outline-none transition-transform duration-200 ${
                    isSelected ? 'scale-115 z-20' : 'hover:scale-110 z-10'
                  }`}
                  title={portal.title}
                >
                  <span
                    className={`w-8 h-8 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all border ${
                      isSelected
                        ? 'bg-cyan-400 text-[#020c1b] border-white shadow-[0_0_20px_rgba(103,232,249,0.9)]'
                        : 'bg-[#031632]/75 text-sky-50 border-cyan-300/45 group-hover:border-white group-hover:bg-sky-400/20'
                    }`}
                  >
                    {portal.drawIcon()}
                  </span>
                  <span
                    className={`mt-0.5 text-[8px] sm:text-[10px] font-bold leading-tight whitespace-nowrap ${
                      isSelected ? 'text-white' : 'text-cyan-100/90'
                    }`}
                    style={{ textShadow: '0 1px 6px rgba(2,10,24,0.95)' }}
                  >
                    {portal.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>

          {activePreviewPortal ? (
            <div className="mt-2 max-w-md w-full rounded-2xl bg-[#041736]/95 border border-cyan-400/45 p-3.5 text-left flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-extrabold text-cyan-300">{activePreviewPortal.title}</div>
                <p className="text-xs text-cyan-100/85 mt-0.5 leading-relaxed">
                  {activePreviewPortal.summary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPortalId(null)}
                aria-label="বন্ধ করুন"
                className="p-1 rounded-lg text-cyan-200 hover:text-white hover:bg-cyan-500/20 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <p className="text-center text-xs text-cyan-200/80 mt-2">
              আলাদা আলাদা পোর্টাল দেখতে আইকনে চাপ দিন · লাইভ তথ্যের জন্য Google দিয়ে লগইন করুন
            </p>
          )}
        </div>

        {/* Right: Google / Approval Gate */}
        <div className="lg:col-span-5">{renderAuthCard()}</div>
      </div>
    </div>
  );
};
