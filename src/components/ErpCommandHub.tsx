import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpDown,
  Cloud,
  ExternalLink,
  FileText,
  Gauge,
  Globe,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  Maximize2,
  Menu,
  Minimize2,
  Moon,
  PieChart,
  Plus,
  QrCode,
  Settings,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  Type,
  Unlock,
  Users,
  Wrench,
  X,
  Sliders
} from 'lucide-react';
import {
  canUserAccessCustomPortal,
  canUserAccessPortal,
  canUserPerformAction,
  getActivePortalOverrideExpiresAt,
  hasActivePortalOverride,
  isPortalDeletedByAdmin,
  isPortalOverridableForUser,
  revokeTemporaryPortalOverride,
  subscribePortalOverrides
} from '../utils/portalPermissions';
import { prefetchPortalModule } from '../utils/modulePrefetch';
import { analyzeCustomerOnu } from '../utils/oltDiagnostics';
import {
  AuditLog,
  BillingPortalDashReport,
  Company,
  CustomerComplaint,
  CustomerDue,
  CustomerMember,
  CustomPortalLink,
  DigitalNotice,
  OfficersState,
  OltLiveReport,
  Partner,
  PortalControlConfig,
  Staff,
  Transaction,
  TransactionType,
  UserSession
} from '../types';
import { renderCustomPortalIcon } from '../utils/portalIcons';
import {
  formatCurrency,
  getTodayString,
  getTransactionDateKey,
  toBengaliNumber
} from '../utils/formatters';
import { isCustomerExpired } from '../utils/customerStatus';
import { getEffectiveTroubleshootPortalUrl } from '../utils/appUrls';
import {
  AppFontSize,
  getSavedAppFontSize,
  setAppFontSize,
  subscribeAppFontSize
} from '../utils/fontScale';
import { NetSpeedTestCard } from './NetSpeedTestCard';

interface ErpCommandHubProps {
  company: Company | null;
  currentUser: UserSession;
  transactions: Transaction[];
  customers: CustomerMember[];
  customerDues: CustomerDue[];
  complaints: CustomerComplaint[];
  staffs: Staff[];
  partners: Partner[];
  officers?: OfficersState | null;
  digitalNotice?: DigitalNotice | null;
  auditLogs?: AuditLog[];
  onNavigateTab: (tab: string) => void;
  onOpenAddModal: (type: TransactionType) => void;
  onOpenAddComplaint?: () => void;
  onOpenBackup?: () => void;
  onOpenCompanySetup?: () => void;
  onOpenSecurityDashboard?: () => void;
  onOpenAppLinks?: () => void;
  onOpenStaffQr?: () => void;
  onOpenMonthlyPdf?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onOpenAuditLog?: () => void;
  onSwitchUser?: () => void;
  autoRefreshIntervalSec?: number;
  onChangeAutoRefresh?: (sec: 0 | 30 | 60 | 300) => void;
  onPortalSelectChange?: (portalId: string | null) => void;
  onOpenSettings?: () => void;
  onOpenSidebarMenu?: () => void;
  onRequestPortalOverride?: (portalId: string, portalTitle: string) => void;
  lastUnlockedOverride?: { portalId: string; nonce: number } | null;
  liveDashReport?: BillingPortalDashReport | null;
  liveOltReport?: OltLiveReport | null;
  onDeleteAllCustomers?: () => Promise<number | void>;
  onOpenDataPurge?: () => void;
  portalControl?: PortalControlConfig | null;
  onOpenPortalControl?: () => void;
}

// Custom crisp white/cyan circuit-style SVG icons matching the radial reference diagram
const ExecutiveUserSvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="7.5" r="3.5" />
    <path d="M5.5 20.5c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
    <path d="M12 14l1.2 3.2-1.2 1.8-1.2-1.8L12 14z" />
  </svg>
);

const TeamClusterSvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="6.5" r="3.2" />
    <circle cx="6.2" cy="16.5" r="3.2" />
    <circle cx="17.8" cy="16.5" r="3.2" />
    <circle cx="12" cy="6" r="1.1" />
    <circle cx="6.2" cy="16" r="1.1" />
    <circle cx="17.8" cy="16" r="1.1" />
  </svg>
);

const AnalyticsBoardSvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="3.5" width="16" height="17" rx="2" />
    <path d="M8 8h8M8 11.5h5" />
    <path d="M7 17.5l3-3 2.5 1.8 4.5-4.5" />
    <circle cx="17" cy="11.8" r="1" />
  </svg>
);

const LedgerDocsSvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7L14.5 3.5z" />
    <path d="M14.5 3.5V7H18" />
    <path d="M9 12h6M9 15.5h4" />
    <path d="M19 9v10a2 2 0 0 1-2 2H9" />
  </svg>
);

const GrowthChartSvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3.5 4v16h17" />
    <path d="M6.5 15l4-4 3.5 2.5 5.5-6" />
    <path d="M6.5 18.5l4-2.5 4 1 5-3.5" />
  </svg>
);

const CloudVaultSvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M7.5 15.5h9a3.5 3.5 0 0 0 .5-6.95A5 5 0 0 0 7.2 7.4 3.5 3.5 0 0 0 7.5 15.5z" />
    <path d="M12 15.5v4.5M9 15.5l-2.5 3.5M15 15.5l2.5 3.5" />
    <circle cx="12" cy="20.5" r="1" />
    <circle cx="6" cy="19.5" r="1" />
    <circle cx="18" cy="19.5" r="1" />
  </svg>
);

const OrgHierarchySvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="9.5" y="3.5" width="5" height="4" rx="0.8" />
    <rect x="4" y="16" width="4.5" height="4" rx="0.8" />
    <rect x="9.75" y="16" width="4.5" height="4" rx="0.8" />
    <rect x="15.5" y="16" width="4.5" height="4" rx="0.8" />
    <path d="M12 7.5v4.5M6.25 12h11.5M6.25 12v4M12 12v4M17.75 12v4" />
  </svg>
);

const TargetEquitySvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1.5" />
    <path d="M16.5 7.5L21 3M18.5 3H21v2.5" />
  </svg>
);

const UserSearchSvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <circle cx="10.5" cy="8.8" r="2.1" />
    <path d="M7.2 14.2c.7-1.6 2-2.4 3.3-2.4s2.6.8 3.3 2.4" />
    <path d="M15.3 15.3L20.5 20.5" />
  </svg>
);

const GlobePortalSvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="7.5" />
    <ellipse cx="12" cy="12" rx="3.4" ry="7.5" />
    <path d="M4.8 9.5h14.4M4.8 14.5h14.4" />
    <circle cx="12" cy="12" r="10.2" strokeDasharray="16 8" />
  </svg>
);

const SignalFaultSvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 17.5a7 7 0 0 1 0-11" />
    <path d="M8.5 15a3.8 3.8 0 0 1 0-6" />
    <path d="M19 6.5a7 7 0 0 1 0 11" />
    <path d="M15.5 9a3.8 3.8 0 0 1 0 6" />
    <circle cx="12" cy="12" r="1.8" />
  </svg>
);

const AutomationGearsSvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.55} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="8" cy="8.5" r="3" />
    <circle cx="16.5" cy="10.5" r="2.6" />
    <circle cx="11" cy="16.8" r="2.7" />
    <path d="M8 4v1.5M8 11.5V13M3.5 8.5H5M11 8.5h1.5M16.5 6.5V8M16.5 13v1.5M11 13v1M11 19.5v1" />
  </svg>
);

const BroadcastBulbSvg: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 17.5h6M9.8 20.5h4.4" />
    <path d="M9.5 17.5c0-1.5-3-3.2-3-7a5.5 5.5 0 1 1 11 0c0 3.8-3 5.5-3 7" />
    <path d="M10.5 11.5l1.5-2 1.5 2" />
  </svg>
);

interface PortalNode {
  id: string;
  shortLabel: string;
  title: string;
  englishDomain: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  hideForStaff?: boolean;
  hideForPartner?: boolean;
  customPortal?: CustomPortalLink;
}

export const ErpCommandHub: React.FC<ErpCommandHubProps> = ({
  company,
  currentUser,
  transactions,
  customers,
  customerDues,
  complaints,
  staffs,
  partners,
  officers,
  digitalNotice,
  auditLogs = [],
  onNavigateTab,
  onOpenAddModal,
  onOpenAddComplaint,
  onOpenBackup,
  onOpenCompanySetup,
  onOpenSecurityDashboard,
  onOpenAppLinks,
  onOpenStaffQr,
  onOpenMonthlyPdf,
  isFullscreen = false,
  onToggleFullscreen,
  isDarkMode = false,
  onToggleDarkMode,
  onOpenAuditLog,
  onSwitchUser,
  autoRefreshIntervalSec = 30,
  onChangeAutoRefresh,
  onPortalSelectChange,
  onOpenSettings,
  onOpenSidebarMenu,
  onRequestPortalOverride,
  lastUnlockedOverride,
  liveDashReport = null,
  liveOltReport = null,
  onDeleteAllCustomers,
  onOpenDataPurge,
  portalControl,
  onOpenPortalControl
}) => {
  // Starts null so the stationary radial ERP hub shows cleanly on startup
  const [selectedPortalId, setSelectedPortalId] = useState<string | null>(null);
  const [lockedPortalAlert, setLockedPortalAlert] = useState<string | null>(null);
  const [lockedPortalMeta, setLockedPortalMeta] = useState<{
    id: string;
    title: string;
    overridable: boolean;
  } | null>(null);
  const [overrideTick, setOverrideTick] = useState(0);
  const [isSpeedTestOpen, setIsSpeedTestOpen] = useState<boolean>(false);
  const [dashboardSortMode, setDashboardSortMode] = useState<'latest' | 'highest_expense'>('latest');
  const [appFontSize, setAppFontSizeState] = useState<AppFontSize>(() => getSavedAppFontSize());
  const [confirmResetOldCustomers, setConfirmResetOldCustomers] = useState(false);
  const [isResettingOldCustomers, setIsResettingOldCustomers] = useState(false);
  const [resetFeedbackMsg, setResetFeedbackMsg] = useState<string | null>(null);

  const detailPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = subscribePortalOverrides(() => setOverrideTick((n) => n + 1));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeAppFontSize((sz) => setAppFontSizeState(sz));
    return unsub;
  }, []);

  useEffect(() => {
    if (!lastUnlockedOverride?.portalId) return;
    const pid = lastUnlockedOverride.portalId;
    if (canUserAccessPortal(pid, currentUser, staffs)) {
      setLockedPortalAlert(null);
      setLockedPortalMeta(null);
      setIsSpeedTestOpen(false);
      setSelectedPortalId(pid);
      onPortalSelectChange?.(pid);
      setTimeout(() => {
        if (detailPanelRef.current) {
          detailPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 60);
    }
  }, [lastUnlockedOverride, currentUser, staffs, onPortalSelectChange]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedPortalId) {
        setSelectedPortalId(null);
        onPortalSelectChange?.(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPortalId, onPortalSelectChange]);

  const isDirectorRole = currentUser.role === 'director' || currentUser.role === 'admin';
  const isStaffRole = currentUser.role === 'staff';
  const isPartnerRole = currentUser.role === 'partner';

  const troubleshootPortalUrl = useMemo(
    () => getEffectiveTroubleshootPortalUrl(company),
    [company]
  );

  // Real-time financial & operational computations across all portals
  const metrics = useMemo(() => {
    const today = getTodayString();
    const currentMonth = today.slice(0, 7);

    let totalIncome = 0;
    let totalExpense = 0;
    let todayIncome = 0;
    let todayExpense = 0;
    let monthIncome = 0;
    let monthExpense = 0;

    transactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      const d = getTransactionDateKey(tx);
      if (tx.type === 'income') {
        totalIncome += amt;
        if (d === today) todayIncome += amt;
        if (d.startsWith(currentMonth)) monthIncome += amt;
      } else {
        totalExpense += amt;
        if (d === today) todayExpense += amt;
        if (d.startsWith(currentMonth)) monthExpense += amt;
      }
    });

    const netBalance = totalIncome - totalExpense;
    const totalDue = customerDues.reduce((s, d) => s + Math.max(0, Number(d.currentDue) || 0), 0);
    const totalDueCollected = customerDues.reduce((s, d) => s + Math.max(0, Number(d.paidAmount) || 0), 0);
    const duePendingAccounts = customerDues.filter((d) => (Number(d.currentDue) || 0) > 0).length;

    const totalCustomers = customers.length;
    const activeCustomers = customers.filter((c) => c.status === 'active').length;
    const expiredCustomers = customers.filter((c) => isCustomerExpired(c)).length;
    const inactiveCustomers = Math.max(0, totalCustomers - activeCustomers);

    let onuProblemCount = 0;
    let onuHighLossCount = 0;
    let onuLosOrOfflineCount = 0;
    let onuHealthyCount = 0;
    customers.forEach((c, idx) => {
      const parsed = analyzeCustomerOnu(c, idx);
      if (parsed.hasProblem) onuProblemCount += 1;
      if (parsed.isHighLoss) onuHighLossCount += 1;
      if (parsed.isOffline || parsed.isLos) onuLosOrOfflineCount += 1;
      if (!parsed.hasProblem && !parsed.isOffline) onuHealthyCount += 1;
    });

    const pendingComplaints = complaints.filter((c) => c.status === 'pending').length;
    const inProgressComplaints = complaints.filter((c) => c.status === 'in_progress').length;
    const resolvedComplaints = complaints.filter((c) => c.status === 'resolved').length;

    const activeStaffList = staffs.filter((s) => s.status !== 'inactive');
    const monthlySalaryPool = activeStaffList.reduce((s, st) => s + (Number(st.salary) || 0), 0);

    const activePartnerList = partners.filter((p) => p.status !== 'inactive');
    const totalPartnerInvestment = partners.reduce((s, p) => s + (Number(p.investment) || 0), 0);

    return {
      totalIncome,
      totalExpense,
      todayIncome,
      todayExpense,
      monthIncome,
      monthExpense,
      netBalance,
      totalDue,
      totalDueCollected,
      duePendingAccounts,
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      expiredCustomers,
      onuProblemCount,
      onuHighLossCount,
      onuLosOrOfflineCount,
      onuHealthyCount,
      pendingComplaints,
      inProgressComplaints,
      resolvedComplaints,
      activeStaffList,
      monthlySalaryPool,
      activePartnerList,
      totalPartnerInvestment
    };
  }, [transactions, customerDues, customers, complaints, staffs, partners]);

  // 14 distinct orbital portals arranged symmetrically like the reference ERP diagram
  const rawPortals: PortalNode[] = useMemo(
    () => [
      {
        id: 'dashboard',
        shortLabel: 'ড্যাশবোর্ড',
        title: 'দৈনিক নির্বাহী ড্যাশবোর্ড',
        englishDomain: 'Executive BI Portal',
        description: 'আয়-ব্যয় সামারি, ক্যাশ ব্যালেন্স, দৈনিক গ্রাফ ও দ্রুত হিসাব এন্ট্রি',
        icon: ExecutiveUserSvg,
        hideForStaff: true,
        hideForPartner: true
      },
      {
        id: 'staff',
        shortLabel: 'স্টাফ ও বেতন',
        title: 'স্টাফ ও বেতন ব্যবস্থাপনা পোর্টাল',
        englishDomain: 'HR & Payroll Portal',
        description: 'সক্রিয় কর্মী প্রোফাইল, পদবি, মাসিক বেতন ও QR পরিচয়পত্র',
        icon: TeamClusterSvg,
        hideForStaff: true,
        hideForPartner: true
      },
      {
        id: 'reports',
        shortLabel: 'রিপোর্ট ও PDF',
        title: 'আর্থিক রিপোর্ট ও PDF বিশ্লেষণ পোর্টাল',
        englishDomain: 'Financial Reports Portal',
        description: 'দৈনিক, মাসিক ও বার্ষিক আয়-ব্যয় বিশ্লেষণ এবং A4 PDF অডিট প্রিন্ট',
        icon: AnalyticsBoardSvg
      },
      {
        id: 'transactions',
        shortLabel: 'হিসাব খাতা',
        title: 'দৈনিক আয়-ব্যয় হিসাব খাতা পোর্টাল',
        englishDomain: 'Cash & Ledger Portal',
        description: 'দৈনিক জমা-খরচ ভাউচার, নগদ ও ব্যাংক হিসাব এবং তাৎক্ষণিক অডিট রেকর্ড',
        icon: LedgerDocsSvg
      },
      {
        id: 'dues',
        shortLabel: 'বাকি ও বিল',
        title: 'গ্রাহক বকেয়া ও বিল কালেকশন পোর্টাল',
        englishDomain: 'Dues Receivable Portal',
        description: 'মাসিক বকেয়া লেজার, আংশিক ও সম্পূর্ণ বিল আদায়ের হিসাব',
        icon: GrowthChartSvg,
        hideForStaff: true,
        hideForPartner: true
      },
      {
        id: 'backup',
        shortLabel: 'ব্যাকআপ',
        title: 'ক্লাউড ড্রাইভ ও ডাটা ব্যাকআপ পোর্টাল',
        englishDomain: 'Cloud & Drive Backup Portal',
        description: 'Google Drive PDF/CSV ব্যাকআপ, JSON এক্সপোর্ট ও ক্লাউড নিরাপত্তা',
        icon: CloudVaultSvg,
        adminOnly: true
      },
      {
        id: 'officers',
        shortLabel: 'কর্মকর্তা',
        title: 'ম্যানেজার ও অডিটর পোর্টাল',
        englishDomain: 'Organization & Authority',
        description: 'প্রধান হিসাবরক্ষক, ম্যানেজার, অডিটর ও সহকারী অডিটর নিয়োগ প্যানেল',
        icon: OrgHierarchySvg,
        hideForStaff: true,
        hideForPartner: true
      },
      {
        id: 'partners',
        shortLabel: 'অংশীদার',
        title: isPartnerRole ? 'আমার শেয়ার পোর্টাল' : 'অংশীদার ও মূলধন পোর্টাল',
        englishDomain: 'Equity & Partners Portal',
        description: 'বিনিয়োগ মূলধন, শেয়ার শতাংশ (%) ও লাভ-ক্ষতি বণ্টনের বিবরণী',
        icon: TargetEquitySvg,
        hideForStaff: true
      },
      {
        id: 'customers',
        shortLabel: 'গ্রাহক CRM',
        title: 'গ্রাহক ও মেম্বার ডিরেক্টরি পোর্টাল',
        englishDomain: 'Subscribers CRM Portal',
        description: 'সকল গ্রাহক তালিকা, প্যাকেজ, মোবাইল নাম্বার, ঠিকানা ও অনু স্ট্যাটাস',
        icon: UserSearchSvg,
        hideForPartner: true
      },
      {
        id: 'troubleshoot_portal',
        shortLabel: 'সমস্যা সমাধান',
        title: 'সমস্যা অনুসন্ধান ও সমাধান পোর্টাল',
        englishDomain: 'Troubleshooting & Solution Portal',
        description: 'সহজে সমস্যা খুঁজে বের করে দ্রুত সমাধান করার সমন্বিত ওয়েব পোর্টাল',
        icon: GlobePortalSvg,
        hideForPartner: true
      },
      {
        id: 'complaints',
        shortLabel: 'অভিযোগ ও লাইন',
        title: 'অভিযোগ ও ফিল্ড সার্ভিস পোর্টাল',
        englishDomain: 'Complaints & Field Desk',
        description: 'লাইন ওয়্যার ফল্ট টিকেট, স্টাফ অ্যাসাইন, খরচ ও সমাধানের লাইভ আপডেট',
        icon: SignalFaultSvg,
        hideForPartner: true
      },
      {
        id: 'security',
        shortLabel: 'সিকিউরিটি',
        title: 'সিকিউরিটি, অডিট লগ ও সেটআপ পোর্টাল',
        englishDomain: 'Security & Setup Portal',
        description: 'পিন কন্ট্রোল, অডিট লগ, কোম্পানি তথ্য ও সমস্যা সমাধান পোর্টাল লিংক সেটআপ',
        icon: AutomationGearsSvg,
        adminOnly: true
      },
      {
        id: 'display',
        shortLabel: 'LED ডিসপ্লে',
        title: 'ডিজিটাল LED নোটিশ ডিসপ্লে পোর্টাল',
        englishDomain: 'Digital Broadcast Display',
        description: 'অফিস LED স্ক্রিন নোটিশ বোর্ড, টিকার বার্তা ও লাইভ কোম্পানি বুলেটিন',
        icon: BroadcastBulbSvg,
        hideForPartner: true
      }
    ],
    [isPartnerRole]
  );

  // Filter out deleted built-in portals and merge active custom linked portals
  const visiblePortals: PortalNode[] = useMemo(() => {
    const activeBuiltins = rawPortals.filter((p) => !isPortalDeletedByAdmin(p.id, portalControl));
    const customList = (portalControl?.customPortals || [])
      .filter((cp) => canUserAccessCustomPortal(cp, currentUser))
      .map<PortalNode>((cp) => ({
        id: `custom:${cp.id}`,
        shortLabel: cp.shortLabel,
        title: cp.title || cp.shortLabel,
        englishDomain: 'Custom Linked Portal',
        description: cp.description || `লিংক: ${cp.url}`,
        icon: ({ className }: { className?: string }) => renderCustomPortalIcon(cp.iconName, className),
        customPortal: cp
      }));
    return [...activeBuiltins, ...customList];
  }, [rawPortals, portalControl, currentUser]);

  const canDashboard = useMemo(
    () => canUserAccessPortal('dashboard', currentUser, staffs, { portalControl }),
    [currentUser, staffs, overrideTick, portalControl]
  );

  const selectedPortal = useMemo(() => {
    if (!selectedPortalId) return null;
    const found = visiblePortals.find((p) => p.id === selectedPortalId) || null;
    if (!found || !canUserAccessPortal(found.id, currentUser, staffs, { portalControl })) return null;
    return found;
  }, [visiblePortals, selectedPortalId, currentUser, staffs, overrideTick, portalControl]);

  // Static stationary radial positions (zero rotation, zero drag, zero slide)
  const orbitNodes = useMemo(() => {
    const count = Math.max(1, visiblePortals.length);
    const radiusPct = count > 14 ? 38.2 : 36.2;
    return visiblePortals.map((portal, index) => {
      const angleRad = (index / count) * Math.PI * 2 - Math.PI / 2;
      const xPct = 50 + radiusPct * Math.cos(angleRad);
      const yPct = 50 + radiusPct * Math.sin(angleRad);
      return {
        portal,
        index,
        xPct,
        yPct
      };
    });
  }, [visiblePortals]);

  const sortedDashboardTransactions = useMemo(() => {
    if (dashboardSortMode === 'highest_expense') {
      return [...transactions]
        .filter((tx) => tx.type === 'expense')
        .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
        .slice(0, 5);
    }
    return [...transactions]
      .sort((a, b) => {
        const da = getTransactionDateKey(a);
        const db = getTransactionDateKey(b);
        if (da !== db) return da < db ? 1 : -1;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      })
      .slice(0, 5);
  }, [transactions, dashboardSortMode]);

  const handleSelectPortal = (portalId: string) => {
    const targetPortal = visiblePortals.find((p) => p.id === portalId);
    const hasAccess = canUserAccessPortal(portalId, currentUser, staffs, { portalControl });
    if (!hasAccess) {
      const overridable = isPortalOverridableForUser(portalId, currentUser);
      const portalTitle = targetPortal?.title || portalId;
      setLockedPortalMeta({
        id: portalId,
        title: portalTitle,
        overridable
      });
      setLockedPortalAlert(
        overridable
          ? `🔒 "${portalTitle}" পোর্টালটি লক করা আছে! পরিচালক পিন দিয়ে সাময়িক আনলক করতে পারেন।`
          : `🔒 "${portalTitle}" পোর্টালটি স্থায়ীভাবে লক করা আছে! অনুমতির বাইরে।`
      );
      return;
    }
    setLockedPortalAlert(null);
    setLockedPortalMeta(null);
    setIsSpeedTestOpen(false);
    if (selectedPortalId === portalId) {
      setSelectedPortalId(null);
      onPortalSelectChange?.(null);
      return;
    }
    setSelectedPortalId(portalId);
    onPortalSelectChange?.(portalId);
    setTimeout(() => {
      if (detailPanelRef.current) {
        detailPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 60);
  };

  // Render real portal-specific live details when user taps a specific orbital icon
  const renderPortalLiveBody = (portal: PortalNode) => {
    if (portal.customPortal) {
      const cp = portal.customPortal;
      return (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#03132b] border border-cyan-400/40 space-y-2">
            <div className="text-xs font-bold text-cyan-300">সংযুক্ত পোর্টাল লিংক (URL)</div>
            <div className="font-mono text-xs sm:text-sm text-white break-all">{cp.url}</div>
            <div className="text-xs text-emerald-300 font-semibold">
              ওপেন মোড: {cp.openMode === 'new_tab' ? 'নতুন ব্রাউজার ট্যাব' : 'অ্যাপের ভেতরে (In-App ভিউ)'}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {cp.openMode === 'in_app' ? (
              <button
                type="button"
                onClick={() => onNavigateTab(`custom:${cp.id}`)}
                className="py-3 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Globe className="w-4 h-4" />
                <span>অ্যাপের ভেতরে খুলুন</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <a
                href={cp.url}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-sm flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-4 h-4" />
                <span>নতুন ট্যাবে খুলুন</span>
              </a>
            )}

            <a
              href={cp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-cyan-400/45 text-white font-bold text-sm flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-4 h-4" />
              <span>ব্রাউজারে সরাসরি খুলুন</span>
            </a>
          </div>

          {(currentUser.role === 'director' || currentUser.role === 'admin') && onOpenPortalControl && (
            <button
              type="button"
              onClick={onOpenPortalControl}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-500/25 hover:bg-indigo-500/40 border border-indigo-400/55 text-indigo-100 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>এই পোর্টাল এডিট বা ডিলিট করুন (App Control)</span>
            </button>
          )}
        </div>
      );
    }

    switch (portal.id) {
      case 'troubleshoot_portal': {
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2.5 font-mono tabular-nums">
              <div className="rounded-xl bg-[#03132b] border border-cyan-400/40 p-3">
                <div className="text-xs sm:text-sm font-sans font-bold text-cyan-200/90">নিবন্ধিত ONU</div>
                <div className="text-xl sm:text-2xl font-black text-cyan-300 mt-0.5">
                  {toBengaliNumber(metrics.totalCustomers)} টি
                </div>
                <div className="text-[11px] font-sans text-emerald-300 mt-0.5">
                  সুস্থ Online: {toBengaliNumber(metrics.onuHealthyCount)}
                </div>
              </div>
              <div className="rounded-xl bg-[#03132b] border border-amber-400/40 p-3">
                <div className="text-xs sm:text-sm font-sans font-bold text-amber-200/90">হাই লস / Offline</div>
                <div className="text-xl sm:text-2xl font-black text-amber-300 mt-0.5">
                  {toBengaliNumber(metrics.onuProblemCount)} টি
                </div>
                <div className="text-[11px] font-sans text-rose-300 mt-0.5">
                  লস: {toBengaliNumber(metrics.onuHighLossCount)} · LOS: {toBengaliNumber(metrics.onuLosOrOfflineCount)}
                </div>
              </div>
              <div className="rounded-xl bg-[#03132b] border border-rose-400/40 p-3">
                <div className="text-xs sm:text-sm font-sans font-bold text-rose-200/90">পেন্ডিং অভিযোগ</div>
                <div className="text-xl sm:text-2xl font-black text-rose-300 mt-0.5">
                  {toBengaliNumber(metrics.pendingComplaints)} টি
                </div>
                <div className="text-[11px] font-sans text-emerald-300 mt-0.5">
                  সমাধান: {toBengaliNumber(metrics.resolvedComplaints)}টি
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-[#03132b]/90 border border-cyan-500/30 divide-y divide-cyan-500/20 text-sm">
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                <span className="text-cyan-200/85 font-semibold">বিল্ট-ইন OLT কনসোল</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-emerald-300">
                  FD1204S-B0 (4-PON) · CDATA
                </span>
              </div>
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                <span className="text-cyan-200/85 font-semibold">OLT লাইভ (103.158.206.4:6560)</span>
                {liveOltReport ? (
                  <span className="text-xs font-black text-emerald-300">
                    সংযুক্ত · Online {toBengaliNumber(liveOltReport.onlineOnus)} / মোট {toBengaliNumber(liveOltReport.totalOnus)}
                    {liveOltReport.highLossOnus + liveOltReport.losOnus > 0
                      ? ` · সমস্যা ${toBengaliNumber(liveOltReport.highLossOnus + liveOltReport.losOnus)}`
                      : ''}
                  </span>
                ) : (
                  <span className="text-xs font-bold text-amber-300">
                    কনসোলে লগইন করলে অটো-আপডেট চলবে
                  </span>
                )}
              </div>
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                <span className="text-cyan-200/85 font-semibold">admin.bhola.net লাইভ সিঙ্ক</span>
                {liveDashReport ? (
                  <span className="text-xs font-black text-emerald-300">
                    সংযুক্ত ({liveDashReport.username}) · সচল:{' '}
                    {liveDashReport.activeCustomers !== null
                      ? toBengaliNumber(liveDashReport.activeCustomers)
                      : '—'}{' '}
                    / মোট:{' '}
                    {liveDashReport.totalCustomers !== null
                      ? toBengaliNumber(liveDashReport.totalCustomers)
                      : '—'}
                  </span>
                ) : (
                  <span className="text-xs font-bold text-amber-300">
                    কনসোলের ভেতর লগইন করে dashReport সিঙ্ক করুন
                  </span>
                )}
              </div>
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                <span className="text-cyan-200/85 font-semibold shrink-0">সংযুক্ত পোর্টাল লিংক</span>
                <div className="flex items-center gap-2 min-w-0">
                  <a
                    href={troubleshootPortalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs sm:text-sm text-cyan-300 hover:text-white underline truncate flex items-center gap-1"
                    title={troubleshootPortalUrl}
                  >
                    <span className="truncate">{troubleshootPortalUrl}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                  {onOpenCompanySetup && isDirectorRole && (
                    <button
                      type="button"
                      onClick={onOpenCompanySetup}
                      className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/40 text-xs font-bold text-cyan-100 shrink-0 cursor-pointer"
                    >
                      বদলান
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigateTab('troubleshoot_portal')}
                className="flex-1 min-w-[200px] py-3 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-sm sm:text-base flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Globe className="w-4 h-4" />
                <span>CDATA OLT ও ONU সমাধান কনসোল খুলুন</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsSpeedTestOpen((v) => !v)}
                className={`py-3 px-4 rounded-xl border font-extrabold text-sm sm:text-base flex items-center justify-center gap-1.5 cursor-pointer ${
                  isSpeedTestOpen
                    ? 'bg-emerald-400 text-[#020c1b] border-white'
                    : 'bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-400/50 text-cyan-100'
                }`}
              >
                <Gauge className="w-4 h-4" />
                <span>নেট স্পিড টেস্ট</span>
              </button>
            </div>
            {isSpeedTestOpen && <NetSpeedTestCard onClose={() => setIsSpeedTestOpen(false)} />}
          </div>
        );
      }

      case 'transactions': {
        const recentTx = transactions.slice(0, 4);
        const canViewTotals = canUserPerformAction('canViewFinancialTotals', currentUser, staffs);
        const canAddTx = canUserPerformAction('canAddTransaction', currentUser, staffs);
        return (
          <div className="space-y-4">
            {canViewTotals ? (
              <div className="grid grid-cols-3 gap-2.5 font-mono tabular-nums">
                <div className="rounded-xl bg-[#03132b] border border-cyan-400/35 p-3">
                  <div className="text-[11px] font-sans text-cyan-200/80">নিট ব্যালেন্স</div>
                  <div className="text-base sm:text-lg font-extrabold text-white mt-0.5 truncate">
                    {formatCurrency(metrics.netBalance)}
                  </div>
                </div>
                <div className="rounded-xl bg-[#03132b] border border-emerald-400/35 p-3">
                  <div className="text-[11px] font-sans text-emerald-200/80">আজকের আয়</div>
                  <div className="text-base sm:text-lg font-extrabold text-emerald-300 mt-0.5 truncate">
                    {formatCurrency(metrics.todayIncome)}
                  </div>
                </div>
                <div className="rounded-xl bg-[#03132b] border border-rose-400/35 p-3">
                  <div className="text-[11px] font-sans text-rose-200/80">আজকের ব্যয়</div>
                  <div className="text-base sm:text-lg font-extrabold text-rose-300 mt-0.5 truncate">
                    {formatCurrency(metrics.todayExpense)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-[#03132b]/80 border border-cyan-500/25 px-3.5 py-2.5 text-xs text-cyan-200/80">
                মোট ক্যাশ ব্যালেন্স ও আর্থিক সারসংক্ষেপ দেখার অনুমতি অ্যাডমিন দ্বারা সীমিত।
              </div>
            )}

            <div className="rounded-xl bg-[#03132b]/85 border border-cyan-500/25 divide-y divide-cyan-500/15">
              <div className="px-3.5 py-2 text-[11px] font-bold text-cyan-300 flex items-center justify-between">
                <span>সর্বশেষ লেনদেন ({toBengaliNumber(transactions.length)}টি মোট)</span>
                {canViewTotals && (
                  <span className="font-mono text-cyan-200/75">
                    মোট আয় {formatCurrency(metrics.totalIncome)}
                  </span>
                )}
              </div>
              {recentTx.length === 0 ? (
                <div className="px-3.5 py-3 text-xs text-cyan-200/75">
                  এখনো কোনো লেনদেন এন্ট্রি করা হয়নি।
                </div>
              ) : (
                recentTx.map((tx) => (
                  <div key={tx.id} className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{tx.title}</div>
                      <div className="text-[11px] text-cyan-200/70">
                        {tx.category} · {getTransactionDateKey(tx)}
                      </div>
                    </div>
                    <span
                      className={`font-mono tabular-nums font-extrabold shrink-0 ${
                        tx.type === 'income' ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigateTab('transactions')}
                className="flex-1 min-w-[140px] py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>পূর্ণ হিসাব খাতা খুলুন</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              {canAddTx && (
                <>
                  <button
                    type="button"
                    onClick={() => onOpenAddModal('income')}
                    className="py-2.5 px-3.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-200 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>আয়</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAddModal('expense')}
                    className="py-2.5 px-3.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/50 text-rose-200 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ব্যয়</span>
                  </button>
                </>
              )}
            </div>
          </div>
        );
      }

      case 'dues': {
        const topDues = [...customerDues]
          .filter((d) => (Number(d.currentDue) || 0) > 0)
          .sort((a, b) => (Number(b.currentDue) || 0) - (Number(a.currentDue) || 0))
          .slice(0, 4);
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2.5 font-mono tabular-nums">
              <div className="rounded-xl bg-[#03132b] border border-amber-400/35 p-3">
                <div className="text-[11px] font-sans text-amber-200/80">মোট বকেয়া</div>
                <div className="text-base sm:text-lg font-extrabold text-amber-300 mt-0.5 truncate">
                  {formatCurrency(metrics.totalDue)}
                </div>
              </div>
              <div className="rounded-xl bg-[#03132b] border border-cyan-400/35 p-3">
                <div className="text-[11px] font-sans text-cyan-200/80">বকেয়া গ্রাহক</div>
                <div className="text-lg font-extrabold text-white mt-0.5">
                  {toBengaliNumber(metrics.duePendingAccounts)} জন
                </div>
              </div>
              <div className="rounded-xl bg-[#03132b] border border-emerald-400/35 p-3">
                <div className="text-[11px] font-sans text-emerald-200/80">মোট আদায়কৃত</div>
                <div className="text-base sm:text-lg font-extrabold text-emerald-300 mt-0.5 truncate">
                  {formatCurrency(metrics.totalDueCollected)}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-[#03132b]/85 border border-cyan-500/25 divide-y divide-cyan-500/15">
              <div className="px-3.5 py-2 text-[11px] font-bold text-cyan-300">
                সর্বোচ্চ বকেয়া গ্রাহক তালিকা
              </div>
              {topDues.length === 0 ? (
                <div className="px-3.5 py-3 text-xs text-emerald-300">
                  কোনো বকেয়া হিসাব বাকি নেই।
                </div>
              ) : (
                topDues.map((d) => (
                  <div key={d.id} className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{d.customerName}</div>
                      <div className="text-[11px] text-cyan-200/70">{d.phone || d.address || 'বকেয়া হিসাব'}</div>
                    </div>
                    <span className="font-mono tabular-nums font-extrabold text-amber-300 shrink-0">
                      {formatCurrency(d.currentDue)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('dues')}
              className="w-full py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>বাকি ও বিল পোর্টাল খুলুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      }

      case 'customers': {
        const recentCustomers = customers.slice(0, 4);
        return (
          <div className="space-y-4">
            {liveDashReport && (
              <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/45 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-black text-emerald-200">
                  admin.bhola.net Live ({liveDashReport.username})
                </span>
                <span className="font-mono font-black text-emerald-300">
                  সচল:{' '}
                  {liveDashReport.activeCustomers !== null
                    ? toBengaliNumber(liveDashReport.activeCustomers)
                    : '—'}{' '}
                  / মোট:{' '}
                  {liveDashReport.totalCustomers !== null
                    ? toBengaliNumber(liveDashReport.totalCustomers)
                    : '—'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2.5 font-mono tabular-nums">
              <div className="rounded-xl bg-[#03132b] border border-cyan-400/35 p-3">
                <div className="text-[11px] font-sans text-cyan-200/80">মোট গ্রাহক</div>
                <div className="text-lg font-extrabold text-white mt-0.5">
                  {toBengaliNumber(metrics.totalCustomers)}
                </div>
              </div>
              <div className="rounded-xl bg-[#03132b] border border-emerald-400/35 p-3">
                <div className="text-[11px] font-sans text-emerald-200/80">সচল (Active)</div>
                <div className="text-lg font-extrabold text-emerald-300 mt-0.5">
                  {toBengaliNumber(metrics.activeCustomers)}
                </div>
              </div>
              <div className="rounded-xl bg-[#03132b] border border-rose-400/35 p-3">
                <div className="text-[11px] font-sans text-rose-200/80">বিচ্ছিন্ন / Inactive</div>
                <div className="text-lg font-extrabold text-rose-300 mt-0.5">
                  {toBengaliNumber(metrics.inactiveCustomers)}
                </div>
              </div>
            </div>

            {resetFeedbackMsg && (
              <div className="rounded-xl bg-emerald-500/20 border border-emerald-400/60 px-3.5 py-2 text-xs font-bold text-emerald-100 flex items-center justify-between gap-2">
                <span>{resetFeedbackMsg}</span>
                <button
                  type="button"
                  onClick={() => setResetFeedbackMsg(null)}
                  className="p-0.5 hover:opacity-80 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {confirmResetOldCustomers && onDeleteAllCustomers && (
              <div className="rounded-xl bg-rose-950/80 border border-rose-400/70 p-3.5 space-y-2.5">
                <div className="text-xs font-bold text-rose-100">
                  অ্যাপে থাকা পুরাতন {toBengaliNumber(customers.length)} জন গ্রাহক স্থায়ীভাবে মুছে ০ করতে চান? এরপর admin.bhola.net লাইভ সিঙ্ক বা নতুন Excel ইমপোর্ট করতে পারবেন।
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={isResettingOldCustomers}
                    onClick={() => setConfirmResetOldCustomers(false)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white cursor-pointer"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    disabled={isResettingOldCustomers}
                    onClick={async () => {
                      setIsResettingOldCustomers(true);
                      try {
                        const deleted = await onDeleteAllCustomers();
                        setConfirmResetOldCustomers(false);
                        if (typeof deleted === 'number' && deleted === 0) {
                          setResetFeedbackMsg('পরিচালক পিন যাচাই না হওয়ায় পুরাতন গ্রাহক মোছা হয়নি।');
                        } else {
                          setResetFeedbackMsg(
                            `পুরাতন ${toBengaliNumber(
                              typeof deleted === 'number' ? deleted : customers.length
                            )} জন গ্রাহক স্থায়ীভাবে মুছে ০ করা হয়েছে।`
                          );
                        }
                      } finally {
                        setIsResettingOldCustomers(false);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 disabled:opacity-60 text-white text-xs font-black flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isResettingOldCustomers ? 'মুছছে...' : 'হ্যাঁ, সব মুছে ০ করুন'}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-xl bg-[#03132b]/85 border border-cyan-500/25 divide-y divide-cyan-500/15">
              <div className="px-3.5 py-2 text-[11px] font-bold text-cyan-300">
                সাম্প্রতিক গ্রাহক তালিকা ({toBengaliNumber(customers.length)}টি ডাটাবেস রেকর্ড)
              </div>
              {recentCustomers.length === 0 ? (
                <div className="px-3.5 py-3 text-xs text-cyan-200/75">
                  কোনো গ্রাহক পাওয়া যায়নি। admin.bhola.net লাইভ সিঙ্ক, Excel ফাইল বা ম্যানুয়ালি গ্রাহক যুক্ত করুন।
                </div>
              ) : (
                recentCustomers.map((c) => (
                  <div key={c.id} className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{c.name}</div>
                      <div className="text-[11px] text-cyan-200/70 font-mono truncate">
                        {c.memberId || c.phone || '—'} · {c.packageName || 'প্যাকেজ'}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-bold shrink-0 ${
                        c.status === 'active' ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {c.status === 'active' ? 'সচল' : 'বন্ধ'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigateTab('customers')}
                className="flex-1 min-w-[160px] py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>গ্রাহক ডিরেক্টরি খুলুন</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              {isDirectorRole && onDeleteAllCustomers && customers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmResetOldCustomers(true)}
                  className="py-2.5 px-3.5 rounded-xl bg-rose-600/85 hover:bg-rose-600 border border-rose-400/50 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
                  title="পুরাতন সংরক্ষিত সকল গ্রাহক মুছে ০ করুন"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>সব পুরাতন গ্রাহক মুছুন ({toBengaliNumber(customers.length)})</span>
                </button>
              )}
            </div>
          </div>
        );
      }

      case 'complaints': {
        const recentComplaints = complaints.slice(0, 4);
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2.5 font-mono tabular-nums">
              <div className="rounded-xl bg-[#03132b] border border-rose-400/35 p-3">
                <div className="text-[11px] font-sans text-rose-200/80">অপেক্ষমাণ</div>
                <div className="text-lg font-extrabold text-rose-300 mt-0.5">
                  {toBengaliNumber(metrics.pendingComplaints)} টি
                </div>
              </div>
              <div className="rounded-xl bg-[#03132b] border border-amber-400/35 p-3">
                <div className="text-[11px] font-sans text-amber-200/80">কাজ চলমান</div>
                <div className="text-lg font-extrabold text-amber-300 mt-0.5">
                  {toBengaliNumber(metrics.inProgressComplaints)} টি
                </div>
              </div>
              <div className="rounded-xl bg-[#03132b] border border-emerald-400/35 p-3">
                <div className="text-[11px] font-sans text-emerald-200/80">সমাধানকৃত</div>
                <div className="text-lg font-extrabold text-emerald-300 mt-0.5">
                  {toBengaliNumber(metrics.resolvedComplaints)} টি
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-[#03132b]/85 border border-cyan-500/25 divide-y divide-cyan-500/15">
              <div className="px-3.5 py-2 text-[11px] font-bold text-cyan-300">
                সাম্প্রতিক লাইন অভিযোগ ও টিকেট
              </div>
              {recentComplaints.length === 0 ? (
                <div className="px-3.5 py-3 text-xs text-emerald-300">
                  কোনো অভিযোগ টিকেট পেন্ডিং নেই।
                </div>
              ) : (
                recentComplaints.map((cmp) => (
                  <div key={cmp.id} className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{cmp.name}</div>
                      <div className="text-[11px] text-cyan-200/70 truncate">
                        {cmp.complainDetails}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-bold shrink-0 ${
                        cmp.status === 'resolved'
                          ? 'text-emerald-300'
                          : cmp.status === 'in_progress'
                          ? 'text-amber-300'
                          : 'text-rose-300'
                      }`}
                    >
                      {cmp.status === 'resolved'
                        ? 'সমাধান'
                        : cmp.status === 'in_progress'
                        ? 'চলমান'
                        : 'পেন্ডিং'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigateTab('complaints')}
                className="flex-1 min-w-[160px] py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Wrench className="w-4 h-4" />
                <span>অভিযোগ পোর্টাল খুলুন</span>
              </button>
              {canUserPerformAction('canAddComplaint', currentUser, staffs) && (
                <button
                  type="button"
                  onClick={() => (onOpenAddComplaint ? onOpenAddComplaint() : onNavigateTab('complaints'))}
                  className="py-2.5 px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>নতুন টিকেট</span>
                </button>
              )}
            </div>
          </div>
        );
      }

      case 'staff': {
        const previewStaff = metrics.activeStaffList.slice(0, 4);
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2.5 font-mono tabular-nums">
              <div className="rounded-xl bg-[#03132b] border border-cyan-400/35 p-3">
                <div className="text-[11px] font-sans text-cyan-200/80">সক্রিয় স্টাফ</div>
                <div className="text-lg font-extrabold text-white mt-0.5">
                  {toBengaliNumber(metrics.activeStaffList.length)} জন
                </div>
              </div>
              <div className="rounded-xl bg-[#03132b] border border-emerald-400/35 p-3 col-span-2">
                <div className="text-[11px] font-sans text-emerald-200/80">মাসিক মূল বেতন বরাদ্দ</div>
                <div className="text-lg font-extrabold text-emerald-300 mt-0.5">
                  {formatCurrency(metrics.monthlySalaryPool)}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-[#03132b]/85 border border-cyan-500/25 divide-y divide-cyan-500/15">
              <div className="px-3.5 py-2 text-[11px] font-bold text-cyan-300">
                কর্মরত স্টাফ প্রোফাইল
              </div>
              {previewStaff.length === 0 ? (
                <div className="px-3.5 py-3 text-xs text-cyan-200/75">কোনো সক্রিয় স্টাফ পাওয়া যায়নি।</div>
              ) : (
                previewStaff.map((st) => (
                  <div key={st.id} className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{st.name}</div>
                      <div className="text-[11px] text-cyan-200/70">{st.designation}</div>
                    </div>
                    <span className="font-mono tabular-nums font-bold text-cyan-200 shrink-0">
                      {formatCurrency(st.salary)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigateTab('staff')}
                className="flex-1 min-w-[160px] py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>স্টাফ ও বেতন পোর্টাল খুলুন</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              {onOpenStaffQr && isDirectorRole && (
                <button
                  type="button"
                  onClick={onOpenStaffQr}
                  className="py-2.5 px-3.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-100 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>QR কার্ড</span>
                </button>
              )}
            </div>
          </div>
        );
      }

      case 'partners': {
        const previewPartners = metrics.activePartnerList.slice(0, 4);
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 font-mono tabular-nums">
              <div className="rounded-xl bg-[#03132b] border border-cyan-400/35 p-3">
                <div className="text-[11px] font-sans text-cyan-200/80">মোট অংশীদার</div>
                <div className="text-lg font-extrabold text-white mt-0.5">
                  {toBengaliNumber(metrics.activePartnerList.length)} জন
                </div>
              </div>
              <div className="rounded-xl bg-[#03132b] border border-emerald-400/35 p-3">
                <div className="text-[11px] font-sans text-emerald-200/80">মোট বিনিয়োগ মূলধন</div>
                <div className="text-lg font-extrabold text-emerald-300 mt-0.5 truncate">
                  {formatCurrency(metrics.totalPartnerInvestment)}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-[#03132b]/85 border border-cyan-500/25 divide-y divide-cyan-500/15">
              <div className="px-3.5 py-2 text-[11px] font-bold text-cyan-300">
                শেয়ার ও বিনিয়োগ বণ্টন
              </div>
              {previewPartners.length === 0 ? (
                <div className="px-3.5 py-3 text-xs text-cyan-200/75">কোনো অংশীদার যুক্ত নেই।</div>
              ) : (
                previewPartners.map((pt) => (
                  <div key={pt.id} className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{pt.name}</div>
                      <div className="text-[11px] text-cyan-200/70">
                        শেয়ার: {toBengaliNumber(pt.sharePercentage)}%
                      </div>
                    </div>
                    <span className="font-mono tabular-nums font-bold text-emerald-300 shrink-0">
                      {formatCurrency(pt.investment)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('partners')}
              className="w-full py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <PieChart className="w-4 h-4" />
              <span>অংশীদার পোর্টাল খুলুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      }

      case 'reports': {
        const monthProfit = metrics.monthIncome - metrics.monthExpense;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2.5 font-mono tabular-nums">
              <div className="rounded-xl bg-[#03132b] border border-emerald-400/35 p-3">
                <div className="text-[11px] font-sans text-emerald-200/80">চলতি মাসের আয়</div>
                <div className="text-base sm:text-lg font-extrabold text-emerald-300 mt-0.5 truncate">
                  {formatCurrency(metrics.monthIncome)}
                </div>
              </div>
              <div className="rounded-xl bg-[#03132b] border border-rose-400/35 p-3">
                <div className="text-[11px] font-sans text-rose-200/80">চলতি মাসের ব্যয়</div>
                <div className="text-base sm:text-lg font-extrabold text-rose-300 mt-0.5 truncate">
                  {formatCurrency(metrics.monthExpense)}
                </div>
              </div>
              <div className="rounded-xl bg-[#03132b] border border-cyan-400/35 p-3">
                <div className="text-[11px] font-sans text-cyan-200/80">মাসিক লাভ/ক্ষতি</div>
                <div
                  className={`text-base sm:text-lg font-extrabold mt-0.5 truncate ${
                    monthProfit >= 0 ? 'text-cyan-300' : 'text-rose-300'
                  }`}
                >
                  {formatCurrency(monthProfit)}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-[#03132b]/85 border border-cyan-500/25 divide-y divide-cyan-500/15 text-xs">
              <div className="px-3.5 py-2.5 flex items-center justify-between">
                <span className="text-cyan-200/80">সর্বমোট হিসাব এন্ট্রি</span>
                <span className="font-mono font-bold text-white">
                  {toBengaliNumber(transactions.length)} টি
                </span>
              </div>
              <div className="px-3.5 py-2.5 flex items-center justify-between">
                <span className="text-cyan-200/80">A4 অফিসিয়াল PDF প্রিন্ট</span>
                <span className="font-bold text-emerald-300">প্রস্তুত</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigateTab('reports')}
                className="flex-1 min-w-[150px] py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>রিপোর্ট ও চার্ট খুলুন</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              {onOpenMonthlyPdf && !isStaffRole && !isPartnerRole && (
                <button
                  type="button"
                  onClick={onOpenMonthlyPdf}
                  className="py-2.5 px-4 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-100 font-bold text-xs cursor-pointer"
                >
                  মাসিক PDF প্রিন্ট
                </button>
              )}
            </div>
          </div>
        );
      }

      case 'officers': {
        const officerItems = [
          { role: 'শাখা / জেনারেল ম্যানেজার', data: officers?.manager },
          { role: 'অভ্যন্তরীণ অডিটর', data: officers?.auditor }
        ];
        return (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#03132b]/85 border border-cyan-500/25 divide-y divide-cyan-500/15">
              <div className="px-3.5 py-2 text-[11px] font-bold text-cyan-300">
                দায়িত্বপ্রাপ্ত কর্মকর্তা তালিকা
              </div>
              {officerItems.map((item) => (
                <div key={item.role} className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                  <span className="text-cyan-200/80">{item.role}</span>
                  <span className="font-bold text-white text-right">
                    {item.data?.name ? `${item.data.name} (${item.data.designation})` : 'নিয়োগকৃত নয়'}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('officers')}
              className="w-full py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>কর্মকর্তা পোর্টাল খুলুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      }

      case 'display': {
        return (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#03132b] border border-cyan-400/35 p-4 space-y-2">
              <div className="text-[11px] font-bold text-cyan-300">সক্রিয় LED নোটিশ ও টিকার</div>
              <div className="text-sm font-extrabold text-white">
                {digitalNotice?.text || 'স্বাগতম DIP BHOLA NETWORK ডিজিটাল ডিসপ্লে বোর্ডে'}
              </div>
              <p className="text-xs text-cyan-100/80 leading-relaxed">
                {digitalNotice?.subText || 'অফিস নোটিশ, লাইভ আয়-ব্যয় ও সেবামূলক ঘোষণা এখানে প্রদর্শিত হয়।'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('display')}
              className="w-full py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>LED ডিসপ্লে বোর্ড খুলুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      }

      case 'backup': {
        if (!isDirectorRole) return null;
        return (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#03132b]/85 border border-cyan-500/25 divide-y divide-cyan-500/15 text-xs">
              <div className="px-3.5 py-2.5 flex items-center justify-between">
                <span className="text-cyan-200/80">মোট সংরক্ষিত লেনদেন</span>
                <span className="font-mono font-bold text-white">
                  {toBengaliNumber(transactions.length)} টি
                </span>
              </div>
              <div className="px-3.5 py-2.5 flex items-center justify-between">
                <span className="text-cyan-200/80">মোট গ্রাহক রেকর্ড</span>
                <span className="font-mono font-bold text-cyan-300">
                  {toBengaliNumber(customers.length)} জন
                </span>
              </div>
              <div className="px-3.5 py-2.5 flex items-center justify-between">
                <span className="text-cyan-200/80">ব্যাকআপ চ্যানেল</span>
                <span className="font-bold text-emerald-300">Google Drive · Gmail · JSON</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => (onOpenBackup ? onOpenBackup() : onNavigateTab('reports'))}
              className="w-full py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>ক্লাউড ব্যাকআপ ও এক্সপোর্ট খুলুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      }

      case 'security': {
        if (!isDirectorRole) return null;
        const recentAudits = auditLogs.slice(0, 3);
        return (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#03132b]/85 border border-cyan-500/25 divide-y divide-cyan-500/15">
              <div className="px-3.5 py-2 text-[11px] font-bold text-cyan-300 flex items-center justify-between">
                <span>সাম্প্রতিক সিকিউরিটি ও অডিট লগ</span>
                <span className="font-mono">{toBengaliNumber(auditLogs.length)} টি</span>
              </div>
              {recentAudits.length === 0 ? (
                <div className="px-3.5 py-3 text-xs text-cyan-200/75">কোনো অডিট লগ পাওয়া যায়নি।</div>
              ) : (
                recentAudits.map((log) => (
                  <div key={log.id} className="px-3.5 py-2 text-xs">
                    <div className="font-bold text-white">{log.actionBengali}</div>
                    <div className="text-[11px] text-cyan-200/70 truncate">
                      {log.performedBy} · {log.details}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {isDirectorRole && onOpenSecurityDashboard && (
                <button
                  type="button"
                  onClick={onOpenSecurityDashboard}
                  className="flex-1 min-w-[140px] py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>সিকিউরিটি ড্যাশবোর্ড</span>
                </button>
              )}
              {isDirectorRole && onOpenCompanySetup && (
                <button
                  type="button"
                  onClick={onOpenCompanySetup}
                  className="py-2.5 px-4 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-100 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>কোম্পানি ও পোর্টাল সেটআপ</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigateTab('playstore')}
                className="py-2.5 px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-100 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>প্লে স্টোর অ্যাপ সেন্টার</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Scoped System Control & Preferences inside Security & Setup Portal */}
            <div className="rounded-xl bg-[#03132b]/90 border border-cyan-400/30 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-cyan-200">
                <span>অ্যাপ সিস্টেম কন্ট্রোল ও প্রিফারেন্স</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {onToggleFullscreen && (
                  <button
                    type="button"
                    onClick={onToggleFullscreen}
                    className="px-2.5 py-1.5 rounded-lg bg-[#062148] hover:bg-cyan-500/25 border border-cyan-400/40 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-cyan-300" /> : <Maximize2 className="w-3.5 h-3.5 text-cyan-300" />}
                    <span>{isFullscreen ? 'নরমাল স্ক্রিন' : 'ফুল স্ক্রিন'}</span>
                  </button>
                )}
                {onToggleDarkMode && (
                  <button
                    type="button"
                    onClick={onToggleDarkMode}
                    className="px-2.5 py-1.5 rounded-lg bg-[#062148] hover:bg-cyan-500/25 border border-cyan-400/40 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 text-cyan-300" />}
                    <span>{isDarkMode ? 'লাইট থিম' : 'ডার্ক থিম'}</span>
                  </button>
                )}
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="px-2.5 py-1.5 rounded-lg bg-[#062148] hover:bg-cyan-500/25 border border-cyan-400/40 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Type className="w-3.5 h-3.5 text-cyan-300" />
                    <span>সেটিংস</span>
                  </button>
                )}
                {isDirectorRole && onOpenAuditLog && (
                  <button
                    type="button"
                    onClick={onOpenAuditLog}
                    className="px-2.5 py-1.5 rounded-lg bg-[#062148] hover:bg-cyan-500/25 border border-cyan-400/40 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-cyan-300" />
                    <span>অডিট লগ</span>
                  </button>
                )}
                {onOpenStaffQr && isDirectorRole && (
                  <button
                    type="button"
                    onClick={onOpenStaffQr}
                    className="px-2.5 py-1.5 rounded-lg bg-[#062148] hover:bg-cyan-500/25 border border-cyan-400/40 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-cyan-300" />
                    <span>স্টাফ QR</span>
                  </button>
                )}
                {onOpenAppLinks && (
                  <button
                    type="button"
                    onClick={onOpenAppLinks}
                    className="px-2.5 py-1.5 rounded-lg bg-[#062148] hover:bg-cyan-500/25 border border-cyan-400/40 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-cyan-300" />
                    <span>অ্যাপ লিংক</span>
                  </button>
                )}
                {isDirectorRole && onOpenBackup && (
                  <button
                    type="button"
                    onClick={onOpenBackup}
                    className="px-2.5 py-1.5 rounded-lg bg-[#062148] hover:bg-cyan-500/25 border border-cyan-400/40 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Cloud className="w-3.5 h-3.5 text-cyan-300" />
                    <span>ব্যাকআপ</span>
                  </button>
                )}
                {onSwitchUser && (
                  <button
                    type="button"
                    onClick={onSwitchUser}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/25 hover:bg-rose-500/40 border border-rose-400/50 text-rose-100 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>লক / বদলান</span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <div className="flex items-center gap-1 bg-[#020c1b] border border-cyan-400/30 rounded-lg px-2 py-1">
                  <span className="text-[11px] font-bold text-cyan-200">ফন্ট:</span>
                  {(
                    [
                      { id: 'small', label: 'ছোট' },
                      { id: 'medium', label: 'মাঝারি' },
                      { id: 'large', label: 'বড়' }
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setAppFontSize(f.id)}
                      className={`px-2 py-0.5 rounded text-[11px] font-black cursor-pointer ${
                        appFontSize === f.id
                          ? 'bg-cyan-400 text-[#020c1b]'
                          : 'text-cyan-100 hover:bg-cyan-500/20'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {onChangeAutoRefresh && (
                  <div className="flex items-center gap-1 bg-[#020c1b] border border-cyan-400/30 rounded-lg px-2 py-1">
                    <span className="text-[11px] font-bold text-cyan-200">অটো-রিফ্রেশ:</span>
                    {([0, 30, 60, 300] as const).map((sec) => (
                      <button
                        key={`sec-ar-${sec}`}
                        type="button"
                        onClick={() => onChangeAutoRefresh(sec)}
                        className={`px-1.5 py-0.5 rounded text-[11px] font-black cursor-pointer ${
                          autoRefreshIntervalSec === sec
                            ? 'bg-cyan-400 text-[#020c1b]'
                            : 'text-cyan-100 hover:bg-cyan-500/20'
                        }`}
                      >
                        {sec === 0 ? 'বন্ধ' : sec === 30 ? '৩০সে' : sec === 60 ? '১মি' : '৫মি'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }

      case 'dashboard':
      default: {
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 font-mono tabular-nums">
              <div className="rounded-xl bg-[#03132b] border border-cyan-400/35 p-3.5">
                <div className="text-sm font-sans font-bold text-cyan-200/90">ক্যাশ ইন হ্যান্ড / নিট</div>
                <div className="text-xl sm:text-2xl font-black text-white mt-0.5 truncate">
                  {formatCurrency(metrics.netBalance)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSelectPortal('customers')}
                className="text-left rounded-xl bg-[#03132b] hover:bg-[#051d42] border border-emerald-400/35 hover:border-emerald-300/70 p-3.5 transition-colors cursor-pointer"
              >
                <div className="text-sm font-sans font-bold text-emerald-200/90 flex items-center justify-between gap-1">
                  <span>সচল গ্রাহক / মোট গ্রাহক</span>
                  {liveDashReport && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                      Live
                    </span>
                  )}
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-300 mt-0.5">
                  {toBengaliNumber(
                    liveDashReport?.activeCustomers !== null && liveDashReport?.activeCustomers !== undefined
                      ? liveDashReport.activeCustomers
                      : metrics.activeCustomers
                  )}{' '}
                  /{' '}
                  {toBengaliNumber(
                    liveDashReport?.totalCustomers !== null && liveDashReport?.totalCustomers !== undefined
                      ? liveDashReport.totalCustomers
                      : metrics.totalCustomers
                  )}
                </div>
                <div className="text-[11px] font-sans text-cyan-300/85 mt-1">
                  তালিকা দেখুন / পুরাতন মুছুন →
                </div>
              </button>
              <div className="rounded-xl bg-[#03132b] border border-amber-400/35 p-3.5">
                <div className="text-sm font-sans font-bold text-amber-200/90">মোট গ্রাহক বকেয়া</div>
                <div className="text-xl sm:text-2xl font-black text-amber-300 mt-0.5 truncate">
                  {formatCurrency(metrics.totalDue)}
                </div>
              </div>
              <div className="rounded-xl bg-[#03132b] border border-rose-400/35 p-3.5">
                <div className="text-sm font-sans font-bold text-rose-200/90">সক্রিয় অভিযোগ</div>
                <div className="text-xl sm:text-2xl font-black text-rose-300 mt-0.5">
                  {toBengaliNumber(metrics.pendingComplaints + metrics.inProgressComplaints)} টি
                </div>
              </div>
            </div>

            {/* Quick Toggle Card: Latest Transaction vs Highest Expense */}
            <div className="rounded-xl bg-[#03132b]/95 border border-cyan-400/40 overflow-hidden">
              <div className="px-3.5 py-2.5 bg-cyan-500/10 border-b border-cyan-400/25 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-black text-cyan-200">
                  {dashboardSortMode === 'latest'
                    ? 'সর্বশেষ লেনদেন (Latest Transaction)'
                    : 'সর্বোচ্চ খরচ (Highest Expense)'}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setDashboardSortMode((m) => (m === 'latest' ? 'highest_expense' : 'latest'))
                  }
                  className="px-3 py-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-[#020c1b] text-xs sm:text-sm font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>
                    {dashboardSortMode === 'latest' ? 'সর্বোচ্চ খরচ দেখুন' : 'সর্বশেষ লেনদেন দেখুন'}
                  </span>
                </button>
              </div>
              <div className="divide-y divide-cyan-500/20">
                {sortedDashboardTransactions.length === 0 ? (
                  <div className="px-3.5 py-3 text-sm text-cyan-200/80">কোনো লেনদেন রেকর্ড পাওয়া যায়নি।</div>
                ) : (
                  sortedDashboardTransactions.map((tx) => (
                    <div key={tx.id} className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate">{tx.title}</div>
                        <div className="text-xs text-cyan-200/80">
                          {tx.category} · {getTransactionDateKey(tx)}
                        </div>
                      </div>
                      <span
                        className={`font-mono tabular-nums font-black text-base shrink-0 ${
                          tx.type === 'income' ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('dashboard')}
              className="w-full py-3 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-sm sm:text-base flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>ক্লাসিক ড্যাশবোর্ড খুলুন</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        );
      }
    }
  };

  return (
    <div className="pb-4 space-y-3">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#020a18] via-[#041d42] to-[#020e21] border border-cyan-400/35 shadow-2xl text-white p-3.5 sm:p-6 lg:p-7">
        {/* Lightweight Matrix / Circuit Backdrop (Zero blur-filter lag) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(rgba(125, 211, 252, 0.5) 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        />

        {/* Focused ERP Header (Pure ERP SYSTEM Wheel until user taps a specific portal) */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-cyan-400/25">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-white p-1 border-2 border-cyan-300/90 shadow-[0_0_20px_rgba(56,189,248,0.5)] shrink-0 overflow-hidden flex items-center justify-center">
              <img
                src={company?.logoUrl || '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg'}
                alt={company?.name || 'DIP BHOLA NETWORK'}
                className="w-full h-full object-contain rounded-lg"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  if (!img.dataset.fallback) {
                    img.dataset.fallback = '1';
                    img.src = '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg';
                  }
                }}
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-2xl font-black tracking-wide text-white truncate">
                {company?.name || 'DIP BHOLA NETWORK'} · ERP SYSTEM
              </h2>
              <p className="text-xs sm:text-base text-cyan-200 font-bold truncate">
                {selectedPortal
                  ? `${selectedPortal.title} — শুধু এই পোর্টালের তথ্য ও ডিজিটাল ডিসপ্লে সক্রিয়`
                  : 'যেকোনো পোর্টালে চাপ দিন — শুধু তার তথ্য, ডিজিটাল ডিসপ্লে ও কোম্পানি প্যাড দেখাবে'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(currentUser.role === 'director' || currentUser.role === 'admin' || currentUser.role === 'manager') &&
              onOpenPortalControl && (
                <button
                  type="button"
                  onClick={onOpenPortalControl}
                  className="px-3 py-2 rounded-xl bg-indigo-500/30 hover:bg-indigo-500/45 border border-indigo-300/60 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  title="অ্যাপস ও পোর্টাল ফুল কন্ট্রোল (পোর্টাল ডিলিট/এড লিংক)"
                >
                  <Sliders className="w-4 h-4 text-cyan-300" />
                  <span className="hidden sm:inline">অ্যাপ কন্ট্রোল</span>
                </button>
              )}
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-2 rounded-xl bg-[#031632]/90 hover:bg-cyan-500/25 border border-cyan-400/45 text-cyan-200 hover:text-white cursor-pointer"
                title="অ্যাপ সেটিংস ও ফন্ট সাইজ"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            {onOpenSidebarMenu && (
              <button
                type="button"
                onClick={onOpenSidebarMenu}
                className="px-3 py-2 rounded-xl bg-[#031632]/90 hover:bg-cyan-500/25 border border-cyan-400/45 text-cyan-100 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                title="মেন্যু খুলুন"
              >
                <Menu className="w-4 h-4 text-cyan-300" />
                <span>মেন্যু</span>
              </button>
            )}
            {selectedPortal && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPortalId(null);
                  setIsSpeedTestOpen(false);
                  onPortalSelectChange?.(null);
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/50 text-rose-100 text-xs sm:text-sm font-black flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
                <span>বন্ধ করুন</span>
              </button>
            )}
          </div>
        </div>

        {lockedPortalAlert && (
          <div className="relative z-10 mt-3 px-4 py-3 rounded-xl bg-rose-600/25 border border-rose-400/70 text-sm sm:text-base font-black text-rose-100 flex flex-wrap items-center justify-between gap-2 shadow-md">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Lock className="w-4 h-4 text-rose-300 shrink-0" />
              <span>{lockedPortalAlert}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {lockedPortalMeta?.overridable && onRequestPortalOverride && (
                <button
                  type="button"
                  onClick={() =>
                    onRequestPortalOverride(lockedPortalMeta.id, lockedPortalMeta.title)
                  }
                  className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>ওভাররাইড পিন</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setLockedPortalAlert(null);
                  setLockedPortalMeta(null);
                }}
                className="p-1 rounded-lg hover:bg-white/15 cursor-pointer shrink-0"
                aria-label="বন্ধ করুন"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Main Content: Completely Stationary Radial ERP Architecture + On-Demand Single Portal Info Panel */}
        <div
          className={`relative z-10 mt-4 grid gap-5 items-center ${
            selectedPortal ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'
          }`}
        >
          {/* THE STATIONARY RADIAL ERP WHEEL */}
          <div
            className={`${
              selectedPortal ? 'lg:col-span-6' : 'w-full'
            } flex flex-col items-center justify-center`}
          >
            <div
              className={`relative w-full aspect-square mx-auto select-none ${
                selectedPortal ? 'max-w-[520px]' : 'max-w-[680px]'
              }`}
            >
              {/* Luminous Technical Concentric Circuit Rings & Spokes (100% Stationary) */}
              <svg
                viewBox="0 0 600 600"
                className="w-full h-full pointer-events-none select-none"
                aria-hidden="true"
              >
                <defs>
                  <radialGradient id="erpDeepGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.46" />
                    <stop offset="55%" stopColor="#0284c7" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="#020a18" stopOpacity="0" />
                  </radialGradient>
                </defs>

                <circle cx="300" cy="300" r="290" fill="url(#erpDeepGlow)" />

                <circle
                  cx="300"
                  cy="300"
                  r="278"
                  fill="none"
                  stroke="#38bdf8"
                  strokeOpacity="0.24"
                  strokeWidth="1.2"
                  strokeDasharray="4 6"
                />

                <circle
                  cx="300"
                  cy="300"
                  r="217"
                  fill="none"
                  stroke="#7dd3fc"
                  strokeOpacity="0.34"
                  strokeWidth="1.6"
                  strokeDasharray="14 8 3 8"
                />
                {orbitNodes.map(({ portal, xPct, yPct }) => {
                  const nx = (xPct / 100) * 600;
                  const ny = (yPct / 100) * 600;
                  const isActive = selectedPortal?.id === portal.id;
                  return (
                    <line
                      key={`spoke-${portal.id}`}
                      x1="300"
                      y1="300"
                      x2={nx}
                      y2={ny}
                      stroke={isActive ? '#ffffff' : '#38bdf8'}
                      strokeOpacity={isActive ? 0.95 : 0.22}
                      strokeWidth={isActive ? 3.2 : 1.2}
                      strokeDasharray={isActive ? undefined : '3 5'}
                    />
                  );
                })}

                <circle
                  cx="300"
                  cy="300"
                  r="168"
                  fill="none"
                  stroke="#38bdf8"
                  strokeOpacity="0.52"
                  strokeWidth="3.5"
                  strokeDasharray="42 14 16 14"
                />

                <circle
                  cx="300"
                  cy="300"
                  r="144"
                  fill="none"
                  stroke="#bae6fd"
                  strokeOpacity="0.86"
                  strokeWidth="9"
                  strokeDasharray="6 6.5"
                />

                <circle
                  cx="300"
                  cy="300"
                  r="118"
                  fill="#031532"
                  stroke="#7dd3fc"
                  strokeOpacity="0.92"
                  strokeWidth="3.5"
                />
                <circle
                  cx="300"
                  cy="300"
                  r="103"
                  fill="none"
                  stroke="#f0f9ff"
                  strokeOpacity="0.95"
                  strokeWidth="2.5"
                  strokeDasharray="96 16 48 12"
                />
              </svg>

              {/* Center Luminous "ERP" Emblem + Dip Bhola Logo Medallion (Stationary) */}
              <button
                type="button"
                onClick={() => {
                  if (selectedPortal) {
                    setSelectedPortalId(null);
                    onPortalSelectChange?.(null);
                  } else {
                    const firstAllowed = visiblePortals.find((p) =>
                      canUserAccessPortal(p.id, currentUser, staffs, { portalControl })
                    );
                    if (firstAllowed) {
                      handleSelectPortal(firstAllowed.id);
                    }
                  }
                }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[31%] h-[31%] rounded-full flex flex-col items-center justify-center text-center cursor-pointer focus:outline-none px-1 z-20"
                title={selectedPortal ? 'মূল ERP হাব দেখুন' : 'অনুমোদিত পোর্টাল দেখুন'}
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white p-0.5 border border-cyan-200 shadow-[0_0_14px_rgba(125,211,252,0.85)] overflow-hidden flex items-center justify-center mb-0.5 shrink-0">
                  <img
                    src={company?.logoUrl || '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg'}
                    alt="DIP BHOLA"
                    className="w-full h-full object-contain rounded-full"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      if (!img.dataset.fallback) {
                        img.dataset.fallback = '1';
                        img.src = '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg';
                      }
                    }}
                  />
                </div>
                <span
                  className="text-3xl sm:text-5xl md:text-6xl font-black italic tracking-tight text-white leading-none"
                  style={{
                    textShadow: '0 0 24px rgba(56, 189, 248, 0.95), 0 0 6px rgba(224, 242, 254, 0.95)'
                  }}
                >
                  ERP
                </span>
                <span className="text-xs sm:text-sm font-black text-cyan-200 tracking-wide truncate max-w-full mt-0.5">
                  {selectedPortal ? selectedPortal.shortLabel : 'NETWORK'}
                </span>
              </button>

              {/* Stationary 360° Orbital Portal Icons (Click to open info — locked portals stay closed) */}
              <div className="absolute inset-0 pointer-events-none">
                {orbitNodes.map(({ portal, xPct, yPct }) => {
                  const Icon = portal.icon;
                  const isActive = selectedPortal?.id === portal.id;
                  const isLocked = !canUserAccessPortal(portal.id, currentUser, staffs, { portalControl });
                  return (
                    <button
                      key={portal.id}
                      type="button"
                      onClick={() => handleSelectPortal(portal.id)}
                      onMouseEnter={() => {
                        if (!isLocked) prefetchPortalModule(portal.id);
                      }}
                      onTouchStart={() => {
                        if (!isLocked) prefetchPortalModule(portal.id);
                      }}
                      style={{ left: `${xPct}%`, top: `${yPct}%` }}
                      aria-pressed={isActive}
                      aria-disabled={isLocked}
                      className={`pointer-events-auto group absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 rounded-full transition-transform duration-150 ${
                        isLocked
                          ? 'opacity-70 z-10'
                          : isActive
                          ? 'scale-[1.2] z-30'
                          : selectedPortal
                          ? 'opacity-90 hover:opacity-100 hover:scale-110 z-10'
                          : 'hover:scale-110 z-10'
                      }`}
                      title={
                        isLocked
                          ? `${portal.title} — 🔒 লক করা আছে (অনুমতি নেই)`
                          : `${portal.title} — বড় করে দেখতে ও তথ্য আনতে চাপ দিন`
                      }
                    >
                      <span
                        className={`relative w-12 h-12 sm:w-16 sm:h-16 md:w-[70px] md:h-[70px] rounded-full flex items-center justify-center transition-all duration-150 ${
                          isLocked
                            ? 'bg-[#031227]/95 text-slate-300 border border-rose-400/55 shadow-inner'
                            : isActive
                            ? 'bg-gradient-to-br from-white via-cyan-200 to-sky-400 text-[#020c1b] border-2 border-white shadow-[0_0_28px_rgba(125,211,252,1),0_0_52px_rgba(56,189,248,0.85)] ring-4 ring-cyan-300/35'
                            : 'bg-[#031632]/92 text-sky-50 border border-cyan-300/60 group-hover:border-white group-hover:bg-sky-400/20 shadow-[0_0_14px_rgba(56,189,248,0.35)]'
                        }`}
                      >
                        <Icon className="w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9" />
                        {isLocked && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-rose-600 border-2 border-white text-white flex items-center justify-center shadow-md">
                            <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[2.6]" />
                          </span>
                        )}
                      </span>
                      <span
                        className={`mt-1 leading-tight text-center rounded-md px-2 py-0.5 flex items-center gap-1 ${
                          isLocked
                            ? 'text-xs sm:text-sm font-bold text-rose-200 bg-[#020e21]/95 border border-rose-400/45 max-w-[110px] sm:max-w-none sm:whitespace-nowrap'
                            : isActive
                            ? 'text-sm sm:text-base md:text-lg rounded-full bg-cyan-300 text-[#020c1b] font-black shadow-lg whitespace-nowrap px-3'
                            : 'text-[13px] sm:text-base md:text-[17px] font-black text-cyan-50 bg-[#020e21]/92 border border-cyan-400/40 max-w-[100px] sm:max-w-none sm:whitespace-nowrap'
                        }`}
                      >
                        <span>{portal.shortLabel}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ON-DEMAND CLICKED PORTAL INFORMATION PANEL */}
          {selectedPortal && (
            <div
              ref={detailPanelRef}
              key={selectedPortal.id}
              className="lg:col-span-6 rounded-2xl bg-[#041736]/95 border-2 border-cyan-300/70 p-4 sm:p-6 shadow-[0_0_32px_rgba(56,189,248,0.25)] space-y-4"
            >
              {/* Enlarged Spotlight Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-cyan-400/25">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-white via-cyan-200 to-sky-400 text-[#020c1b] border-2 border-white shadow-[0_0_22px_rgba(103,232,249,0.85)] flex items-center justify-center shrink-0">
                    <selectedPortal.icon className="w-8 h-8 sm:w-9 sm:h-9" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-mono font-bold text-cyan-300 tracking-wide">
                      {selectedPortal.englishDomain}
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-black text-white truncate">
                      {selectedPortal.title}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedPortalId(null);
                    onPortalSelectChange?.(null);
                  }}
                  aria-label="তথ্য বন্ধ করুন"
                  className="p-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/45 text-cyan-100 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-base sm:text-lg text-cyan-50/95 leading-relaxed font-semibold">
                {selectedPortal.description}
              </p>

              {hasActivePortalOverride(selectedPortal.id, currentUser) && (() => {
                const exp = getActivePortalOverrideExpiresAt(selectedPortal.id, currentUser);
                const remMins = exp ? Math.max(1, Math.ceil((exp - Date.now()) / 60_000)) : 1;
                return (
                  <div className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-black text-emerald-200 flex items-center gap-1.5">
                      <Unlock className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                      <span>ডিরেক্টর ওভাররাইড আনলক চালু · প্রায় {toBengaliNumber(remMins)} মিনিট বাকি</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        revokeTemporaryPortalOverride(selectedPortal.id, currentUser.id);
                        setSelectedPortalId(null);
                        onPortalSelectChange?.(null);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/25 hover:bg-rose-500/40 border border-rose-400/50 text-rose-100 font-black cursor-pointer"
                    >
                      লক করুন
                    </button>
                  </div>
                );
              })()}

              {/* Dynamic Portal-Specific Real Data Body */}
              {renderPortalLiveBody(selectedPortal)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
