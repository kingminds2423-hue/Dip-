import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import type { User } from 'firebase/auth';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { DigitalTickerBar } from './components/DigitalTickerBar';
import { MobileInstallNotice } from './components/MobileInstallNotice';
import { AutoUpdateBanner } from './components/AutoUpdateBanner';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { QuickCommandBar } from './components/QuickCommandBar';
import { FixedNotificationBar } from './components/FixedNotificationBar';
import type { AppLinksTab } from './components/AppLinksModal';
import { AppUpdateProvider } from './hooks/useAppUpdate';

// Lazy-loaded heavy tabs & modals so initial app launch stays ultra-fast
const TransactionsTable = React.lazy(() => import('./components/TransactionsTable').then((m) => ({ default: m.TransactionsTable })));
const StaffManagement = React.lazy(() => import('./components/StaffManagement').then((m) => ({ default: m.StaffManagement })));
const PartnersView = React.lazy(() => import('./components/PartnersView').then((m) => ({ default: m.PartnersView })));
const CustomerDuesView = React.lazy(() => import('./components/CustomerDuesView').then((m) => ({ default: m.CustomerDuesView })));
const ReportsView = React.lazy(() => import('./components/ReportsView').then((m) => ({ default: m.ReportsView })));
const DigitalDisplayBoard = React.lazy(() => import('./components/DigitalDisplayBoard').then((m) => ({ default: m.DigitalDisplayBoard })));
const OfficersView = React.lazy(() => import('./components/OfficersView').then((m) => ({ default: m.OfficersView })));
const CustomerComplaintsView = React.lazy(() => import('./components/CustomerComplaintsView').then((m) => ({ default: m.CustomerComplaintsView })));
const CustomersDirectoryView = React.lazy(() => import('./components/CustomersDirectoryView').then((m) => ({ default: m.CustomersDirectoryView })));
const TroubleshootPortalView = React.lazy(() => import('./components/TroubleshootPortalView').then((m) => ({ default: m.TroubleshootPortalView })));
const ErpCommandHub = React.lazy(() => import('./components/ErpCommandHub').then((m) => ({ default: m.ErpCommandHub })));
const PlayStoreAppView = React.lazy(() => import('./components/PlayStoreAppView').then((m) => ({ default: m.PlayStoreAppView })));
const CustomPortalView = React.lazy(() => import('./components/CustomPortalView').then((m) => ({ default: m.CustomPortalView })));
const StatementQrViewer = React.lazy(() => import('./components/StatementQrViewer').then((m) => ({ default: m.StatementQrViewer })));

const TransactionModal = React.lazy(() => import('./components/TransactionModal').then((m) => ({ default: m.TransactionModal })));
const ComplaintModal = React.lazy(() => import('./components/ComplaintModal').then((m) => ({ default: m.ComplaintModal })));
const LoginModal = React.lazy(() => import('./components/LoginModal').then((m) => ({ default: m.LoginModal })));
const BackupModal = React.lazy(() => import('./components/BackupModal').then((m) => ({ default: m.BackupModal })));
const StaffQrModal = React.lazy(() => import('./components/StaffQrModal').then((m) => ({ default: m.StaffQrModal })));
const CompanySetupModal = React.lazy(() => import('./components/CompanySetupModal').then((m) => ({ default: m.CompanySetupModal })));
const AppLinksModal = React.lazy(() => import('./components/AppLinksModal').then((m) => ({ default: m.AppLinksModal })));
const AuditLogModal = React.lazy(() => import('./components/AuditLogModal').then((m) => ({ default: m.AuditLogModal })));
const PlayStoreUpdateModal = React.lazy(() => import('./components/PlayStoreUpdateModal').then((m) => ({ default: m.PlayStoreUpdateModal })));
const AdminSecurityDashboard = React.lazy(() => import('./components/AdminSecurityDashboard').then((m) => ({ default: m.AdminSecurityDashboard })));
const AdminPinPromptModal = React.lazy(() => import('./components/AdminPinPromptModal').then((m) => ({ default: m.AdminPinPromptModal })));
const JoiningModal = React.lazy(() => import('./components/JoiningModal').then((m) => ({ default: m.JoiningModal })));
const AppSettingsModal = React.lazy(() => import('./components/AppSettingsModal').then((m) => ({ default: m.AppSettingsModal })));
const PortalOverrideGateModal = React.lazy(() => import('./components/PortalOverrideGateModal').then((m) => ({ default: m.PortalOverrideGateModal })));
const PortalControlModal = React.lazy(() => import('./components/PortalControlModal').then((m) => ({ default: m.PortalControlModal })));
import {
  Maximize2,
  ShieldAlert,
  X,
  WifiOff,
  CheckCircle2,
  RefreshCw,
  FileText,
  Send,
  ExternalLink,
  Cpu,
  KeyRound,
  Lock
} from 'lucide-react';

import {
  Transaction,
  Staff,
  Partner,
  Company,
  CustomerDue,
  CustomerMember,
  AdminAuth,
  UserSession,
  AppUserAccount,
  AppUserRole,
  PortalControlConfig,
  TransactionType,
  DigitalNotice,
  AppointedOfficer,
  OfficersState,
  AuditLog,
  CustomerComplaint,
  ComplaintStatus,
  WhatsAppGroupConfig,
  JoinRequest,
  NotificationControl,
  BillingPortalDashReport,
  OltLiveReport
} from './types';

import {
  subscribeTransactions,
  subscribeStaffs,
  subscribePartners,
  subscribeCompany,
  subscribeCustomerDues,
  subscribeSettings,
  subscribeDigitalNotice,
  saveDigitalNotice,
  DEFAULT_DIGITAL_NOTICE,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  addStaff,
  updateStaff,
  deleteStaff,
  addPartner,
  updatePartner,
  deletePartner,
  addPartnerInvestment,
  addCustomerDue,
  updateCustomerDue,
  deleteCustomerDue,
  updateCompany,
  seedInitialDataIfEmpty,
  generateCsvData,
  generateBackupJson,
  subscribeOfficers,
  appointOfficer,
  saveOfficers,
  DEFAULT_OFFICERS,
  subscribeAuditLogs,
  addAuditLog,
  subscribeComplaints,
  addComplaint,
  updateComplaint,
  deleteComplaint,
  deleteAllComplaints,
  subscribeWhatsAppGroupConfig,
  saveWhatsAppGroupConfig,
  DEFAULT_WHATSAPP_GROUP_CONFIG,
  subscribeJoinRequests,
  addJoinRequest,
  updateJoinRequest,
  subscribeNotificationControl,
  clearAllNotificationsInCloud,
  restoreNotificationsInCloud,
  getStoredNotificationControl,
  shouldSeedComplaintsOnce,
  markComplaintsSeeded,
  refreshLiveCloudConnection,
  subscribeCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  deleteAllCustomers,
  importCustomersBatch,
  purgeLegacyPortalInformation,
  getStoredPortalControl,
  subscribePortalControl,
  savePortalControl
} from './services/dataService';
import {
  subscribeFirestoreErrors,
  clearFirestoreError,
  FirestoreErrorInfo
} from './firebase';
import { CACHE_KEYS, getCachedData } from './services/localCache';
import { useAutoRefresh } from './hooks/useAutoRefresh';

import {
  logoutUser,
  isDirector,
  subscribeToFirebaseAuthState
} from './services/authService';
import {
  ensureOrLoadUserAccount,
  subscribeMyUserAccount,
  subscribeAllUserAccounts,
  approveUserAccountRole,
  rejectUserAccountRole,
  buildSessionFromUserAccount
} from './services/userRoleService';
import {
  initOfflineAutoSync,
  subscribeOfflineSyncState,
  getOfflineSyncState,
  flushOfflineQueue,
  clearLastAutoSyncedNotice,
  OfflineSyncState
} from './services/offlineSync';
import { toBengaliNumber, getTodayString } from './utils/formatters';
import {
  applyDynamicPrintPageRule,
  getSavedPrintPreferences,
  generatePdfFromHtmlMarkup
} from './services/pdfPrintService';
import {
  getAccessToken,
  googleSignIn,
  loadAutoBackupSettings,
  saveAutoBackupSettings,
  getPreviousMonthKey,
  buildA4MonthlyBodyMarkup,
  buildA4MonthlyHtmlDocument,
  uploadFullBackupToDrive,
  uploadPdfBlobToDrive,
  uploadMonthlyA4StatementToDrive,
  uploadCsvStatementToDrive,
  sendBackupEmailViaGmail,
  formatGoogleDriveAuthError,
  AutoBackupSettings
} from './services/googleDriveService';
import { applyAppFontSize } from './utils/fontScale';
import {
  canUserAccessPortal,
  clearTemporaryPortalOverrides,
  DEFAULT_STAFF_ALLOWED_PORTALS,
  getPortalBengaliLabel,
  isPortalOverridableForUser,
  subscribePortalOverrides
} from './utils/portalPermissions';
import {
  DEFAULT_TROUBLESHOOT_PORTAL_URL,
  getEffectiveTroubleshootPortalUrl
} from './utils/appUrls';
import { autoAssignTechnicianByLocation } from './utils/complaintAutoAssign';

const DEFAULT_COMPANY_CONFIG: Company = {
  name: 'DIP BHOLA NETWORK',
  subTitle: 'দৈনিক আয়-ব্যয় ও কেন্দ্রীয় স্টাফ মনিটরিং সিস্টেম',
  ownerName: 'জাহিদুল ইসলাম',
  phone: '01721200049',
  email: 'zahidulislam53330@gmail.com',
  address: '৩নং পশ্চিম ইলিশা।ভোলা সদর ভোলা',
  currencySymbol: '৳',
  logoUrl: '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg',
  troubleshootPortalUrl: 'https://ais-pre-fyeuetew7nlhutdk5vcph2-383821225111.asia-northeast1.run.app'
};

export default function App() {
  const [publicStatementRoute, setPublicStatementRoute] = useState<{
    reportId: string;
    payload?: string | null;
  } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const params = new URLSearchParams(window.location.search);
      const stmtId = params.get('stmt_id');
      if (stmtId && stmtId.trim().length >= 10) {
        return {
          reportId: stmtId.trim(),
          payload: params.get('p')
        };
      }
    } catch {
      // ignore URL errors
    }
    return null;
  });

  const [fbUser, setFbUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [appUserAccount, setAppUserAccount] = useState<AppUserAccount | null>(null);
  const [allUserAccounts, setAllUserAccounts] = useState<AppUserAccount[]>([]);
  const [portalControl, setPortalControl] = useState<PortalControlConfig>(() => getStoredPortalControl());
  const [isPortalControlOpen, setIsPortalControlOpen] = useState<boolean>(false);
  const [staffQrTargetId, setStaffQrTargetId] = useState<string | undefined>(undefined);

  const [activeTab, setActiveTab] = useState<string>('erp_hub');
  const [selectedErpPortalId, setSelectedErpPortalId] = useState<string | null>(null);
  const [lockedNavNotice, setLockedNavNotice] = useState<{
    message: string;
    portalId?: string;
    portalTitle?: string;
  } | null>(null);
  const [overrideTick, setOverrideTick] = useState(0);
  const [overrideGateTarget, setOverrideGateTarget] = useState<{
    portalId: string;
    portalTitle: string;
    source: 'erp_hub' | 'nav';
  } | null>(null);
  const [lastUnlockedOverride, setLastUnlockedOverride] = useState<{
    portalId: string;
    nonce: number;
  } | null>(null);

  // Firestore real-time state (hydrated synchronously from localStorage cache for instant paint)
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    getCachedData<Transaction[]>(CACHE_KEYS.TRANSACTIONS, [])
  );
  const [staffs, setStaffs] = useState<Staff[]>(() =>
    getCachedData<Staff[]>(CACHE_KEYS.STAFFS, [])
  );
  const [partners, setPartners] = useState<Partner[]>(() =>
    getCachedData<Partner[]>(CACHE_KEYS.PARTNERS, [])
  );
  const [company, setCompany] = useState<Company | null>(() => {
    const cached = getCachedData<Company | null>(CACHE_KEYS.COMPANY, null);
    if (!cached) return DEFAULT_COMPANY_CONFIG;
    return {
      ...DEFAULT_COMPANY_CONFIG,
      ...cached,
      troubleshootPortalUrl: getEffectiveTroubleshootPortalUrl(cached)
    };
  });
  const [customerDues, setCustomerDues] = useState<CustomerDue[]>(() =>
    getCachedData<CustomerDue[]>(CACHE_KEYS.CUSTOMER_DUES, [])
  );
  const [complaints, setComplaints] = useState<CustomerComplaint[]>(() =>
    getCachedData<CustomerComplaint[]>(CACHE_KEYS.COMPLAINTS, [])
  );
  const [customers, setCustomers] = useState<CustomerMember[]>(() =>
    getCachedData<CustomerMember[]>(CACHE_KEYS.CUSTOMERS, [])
  );
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [adminAuth, setAdminAuth] = useState<AdminAuth | null>(null);
  const [digitalNotice, setDigitalNotice] = useState<DigitalNotice>(DEFAULT_DIGITAL_NOTICE);
  const [officers, setOfficers] = useState<OfficersState>(DEFAULT_OFFICERS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [whatsappGroupConfig, setWhatsappGroupConfig] = useState<WhatsAppGroupConfig>(DEFAULT_WHATSAPP_GROUP_CONFIG);
  const [notificationControl, setNotificationControl] = useState<NotificationControl>(() => getStoredNotificationControl());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [offlineSyncState, setOfflineSyncState] = useState<OfflineSyncState>(() => getOfflineSyncState());
  const [firestoreError, setFirestoreError] = useState<FirestoreErrorInfo | null>(null);

  // Global Dark Mode Theme State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dip_bhola_dark_mode') === 'true';
    } catch {
      return false;
    }
  });

  // Auto-logout security toast
  const [autoLogoutNotice, setAutoLogoutNotice] = useState<string | null>(null);

  // Layout & Toolbar states
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);

  // Modal states
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txModalDefaultType, setTxModalDefaultType] = useState<TransactionType>('expense');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
  const [editingComplaint, setEditingComplaint] = useState<CustomerComplaint | null>(null);
  const [prefillCustomerForComplaint, setPrefillCustomerForComplaint] = useState<CustomerMember | null>(null);
  const [prefillStaffForComplaint, setPrefillStaffForComplaint] = useState<string | null>(null);

  // Live admin.bhola.net & 103.158.206.4:6560 OLT proxy sessions (held strictly in JS memory only)
  const [liveBillingSessionToken, setLiveBillingSessionToken] = useState<string | null>(null);
  const [liveDashReport, setLiveDashReport] = useState<BillingPortalDashReport | null>(null);
  const [liveOltSessionToken, setLiveOltSessionToken] = useState<string | null>(null);
  const [liveOltReport, setLiveOltReport] = useState<OltLiveReport | null>(null);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isStaffQrOpen, setIsStaffQrOpen] = useState(false);
  const [isCompanySetupOpen, setIsCompanySetupOpen] = useState(false);
  const [openCompanySetupScrollToPurge, setOpenCompanySetupScrollToPurge] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAppLinksOpen, setIsAppLinksOpen] = useState(false);
  const [appLinksTab, setAppLinksTab] = useState<AppLinksTab>('download');
  const [isJoiningModalOpen, setIsJoiningModalOpen] = useState(false);
  const [joiningInitialRole, setJoiningInitialRole] = useState<'staff' | 'partner'>('staff');
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isSecurityDashboardOpen, setIsSecurityDashboardOpen] = useState(false);
  const [pinPrompt, setPinPrompt] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onVerified: () => void;
    onCancelled?: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onVerified: () => {}
  });
  const pinVerifiedFlagRef = useRef(false);
  const [openAddStaffNonce, setOpenAddStaffNonce] = useState(0);
  const [openPrintStudioNonce, setOpenPrintStudioNonce] = useState(0);
  const [toggleNotifWindowNonce, setToggleNotifWindowNonce] = useState(0);

  // Automated 1st-of-Month PDF + Drive + Gmail Backup State
  const [autoBackupSettings, setAutoBackupSettings] = useState<AutoBackupSettings>(() =>
    loadAutoBackupSettings('zahidulislam53330@gmail.com')
  );
  const [autoBackupToast, setAutoBackupToast] = useState<{
    type: 'success' | 'error';
    text: string;
    driveLink?: string;
  } | null>(null);
  const [isRunningAutoBackup, setIsRunningAutoBackup] = useState(false);
  const [dismissedPrevMonthBanner, setDismissedPrevMonthBanner] = useState(false);
  const autoBackupLockRef = React.useRef(false);
  const complaintsSeedCheckedRef = React.useRef(false);

  const requireDirectorPin = (
    title: string,
    description: string,
    onVerified: () => void,
    onCancelled?: () => void
  ) => {
    if (!isDirector(currentUser)) {
      setLockedNavNotice({
        message: '🔒 সিকিউরিটি, অডিট লগ ও পরিচালক পিন ভেরিফিকেশন স্টাফের জন্য সম্পূর্ণ লক করা আছে।'
      });
      onCancelled?.();
      return;
    }
    pinVerifiedFlagRef.current = false;
    setPinPrompt({
      isOpen: true,
      title,
      description,
      onVerified: () => {
        pinVerifiedFlagRef.current = true;
        onVerified();
      },
      onCancelled
    });
  };

  useEffect(() => {
    return subscribePortalOverrides(() => setOverrideTick((n) => n + 1));
  }, []);

  // Initialize default @page print rule & saved global font scale on startup
  useEffect(() => {
    applyAppFontSize();
    const prefs = getSavedPrintPreferences();
    applyDynamicPrintPageRule(
      prefs.size,
      prefs.orientation,
      prefs.marginMm,
      prefs.customWidthMm,
      prefs.customHeightMm
    );
  }, []);

  // Sync Dark Mode class with <html> element
  useEffect(() => {
    try {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('dip_bhola_dark_mode', 'true');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('dip_bhola_dark_mode', 'false');
      }
    } catch (e) {
      console.warn('Error setting dark mode:', e);
    }
  }, [isDarkMode]);

  // Auto-logout after 15 minutes of inactivity for shared devices
  useEffect(() => {
    if (!fbUser || appUserAccount?.status !== 'approved') return;
    let timeoutId: ReturnType<typeof setTimeout>;

    const resetInactivityTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        const prevName = appUserAccount?.displayName || fbUser.displayName || 'ব্যবহারকারী';
        const prevId = fbUser.uid;
        const prevRole = (appUserAccount?.role === 'pending' ? 'staff' : appUserAccount?.role) || 'staff';
        await addAuditLog({
          action: 'security_alert',
          actionBengali: 'নিষ্ক্রিয়তায় অটো-লগআউট',
          performedBy: prevName,
          performedById: prevId,
          performedByUid: fbUser.uid,
          role: prevRole,
          details: '১৫ মিনিট নিষ্ক্রিয়তার কারণে ডিভাইসের ডেটা সুরক্ষায় অটো-লগআউট সক্রিয় হয়েছে।'
        }).catch(() => {});
        await logoutUser();
        setLiveBillingSessionToken(null);
        setLiveDashReport(null);
        setLiveOltSessionToken(null);
        setLiveOltReport(null);
        setAppUserAccount(null);
        setAllUserAccounts([]);
        setAutoLogoutNotice('১৫ মিনিট কোনো সক্রিয়তা না থাকায় নিরাপত্তার স্বার্থে আপনার সেশনটি স্বয়ংক্রিয়ভাবে লগআউট করা হয়েছে।');
      }, 15 * 60 * 1000); // 15 minutes
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    activityEvents.forEach((evt) => window.addEventListener(evt, resetInactivityTimer, { passive: true }));
    resetInactivityTimer();

    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetInactivityTimer));
    };
  }, [fbUser, appUserAccount]);

  // Initialize and Seed Firestore if empty
  const initData = useCallback(async (force = false) => {
    setIsSyncing(true);
    try {
      await seedInitialDataIfEmpty(force);
    } catch (e) {
      console.warn('Initial seed error:', e);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Seed sample complaints ONCE ONLY on fresh install (never re-seeds after Admin deletes complaints)
  const seedInitialComplaintsIfEmpty = useCallback(async (currentList: CustomerComplaint[]) => {
    if (currentList.length > 0) {
      complaintsSeedCheckedRef.current = true;
      await markComplaintsSeeded();
      return;
    }
    if (complaintsSeedCheckedRef.current) return;
    complaintsSeedCheckedRef.current = true;
    const allowedToSeed = await shouldSeedComplaintsOnce();
    if (!allowedToSeed) return;
    try {
      await markComplaintsSeeded();
      await addComplaint({
        name: 'মোঃ হোসেন',
        idNumber: 'DBN-101',
        mobileNumber: '01712345678',
        address: 'বিশ্বরোড মোড়, ভোলা সদর',
        complainDetails: 'হোসেন ও রাজিব বিশ্বরোড লাইন সমস্যা - অপটিক্যাল ফাইবার ড্রপ ক্যাবল কাটা পড়েছে, নেট সংযোগ বিচ্ছিন্ন।',
        status: 'in_progress',
        priority: 'urgent',
        assignedStaffName: 'মোঃ রাজিব',
        reportedBy: 'জাহিদুল ইসলাম (পরিচালক)'
      });
      await addComplaint({
        name: 'হারুন অর রশিদ',
        idNumber: 'DBN-102',
        mobileNumber: '01823456789',
        address: 'ভোলা সদর হারুন এর লাইন সংলগ্ন',
        complainDetails: 'ভোলা সদর হারুন এর লাইন সমস্যা - রাউটারে লাল বাতি জ্বলছে ও ইন্টারনেট কানেকশন পাওয়া যাচ্ছে না।',
        status: 'pending',
        priority: 'critical',
        assignedStaffName: 'মোঃ শাওন',
        reportedBy: 'জাহিদুল ইসলাম (পরিচালক)'
      });
      await addComplaint({
        name: 'মোঃ আকাস',
        idNumber: 'DBN-103',
        mobileNumber: '01934567890',
        address: 'বাপ্তা ইউনিয়ন পরিষদ সংলগ্ন',
        complainDetails: 'আকাস ও অন্তর লাইন সমস্যা বাপ্তা - মাঝে মাঝে কানেকশন ড্রপ করছে এবং স্পিড ধীরগতি।',
        status: 'pending',
        priority: 'normal',
        assignedStaffName: 'অন্তর',
        reportedBy: 'জাহিদুল ইসলাম (পরিচালক)'
      });
    } catch (err) {
      console.warn('Complaints seed notice:', err);
    }
  }, []);

  // Verified Firebase Auth & /users/{uid} Approval Listener
  useEffect(() => {
    if (publicStatementRoute) {
      setAuthLoading(false);
      return;
    }
    let unsubUserDoc: (() => void) | undefined;
    const unsubAuth = subscribeToFirebaseAuthState((user) => {
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = undefined;
      }
      setFbUser(user);
      if (!user) {
        setAppUserAccount(null);
        setAllUserAccounts([]);
        setAuthLoading(false);
        return;
      }
      if (!user.emailVerified) {
        setAppUserAccount(null);
        setAuthLoading(false);
        return;
      }
      setAuthLoading(true);
      ensureOrLoadUserAccount(user)
        .then((acc) => {
          setAppUserAccount(acc);
          setAuthLoading(false);
        })
        .catch(() => {
          setAuthLoading(false);
        });
      unsubUserDoc = subscribeMyUserAccount(user.uid, (acc) => {
        if (acc) {
          setAppUserAccount(acc);
          setAuthLoading(false);
        }
      });
    });
    return () => {
      if (unsubUserDoc) unsubUserDoc();
      unsubAuth();
    };
  }, [publicStatementRoute]);

  const isApprovedAuth = Boolean(
    !publicStatementRoute &&
      fbUser &&
      fbUser.emailVerified &&
      appUserAccount &&
      appUserAccount.status === 'approved' &&
      appUserAccount.role !== 'pending'
  );

  const currentUser = useMemo<UserSession | null>(() => {
    if (!isApprovedAuth || !fbUser || !appUserAccount) return null;
    return buildSessionFromUserAccount(appUserAccount, fbUser, staffs, partners, company);
  }, [isApprovedAuth, fbUser, appUserAccount, staffs, partners, company]);

  // Mount private Firestore listeners strictly AFTER verified Auth + approved role
  useEffect(() => {
    const unsubOfflineState = subscribeOfflineSyncState((st) => setOfflineSyncState(st));
    const unsubFsErrors = subscribeFirestoreErrors((err) => setFirestoreError(err));

    if (!isApprovedAuth) {
      return () => {
        unsubOfflineState();
        unsubFsErrors();
      };
    }

    const cleanupOffline = initOfflineAutoSync();

    let seedDelayTimer: ReturnType<typeof setTimeout> | undefined;
    const alreadySeeded = (() => {
      try {
        return window.localStorage.getItem('dip_bhola_seeded_v1') === '1';
      } catch {
        return false;
      }
    })();
    if (alreadySeeded) {
      seedDelayTimer = setTimeout(() => {
        void initData(false);
      }, 2200);
    } else {
      void initData(false);
    }

    const unsubTx = subscribeTransactions((list) => setTransactions(list));
    const unsubStaff = subscribeStaffs((list) => setStaffs(list));
    const unsubPartners = subscribePartners((list) => setPartners(list));
    const unsubCompany = subscribeCompany((comp) => setCompany(comp));
    const unsubDues = subscribeCustomerDues((dues) => setCustomerDues(dues));
    const unsubSettings = subscribeSettings((sett) => setAdminAuth(sett));
    const unsubNotice = subscribeDigitalNotice((notice) => setDigitalNotice(notice));
    const unsubOfficers = subscribeOfficers((offs) => setOfficers(offs));
    const unsubComplaints = subscribeComplaints((list) => {
      setComplaints(list);
      seedInitialComplaintsIfEmpty(list);
    });
    const unsubCustomers = subscribeCustomers((list) => setCustomers(list));
    const unsubWaGroup = subscribeWhatsAppGroupConfig((cfg) => setWhatsappGroupConfig(cfg));
    const unsubJoinRequests = subscribeJoinRequests((reqs) => setJoinRequests(reqs));
    const unsubNotificationControl = subscribeNotificationControl((ctrl) => setNotificationControl(ctrl));
    const unsubPortalControl = subscribePortalControl((ctrl) => setPortalControl(ctrl));

    // Defer audit history stream slightly so dashboard paints with full priority
    let unsubAudit: (() => void) | undefined;
    const auditTimer = setTimeout(() => {
      unsubAudit = subscribeAuditLogs((logs) => setAuditLogs(logs));
    }, 500);

    return () => {
      cleanupOffline();
      unsubOfflineState();
      if (seedDelayTimer) clearTimeout(seedDelayTimer);
      clearTimeout(auditTimer);
      unsubTx();
      unsubStaff();
      unsubPartners();
      unsubCompany();
      unsubDues();
      unsubSettings();
      unsubNotice();
      unsubOfficers();
      if (unsubAudit) unsubAudit();
      unsubComplaints();
      unsubCustomers();
      unsubWaGroup();
      unsubJoinRequests();
      unsubNotificationControl();
      unsubPortalControl();
      unsubFsErrors();
    };
  }, [isApprovedAuth, initData, seedInitialComplaintsIfEmpty]);

  // Director-only subscription to all Google user accounts for role approval
  useEffect(() => {
    if (!isApprovedAuth || !currentUser || !isDirector(currentUser)) {
      setAllUserAccounts([]);
      return;
    }
    return subscribeAllUserAccounts((accounts) => setAllUserAccounts(accounts));
  }, [isApprovedAuth, currentUser?.uid, currentUser?.role]);

  // Handle URL Query Parameters safely (NO auto-login on shared links — Mobile + PIN is mandatory)
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const portal = urlParams.get('portal') || urlParams.get('role');
      const roleParam = urlParams.get('role');
      const viewParam = urlParams.get('view') || urlParams.get('app');
      const actionParam = urlParams.get('action');

      if (portal === 'join' || actionParam === 'join') {
        setJoiningInitialRole(roleParam === 'partner' ? 'partner' : 'staff');
        if (!currentUser) {
          setActiveTab('join');
        } else {
          setIsJoiningModalOpen(true);
        }
        return;
      }

      if (
        !currentUser &&
        (portal === 'playstore' ||
          viewParam === 'playstore' ||
          urlParams.get('store') === '1' ||
          actionParam === 'install' ||
          actionParam === 'download')
      ) {
        setActiveTab('playstore');
      } else if (currentUser) {
        if (
          (urlParams.get('partner') || portal === 'partner') &&
          (currentUser.role === 'director' || currentUser.role === 'admin')
        ) {
          setActiveTab('partners');
        } else if (
          portal === 'troubleshoot_portal' &&
          canUserAccessPortal('troubleshoot_portal', currentUser, staffs, { portalControl })
        ) {
          setActiveTab('troubleshoot_portal');
        }
      }
    } catch (e) {
      console.warn('URL parameter parsing error:', e);
    }
  }, [currentUser, staffs, portalControl]);

  // Strict Role-Based, Per-Staff & Global Portal Control Route Guard
  useEffect(() => {
    if (!currentUser) return;
    if (activeTab === 'erp_hub' || activeTab === 'join') return;
    if (!canUserAccessPortal(activeTab, currentUser, staffs, { portalControl })) {
      setActiveTab('erp_hub');
      setSelectedErpPortalId(null);
    }
  }, [currentUser, activeTab, staffs, portalControl, overrideTick]);

  const showLockedPortalNotice = useCallback(
    (msg: string, portalId?: string, portalTitle?: string) => {
      setLockedNavNotice({ message: msg, portalId, portalTitle });
    },
    []
  );

  const handleNavigateTab = useCallback(
    (targetTab: string) => {
      if (!currentUser) return;
      if (
        targetTab !== 'erp_hub' &&
        targetTab !== 'join' &&
        !canUserAccessPortal(targetTab, currentUser, staffs, { portalControl })
      ) {
        const customTitle = targetTab.startsWith('custom:')
          ? portalControl.customPortals.find((c) => `custom:${c.id}` === targetTab)?.title
          : undefined;
        const title = customTitle || getPortalBengaliLabel(targetTab);
        setLockedNavNotice({
          message: `🔒 "${title}" পোর্টালটি বন্ধ অথবা আপনার জন্য লক করা আছে।`,
          portalId: targetTab,
          portalTitle: title
        });
        return;
      }
      setLockedNavNotice(null);
      setActiveTab(targetTab);
      if (targetTab !== 'erp_hub') {
        setSelectedErpPortalId(null);
      }
    },
    [currentUser, staffs, portalControl, overrideTick]
  );

  // Handle transaction save (create or update) with Audit Log — Staff & Partners cannot edit existing entries
  const handleSaveTransaction = async (txData: Omit<Transaction, 'id' | 'createdAt'> & { id?: string }) => {
    if (!currentUser || currentUser.role === 'partner') return;
    if (!canUserAccessPortal('transactions', currentUser, staffs, { portalControl })) return;
    if (txData.id) {
      if (currentUser.role === 'staff') return;
      await updateTransaction(txData.id, txData);
      await addAuditLog({
        action: 'transaction_edit',
        actionBengali: 'লেনদেন আপডেট',
        performedBy: currentUser.name,
        performedById: currentUser.id,
        role: currentUser.role,
        details: `লেনদেন তথ্য সংশোধন: ৳${txData.amount} (${txData.title})`
      });
    } else {
      await addTransaction(txData);
      await addAuditLog({
        action: 'transaction_add',
        actionBengali: 'নতুন লেনদেন এন্ট্রি',
        performedBy: currentUser.name,
        performedById: currentUser.id,
        role: currentUser.role,
        details: `নতুন ${txData.type === 'income' ? 'জমা' : 'খরচ'} এন্ট্রি: ৳${txData.amount} (${txData.title})`
      });
    }
  };

  // Open transaction modal (guarded by portal permission)
  const handleOpenAddTxModal = (type: TransactionType) => {
    if (!currentUser || currentUser.role === 'partner') return;
    if (!canUserAccessPortal('transactions', currentUser, staffs, { portalControl })) {
      setLockedNavNotice({
        message: '🔒 "হিসাব খাতা" পোর্টালটি লক করা আছে — জমা/খরচ এন্ট্রি দেওয়ার অনুমতি নেই।',
        portalId: 'transactions',
        portalTitle: 'হিসাব খাতা (জমা ও খরচ এন্ট্রি)'
      });
      return;
    }
    setLockedNavNotice(null);
    setEditingTx(null);
    setTxModalDefaultType(type);
    setIsTxModalOpen(true);
  };

  const handleEditTx = (tx: Transaction) => {
    if (!currentUser || currentUser.role === 'staff' || currentUser.role === 'partner') return;
    setEditingTx(tx);
    setTxModalDefaultType(tx.type);
    setIsTxModalOpen(true);
  };

  const handleDeleteTx = async (id: string) => {
    if (!currentUser || !isDirector(currentUser)) return;
    const targetTx = transactions.find((t) => t.id === id);
    await deleteTransaction(id);
    await addAuditLog({
      action: 'transaction_delete',
      actionBengali: 'লেনদেন মুছে ফেলা হয়েছে',
      performedBy: currentUser.name,
      performedById: currentUser.id,
      role: currentUser.role,
      details: `মুছে ফেলা লেনদেন: ৳${targetTx?.amount || 0} (${targetTx?.title || id})`
    });
  };

  // Staff Salary Payment Quick Entry
  const handlePayStaffSalary = (staff: Staff) => {
    if (!currentUser) return;
    const user = currentUser;
    setEditingTx(null);
    setTxModalDefaultType('expense');
    setIsTxModalOpen(true);
    setTimeout(() => {
      setEditingTx({
        id: '',
        type: 'expense',
        date: getTodayString(),
        title: `${staff.name} (স্টাফ বেতন ও ভাতা)`,
        category: 'স্টাফ বেতন ও ভাতা',
        amount: staff.salary,
        paymentMethod: 'cash',
        addedBy: user.name,
        addedById: user.id,
        note: `মাসিক বেতন পরিশোধ - ${staff.designation}`,
        createdAt: new Date().toISOString()
      });
    }, 50);
  };

  // Customer Due Payment Collection
  const handleCollectCustomerDue = async (due: CustomerDue, amount: number, paymentMethod: string) => {
    if (!currentUser) return;
    const todayStr = getTodayString();
    const newPaid = (due.paidAmount || 0) + amount;
    const newCurrent = Math.max(0, (due.totalDue || 0) - newPaid);

    await updateCustomerDue(due.id, {
      paidAmount: newPaid,
      currentDue: newCurrent,
      notes: `${due.notes ? due.notes + ' | ' : ''}আদায়: ৳${amount} (${todayStr})`
    });

    await addTransaction({
      type: 'income',
      date: todayStr,
      title: `${due.customerName} - বকেয়া বিল আদায়`,
      category: 'গ্রাহক মাসিক বিল কালেকশন',
      amount,
      paymentMethod,
      addedBy: currentUser.name,
      addedById: currentUser.id,
      note: `গ্রাহক বিল কালেকশন - ${due.address || ''}`
    });
  };

  // Customer Complaints Handlers
  const handleSaveComplaint = async (
    cData: Omit<CustomerComplaint, 'id' | 'createdAt'> & { id?: string }
  ) => {
    if (!currentUser) return;
    if (cData.id) {
      await updateComplaint(cData.id, cData);
      await addAuditLog({
        action: 'complaint_edit',
        actionBengali: 'অভিযোগ আপডেট',
        performedBy: currentUser.name,
        performedById: currentUser.id,
        role: currentUser.role,
        details: `অভিযোগ তথ্য সংশোধন: #${cData.idNumber} (${cData.name} - ${cData.address})`
      });
    } else {
      let complaintPayload = { ...cData };
      if (!complaintPayload.assignedStaffId && staffs.length > 0) {
        const autoMatch = autoAssignTechnicianByLocation({
          address: complaintPayload.address,
          oltInfo: complaintPayload.oltInfo,
          staffs,
          complaints
        });
        if (autoMatch.staff) {
          complaintPayload = {
            ...complaintPayload,
            assignedStaffId: autoMatch.staff.id,
            assignedStaffName: autoMatch.staff.name,
            autoAssignedReason: autoMatch.reasonBengali
          };
        }
      }
      const saved = await addComplaint(complaintPayload);
      await addAuditLog({
        action: 'complaint_add',
        actionBengali: 'নতুন অভিযোগ দাখিল',
        performedBy: currentUser.name,
        performedById: currentUser.id,
        role: currentUser.role,
        details: `নতুন অভিযোগ এন্ট্রি: #${saved.idNumber} (${saved.name} - ${saved.address})${
          saved.assignedStaffName ? ` → টেকনিশিয়ান: ${saved.assignedStaffName}` : ''
        }`
      });
    }
  };

  const handleDeleteComplaint = async (id: string) => {
    if (!currentUser || !isDirector(currentUser)) return;
    complaintsSeedCheckedRef.current = true;
    const target = complaints.find((c) => c.id === id);
    await deleteComplaint(id);
    await addAuditLog({
      action: 'complaint_delete',
      actionBengali: 'অভিযোগ মুছে ফেলা হয়েছে',
      performedBy: currentUser.name,
      performedById: currentUser.id,
      role: currentUser.role,
      details: `মুছে ফেলা অভিযোগ: #${target?.idNumber || id} (${target?.name || ''})`
    });
  };

  const handleDeleteAllComplaints = async () => {
    if (!currentUser || !isDirector(currentUser)) return;
    complaintsSeedCheckedRef.current = true;
    const targetIds = complaints.map((c) => c.id);
    const deletedCount = await deleteAllComplaints(targetIds);
    await addAuditLog({
      action: 'complaint_delete_all',
      actionBengali: 'সকল অভিযোগ পারমানেন্ট ডিলিট (অ্যাডমিন)',
      performedBy: currentUser.name,
      performedById: currentUser.id,
      role: currentUser.role,
      details: `অ্যাডমিন ${currentUser.name} কর্তৃক সর্বমোট ${toBengaliNumber(deletedCount)}টি গ্রাহক অভিযোগ স্থায়ীভাবে ডিলিট করা হয়েছে।`
    });
  };

  const handleDeleteAllCustomers = async (): Promise<number> => {
    if (!currentUser || !isDirector(currentUser)) return 0;
    const targetIds = customers.map((c) => c.id);
    return new Promise<number>((resolve) => {
      requireDirectorPin(
        'সব পুরাতন গ্রাহক স্থায়ীভাবে মুছুন',
        `অ্যাপে সংরক্ষিত সকল (${toBengaliNumber(targetIds.length)} জন) পুরাতন গ্রাহক স্থায়ীভাবে মুছে ০ করতে পরিচালকের ৪-ডিজিট পিন দিন।`,
        async () => {
          try {
            const deletedCount = await deleteAllCustomers(targetIds);
            await addAuditLog({
              action: 'customer_delete_all',
              actionBengali: 'সকল পুরাতন গ্রাহক মুছে ফেলা হয়েছে (অ্যাডমিন)',
              performedBy: currentUser.name,
              performedById: currentUser.id,
              role: currentUser.role,
              details: `অ্যাডমিন ${currentUser.name} কর্তৃক সর্বমোট ${toBengaliNumber(deletedCount)} জন পুরাতন গ্রাহক স্থায়ীভাবে ডিলিট করা হয়েছে।`
            });
            resolve(deletedCount);
          } catch (err) {
            console.warn('Delete all customers error:', err);
            resolve(0);
          }
        },
        () => resolve(0)
      );
    });
  };

  const handlePurgeLegacyPortalData = async (options: {
    wipeCustomers: boolean;
    wipeCustomerDues: boolean;
    wipeComplaints: boolean;
    wipeJoinRequests: boolean;
  }) => {
    if (!currentUser || !isDirector(currentUser)) {
      return {
        deletedCustomers: 0,
        deletedDues: 0,
        deletedComplaints: 0,
        deletedJoinRequests: 0
      };
    }
    if (options.wipeComplaints) {
      complaintsSeedCheckedRef.current = true;
    }
    setLiveBillingSessionToken(null);
    setLiveDashReport(null);

    const res = await purgeLegacyPortalInformation({
      wipeCustomers: options.wipeCustomers,
      wipeCustomerDues: options.wipeCustomerDues,
      wipeComplaints: options.wipeComplaints,
      wipeJoinRequests: options.wipeJoinRequests,
      wipeLegacySettings: true,
      knownCustomerIds: customers.map((c) => c.id),
      knownDueIds: customerDues.map((d) => d.id),
      knownComplaintIds: complaints.map((c) => c.id),
      knownJoinRequestIds: joinRequests.map((r) => r.id)
    });

    await addAuditLog({
      action: 'portal_data_purge',
      actionBengali: 'পুরাতন পোর্টাল ও সকল অপ্রয়োজনীয় তথ্য ডিলিট (অ্যাডমিন)',
      performedBy: currentUser.name,
      performedById: currentUser.id,
      role: currentUser.role,
      details: `পুরাতন পোর্টাল ও অপ্রয়োজনীয় ক্লাউড তথ্য ডিলিট: গ্রাহক ${toBengaliNumber(res.deletedCustomers)} জন, বকেয়া ${toBengaliNumber(res.deletedDues)} টি, অভিযোগ ${toBengaliNumber(res.deletedComplaints)} টি, জয়েনিং আবেদন ${toBengaliNumber(res.deletedJoinRequests)} টি ও পুরাতন পোর্টাল সেটিংস মুছে ফেলা হয়েছে।`
    });

    return {
      deletedCustomers: res.deletedCustomers,
      deletedDues: res.deletedDues,
      deletedComplaints: res.deletedComplaints,
      deletedJoinRequests: res.deletedJoinRequests
    };
  };

  const handleUpdateComplaintStatus = async (
    id: string,
    newStatus: ComplaintStatus,
    resolutionNote?: string
  ) => {
    if (!currentUser) return;
    const target = complaints.find((c) => c.id === id);
    const updates: Partial<CustomerComplaint> = {
      status: newStatus,
      ...(newStatus === 'resolved'
        ? {
            resolvedAt: new Date().toISOString(),
            resolutionNote: resolutionNote || 'সমস্যা সমাধান সম্পন্ন'
          }
        : {})
    };
    await updateComplaint(id, updates);
    await addAuditLog({
      action: 'complaint_status',
      actionBengali: 'অভিযোগ স্ট্যাটাস পরিবর্তন',
      performedBy: currentUser.name,
      performedById: currentUser.id,
      role: currentUser.role,
      details: `স্ট্যাটাস পরিবর্তন: #${target?.idNumber || id} -> ${
        newStatus === 'resolved' ? 'সমাধানকৃত' : newStatus === 'in_progress' ? 'কাজ চলছে' : 'পেন্ডিং'
      }`
    });
  };

  const handleRecordLineExpense = (cmp: CustomerComplaint) => {
    if (!currentUser) return;
    const user = currentUser;
    setEditingTx(null);
    setTxModalDefaultType('expense');
    setIsTxModalOpen(true);
    setTimeout(() => {
      setEditingTx({
        id: '',
        type: 'expense',
        date: getTodayString(),
        title: `[অভিযোগ ${cmp.idNumber}] ${cmp.name} - লাইন মেরামত ও যাতায়াত খরচ`,
        category: 'যাতায়াত ও ডেলিভারি খরচ',
        amount: 100,
        paymentMethod: 'cash',
        addedBy: user.name,
        addedById: user.id,
        note: `গ্রাহক অভিযোগ সমাধান বাবদ লাইন খরচ: ${cmp.complainDetails} (এলাকা: ${cmp.address})`,
        createdAt: new Date().toISOString()
      });
    }, 60);
  };

  // Quick Expense 1-click handler
  const handleQuickExpense = async (data: {
    title: string;
    category: string;
    amount: number;
    paymentMethod: string;
    note?: string;
  }) => {
    if (!currentUser) return;
    await handleSaveTransaction({
      type: 'expense',
      date: getTodayString(),
      title: data.title,
      category: data.category,
      amount: data.amount,
      paymentMethod: data.paymentMethod || 'cash',
      addedBy: currentUser.name,
      addedById: currentUser.id,
      note: data.note || 'দ্রুত খরচ এন্ট্রি'
    });
  };

  // Export CSV (supports filtered periods across all authorized roles)
  const handleExportCsv = (monthStr?: string, customList?: Transaction[]) => {
    const baseList = customList || transactions;

    const listToExport = customList
      ? baseList
      : monthStr
      ? baseList.filter((t) => t.date && t.date.startsWith(monthStr))
      : baseList;

    const csvContent = generateCsvData(listToExport, company?.name || 'DIP BHOLA NETWORK', monthStr);
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `hisab_khata_${monthStr || 'all'}_${getTodayString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSubmitJoinRequest = async (
    reqData: Omit<JoinRequest, 'id' | 'status' | 'createdAt'>
  ): Promise<JoinRequest> => {
    const saved = await addJoinRequest(reqData);
    await addAuditLog({
      action: 'join_request_submit',
      actionBengali: reqData.role === 'partner' ? 'নতুন পার্টনার জয়েনিং আবেদন' : 'নতুন স্টাফ জয়েনিং আবেদন',
      performedBy: reqData.name,
      performedById: saved.id,
      role: reqData.role,
      details: `${reqData.role === 'partner' ? 'শেয়ার পার্টনার' : 'স্টাফ'} জয়েনিং আবেদন: ${reqData.name} (${reqData.phone})`
    });
    return saved;
  };

  const handleApproveJoinRequest = async (req: JoinRequest) => {
    if (!currentUser) return;
    const today = getTodayString();
    if (req.role === 'staff') {
      const newStaff: Staff = {
        id: `staff-${Date.now()}`,
        name: req.name,
        phone: req.phone,
        pin: req.pin,
        designation: req.designationOrRole || 'সহকারী টেকনিশিয়ান',
        salary: 8000,
        joinedAt: today,
        address: req.address || '',
        nid: req.nid || '',
        status: 'active',
        allowedPortals: DEFAULT_STAFF_ALLOWED_PORTALS
      };
      await addStaff(newStaff);
    } else {
      const inv = Number(req.initialInvestment) || 0;
      const newPartner: Partner = {
        id: `p-${Date.now()}`,
        name: req.name,
        phone: req.phone,
        pin: req.pin,
        role: req.designationOrRole || 'শেয়ার অংশীদার',
        address: req.address || '',
        nidNumber: req.nid || '',
        joinedDate: today,
        investment: inv,
        sharePercentage: 0,
        investmentHistory:
          inv > 0
            ? [{ id: `inv-${Date.now()}`, date: today, amount: inv, note: 'জয়েনিং প্রারম্ভিক মূলধন' }]
            : [],
        notes: req.notes || '',
        status: 'active'
      };
      await addPartner(newPartner);
    }

    await updateJoinRequest(req.id, {
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy: currentUser.name
    });

    await addAuditLog({
      action: 'join_request_approve',
      actionBengali: 'জয়েনিং আবেদন অনুমোদিত',
      performedBy: currentUser.name,
      performedById: currentUser.id,
      role: currentUser.role,
      details: `${req.name} (${req.role === 'partner' ? 'শেয়ার পার্টনার' : 'স্টাফ'})-কে অনুমোদন দেওয়া হয়েছে।`
    });
  };

  const handleRejectJoinRequest = async (req: JoinRequest) => {
    if (!currentUser) return;
    await updateJoinRequest(req.id, {
      status: 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewedBy: currentUser.name
    });
  };

  const handleManualSync = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      await fetch('/api/health', { cache: 'no-store' }).catch(() => null);
    }
    await flushOfflineQueue();
    await refreshLiveCloudConnection();
  }, []);

  const autoRefresh = useAutoRefresh(handleManualSync, true);

  // Automated 1st-of-month Previous-Month PDF + Drive + Gmail dispatcher
  const dispatchPrevMonthPdfAndBackup = useCallback(
    async (token: string, targetMonth: string) => {
      if (autoBackupLockRef.current) return;
      autoBackupLockRef.current = true;
      setIsRunningAutoBackup(true);

      try {
        const latestSettings = loadAutoBackupSettings(company?.email || 'zahidulislam53330@gmail.com');
        const companyName = company?.name || 'DIP BHOLA NETWORK';
        const ownerName = company?.ownerName || 'জাহিদুল ইসলাম';
        const todayStr = getTodayString();

        const backupData = generateBackupJson(
          company || DEFAULT_COMPANY_CONFIG,
          partners,
          adminAuth || { pin: '1234', phone: '01700000000' },
          staffs,
          transactions,
          customerDues
        );

        const markup = buildA4MonthlyBodyMarkup({
          companyName,
          subTitle: company?.subTitle || 'দৈনিক আয়-ব্যয় ও কেন্দ্রীয় স্টাফ মনিটরিং সিস্টেম',
          address: company?.address || 'ভোলা সদর',
          phone: company?.phone || '01721200049',
          ownerName,
          targetMonth,
          transactions
        });

        const pdfResult = await generatePdfFromHtmlMarkup(
          markup,
          `dip_bhola_monthly_report_${targetMonth}.pdf`
        );

        let driveJsonLink: string | undefined;
        let drivePdfLink: string | undefined;

        if (latestSettings.autoDriveEnabled) {
          const driveJsonFile = await uploadFullBackupToDrive(token, backupData);
          driveJsonLink = driveJsonFile.webViewLink;
          const drivePdfFile = await uploadPdfBlobToDrive(
            token,
            pdfResult.blob,
            pdfResult.fileName,
            targetMonth
          );
          drivePdfLink = drivePdfFile.webViewLink;

          if (latestSettings.autoMonthlyA4Enabled) {
            const a4Html = buildA4MonthlyHtmlDocument({
              companyName,
              subTitle: company?.subTitle || 'দৈনিক আয়-ব্যয় ও কেন্দ্রীয় স্টাফ মনিটরিং সিস্টেম',
              address: company?.address || 'ভোলা সদর',
              phone: company?.phone || '01721200049',
              ownerName,
              targetMonth,
              transactions
            });
            await uploadMonthlyA4StatementToDrive(token, a4Html, targetMonth, companyName);
            const monthTx = transactions.filter((t) => t.date && t.date.startsWith(targetMonth));
            await uploadCsvStatementToDrive(
              token,
              generateCsvData(monthTx, companyName, targetMonth),
              targetMonth
            );
          }
        }

        const recipient = (latestSettings.targetGmail || company?.email || 'zahidulislam53330@gmail.com').trim();
        if (latestSettings.autoGmailEnabled && recipient) {
          await sendBackupEmailViaGmail({
            accessToken: token,
            toEmail: recipient,
            companyName,
            backupData,
            reportMonth: targetMonth,
            driveFileLink: driveJsonLink,
            drivePdfLink,
            pdfAttachment: { fileName: pdfResult.fileName, blob: pdfResult.blob }
          });
        }

        const nowIso = new Date().toISOString();
        const updated = saveAutoBackupSettings({
          ...latestSettings,
          targetGmail: recipient,
          lastDriveBackupAt: latestSettings.autoDriveEnabled ? nowIso : latestSettings.lastDriveBackupAt,
          lastGmailSentAt: latestSettings.autoGmailEnabled ? nowIso : latestSettings.lastGmailSentAt,
          lastBackupDate: todayStr,
          lastBackupMonth: targetMonth,
          lastAutoPrevMonthSent: targetMonth,
          lastPrevMonthPdfDriveLink: drivePdfLink || latestSettings.lastPrevMonthPdfDriveLink,
          lastBackupTxCount: transactions.length
        });
        setAutoBackupSettings(updated);

        if (currentUser) {
          await addAuditLog({
            action: 'auto_backup_monthly_pdf',
            actionBengali: 'অটো মাসিক PDF ও ব্যাকআপ সম্পন্ন',
            performedBy: currentUser.name,
            performedById: currentUser.id,
            role: currentUser.role,
            details: `${targetMonth} মাসের A4 PDF রিপোর্ট ও ব্যাকআপ Google Drive এবং ${recipient}-এ পাঠানো হয়েছে।`
          });
        }

        setAutoBackupToast({
          type: 'success',
          text: `অটো সিস্টেম: গত মাস (${targetMonth})-এর A4 PDF রিপোর্ট Drive ও ${recipient} ঠিকানায় সফলভাবে পাঠানো হয়েছে!`,
          driveLink: drivePdfLink
        });
      } catch (err: any) {
        console.warn('Auto previous-month PDF backup error:', err);
        setAutoBackupToast({
          type: 'error',
          text: err?.message || 'অটো মাসিক PDF ব্যাকআপ পাঠাতে সমস্যা হয়েছে।'
        });
      } finally {
        autoBackupLockRef.current = false;
        setIsRunningAutoBackup(false);
      }
    },
    [company, partners, adminAuth, staffs, transactions, customerDues, currentUser]
  );

  // Automatic 1st-of-month & daily background backup runner when active in-memory Google token exists
  useEffect(() => {
    if (!currentUser || !isDirector(currentUser)) return;
    if (transactions.length === 0) return;

    const runSchedulerCheck = async () => {
      const token = getAccessToken();
      if (!token || autoBackupLockRef.current) return;

      const latest = loadAutoBackupSettings(company?.email || 'zahidulislam53330@gmail.com');
      if (!latest.autoDriveEnabled && !latest.autoGmailEnabled) return;

      const prevMonthKey = getPreviousMonthKey();
      if (latest.lastAutoPrevMonthSent !== prevMonthKey) {
        await dispatchPrevMonthPdfAndBackup(token, prevMonthKey);
        return;
      }

      const todayStr = getTodayString();
      if (latest.autoDriveEnabled && latest.lastBackupDate !== todayStr) {
        autoBackupLockRef.current = true;
        try {
          const backupData = generateBackupJson(
            company || DEFAULT_COMPANY_CONFIG,
            partners,
            adminAuth || { pin: '1234', phone: '01700000000' },
            staffs,
            transactions,
            customerDues
          );
          await uploadFullBackupToDrive(token, backupData);
          const nowIso = new Date().toISOString();
          const updated = saveAutoBackupSettings({
            ...latest,
            lastDriveBackupAt: nowIso,
            lastBackupDate: todayStr,
            lastBackupTxCount: transactions.length
          });
          setAutoBackupSettings(updated);
        } catch (err) {
          console.warn('Daily auto Drive backup skipped:', err);
        } finally {
          autoBackupLockRef.current = false;
        }
      }
    };

    runSchedulerCheck();
    const timer = setInterval(runSchedulerCheck, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, [currentUser, transactions, company, partners, adminAuth, staffs, customerDues, dispatchPrevMonthPdfAndBackup]);

  const handleOneClickConnectAndSendPrevMonth = async () => {
    try {
      setIsRunningAutoBackup(true);
      const res = await googleSignIn();
      if (!res) return;
      await dispatchPrevMonthPdfAndBackup(res.accessToken, getPreviousMonthKey());
    } catch (err: any) {
      setAutoBackupToast({
        type: 'error',
        text: formatGoogleDriveAuthError(err)
      });
    } finally {
      setIsRunningAutoBackup(false);
    }
  };

  // STRICT ADMIN ONLY: Delete All Notifications globally
  const handleDeleteAllNotifications = async (visibleKeys: string[]) => {
    if (!currentUser || !isDirector(currentUser)) {
      throw new Error('শুধুমাত্র অ্যাডমিন সকল নোটিফিকেশন ডিলিট করতে পারবেন।');
    }
    const allCurrentKeys = [
      ...visibleKeys,
      ...complaints.filter((c) => c.status !== 'resolved').map((c) => `cmp-${c.id}`),
      ...customerDues.filter((d) => (d.currentDue || 0) > 0).map((d) => `due-${d.id}`),
      ...joinRequests.filter((r) => r.status === 'pending').map((r) => `join-${r.id}`),
    ];
    const nextControl = await clearAllNotificationsInCloud(currentUser.name, allCurrentKeys);
    setNotificationControl(nextControl);
    await addAuditLog({
      action: 'notifications_clear_all',
      actionBengali: 'সকল নোটিফিকেশন ডিলিট (অ্যাডমিন)',
      performedBy: currentUser.name,
      performedById: currentUser.id,
      role: currentUser.role,
      details: `অ্যাডমিন ${currentUser.name} কর্তৃক সর্বমোট ${toBengaliNumber(visibleKeys.length)}টি প্রদর্শিত নোটিফিকেশন ডিলিট করা হয়েছে।`
    });
  };

  const handleRestoreNotifications = async () => {
    if (!currentUser || !isDirector(currentUser)) {
      throw new Error('শুধুমাত্র অ্যাডমিন নোটিফিকেশন পুনরুদ্ধার করতে পারবেন।');
    }
    const nextControl = await restoreNotificationsInCloud(currentUser.name);
    setNotificationControl(nextControl);
  };

  const handleRefreshAccount = async () => {
    if (!fbUser) return;
    const acc = await ensureOrLoadUserAccount(fbUser);
    setAppUserAccount(acc);
  };

  const handleApproveUserRole = async (
    uid: string,
    role: Exclude<AppUserRole, 'pending'>,
    linkOptions?: { linkedStaffId?: string; linkedPartnerId?: string }
  ) => {
    if (!currentUser || !isDirector(currentUser)) return;
    await approveUserAccountRole(uid, role, currentUser, linkOptions);
    await addAuditLog({
      action: 'user_role_approve',
      actionBengali: 'Google টিম মেম্বার রোল অনুমোদন',
      performedBy: currentUser.name,
      performedById: currentUser.id,
      performedByUid: currentUser.uid,
      role: currentUser.role,
      details: `ব্যবহারকারী (${uid})-কে "${role}" রোলে অনুমোদন দেওয়া হয়েছে।`
    }).catch(() => {});
  };

  const handleRejectUserRole = async (uid: string, reason?: string) => {
    if (!currentUser || !isDirector(currentUser)) return;
    await rejectUserAccountRole(uid, currentUser, reason);
    await addAuditLog({
      action: 'user_role_reject',
      actionBengali: 'ব্যবহারকারীর অ্যাক্সেস স্থগিত',
      performedBy: currentUser.name,
      performedById: currentUser.id,
      performedByUid: currentUser.uid,
      role: currentUser.role,
      details: `ব্যবহারকারী (${uid})-এর অ্যাক্সেস স্থগিত/বাতিল করা হয়েছে।`
    }).catch(() => {});
  };

  const handleSavePortalControl = async (next: PortalControlConfig) => {
    const saved = await savePortalControl(next);
    setPortalControl(saved);
  };

  const handleLogout = async () => {
    // Clear any temporary portal override unlocks when session closes or switches user
    clearTemporaryPortalOverrides();
    setOverrideGateTarget(null);
    setLastUnlockedOverride(null);
    setLiveBillingSessionToken(null);
    setLiveDashReport(null);
    setLiveOltSessionToken(null);
    setLiveOltReport(null);
    await logoutUser();
    setAppUserAccount(null);
    setAllUserAccounts([]);
    setSelectedErpPortalId(null);
    setLockedNavNotice(null);
    setIsLoginModalOpen(false);
    setActiveTab('erp_hub');
  };

  // Action Bar Handlers
  const handleOpenAddStaff = () => {
    if (currentUser?.role === 'staff') return;
    setActiveTab('staff');
    setOpenAddStaffNonce((n) => n + 1);
  };

  const handleOpenMonthlyPdf = () => {
    if (currentUser?.role === 'staff' || currentUser?.role === 'partner') return;
    setActiveTab('reports');
    setTimeout(() => {
      setOpenPrintStudioNonce((n) => n + 1);
    }, 150);
  };

  // Calculate Net Balance for Sidebar Stats (Staff & Directors can see Daily/Monthly/Total financials)
  const isStaffRole = currentUser?.role === 'staff';
  const isPartnerRole = currentUser?.role === 'partner';
  const isRestrictedRole = isStaffRole || isPartnerRole;
  const canManagePortals = Boolean(currentUser && (isDirector(currentUser) || currentUser.role === 'manager'));
  const canUserViewTransactions = canUserAccessPortal('transactions', currentUser, staffs, { portalControl });
  const canUserViewComplaints = canUserAccessPortal('complaints', currentUser, staffs, { portalControl });
  // Keep ERP Command Hub completely free of Digital Display & Company Pad bars; show them inside sub-modules only
  const showDigitalDisplayAndCompanyPad = activeTab !== 'erp_hub';
  const pendingJoinRequestsCount = joinRequests.filter((r) => r.status === 'pending').length;

  const totalIncome = isPartnerRole
    ? 0
    : transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = isPartnerRole
    ? 0
    : transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
  const netBalance = totalIncome - totalExpense;

  // 0. Public QR Statement PDF Viewer Route (?stmt_id=...&p=...) — accessible on scan without requiring ERP login
  if (publicStatementRoute) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center text-xs">আর্থিক বিবরণী লোড হচ্ছে...</div>}>
        <StatementQrViewer
          reportId={publicStatementRoute.reportId}
          fallbackPayload={publicStatementRoute.payload}
          onCloseToLogin={() => {
            try {
              window.history.replaceState({}, '', window.location.pathname);
            } catch {
              // ignore history errors
            }
            setPublicStatementRoute(null);
          }}
        />
      </Suspense>
    );
  }

  // 1. Unauthenticated / Unapproved Visitors: Render ONLY Public PlayStore Install Page, Join Portal, OR Google Sign-In Gate
  // Zero Director data, zero Share Partners, zero Staff lists/PINs in DOM until approved!
  if (!currentUser) {
    return (
      <AppUpdateProvider currentUser={null}>
        <div className="min-h-screen bg-[#020a18] text-slate-100 flex flex-col font-sans">
          <AutoUpdateBanner />
          <OfflineIndicator />
          <div className="bg-[#031229] border-b border-cyan-500/20 px-4 py-1.5 flex items-center justify-end print:hidden">
            <PWAInstallButton />
          </div>
          <Suspense fallback={null}>
            <PlayStoreUpdateModal currentUser={null} />
          </Suspense>
          {autoLogoutNotice && (
            <div className="bg-amber-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between gap-2 print:hidden">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{autoLogoutNotice}</span>
              </div>
              <button
                onClick={() => setAutoLogoutNotice(null)}
                className="p-1 rounded-lg hover:bg-amber-700 transition-colors"
                aria-label="বন্ধ করুন"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {activeTab === 'join' ? (
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-emerald-200">জয়েনিং পোর্টাল লোড হচ্ছে...</div>}>
              <JoiningModal
                isOpen={true}
                isPage={true}
                initialRole={joiningInitialRole}
                company={company}
                whatsappGroupConfig={whatsappGroupConfig}
                onClose={() => setActiveTab('erp_hub')}
                onSubmitJoinRequest={handleSubmitJoinRequest}
                onOpenLogin={() => {
                  try {
                    if (window.location.search) {
                      window.history.replaceState({}, '', window.location.pathname);
                    }
                  } catch {
                    // ignore
                  }
                  setActiveTab('erp_hub');
                }}
              />
            </Suspense>
          ) : activeTab === 'playstore' ? (
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-emerald-200">লোড হচ্ছে...</div>}>
              <PlayStoreAppView
                company={company}
                staffs={[]}
                partners={[]}
                currentUser={null}
                onOpenDashboard={() => setActiveTab('erp_hub')}
                onOpenLogin={() => {
                  try {
                    if (window.location.search) {
                      window.history.replaceState({}, '', window.location.pathname);
                    }
                  } catch {
                    // ignore
                  }
                  setActiveTab('erp_hub');
                }}
              />
            </Suspense>
          ) : (
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-emerald-200">নিরাপদ লগইন পেজ লোড হচ্ছে...</div>}>
              <LoginModal
                isOpen={true}
                isLocked={true}
                onClose={() => {}}
                company={company}
                firebaseUser={fbUser}
                appUserAccount={appUserAccount}
                authLoading={authLoading}
                onOpenPlayStore={() => setActiveTab('playstore')}
                onOpenJoinPortal={() => {
                  setJoiningInitialRole('staff');
                  setActiveTab('join');
                }}
                onSignOut={handleLogout}
                onRefreshAccount={handleRefreshAccount}
              />
            </Suspense>
          )}
        </div>
      </AppUpdateProvider>
    );
  }

  return (
    <AppUpdateProvider currentUser={currentUser}>
      <div className="min-h-screen bg-[#020a18] text-slate-100 flex flex-col font-sans">
        {/* Auto-Update Notification Banner (All Installed App Users) & Mobile Install Notice (Admin Only) */}
        <AutoUpdateBanner />
        <OfflineIndicator />
        <div className="bg-[#031229] border-b border-cyan-500/20 px-4 py-1.5 flex items-center justify-end print:hidden">
          <PWAInstallButton />
        </div>
        {isDirector(currentUser) && <MobileInstallNotice />}

      {/* Auto-logout security toast */}
      {autoLogoutNotice && (
        <div className="bg-amber-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{autoLogoutNotice}</span>
          </div>
          <button
            onClick={() => setAutoLogoutNotice(null)}
            className="p-1 rounded-lg hover:bg-amber-700 transition-colors"
            aria-label="বন্ধ করুন"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Firestore Sync / Permission Error Alert */}
      {firestoreError && (
        <div className="bg-rose-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>
              সিঙ্ক সতর্কতা ({firestoreError.operation}): {firestoreError.message}
            </span>
          </div>
          <button
            onClick={() => clearFirestoreError()}
            className="p-1 rounded-lg hover:bg-rose-700 transition-colors"
            aria-label="বন্ধ করুন"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Offline Mode / Auto-Online Sync Live Toast Banners */}
      {(!offlineSyncState.isOnline || offlineSyncState.pendingCount > 0) && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-black flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              {!offlineSyncState.isOnline
                ? 'অফলাইন মোড চালু — নিশ্চিন্তে হিসাব ও অভিযোগ এন্ট্রি করুন, ইন্টারনেট আসলেই সব তথ্য অটো অনলাইন হয়ে যাবে।'
                : `ইন্টারনেট পাওয়া গেছে! অফলাইনের ${toBengaliNumber(offlineSyncState.pendingCount)}টি এন্ট্রি অনলাইন সিঙ্ক হচ্ছে...`}
            </span>
          </div>
          {offlineSyncState.isOnline && offlineSyncState.pendingCount > 0 && (
            <button
              type="button"
              onClick={handleManualSync}
              disabled={offlineSyncState.isSyncing}
              className="px-3 py-1 rounded-lg bg-slate-950 text-amber-300 text-[11px] font-bold flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${offlineSyncState.isSyncing ? 'animate-spin' : ''}`} />
              <span>এখনই সিঙ্ক করুন</span>
            </button>
          )}
        </div>
      )}

      {offlineSyncState.lastAutoSyncedCount > 0 && offlineSyncState.isOnline && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              ইন্টারনেট সংযোগ পুনরায় চালু! অফলাইনের {toBengaliNumber(offlineSyncState.lastAutoSyncedCount)}টি এন্ট্রি স্বয়ংক্রিয়ভাবে অনলাইন ক্লাউডে সিঙ্ক সম্পন্ন হয়েছে।
            </span>
          </div>
          <button
            type="button"
            onClick={() => clearLastAutoSyncedNotice()}
            className="p-1 rounded-lg hover:bg-emerald-700 transition-colors"
            aria-label="বন্ধ করুন"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Auto 1st-of-Month Previous Month PDF Backup Notice & 1-Click Send (Director Only, shown when working in a portal) */}
      {showDigitalDisplayAndCompanyPad &&
        isDirector(currentUser) &&
        !dismissedPrevMonthBanner &&
        (autoBackupSettings.autoDriveEnabled || autoBackupSettings.autoGmailEnabled) &&
        autoBackupSettings.lastAutoPrevMonthSent !== getPreviousMonthKey() && (
          <div className="bg-gradient-to-r from-indigo-900 via-emerald-900 to-slate-900 text-white px-4 py-2 text-xs font-bold flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/30 print:hidden">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>
                গত মাস ({getPreviousMonthKey()})-এর অটো A4 PDF রিপোর্ট Google Drive ও{' '}
                <span className="text-amber-300">{autoBackupSettings.targetGmail}</span>-এ পাঠানোর জন্য প্রস্তুত।
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOneClickConnectAndSendPrevMonth}
                disabled={isRunningAutoBackup}
                className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] flex items-center gap-1 shadow-sm"
              >
                {isRunningAutoBackup ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
                <span>{isRunningAutoBackup ? 'পাঠানো হচ্ছে...' : '১ ক্লিকে Drive + Gmail-এ পাঠান'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsBackupModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[11px]"
              >
                PDF দেখুন ও প্রিন্ট
              </button>
              <button
                type="button"
                onClick={() => setDismissedPrevMonthBanner(true)}
                className="p-1 rounded-lg hover:bg-white/10"
                aria-label="বন্ধ করুন"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      {/* Auto Backup Completion Toast */}
      {isDirector(currentUser) && autoBackupToast && (
        <div
          className={`px-4 py-2 text-xs font-bold flex flex-wrap items-center justify-between gap-2 print:hidden ${
            autoBackupToast.type === 'success'
              ? 'bg-emerald-700 text-white'
              : 'bg-rose-700 text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{autoBackupToast.text}</span>
          </div>
          <div className="flex items-center gap-2">
            {autoBackupToast.driveLink && (
              <a
                href={autoBackupToast.driveLink}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded-lg bg-white text-emerald-900 font-black text-[11px] flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Drive PDF দেখুন</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => setAutoBackupToast(null)}
              className="p-1 rounded-lg hover:bg-black/20"
              aria-label="বন্ধ করুন"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 1. TOP LETTERHEAD PAD HEADER (Shown only when an ERP Programme / sub-page is opened) */}
      {showDigitalDisplayAndCompanyPad && (
        !isFullScreen ? (
          <Header
            company={company}
            currentUser={currentUser}
          />
        ) : (
          /* Floating mini-restore bar when topbar is hidden */
          <div className="bg-gradient-to-r from-[#020a18] via-[#041d42] to-[#020e21] text-cyan-100 px-4 py-2 flex items-center justify-between text-xs border-b border-cyan-400/30 print:hidden">
            <div className="flex items-center gap-2.5">
              <img
                src={company?.logoUrl || '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg'}
                alt={company?.name || 'DIP BHOLA NETWORK'}
                className="w-7 h-7 rounded-lg bg-white p-0.5 object-contain border border-cyan-300/75"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  if (!img.dataset.fallback) {
                    img.dataset.fallback = '1';
                    img.src = '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg';
                  }
                }}
              />
              <span className="font-extrabold text-sm text-white tracking-wide">{company?.name || 'DIP BHOLA NETWORK'}</span>
              <span className="hidden sm:inline text-cyan-300">• ফুল স্ক্রিন ERP মোড চালু</span>
            </div>
            <button
              onClick={() => setIsFullScreen(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#031632] hover:bg-[#05234d] text-cyan-100 rounded-lg font-bold text-xs transition-colors border border-cyan-400/45"
            >
              <Maximize2 className="w-3.5 h-3.5 text-cyan-300" />
              <span>প্যাড হেডার দেখান</span>
            </button>
          </div>
        )
      )}

      {/* 2. Sticky Top Container ONLY for Digital Display when a Programme is opened + Locked Entry Gate Alert (No top Quick Entry headline bar) */}
      {(showDigitalDisplayAndCompanyPad || lockedNavNotice) && (
        <div className="sticky top-0 z-40 print:hidden shadow-lg">
          {showDigitalDisplayAndCompanyPad && (
            <>
              <DigitalTickerBar
                notice={digitalNotice}
                company={company}
                partners={partners}
                transactions={transactions}
                complaints={complaints}
                customerDues={customerDues}
                joinRequests={joinRequests}
                offlineSyncState={offlineSyncState}
                notificationControl={notificationControl}
                currentUser={currentUser}
                onOpenDisplayTab={() => handleNavigateTab('display')}
                onToggleNotificationWindow={() => setToggleNotifWindowNonce((n) => n + 1)}
              />
              <FixedNotificationBar
                currentUser={currentUser}
                complaints={complaints}
                customerDues={customerDues}
                joinRequests={joinRequests}
                offlineSyncState={offlineSyncState}
                notificationControl={notificationControl}
                toggleWindowNonce={toggleNotifWindowNonce}
                onManualSync={handleManualSync}
                onNavigateTab={handleNavigateTab}
                onOpenJoinRequests={() => {
                  setAppLinksTab('whatsapp_groups');
                  setIsAppLinksOpen(true);
                }}
                onDeleteAllNotifications={
                  isDirector(currentUser) ? handleDeleteAllNotifications : undefined
                }
                onRestoreNotifications={
                  isDirector(currentUser) ? handleRestoreNotifications : undefined
                }
              />
            </>
          )}
          {lockedNavNotice && (
            <div className="bg-rose-700 text-white px-4 py-2 text-xs sm:text-sm font-black flex flex-wrap items-center justify-between gap-2 border-b border-rose-400/50">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Lock className="w-4 h-4 text-rose-200 shrink-0" />
                <span>{lockedNavNotice.message}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {lockedNavNotice.portalId &&
                  isPortalOverridableForUser(lockedNavNotice.portalId, currentUser) && (
                    <button
                      type="button"
                      onClick={() =>
                        setOverrideGateTarget({
                          portalId: lockedNavNotice.portalId!,
                          portalTitle:
                            lockedNavNotice.portalTitle ||
                            getPortalBengaliLabel(lockedNavNotice.portalId!),
                          source: 'nav'
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>ওভাররাইড পিন</span>
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => setLockedNavNotice(null)}
                  className="p-1 rounded-lg hover:bg-black/20 shrink-0 cursor-pointer"
                  aria-label="বন্ধ করুন"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. MAIN LAYOUT */}
      <div className="flex-1 flex min-h-0 pb-24">
        
        {/* Left Side Bars (বাম পাশে আলাদা আলাদা বার) */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={handleNavigateTab}
          currentUser={currentUser}
          company={company}
          staffs={staffs}
          portalControl={portalControl}
          onOpenPortalControl={canManagePortals ? () => setIsPortalControlOpen(true) : undefined}
          onLockedNav={showLockedPortalNotice}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          isFullScreen={isFullScreen}
          onToggleFullScreen={() => setIsFullScreen((prev) => !prev)}
          onOpenStaffQr={() => {
            setStaffQrTargetId(undefined);
            setIsStaffQrOpen(true);
          }}
          onOpenMonthlyPdf={handleOpenMonthlyPdf}
          onOpenBackup={() => setIsBackupModalOpen(true)}
          onOpenCompanySetup={() =>
            requireDirectorPin(
              'কোম্পানি সেটআপ পরিবর্তন',
              'প্রতিষ্ঠানের তথ্য পরিবর্তনের জন্য পরিচালকের ৪-ডিজিট পিন দিন।',
              () => setIsCompanySetupOpen(true)
            )
          }
          onOpenAddStaff={handleOpenAddStaff}
          onOpenAppLinks={() => {
            setAppLinksTab('download');
            setIsAppLinksOpen(true);
          }}
          onOpenWhatsAppGroups={() => {
            setAppLinksTab('whatsapp_groups');
            setIsAppLinksOpen(true);
          }}
          pendingJoinRequestsCount={pendingJoinRequestsCount}
          onOpenAuditLog={() =>
            requireDirectorPin(
              'অডিট লগ ভেরিফিকেশন',
              'সিস্টেমের বিস্তারিত অডিট লগ দেখতে পরিচালকের ৪-ডিজিট পিন দিন।',
              () => setIsAuditModalOpen(true)
            )
          }
          onOpenSecurityDashboard={() =>
            requireDirectorPin(
              'সিকিউরিটি ড্যাশবোর্ড ভেরিফিকেশন',
              'সিকিউরিটি ড্যাশবোর্ড ও সেশন কন্ট্রোলে প্রবেশ করতে পরিচালকের পিন দিন।',
              () => setIsSecurityDashboardOpen(true)
            )
          }
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode((d) => !d)}
          onLogout={handleLogout}
          isOpenMobile={isSidebarOpenMobile}
          onCloseMobile={() => setIsSidebarOpenMobile(false)}
          hideDesktopPersistent={false}
          onOpenDataPurge={
            isDirector(currentUser)
              ? () =>
                  requireDirectorPin(
                    'পুরাতন পোর্টাল ও সকল তথ্য মুছুন',
                    'পুরাতন পোর্টালের (t4povhqa...) সকল গ্রাহক, বকেয়া ও সেটিংস তথ্য স্থায়ীভাবে ডিলিট করতে পরিচালকের ৪-ডিজিট পিন দিন।',
                    () => {
                      setOpenCompanySetupScrollToPurge(true);
                      setIsCompanySetupOpen(true);
                    }
                  )
              : undefined
          }
          offlineSyncState={offlineSyncState}
          onManualSync={handleManualSync}
          stats={{
            txCount: transactions.length,
            staffCount: staffs.length,
            duesCount: customerDues.filter((d) => (d.currentDue || 0) > 0).length,
            netBalance,
            complaintsCount: complaints.length,
            pendingComplaintsCount: complaints.filter((c) => c.status === 'pending').length,
            customersCount: customers.length
          }}
        />

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          
          {/* Main Body Content View */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5">
            <Suspense fallback={<div className="py-12 text-center text-xs text-slate-400">লোড হচ্ছে...</div>}>
            {activeTab === 'erp_hub' && (
              <ErpCommandHub
                company={company}
                currentUser={currentUser}
                transactions={transactions}
                customers={customers}
                customerDues={customerDues}
                complaints={complaints}
                staffs={staffs}
                partners={partners}
                officers={officers}
                digitalNotice={digitalNotice}
                auditLogs={auditLogs}
                onPortalSelectChange={(pid) => setSelectedErpPortalId(pid)}
                onNavigateTab={handleNavigateTab}
                onOpenAddModal={handleOpenAddTxModal}
                onOpenAddComplaint={() => {
                  if (!canUserViewComplaints) {
                    setLockedNavNotice({
                      message: '🔒 "অভিযোগ" পোর্টালটি লক করা আছে — অভিযোগ এন্ট্রির অনুমতি নেই।',
                      portalId: 'complaints',
                      portalTitle: 'অভিযোগ ও লাইন সার্ভিস'
                    });
                    return;
                  }
                  setEditingComplaint(null);
                  setPrefillCustomerForComplaint(null);
                  setPrefillStaffForComplaint(null);
                  setIsComplaintModalOpen(true);
                }}
                onOpenBackup={() => setIsBackupModalOpen(true)}
                onOpenCompanySetup={() =>
                  requireDirectorPin(
                    'কোম্পানি সেটআপ পরিবর্তন',
                    'প্রতিষ্ঠানের নাম, লোগো ও ঠিকানা সম্পাদনার জন্য পরিচালকের ৪-ডিজিট পিন দিন।',
                    () => {
                      setOpenCompanySetupScrollToPurge(false);
                      setIsCompanySetupOpen(true);
                    }
                  )
                }
                onOpenDataPurge={
                  isDirector(currentUser)
                    ? () =>
                        requireDirectorPin(
                          'পুরাতন পোর্টাল ও সকল তথ্য মুছুন',
                          'পুরাতন পোর্টালের (t4povhqa...) সকল গ্রাহক, বকেয়া ও সেটিংস তথ্য স্থায়ীভাবে ডিলিট করতে পরিচালকের ৪-ডিজিট পিন দিন।',
                          () => {
                            setOpenCompanySetupScrollToPurge(true);
                            setIsCompanySetupOpen(true);
                          }
                        )
                    : undefined
                }
                onOpenSecurityDashboard={() =>
                  requireDirectorPin(
                    'সিকিউরিটি ও অডিট ড্যাশবোর্ড',
                    'নিরাপত্তা ড্যাশবোর্ড ও সেশন লগে প্রবেশ করতে পরিচালকের ৪-ডিজিট পিন দিন।',
                    () => setIsSecurityDashboardOpen(true)
                  )
                }
                onOpenAppLinks={() => setIsAppLinksOpen(true)}
                onOpenStaffQr={() => {
                  setStaffQrTargetId(undefined);
                  setIsStaffQrOpen(true);
                }}
                onOpenMonthlyPdf={handleOpenMonthlyPdf}
                isFullscreen={isFullScreen}
                onToggleFullscreen={() => setIsFullScreen((prev) => !prev)}
                isDarkMode={isDarkMode}
                onToggleDarkMode={() => setIsDarkMode((d) => !d)}
                onOpenAuditLog={() =>
                  requireDirectorPin(
                    'অডিট লগ ভেরিফিকেশন',
                    'সিস্টেমের বিস্তারিত অডিট লগ দেখতে পরিচালকের ৪-ডিজিট পিন দিন।',
                    () => setIsAuditModalOpen(true)
                  )
                }
                onSwitchUser={() => setIsLoginModalOpen(true)}
                autoRefreshIntervalSec={autoRefresh.intervalSec}
                onChangeAutoRefresh={(sec) => autoRefresh.setIntervalSec(sec)}
                onOpenSettings={() => setIsSettingsModalOpen(true)}
                onOpenSidebarMenu={() => setIsSidebarOpenMobile((prev) => !prev)}
                onRequestPortalOverride={(portalId, portalTitle) =>
                  setOverrideGateTarget({ portalId, portalTitle, source: 'erp_hub' })
                }
                lastUnlockedOverride={lastUnlockedOverride}
                liveDashReport={liveDashReport}
                liveOltReport={liveOltReport}
                onDeleteAllCustomers={isDirector(currentUser) ? handleDeleteAllCustomers : undefined}
                portalControl={portalControl}
                onOpenPortalControl={canManagePortals ? () => setIsPortalControlOpen(true) : undefined}
              />
            )}

            {activeTab === 'dashboard' && (
              <Dashboard
                transactions={transactions}
                staffs={staffs}
                partners={partners}
                company={company}
                currentUser={currentUser}
                complaints={complaints}
                customers={customers}
                customerDues={customerDues}
                auditLogs={auditLogs}
                whatsappGroupConfig={whatsappGroupConfig}
                onOpenAddModal={handleOpenAddTxModal}
                onViewAllTransactions={() => setActiveTab('transactions')}
                onViewStaff={() => setActiveTab('staff')}
                onViewPartners={() => setActiveTab('partners')}
                onViewComplaints={() => setActiveTab('complaints')}
                onOpenAddComplaint={() => {
                  setEditingComplaint(null);
                  setPrefillCustomerForComplaint(null);
                  setPrefillStaffForComplaint(null);
                  setIsComplaintModalOpen(true);
                }}
                onQuickExpense={handleQuickExpense}
                onNavigateTab={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'transactions' && (
              <TransactionsTable
                transactions={transactions}
                currentUser={currentUser}
                company={company}
                whatsappGroupConfig={whatsappGroupConfig}
                offlineSyncState={offlineSyncState}
                onManualSyncNow={handleManualSync}
                onOpenAddModal={handleOpenAddTxModal}
                onEditTransaction={handleEditTx}
                onDeleteTransaction={handleDeleteTx}
                onExportCsv={(periodLabel, filteredRows) => handleExportCsv(periodLabel, filteredRows)}
              />
            )}

            {/* Customer Complaints Tab (গ্রাহক অভিযোগ ও সার্ভিস ট্র্যাকিং) */}
            {activeTab === 'complaints' && (
              <CustomerComplaintsView
                complaints={complaints}
                staffs={staffs}
                currentUser={currentUser}
                company={company}
                whatsappGroupConfig={whatsappGroupConfig}
                onSaveWhatsAppGroupConfig={saveWhatsAppGroupConfig}
                onOpenAddModal={() => {
                  setEditingComplaint(null);
                  setPrefillCustomerForComplaint(null);
                  setPrefillStaffForComplaint(null);
                  setIsComplaintModalOpen(true);
                }}
                onEditComplaint={(cmp) => {
                  setEditingComplaint(cmp);
                  setPrefillCustomerForComplaint(null);
                  setPrefillStaffForComplaint(null);
                  setIsComplaintModalOpen(true);
                }}
                onDeleteComplaint={handleDeleteComplaint}
                onDeleteAllComplaints={isDirector(currentUser) ? handleDeleteAllComplaints : undefined}
                onUpdateStatus={handleUpdateComplaintStatus}
                onRecordLineExpense={handleRecordLineExpense}
              />
            )}

            {/* Customer Directory Tab (গ্রাহক ও সদস্য তালিকা + অটো-ফিল) */}
            {activeTab === 'customers' && (
              <CustomersDirectoryView
                customers={customers}
                transactions={transactions}
                customerDues={customerDues}
                currentUser={currentUser}
                staffs={staffs}
                onAddCustomer={async (c) => {
                  await addCustomer(c);
                }}
                onUpdateCustomer={updateCustomer}
                onDeleteCustomer={deleteCustomer}
                onDeleteAllCustomers={isDirector(currentUser) ? handleDeleteAllCustomers : undefined}
                onImportCustomers={(rows) => importCustomersBatch(rows, customers)}
                onOpenTroubleshootPortal={() => handleNavigateTab('troubleshoot_portal')}
                onCreateComplaintFromCustomer={(cust) => {
                  setEditingComplaint(null);
                  setPrefillCustomerForComplaint(cust);
                  setPrefillStaffForComplaint(null);
                  setIsComplaintModalOpen(true);
                }}
              />
            )}

            {/* Embedded Troubleshooting & Resolution Portal Tab */}
            {activeTab === 'troubleshoot_portal' && (
              <TroubleshootPortalView
                company={company}
                currentUser={currentUser}
                staffs={staffs}
                customers={customers}
                complaints={complaints}
                liveBillingSessionToken={liveBillingSessionToken}
                liveDashReport={liveDashReport}
                onBillingSessionChange={(token, report) => {
                  setLiveBillingSessionToken(token);
                  setLiveDashReport(report);
                }}
                liveOltSessionToken={liveOltSessionToken}
                liveOltReport={liveOltReport}
                onOltSessionChange={(token, report) => {
                  setLiveOltSessionToken(token);
                  setLiveOltReport(report);
                }}
                onImportBillingCustomers={(rows) => importCustomersBatch(rows, customers)}
                onDeleteAllCustomers={isDirector(currentUser) ? handleDeleteAllCustomers : undefined}
                onUpdateCustomer={updateCustomer}
                onAddCustomer={async (c) => {
                  await addCustomer(c);
                }}
                onCreateComplaintFromCustomer={(cust, assignedStaffId) => {
                  setEditingComplaint(null);
                  setPrefillCustomerForComplaint(cust);
                  setPrefillStaffForComplaint(assignedStaffId || null);
                  setIsComplaintModalOpen(true);
                }}
                onOpenComplaints={() => handleNavigateTab('complaints')}
                onOpenCustomers={() => handleNavigateTab('customers')}
                onSavePortalUrl={
                  isDirector(currentUser)
                    ? async (nextUrl: string) => {
                        const baseCompany = company || DEFAULT_COMPANY_CONFIG;
                        await updateCompany({
                          ...baseCompany,
                          troubleshootPortalUrl: nextUrl || DEFAULT_TROUBLESHOOT_PORTAL_URL
                        });
                        await addAuditLog({
                          action: 'company_update',
                          actionBengali: 'সমাধান ওয়েব পোর্টাল লিংক পরিবর্তন',
                          performedBy: currentUser.name,
                          performedById: currentUser.id,
                          role: currentUser.role,
                          details: `নতুন পোর্টাল লিংক সংরক্ষিত: ${nextUrl}`
                        });
                      }
                    : undefined
                }
                onOpenCompanySetup={
                  isDirector(currentUser)
                    ? () =>
                        requireDirectorPin(
                          'সমস্যা সমাধান পোর্টাল লিংক সেটআপ',
                          'সমস্যা সমাধান ওয়েব পোর্টালের লিংক পরিবর্তন করতে পরিচালকের ৪-ডিজিট পিন দিন।',
                          () => setIsCompanySetupOpen(true)
                        )
                    : undefined
                }
              />
            )}

            {activeTab === 'staff' && (
              <StaffManagement
                staffs={staffs}
                transactions={transactions}
                currentUser={currentUser}
                company={company}
                joinRequests={joinRequests}
                whatsappGroupConfig={whatsappGroupConfig}
                onApproveJoinRequest={handleApproveJoinRequest}
                onRejectJoinRequest={handleRejectJoinRequest}
                onOpenWhatsAppGroups={() => {
                  setAppLinksTab('whatsapp_groups');
                  setIsAppLinksOpen(true);
                }}
                onAddStaff={async (s) => { await addStaff(s); }}
                onUpdateStaff={updateStaff}
                onDeleteStaff={deleteStaff}
                onPaySalary={handlePayStaffSalary}
                onOpenStaffQr={(staffId) => {
                  setStaffQrTargetId(staffId);
                  setIsStaffQrOpen(true);
                }}
                openAddModalNonce={openAddStaffNonce}
              />
            )}

            {activeTab === 'partners' && (
              <PartnersView
                partners={partners}
                transactions={transactions}
                company={company}
                currentUser={currentUser}
                whatsappGroupConfig={whatsappGroupConfig}
                joinRequests={joinRequests}
                onApproveJoinRequest={handleApproveJoinRequest}
                onRejectJoinRequest={handleRejectJoinRequest}
                onOpenWhatsAppGroups={() => {
                  setAppLinksTab('whatsapp_groups');
                  setIsAppLinksOpen(true);
                }}
                onAddPartner={async (p) => { await addPartner(p); }}
                onUpdatePartner={updatePartner}
                onDeletePartner={deletePartner}
                onAddInvestment={addPartnerInvestment}
              />
            )}

            {activeTab === 'dues' && (
              <CustomerDuesView
                customerDues={customerDues}
                currentUser={currentUser}
                onAddCustomerDue={async (d) => { await addCustomerDue(d); }}
                onUpdateCustomerDue={updateCustomerDue}
                onDeleteCustomerDue={deleteCustomerDue}
                onCollectPayment={handleCollectCustomerDue}
              />
            )}

            {activeTab === 'display' && (
              <DigitalDisplayBoard
                notice={digitalNotice}
                currentUser={currentUser}
                company={company}
                partners={partners}
                transactions={transactions}
                onSaveNotice={async (n) => {
                  if (!isDirector(currentUser)) return;
                  await saveDigitalNotice(n);
                }}
              />
            )}

            {activeTab === 'officers' && (
              <OfficersView
                officers={officers}
                staffs={staffs}
                company={company}
                currentUser={currentUser}
                onAppointOfficer={async (type, data) => {
                  await appointOfficer(type, data, officers);
                }}
                onSaveAllOfficers={saveOfficers}
              />
            )}

            {activeTab === 'reports' && (
              <ReportsView
                transactions={transactions}
                company={company}
                partners={partners}
                staffs={staffs}
                officers={officers}
                complaints={complaints}
                whatsappGroupConfig={whatsappGroupConfig}
                openPrintStudioNonce={openPrintStudioNonce}
                onExportCsv={handleExportCsv}
              />
            )}

            {activeTab === 'playstore' && (
              <PlayStoreAppView
                company={company}
                staffs={isRestrictedRole ? [] : staffs}
                partners={isRestrictedRole ? [] : partners}
                currentUser={currentUser}
                onOpenDashboard={() => handleNavigateTab('erp_hub')}
                onOpenRoleTarget={(target) => handleNavigateTab(target)}
                onOpenPortalControl={canManagePortals ? () => setIsPortalControlOpen(true) : undefined}
              />
            )}

            {activeTab.startsWith('custom:') && (() => {
              const targetCustomPortal = portalControl.customPortals.find(
                (cp) => `custom:${cp.id}` === activeTab
              );
              if (!targetCustomPortal) return null;
              return (
                <CustomPortalView
                  portal={targetCustomPortal}
                  isDirectorOrAdmin={canManagePortals}
                  onBackToHub={() => handleNavigateTab('erp_hub')}
                  onOpenPortalControl={canManagePortals ? () => setIsPortalControlOpen(true) : undefined}
                />
              );
            })()}
            </Suspense>
          </main>

          {/* Footer (Hidden on pure ERP Hub landing, visible when viewing a portal or programme) */}
          {showDigitalDisplayAndCompanyPad && (
            <footer className="bg-[#020b1b] border-t border-cyan-400/25 py-3.5 text-center text-xs text-cyan-200/80 print:hidden mt-auto">
              <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div>
                  © 2026 <span className="font-bold text-white">{company?.name || 'DIP BHOLA NETWORK'}</span>. সর্বস্বত্ব সংরক্ষিত।
                </div>
                <div className="text-[11px] text-cyan-300/80 font-medium">
                  {company?.address || '৩নং পশ্চিম ইলিশা।ভোলা সদর ভোলা'}
                </div>
              </div>
            </footer>
          )}
        </div>

      </div>

      {/* 4. Minimal return-to-ERP bar shown when user is inside any opened Programme tab */}
      {activeTab !== 'erp_hub' && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#020e21]/95 backdrop-blur-md border-t border-cyan-500/30 shadow-[0_-6px_24px_rgba(2,10,24,0.35)] px-3 py-2 print:hidden">
          <div className="max-w-md mx-auto flex items-center justify-center">
            <button
              type="button"
              onClick={() => handleNavigateTab('erp_hub')}
              className="w-full py-2 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition-transform active:scale-95 cursor-pointer"
            >
              <Cpu className="w-4 h-4" />
              <span>← ERP সিস্টেম (সব পোর্টাল)</span>
            </button>
          </div>
        </nav>
      )}

      <Suspense fallback={null}>
      {/* Transaction Add / Edit Modal */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        onSave={handleSaveTransaction}
        editingTx={editingTx}
        currentUser={currentUser}
        defaultType={txModalDefaultType}
      />

      {/* Customer Complaint Modal */}
      <ComplaintModal
        isOpen={isComplaintModalOpen}
        onClose={() => {
          setIsComplaintModalOpen(false);
          setPrefillCustomerForComplaint(null);
          setPrefillStaffForComplaint(null);
        }}
        onSave={handleSaveComplaint}
        editingComplaint={editingComplaint}
        staffs={staffs}
        complaints={complaints}
        currentUser={currentUser}
        company={company}
        whatsappGroupConfig={whatsappGroupConfig}
        customers={customers}
        prefillCustomer={prefillCustomerForComplaint}
        prefillStaffId={prefillStaffForComplaint}
        onSaveNewCustomer={async (c) => {
          await addCustomer(c);
        }}
        onOpenTroubleshootPortal={() => {
          setIsComplaintModalOpen(false);
          handleNavigateTab('troubleshoot_portal');
        }}
      />

      {/* Login / Switch Google Account Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        company={company}
        firebaseUser={fbUser}
        appUserAccount={appUserAccount}
        authLoading={authLoading}
        currentUser={currentUser}
        onOpenPlayStore={() => {
          setIsLoginModalOpen(false);
          setActiveTab('playstore');
        }}
        onOpenJoinPortal={() => {
          setIsLoginModalOpen(false);
          setJoiningInitialRole('staff');
          setIsJoiningModalOpen(true);
        }}
        onSignOut={handleLogout}
        onRefreshAccount={handleRefreshAccount}
      />

      {/* Staff & Share Partner Joining Modal */}
      <JoiningModal
        isOpen={isJoiningModalOpen}
        initialRole={joiningInitialRole}
        company={company}
        whatsappGroupConfig={whatsappGroupConfig}
        onClose={() => setIsJoiningModalOpen(false)}
        onSubmitJoinRequest={handleSubmitJoinRequest}
      />

      {/* Director-Only Backup, Company Setup, Security & PIN Verification Modals */}
      {isDirector(currentUser) && (
        <>
          <BackupModal
            isOpen={isBackupModalOpen}
            onClose={() => setIsBackupModalOpen(false)}
            company={company}
            partners={partners}
            staffs={staffs}
            transactions={transactions}
            customerDues={customerDues}
            adminAuth={adminAuth}
            onRefreshData={() => initData(true)}
            onAutoSettingsUpdated={(s) => setAutoBackupSettings(s)}
          />

          <CompanySetupModal
            isOpen={isCompanySetupOpen}
            onClose={() => {
              setIsCompanySetupOpen(false);
              setOpenCompanySetupScrollToPurge(false);
            }}
            company={company}
            onSaveCompany={async (comp) => { await updateCompany(comp); }}
            currentUser={currentUser}
            customersCount={customers.length}
            customerDuesCount={customerDues.length}
            complaintsCount={complaints.length}
            joinRequestsCount={joinRequests.length}
            onPurgeLegacyPortalData={handlePurgeLegacyPortalData}
            initialScrollToDataManagement={openCompanySetupScrollToPurge}
          />
        </>
      )}

      {/* Universal App Settings Modal (Font Size Small / Medium / Large, Theme & Display) */}
      <AppSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        currentUser={currentUser}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((d) => !d)}
        isFullScreen={isFullScreen}
        onToggleFullScreen={() => setIsFullScreen((prev) => !prev)}
        autoRefreshIntervalSec={autoRefresh.intervalSec}
        onChangeAutoRefresh={(sec) => autoRefresh.setIntervalSec(sec)}
        onOpenCompanySetup={
          isDirector(currentUser)
            ? () =>
                requireDirectorPin(
                  'কোম্পানি সেটআপ পরিবর্তন',
                  'প্রতিষ্ঠানের নাম, লোগো ও ঠিকানা সম্পাদনার জন্য পরিচালকের ৪-ডিজিট পিন দিন।',
                  () => setIsCompanySetupOpen(true)
                )
            : undefined
        }
        onOpenPortalControl={canManagePortals ? () => setIsPortalControlOpen(true) : undefined}
      />

      {/* App Links & QR Code Share Modal */}
      <AppLinksModal
        isOpen={isAppLinksOpen}
        onClose={() => setIsAppLinksOpen(false)}
        staffs={staffs}
        partners={partners}
        company={company}
        currentUser={currentUser}
        initialTab={appLinksTab}
        whatsappGroupConfig={whatsappGroupConfig}
        onSaveWhatsAppGroupConfig={saveWhatsAppGroupConfig}
        joinRequests={joinRequests}
        onApproveJoinRequest={handleApproveJoinRequest}
        onRejectJoinRequest={handleRejectJoinRequest}
        onOpenPlayStore={() => {
          setIsAppLinksOpen(false);
          setActiveTab('playstore');
        }}
        onOpenTroubleshootPortal={() => {
          setIsAppLinksOpen(false);
          handleNavigateTab('troubleshoot_portal');
        }}
        onOpenCompanySetup={
          isDirector(currentUser)
            ? () => {
                setIsAppLinksOpen(false);
                requireDirectorPin(
                  'কোম্পানি সেটআপ পরিবর্তন',
                  'প্রতিষ্ঠানের তথ্য ও সমস্যা সমাধান পোর্টাল লিংক পরিবর্তনের জন্য পরিচালকের ৪-ডিজিট পিন দিন।',
                  () => setIsCompanySetupOpen(true)
                );
              }
            : undefined
        }
      />

      {/* Official Staff QR & Photo ID Card Modal */}
      <StaffQrModal
        isOpen={isStaffQrOpen}
        onClose={() => {
          setIsStaffQrOpen(false);
          setStaffQrTargetId(undefined);
        }}
        staffs={staffs}
        company={company}
        initialStaffId={staffQrTargetId}
        onUpdateStaff={canManagePortals ? updateStaff : undefined}
      />

      {/* Global Installed App Portal Full Control Modal (Director & Manager) */}
      {canManagePortals && (
        <PortalControlModal
          isOpen={isPortalControlOpen}
          onClose={() => setIsPortalControlOpen(false)}
          portalControl={portalControl}
          onSavePortalControl={handleSavePortalControl}
          currentUser={currentUser}
          darkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode((d) => !d)}
          isFullscreen={isFullScreen}
          onToggleFullscreen={() => setIsFullScreen((prev) => !prev)}
          autoRefresh={autoRefresh.intervalSec > 0}
          onToggleAutoRefresh={() =>
            autoRefresh.setIntervalSec(autoRefresh.intervalSec > 0 ? 0 : 60)
          }
        />
      )}

      {/* Director-Only Security, Audit & PIN Modals (Never rendered for Staff / Non-Directors) */}
      {isDirector(currentUser) && (
        <>
          <AuditLogModal
            isOpen={isAuditModalOpen}
            onClose={() => setIsAuditModalOpen(false)}
            auditLogs={auditLogs}
            currentUser={currentUser}
          />

          <AdminSecurityDashboard
            isOpen={isSecurityDashboardOpen}
            onClose={() => setIsSecurityDashboardOpen(false)}
            auditLogs={auditLogs}
            adminAuth={adminAuth}
            company={company}
            currentUser={currentUser}
            allUsers={allUserAccounts}
            staffs={staffs}
            partners={partners}
            onApproveUserRole={handleApproveUserRole}
            onRejectUserRole={handleRejectUserRole}
            onOpenPortalControl={() => setIsPortalControlOpen(true)}
            onForceLogoutAll={handleLogout}
            onOpenForgotPin={() => setIsLoginModalOpen(true)}
          />

          <AdminPinPromptModal
            isOpen={pinPrompt.isOpen}
            onClose={() => {
              const cancelCb = !pinVerifiedFlagRef.current ? pinPrompt.onCancelled : undefined;
              setPinPrompt((prev) => ({ ...prev, isOpen: false, onCancelled: undefined }));
              cancelCb?.();
            }}
            onSuccess={pinPrompt.onVerified}
            adminAuth={adminAuth}
            currentUser={currentUser}
            title={pinPrompt.title}
            description={pinPrompt.description}
            onOpenForgotPin={() => {
              setPinPrompt((prev) => ({ ...prev, isOpen: false }));
              setIsLoginModalOpen(true);
            }}
          />
        </>
      )}
      {/* Portal Entry Gate Override Modal (Director PIN Temporary Unlock for Staff) */}
      <PortalOverrideGateModal
        isOpen={Boolean(overrideGateTarget)}
        portalId={overrideGateTarget?.portalId || null}
        portalTitle={overrideGateTarget?.portalTitle}
        currentUser={currentUser}
        adminAuth={adminAuth}
        onClose={() => setOverrideGateTarget(null)}
        onUnlocked={(portalId, durationMinutes) => {
          const portalTitle =
            overrideGateTarget?.portalTitle || getPortalBengaliLabel(portalId);
          const source = overrideGateTarget?.source || 'erp_hub';
          setLockedNavNotice(null);
          setOverrideGateTarget(null);
          void addAuditLog({
            action: 'portal_override_unlock',
            actionBengali: 'পোর্টাল সাময়িক আনলক (ওভাররাইড পিন)',
            performedBy: currentUser.name,
            performedById: currentUser.id,
            role: currentUser.role,
            details: `পরিচালক ওভাররাইড পিনের মাধ্যমে স্টাফ "${currentUser.name}"-এর জন্য "${portalTitle}" পোর্টালটি ${toBengaliNumber(durationMinutes)} মিনিটের জন্য সাময়িক আনলক করা হয়েছে।`
          });
          if (source === 'nav') {
            setActiveTab(portalId);
            setSelectedErpPortalId(null);
          } else {
            setLastUnlockedOverride({ portalId, nonce: Date.now() });
          }
        }}
      />

      {/* Global Google Play Install & Auto-Update System Modal */}
      <PlayStoreUpdateModal currentUser={currentUser} />
      </Suspense>

      {/* Bottom Floating Iconic Quick Entry System Logo (Always present at bottom of screen) */}
      <QuickCommandBar
        currentUser={currentUser}
        company={company}
        transactions={transactions}
        complaints={complaints}
        canTransactions={canUserViewTransactions}
        canComplaints={canUserViewComplaints}
        showFinancialSummary={showDigitalDisplayAndCompanyPad}
        showBackToErp={activeTab !== 'erp_hub'}
        onBackToErp={() => handleNavigateTab('erp_hub')}
        onLockedAction={showLockedPortalNotice}
        onOpenAddModal={handleOpenAddTxModal}
        onOpenLedger={() => handleNavigateTab('transactions')}
        onOpenComplaints={() => handleNavigateTab('complaints')}
        onOpenSidebarMenu={() => setIsSidebarOpenMobile((prev) => !prev)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        whatsappGroupConfig={whatsappGroupConfig}
        onLogout={handleLogout}
      />
    </div>
    </AppUpdateProvider>
  );
}
