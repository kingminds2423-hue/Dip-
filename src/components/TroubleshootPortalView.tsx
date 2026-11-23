import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Clock,
  Copy,
  Database,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Filter,
  Globe,
  Link2,
  Lock,
  LogOut,
  Maximize2,
  Minimize2,
  Plus,
  Radio,
  RefreshCw,
  Router,
  Save,
  Search,
  Server,
  Settings,
  ShieldAlert,
  Split,
  Trash2,
  UserCheck,
  Users,
  Wifi,
  WifiOff,
  Wrench,
  X
} from 'lucide-react';
import {
  BillingPortalDashReport,
  BillingPortalSyncedRow,
  Company,
  CustomerComplaint,
  CustomerMember,
  OltLiveReport,
  OltSyncedOnuRow,
  Staff,
  UserSession
} from '../types';
import {
  DEFAULT_TROUBLESHOOT_PORTAL_URL,
  PUBLISHED_SHARED_URL,
  getEffectiveTroubleshootPortalUrl,
  normalizePortalHttpUrl
} from '../utils/appUrls';
import { formatCurrency, toBengaliNumber, toEnglishDigits } from '../utils/formatters';
import { canUserPerformAction } from '../utils/portalPermissions';
import {
  ParsedOnuTelemetry,
  PonPortId,
  analyzeCustomerOnu,
  computePonBuckets,
  parseOltPasteLines
} from '../utils/oltDiagnostics';
import {
  fetchBillingSubscribers,
  fetchLiveDashReport,
  loginAdminBholaNet,
  logoutAdminBholaNet
} from '../services/billingPortalService';
import {
  fetchLiveOltReport,
  fetchSpecificOltPageRows,
  loginOltPortal,
  logoutOltPortal
} from '../services/oltPortalService';
import {
  exportMixedSummaryToExcel,
  exportMixedSummaryToPdf
} from '../utils/mixedReportExport';
import { autoAssignTechnicianByLocation } from '../utils/complaintAutoAssign';
import { CustomerOnuDetailModal } from './CustomerOnuDetailModal';

interface TroubleshootPortalViewProps {
  company: Company | null;
  currentUser: UserSession;
  staffs?: Staff[];
  customers?: CustomerMember[];
  complaints?: CustomerComplaint[];
  liveBillingSessionToken?: string | null;
  liveDashReport?: BillingPortalDashReport | null;
  onBillingSessionChange?: (token: string | null, report: BillingPortalDashReport | null) => void;
  liveOltSessionToken?: string | null;
  liveOltReport?: OltLiveReport | null;
  onOltSessionChange?: (token: string | null, report: OltLiveReport | null) => void;
  onImportBillingCustomers?: (
    rows: Array<Omit<CustomerMember, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<{ addedCount: number; updatedCount: number; totalProcessed: number }>;
  onDeleteAllCustomers?: () => Promise<number | void>;
  onUpdateCustomer?: (id: string, updates: Partial<CustomerMember>) => Promise<void>;
  onAddCustomer?: (customer: Omit<CustomerMember, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCreateComplaintFromCustomer?: (customer: CustomerMember, assignedStaffId?: string) => void;
  onOpenComplaints?: () => void;
  onOpenCustomers?: () => void;
  onOpenCompanySetup?: () => void;
  onSavePortalUrl?: (nextUrl: string) => Promise<void>;
}

interface PortalHealthState {
  checking: boolean;
  checked: boolean;
  active: boolean;
  reachable: boolean;
  status: number;
  latencyMs?: number;
  checkedAt?: string;
}

type ConsoleTab = 'overview' | 'onu_table' | 'web_portal';
type QuickStatusFilter = 'all' | 'problem' | 'healthy' | 'offline';
type MixedSourceTag = 'both' | 'olt' | 'billing' | 'local';

function isSameUrlOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin.toLowerCase() === new URL(b).origin.toLowerCase();
  } catch {
    return false;
  }
}

function normalizeMacHex(val?: string): string {
  const hex = (val || '').trim().toUpperCase().replace(/[^0-9A-F]/g, '');
  if (hex.length !== 12) return '';
  return hex.match(/.{1,2}/g)?.join(':') || '';
}

function normalizeMemberKey(val?: string): string {
  return toEnglishDigits((val || '').trim().toLowerCase());
}

function normalizePhoneKey(val?: string): string {
  const digits = toEnglishDigits((val || '').replace(/\D+/g, ''));
  if (digits.startsWith('880') && digits.length >= 13) return `0${digits.slice(3)}`;
  if (digits.length === 10 && digits.startsWith('1')) return `0${digits}`;
  return digits;
}

function normalizeNameKey(val?: string): string {
  return (val || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const OLT_DEVICE_URL = 'http://103.158.206.4:6560/cgi/home.php';
const PAGE_SIZE = 20;

export const TroubleshootPortalView: React.FC<TroubleshootPortalViewProps> = ({
  company,
  currentUser,
  staffs = [],
  customers = [],
  complaints = [],
  liveBillingSessionToken = null,
  liveDashReport = null,
  onBillingSessionChange,
  liveOltSessionToken = null,
  liveOltReport = null,
  onOltSessionChange,
  onImportBillingCustomers,
  onDeleteAllCustomers,
  onUpdateCustomer,
  onAddCustomer,
  onCreateComplaintFromCustomer,
  onOpenComplaints,
  onOpenCustomers,
  onOpenCompanySetup,
  onSavePortalUrl
}) => {
  const portalUrl = getEffectiveTroubleshootPortalUrl(company);

  const [consoleTab, setConsoleTab] = useState<ConsoleTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPonFilter, setSelectedPonFilter] = useState<'ALL' | PonPortId>('ALL');
  const [statusFilter, setStatusFilter] = useState<QuickStatusFilter>('all');
  const [memberPreviewFilter, setMemberPreviewFilter] = useState<'all' | 'linked' | 'online' | 'problem'>('all');
  const [showAllPreviewMembers, setShowAllPreviewMembers] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Selected Staff for direct complaint dispatch from OLT+Billing unified rows
  const [selectedAssignStaffId, setSelectedAssignStaffId] = useState<string>('');

  // admin.bhola.net Live Server-to-Server Login & dashReport states (token held strictly in parent JS memory)
  const [showBholaLoginForm, setShowBholaLoginForm] = useState<boolean>(false);
  const [bholaUsername, setBholaUsername] = useState('');
  const [bholaPassword, setBholaPassword] = useState('');
  const [showBholaPass, setShowBholaPass] = useState(false);
  const [bholaRemember, setBholaRemember] = useState(true);
  const [isLoggingInBhola, setIsLoggingInBhola] = useState(false);
  const [isRefreshingDash, setIsRefreshingDash] = useState(false);
  const [isSyncingBillingRows, setIsSyncingBillingRows] = useState(false);
  const [selectedNavLinkname, setSelectedNavLinkname] = useState('');
  const [bholaError, setBholaError] = useState<string | null>(null);
  const [bholaSyncBanner, setBholaSyncBanner] = useState<string | null>(null);

  // Live OLT CGI (http://103.158.206.4:6560/cgi/home.php) states (token held strictly in parent JS memory)
  const [showOltLoginForm, setShowOltLoginForm] = useState<boolean>(false);
  const [oltUsername, setOltUsername] = useState('');
  const [oltPassword, setOltPassword] = useState('');
  const [showOltPass, setShowOltPass] = useState(false);
  const [isLoggingInOlt, setIsLoggingInOlt] = useState(false);
  const [isRefreshingOlt, setIsRefreshingOlt] = useState(false);
  const [isFetchingOltPage, setIsFetchingOltPage] = useState(false);
  const [selectedOltPagePath, setSelectedOltPagePath] = useState('');
  const [oltError, setOltError] = useState<string | null>(null);
  const [oltSyncBanner, setOltSyncBanner] = useState<string | null>(null);

  // Unified Auto-Update Polling (OLT + Billing together)
  const [autoSyncIntervalSec, setAutoSyncIntervalSec] = useState<0 | 30 | 60>(30);
  const [lastAutoSyncAt, setLastAutoSyncAt] = useState<string | null>(null);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [isSavingMixedToDb, setIsSavingMixedToDb] = useState(false);
  const autoSyncLockRef = React.useRef(false);

  // Mixed OLT + Billing Summary Report Export states (Excel / PDF)
  const [isExportingFormat, setIsExportingFormat] = useState<'excel' | 'pdf' | null>(null);
  const [exportBanner, setExportBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Inline Director customer reset confirmation state
  const [confirmResetCustomers, setConfirmResetCustomers] = useState(false);
  const [isResettingCustomers, setIsResettingCustomers] = useState(false);

  // Selected customer for "সমস্যা ও পাওয়ার" modal
  const [detailCustomerId, setDetailCustomerId] = useState<string | null>(null);
  const [detailStartEdit, setDetailStartEdit] = useState(false);

  // Bulk OLT Paste Sync Modal
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteInput, setPasteInput] = useState('');
  const [isSyncingPaste, setIsSyncingPaste] = useState(false);
  const [pasteResultMsg, setPasteResultMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Optional external troubleshooting URL tab state
  const [reloadNonce, setReloadNonce] = useState(0);
  const [isLoadingFrame, setIsLoadingFrame] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedKey, setCopiedKey] = useState<'portal' | 'erp' | null>(null);
  const [forceShowFrame, setForceShowFrame] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [draftUrl, setDraftUrl] = useState(portalUrl);
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [health, setHealth] = useState<PortalHealthState>({
    checking: false,
    checked: false,
    active: false,
    reachable: false,
    status: 0
  });

  const isDirectorRole = currentUser.role === 'director' || currentUser.role === 'admin';
  const canEditCustomer = useMemo(
    () => canUserPerformAction('canEditCustomer', currentUser, staffs),
    [currentUser, staffs]
  );
  const canAddComplaint = useMemo(
    () => canUserPerformAction('canAddComplaint', currentUser, staffs),
    [currentUser, staffs]
  );

  const pendingComplaints = useMemo(
    () => complaints.filter((c) => c.status === 'pending'),
    [complaints]
  );
  const inProgressComplaints = useMemo(
    () => complaints.filter((c) => c.status === 'in_progress'),
    [complaints]
  );

  // Mix Firestore customers + live admin.bhola.net billing rows + live 103.158.206.4:6560 OLT ONU telemetry in real time
  const liveBillingByKey = useMemo(() => {
    const map = new Map<string, BillingPortalSyncedRow>();
    (liveDashReport?.subscriberRows || []).forEach((r) => {
      const idKey = normalizeMemberKey(r.memberId);
      const phoneKey = normalizePhoneKey(r.phone);
      const macKey = normalizeMacHex(r.onuMac);
      if (idKey) map.set(`id:${idKey}`, r);
      if (phoneKey.length >= 10) map.set(`ph:${phoneKey}`, r);
      if (macKey) map.set(`mac:${macKey}`, r);
    });
    return map;
  }, [liveDashReport]);

  const { mixedCustomers, mixSourceById } = useMemo<{
    mixedCustomers: CustomerMember[];
    mixSourceById: Map<string, MixedSourceTag>;
  }>(() => {
    const sourceMap = new Map<string, MixedSourceTag>();
    const billingAttachedIds = new Set<string>();
    const matchedLiveBillingKeys = new Set<string>();
    const nowIso = new Date().toISOString();

    // Step 1: Start from Firestore customers and overlay live Billing rows
    const merged: CustomerMember[] = customers.map((c) => {
      const idKey = normalizeMemberKey(c.memberId);
      const phoneKey = normalizePhoneKey(c.phone);
      const macKey = normalizeMacHex(c.onuMac);
      const liveHit =
        (idKey && liveBillingByKey.get(`id:${idKey}`)) ||
        (macKey && liveBillingByKey.get(`mac:${macKey}`)) ||
        (phoneKey.length >= 10 && liveBillingByKey.get(`ph:${phoneKey}`)) ||
        undefined;

      if (!liveHit) {
        sourceMap.set(c.id, 'local');
        return c;
      }

      if (idKey) matchedLiveBillingKeys.add(`id:${idKey}`);
      if (phoneKey.length >= 10) matchedLiveBillingKeys.add(`ph:${phoneKey}`);
      billingAttachedIds.add(c.id);
      sourceMap.set(c.id, 'billing');

      return {
        ...c,
        packageName: liveHit.packageName || c.packageName,
        monthlyFee: liveHit.monthlyFee ?? c.monthlyFee,
        expiryDate: liveHit.expiryDate || c.expiryDate,
        dueAmount: liveHit.dueAmount ?? c.dueAmount,
        status: liveHit.status || c.status,
        statusLabel: liveHit.statusLabel || c.statusLabel,
        oltInfo: c.oltInfo || liveHit.oltInfo,
        onuMac: c.onuMac || liveHit.onuMac,
        rxPower: c.rxPower || liveHit.rxPower
      };
    });

    // Step 2: Append unmatched live Billing subscribers directly
    (liveDashReport?.subscriberRows || []).forEach((r, idx) => {
      const idKey = normalizeMemberKey(r.memberId);
      const phoneKey = normalizePhoneKey(r.phone);
      const alreadyPresent =
        (idKey && matchedLiveBillingKeys.has(`id:${idKey}`)) ||
        (phoneKey.length >= 10 && matchedLiveBillingKeys.has(`ph:${phoneKey}`)) ||
        merged.some(
          (c) =>
            (idKey && normalizeMemberKey(c.memberId) === idKey) ||
            (phoneKey.length >= 10 && normalizePhoneKey(c.phone) === phoneKey)
        );

      if (!alreadyPresent) {
        const virtualId = `live-${idKey || idx}`;
        billingAttachedIds.add(virtualId);
        sourceMap.set(virtualId, 'billing');
        merged.push({
          id: virtualId,
          memberId: r.memberId,
          name: r.name,
          phone: r.phone,
          address: r.address,
          packageName: r.packageName,
          monthlyFee: r.monthlyFee,
          expiryDate: r.expiryDate,
          dueAmount: r.dueAmount,
          status: r.status,
          statusLabel: r.statusLabel,
          oltInfo: r.oltInfo,
          onuMac: r.onuMac,
          rxPower: r.rxPower,
          createdAt: nowIso,
          updatedAt: nowIso
        });
      }
    });

    // Step 3: Overlay live 103.158.206.4:6560 OLT ONU telemetry onto matching Billing/Customer rows
    const liveOnus: OltSyncedOnuRow[] = liveOltReport?.onuRows || [];
    if (liveOnus.length > 0) {
      const byMac = new Map<string, number>();
      const byMemberId = new Map<string, number>();
      const byPhone = new Map<string, number>();
      const nameCounts = new Map<string, number>();
      const byUniqueName = new Map<string, number>();

      merged.forEach((c) => {
        const nk = normalizeNameKey(c.name);
        if (nk) nameCounts.set(nk, (nameCounts.get(nk) || 0) + 1);
      });

      merged.forEach((c, idx) => {
        const mk = normalizeMacHex(c.onuMac);
        if (mk && !byMac.has(mk)) byMac.set(mk, idx);
        const ik = normalizeMemberKey(c.memberId);
        if (ik && !byMemberId.has(ik)) byMemberId.set(ik, idx);
        const pk = normalizePhoneKey(c.phone);
        if (pk.length >= 10 && !byPhone.has(pk)) byPhone.set(pk, idx);
        const nk = normalizeNameKey(c.name);
        if (nk && nameCounts.get(nk) === 1 && !byUniqueName.has(nk)) byUniqueName.set(nk, idx);
      });

      liveOnus.forEach((onu, onuIdx) => {
        let matchIndex: number | undefined;
        const onuMacKey = normalizeMacHex(onu.onuMac);
        const onuPhoneKey = normalizePhoneKey(onu.phone);
        const onuNameRaw = normalizeNameKey(onu.onuName);
        const onuIdKey = normalizeMemberKey(onu.onuId);

        if (onuMacKey && byMac.has(onuMacKey)) {
          matchIndex = byMac.get(onuMacKey);
        }
        if (matchIndex === undefined && onuIdKey && byMemberId.has(onuIdKey)) {
          matchIndex = byMemberId.get(onuIdKey);
        }
        if (matchIndex === undefined && onu.onuName) {
          const tokens = toEnglishDigits(onu.onuName)
            .toLowerCase()
            .split(/[\s\-_/:,|]+/)
            .filter((t) => t.length >= 3);
          for (const tok of tokens) {
            if (byMemberId.has(tok)) {
              matchIndex = byMemberId.get(tok);
              break;
            }
          }
        }
        if (matchIndex === undefined && onuPhoneKey.length >= 10 && byPhone.has(onuPhoneKey)) {
          matchIndex = byPhone.get(onuPhoneKey);
        }
        if (matchIndex === undefined && onuNameRaw && byUniqueName.has(onuNameRaw)) {
          matchIndex = byUniqueName.get(onuNameRaw);
        }

        const combinedOltPower = [
          onu.rxPower,
          onu.txPower ? `Tx: ${onu.txPower}` : '',
          onu.fiberLength
        ]
          .filter(Boolean)
          .join(' | ');

        if (matchIndex !== undefined) {
          const target = merged[matchIndex];
          const hadBilling = billingAttachedIds.has(target.id);
          const mergedStatusLabel =
            hadBilling && target.statusLabel && onu.statusLabel
              ? `${target.statusLabel} · OLT: ${onu.statusLabel}`
              : onu.statusLabel || target.statusLabel;

          merged[matchIndex] = {
            ...target,
            oltInfo: onu.oltInfo || target.oltInfo,
            onuMac: onu.onuMac || target.onuMac,
            rxPower: onu.rxPower || target.rxPower,
            txPower: onu.txPower || target.txPower,
            fiberLength: onu.fiberLength || target.fiberLength,
            oltPower: combinedOltPower || target.oltPower,
            lossStatus: onu.lossStatus !== 'normal' ? onu.lossStatus : target.lossStatus || 'normal',
            issueReason: onu.issueReason || (onu.lossStatus === 'normal' ? undefined : target.issueReason),
            status: onu.status === 'inactive' ? 'inactive' : target.status,
            statusLabel: mergedStatusLabel
          };
          sourceMap.set(target.id, hadBilling ? 'both' : 'olt');
        } else {
          const virtualOltId = `live-olt-${onuIdx}-${onu.onuMac || onu.onuId || 'onu'}`;
          sourceMap.set(virtualOltId, 'olt');
          merged.push({
            id: virtualOltId,
            memberId: onu.onuId || onu.onuMac || `OLT-${onuIdx + 1}`,
            name: onu.onuName || onu.onuMac || `${onu.ponPort} ONU`,
            phone: onu.phone || '—',
            address: onu.oltInfo || onu.ponPort,
            oltInfo: onu.oltInfo,
            onuMac: onu.onuMac,
            rxPower: onu.rxPower,
            txPower: onu.txPower,
            fiberLength: onu.fiberLength,
            oltPower: combinedOltPower,
            status: onu.status,
            statusLabel: `OLT: ${onu.statusLabel}`,
            lossStatus: onu.lossStatus,
            issueReason: onu.issueReason,
            createdAt: nowIso,
            updatedAt: nowIso
          });
        }
      });
    }

    return { mixedCustomers: merged, mixSourceById: sourceMap };
  }, [customers, liveBillingByKey, liveDashReport, liveOltReport]);

  // Real OLT / ONU Telemetry Computed Directly from Mixed Billing + Live OLT + Firestore Customers
  const telemetryList = useMemo<ParsedOnuTelemetry[]>(
    () => mixedCustomers.map((c, idx) => analyzeCustomerOnu(c, idx)),
    [mixedCustomers]
  );

  // Prioritized problem queue for Smart 1-Tap Staff Complaint Assistance
  const suggestedComplaintLines = useMemo(() => {
    const rank: Record<string, number> = {
      critical: 0,
      urgent: 1,
      warning: 2,
      unmeasured: 3,
      healthy: 4
    };
    return telemetryList
      .filter((t) => t.hasProblem || t.isOffline || t.customer.status !== 'active')
      .sort((a, b) => (rank[a.tier] ?? 9) - (rank[b.tier] ?? 9));
  }, [telemetryList]);

  const ponBuckets = useMemo(() => computePonBuckets(telemetryList), [telemetryList]);

  const summaryStats = useMemo(() => {
    const total = telemetryList.length;
    const healthy = telemetryList.filter((i) => !i.hasProblem && !i.isOffline).length;
    const problem = telemetryList.filter((i) => i.hasProblem).length;
    const highLoss = telemetryList.filter((i) => i.isHighLoss).length;
    const losOrOffline = telemetryList.filter((i) => i.isOffline || i.isLos).length;
    const withOnuMac = telemetryList.filter((i) => i.onuMac !== '—' || i.rxDbm !== null).length;

    const alertPons = (['PON1', 'PON2', 'PON3', 'PON4'] as const).filter(
      (p) => ponBuckets[p].highLossCount > 0 || ponBuckets[p].losCount > 0
    );

    return {
      total,
      healthy,
      problem,
      highLoss,
      losOrOffline,
      withOnuMac,
      alertPons
    };
  }, [telemetryList, ponBuckets]);

  // Unified Member/Billing + OLT Mixed Stats computed strictly from real Billing, OLT & Firestore data
  const unifiedMixStats = useMemo(() => {
    const billingScoped = telemetryList.filter(
      (t) => mixSourceById.get(t.customer.id) !== 'olt'
    );
    const onuScoped = telemetryList.filter((t) => {
      const src = mixSourceById.get(t.customer.id);
      return (
        src === 'olt' ||
        src === 'both' ||
        Boolean(t.customer.onuMac?.trim() || t.customer.oltInfo?.trim() || t.customer.rxPower?.trim())
      );
    });

    const totalMembers =
      liveDashReport?.totalCustomers !== null && liveDashReport?.totalCustomers !== undefined
        ? liveDashReport.totalCustomers
        : billingScoped.length;

    const activeMembers =
      liveDashReport?.activeCustomers !== null && liveDashReport?.activeCustomers !== undefined
        ? liveDashReport.activeCustomers
        : billingScoped.filter((t) => t.customer.status === 'active').length;

    const onlineMembers =
      liveDashReport?.onlineCustomers !== null && liveDashReport?.onlineCustomers !== undefined
        ? liveDashReport.onlineCustomers
        : billingScoped.filter((t) => !t.isOffline && t.customer.status === 'active').length;

    const disabledOrExpiredCount =
      liveDashReport?.expiredCustomers !== null && liveDashReport?.expiredCustomers !== undefined
        ? liveDashReport.expiredCustomers
        : liveDashReport?.inactiveCustomers !== null && liveDashReport?.inactiveCustomers !== undefined
        ? liveDashReport.inactiveCustomers
        : billingScoped.filter((t) => t.customer.status !== 'active').length;

    const offlineMembers =
      liveDashReport?.offlineCustomers !== null && liveDashReport?.offlineCustomers !== undefined
        ? liveDashReport.offlineCustomers
        : Math.max(0, totalMembers - onlineMembers);

    const dueMemberCount = billingScoped.filter(
      (t) => (Number(t.customer.dueAmount) || 0) > 0
    ).length;

    const onuLinkedItems = billingScoped.filter(
      (t) =>
        mixSourceById.get(t.customer.id) === 'both' ||
        Boolean(t.customer.onuMac?.trim() || t.customer.oltInfo?.trim() || t.customer.rxPower?.trim())
    );
    const onuLinkedCount = onuLinkedItems.length;
    const onuUpLinkedCount = onuLinkedItems.filter((t) => !t.isOffline && !t.isLos).length;
    const onlineMemberPct = totalMembers > 0 ? Math.round((onlineMembers / totalMembers) * 100) : 0;

    const hasLiveOltCounts = Boolean(liveOltReport && liveOltReport.totalOnus > 0);
    const totalOnus = hasLiveOltCounts ? liveOltReport!.totalOnus : onuScoped.length;
    const onlineOnus = hasLiveOltCounts
      ? liveOltReport!.onlineOnus
      : onuScoped.filter((t) => !t.isOffline && !t.isLos).length;
    const activeOnus = onlineOnus;
    const offlineOnus = hasLiveOltCounts
      ? Math.max(0, liveOltReport!.totalOnus - liveOltReport!.onlineOnus)
      : onuScoped.filter((t) => t.isOffline || t.isLos).length;
    const alarmOnus = hasLiveOltCounts
      ? Math.max(
          (liveOltReport!.highLossOnus || 0) + (liveOltReport!.losOnus || 0),
          onuScoped.filter((t) => t.isHighLoss || t.isLos).length
        )
      : onuScoped.filter((t) => t.hasProblem).length;

    const xponTotal = onuScoped.filter((t) => t.techType === 'XPON').length;
    const eponTotal = onuScoped.filter((t) => t.techType === 'EPON' || t.techType === 'GPON').length;
    const onlineOnuPct = totalOnus > 0 ? Number(((onlineOnus / totalOnus) * 100).toFixed(1)) : 0;
    const activeOnuPct = totalOnus > 0 ? Number(((activeOnus / totalOnus) * 100).toFixed(1)) : 0;
    const alarmOnuPct = totalOnus > 0 ? Number(((alarmOnus / totalOnus) * 100).toFixed(1)) : 0;

    const ponDetailed = (['PON1', 'PON2', 'PON3', 'PON4'] as const).map((ponId) => {
      const localBucket = ponBuckets[ponId];
      const livePon = liveOltReport?.ponSummary.find((p) => p.ponId === ponId);
      const total = Math.max(localBucket.total, livePon?.total ?? 0);
      const online =
        livePon && livePon.total >= localBucket.total ? livePon.online : localBucket.online;
      const offline =
        livePon && livePon.total >= localBucket.total ? livePon.offline : localBucket.offline;
      const alarmCount = Math.max(
        localBucket.highLossCount + localBucket.losCount,
        (livePon?.highLossCount ?? 0) + (livePon?.losCount ?? 0)
      );
      const xponCount = localBucket.items.filter((i) => i.techType === 'XPON').length;
      const eponCount = localBucket.items.filter(
        (i) => i.techType === 'EPON' || i.techType === 'GPON'
      ).length;

      return {
        ponId,
        total,
        online,
        offline,
        alarmCount,
        xponCount,
        eponCount
      };
    });

    return {
      totalMembers,
      activeMembers,
      onlineMembers,
      offlineMembers,
      disabledOrExpiredCount,
      dueMemberCount,
      onuLinkedCount,
      onuUpLinkedCount,
      onlineMemberPct,
      totalOnus,
      onlineOnus,
      activeOnus,
      offlineOnus,
      alarmOnus,
      xponTotal,
      eponTotal,
      onlineOnuPct,
      activeOnuPct,
      alarmOnuPct,
      ponDetailed
    };
  }, [telemetryList, mixSourceById, liveDashReport, liveOltReport, ponBuckets]);

  const previewMembers = useMemo(() => {
    const q = toEnglishDigits(searchQuery.trim().toLowerCase());
    const sourceRank: Record<MixedSourceTag, number> = {
      both: 0,
      billing: 1,
      local: 2,
      olt: 3
    };
    return telemetryList
      .filter((item) => {
        if (selectedPonFilter !== 'ALL' && item.ponPort !== selectedPonFilter) return false;
        const src = mixSourceById.get(item.customer.id) || 'local';
        if (memberPreviewFilter === 'linked') {
          const hasOnu =
            src === 'both' ||
            Boolean(
              item.customer.onuMac?.trim() ||
                item.customer.oltInfo?.trim() ||
                item.customer.rxPower?.trim()
            );
          if (!hasOnu || src === 'olt') return false;
        } else if (memberPreviewFilter === 'online') {
          if (item.isOffline || item.isLos) return false;
        } else if (memberPreviewFilter === 'problem') {
          if (!item.hasProblem && !item.isOffline) return false;
        }

        if (!q) return true;
        const c = item.customer;
        const haystack = toEnglishDigits(
          `${c.memberId} ${c.name} ${c.phone} ${c.packageName || ''} ${c.onuMac || ''} ${c.oltInfo || ''} ${item.ponLabel}`.toLowerCase()
        );
        return haystack.includes(q);
      })
      .sort((a, b) => {
        const ra = sourceRank[mixSourceById.get(a.customer.id) || 'local'];
        const rb = sourceRank[mixSourceById.get(b.customer.id) || 'local'];
        if (ra !== rb) return ra - rb;
        if (a.hasProblem !== b.hasProblem) return a.hasProblem ? -1 : 1;
        return 0;
      });
  }, [telemetryList, mixSourceById, selectedPonFilter, memberPreviewFilter, searchQuery]);

  const filteredTelemetry = useMemo(() => {
    const q = toEnglishDigits(searchQuery.trim().toLowerCase());
    return telemetryList.filter((item) => {
      if (selectedPonFilter !== 'ALL' && item.ponPort !== selectedPonFilter) return false;
      if (statusFilter === 'problem' && !item.hasProblem) return false;
      if (statusFilter === 'healthy' && (item.hasProblem || item.isOffline)) return false;
      if (statusFilter === 'offline' && !item.isOffline && !item.isLos) return false;

      if (!q) return true;
      const c = item.customer;
      const haystack = toEnglishDigits(
        `${c.memberId} ${c.name} ${c.phone} ${c.address} ${c.oltInfo || ''} ${c.onuMac || ''} ${c.rxPower || ''} ${c.txPower || ''} ${c.tjBox || ''} ${c.splitterName || ''} ${c.issueReason || ''} ${item.ponLabel}`.toLowerCase()
      );
      return haystack.includes(q);
    });
  }, [telemetryList, selectedPonFilter, statusFilter, searchQuery]);

  // Reset pagination whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedPonFilter, statusFilter, consoleTab]);

  const totalPages = Math.max(1, Math.ceil(filteredTelemetry.length / PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTelemetry.slice(start, start + PAGE_SIZE);
  }, [filteredTelemetry, currentPage]);

  const activeDetailCustomer = useMemo(
    () =>
      detailCustomerId
        ? mixedCustomers.find((c) => c.id === detailCustomerId) ||
          customers.find((c) => c.id === detailCustomerId) ||
          null
        : null,
    [mixedCustomers, customers, detailCustomerId]
  );

  const handleExportMixedSummary = useCallback(
    async (format: 'excel' | 'pdf') => {
      if (isExportingFormat) return;
      setIsExportingFormat(format);
      setExportBanner(null);

      const filterParts: string[] = [];
      if (selectedPonFilter !== 'ALL') filterParts.push(selectedPonFilter);
      if (statusFilter !== 'all') {
        filterParts.push(
          statusFilter === 'problem'
            ? 'সমস্যাজনিত'
            : statusFilter === 'healthy'
            ? 'Online'
            : 'Offline/LOS'
        );
      }
      if (searchQuery.trim()) filterParts.push(`সার্চ: ${searchQuery.trim()}`);

      const rowsToExport =
        filterParts.length > 0 ? filteredTelemetry : telemetryList;

      const payload = {
        company,
        exportedBy: currentUser.name,
        stats: unifiedMixStats,
        telemetryRows: rowsToExport,
        mixSourceById,
        liveDashReport,
        liveOltReport,
        activeFilterLabel: filterParts.length > 0 ? filterParts.join(' · ') : undefined
      };

      try {
        if (format === 'excel') {
          await exportMixedSummaryToExcel(payload);
          setExportBanner({
            type: 'success',
            text: `মিক্সড OLT + বিলিং সামারি এক্সেল (.xlsx) ডাউনলোড সম্পন্ন (${toBengaliNumber(rowsToExport.length)}টি লাইন)।`
          });
        } else {
          await exportMixedSummaryToPdf(payload);
          setExportBanner({
            type: 'success',
            text: `মিক্সড OLT + বিলিং সামারি পিডিএফ (.pdf) ডাউনলোড সম্পন্ন (${toBengaliNumber(rowsToExport.length)}টি লাইন)।`
          });
        }
      } catch (err) {
        setExportBanner({
          type: 'error',
          text:
            err instanceof Error && err.message
              ? `রিপোর্ট তৈরি ব্যর্থ: ${err.message}`
              : 'রিপোর্ট ডাউনলোড করতে সমস্যা হয়েছে।'
        });
      } finally {
        setIsExportingFormat(null);
      }
    },
    [
      isExportingFormat,
      selectedPonFilter,
      statusFilter,
      searchQuery,
      filteredTelemetry,
      telemetryList,
      company,
      currentUser.name,
      unifiedMixStats,
      mixSourceById,
      liveDashReport,
      liveOltReport
    ]
  );

  // External Portal URL Health Probe (only runs when viewing Web Portal tab)
  const isSelfAppUrl =
    isSameUrlOrigin(portalUrl, PUBLISHED_SHARED_URL) ||
    (typeof window !== 'undefined' && isSameUrlOrigin(portalUrl, window.location.origin));

  useEffect(() => {
    setDraftUrl(portalUrl);
    setForceShowFrame(false);
  }, [portalUrl]);

  const checkPortalHealth = useCallback(async (targetUrl: string) => {
    setHealth((prev) => ({ ...prev, checking: true }));
    try {
      const res = await fetch(
        `/api/portal-health-check?url=${encodeURIComponent(targetUrl)}`,
        { cache: 'no-store' }
      );
      if (!res.ok) {
        setHealth({ checking: false, checked: true, active: false, reachable: false, status: res.status });
        return;
      }
      const data = (await res.json()) as {
        active?: boolean;
        reachable?: boolean;
        status?: number;
        latencyMs?: number;
        checkedAt?: string;
      };
      setHealth({
        checking: false,
        checked: true,
        active: Boolean(data.active),
        reachable: Boolean(data.reachable),
        status: Number(data.status || 0),
        latencyMs: data.latencyMs,
        checkedAt: data.checkedAt
      });
    } catch {
      setHealth({ checking: false, checked: true, active: false, reachable: false, status: 0 });
    }
  }, []);

  useEffect(() => {
    if (consoleTab === 'web_portal') {
      void checkPortalHealth(portalUrl);
    }
  }, [consoleTab, portalUrl, reloadNonce, checkPortalHealth]);

  const handleCopyUrl = async (target: string, key: 'portal' | 'erp') => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(target);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
      }
    } catch {
      // ignore clipboard restrictions
    }
  };

  const handlePersistUrl = async (rawNextUrl: string) => {
    if (!onSavePortalUrl) return;
    const normalized = normalizePortalHttpUrl(rawNextUrl);
    if (!normalized) {
      setSaveMessage({ type: 'error', text: 'সঠিক ওয়েব লিংক লিখুন।' });
      return;
    }
    setIsSavingUrl(true);
    setSaveMessage(null);
    try {
      await onSavePortalUrl(normalized);
      setDraftUrl(normalized);
      setIsEditingUrl(false);
      setIsLoadingFrame(true);
      setReloadNonce((n) => n + 1);
      setSaveMessage({ type: 'success', text: 'নতুন ওয়েব লিংক Firestore-এ সংরক্ষিত হয়েছে!' });
      setTimeout(() => setSaveMessage(null), 4000);
    } catch {
      setSaveMessage({ type: 'error', text: 'লিংক সেভ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।' });
    } finally {
      setIsSavingUrl(false);
    }
  };

  // Apply pasted OLT/ONU rows onto matching customers (or create new records if requested)
  const parsedPastePreview = useMemo(() => parseOltPasteLines(pasteInput), [pasteInput]);

  const handleApplyOltPasteSync = async () => {
    if (!onUpdateCustomer || parsedPastePreview.length === 0) return;
    setIsSyncingPaste(true);
    setPasteResultMsg(null);
    let updatedCount = 0;
    let addedCount = 0;

    try {
      for (const row of parsedPastePreview) {
        const cleanId = toEnglishDigits((row.memberId || '').trim().toLowerCase());
        const cleanMac = (row.onuMac || '').trim().toUpperCase();
        const cleanPhone = toEnglishDigits((row.phone || '').replace(/[^0-9]/g, ''));

        const matched = customers.find((c) => {
          if (cleanId && toEnglishDigits((c.memberId || '').trim().toLowerCase()) === cleanId) return true;
          if (cleanMac && (c.onuMac || '').trim().toUpperCase() === cleanMac) return true;
          if (cleanPhone && toEnglishDigits((c.phone || '').replace(/[^0-9]/g, '')) === cleanPhone) return true;
          return false;
        });

        const combinedPower = [row.rxPower, row.fiberLength].filter(Boolean).join(' | ');

        if (matched) {
          await onUpdateCustomer(matched.id, {
            ...(row.oltInfo ? { oltInfo: row.oltInfo } : {}),
            ...(row.onuMac ? { onuMac: row.onuMac } : {}),
            ...(row.rxPower ? { rxPower: row.rxPower } : {}),
            ...(row.fiberLength ? { fiberLength: row.fiberLength } : {}),
            ...(combinedPower ? { oltPower: combinedPower } : {}),
            status: row.status,
            lossStatus: row.lossStatus,
            ...(row.issueReason ? { issueReason: row.issueReason } : {})
          });
          updatedCount += 1;
        } else if (onAddCustomer && (row.memberId || row.onuMac)) {
          await onAddCustomer({
            memberId: row.memberId || row.onuMac || `ONU-${Date.now().toString().slice(-4)}`,
            name: row.name || row.memberId || row.onuMac || 'OLT গ্রাহক',
            phone: row.phone || '01700000000',
            address: row.address || row.oltInfo || 'ভোলা',
            oltInfo: row.oltInfo || '',
            oltPower: combinedPower,
            rxPower: row.rxPower || '',
            fiberLength: row.fiberLength || '',
            onuMac: row.onuMac || '',
            status: row.status,
            lossStatus: row.lossStatus,
            issueReason: row.issueReason || '',
            addedBy: currentUser.name
          });
          addedCount += 1;
        }
      }

      setPasteResultMsg({
        type: 'success',
        text: `সফলভাবে ${toBengaliNumber(updatedCount)}টি গ্রাহকের OLT তথ্য আপডেট এবং ${toBengaliNumber(addedCount)}টি নতুন ONU যুক্ত হয়েছে!`
      });
      setPasteInput('');
    } catch {
      setPasteResultMsg({
        type: 'error',
        text: 'OLT ডেটা সিঙ্ক করার সময় সমস্যা হয়েছে। আবার চেষ্টা করুন।'
      });
    } finally {
      setIsSyncingPaste(false);
    }
  };

  const handleBholaLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bholaUsername.trim() || !bholaPassword) {
      setBholaError('admin.bhola.net ইউজারনেম ও পাসওয়ার্ড দিন।');
      return;
    }
    setIsLoggingInBhola(true);
    setBholaError(null);
    setBholaSyncBanner(null);
    try {
      const res = await loginAdminBholaNet({
        username: bholaUsername.trim(),
        password: bholaPassword,
        remember: bholaRemember
      });
      setBholaPassword('');
      setShowBholaLoginForm(false);
      onBillingSessionChange?.(res.sessionToken, res.report);
      if (res.report.navLinks.length > 0 && !selectedNavLinkname) {
        const customerLink = res.report.navLinks.find((l) =>
          /(?:customer|client|member|user|active|all)/i.test(`${l.label} ${l.linkname}`)
        );
        if (customerLink) setSelectedNavLinkname(customerLink.linkname);
      }
      setBholaSyncBanner(
        `admin.bhola.net লাইভ সেশন চালু (${res.report.username}) — dashReport-এ ${toBengaliNumber(
          res.report.metricCards.length
        )}টি কার্ড ও ${toBengaliNumber(res.report.subscriberRows.length)} জন গ্রাহক সিঙ্ক হয়েছে।`
      );
    } catch (err) {
      setBholaError(err instanceof Error ? err.message : 'admin.bhola.net লগইন ব্যর্থ হয়েছে।');
    } finally {
      setIsLoggingInBhola(false);
    }
  };

  const handleRefreshDashReport = async () => {
    if (!liveBillingSessionToken || isRefreshingDash) return;
    setIsRefreshingDash(true);
    setBholaError(null);
    try {
      const updated = await fetchLiveDashReport(liveBillingSessionToken);
      onBillingSessionChange?.(liveBillingSessionToken, updated);
      setBholaSyncBanner('admin.bhola.net dashReport থেকে লাইভ সংখ্যা সফলভাবে রিফ্রেশ হয়েছে!');
    } catch (err) {
      const expired = (err as Error & { sessionExpired?: boolean })?.sessionExpired;
      if (expired) {
        onBillingSessionChange?.(null, null);
        setShowBholaLoginForm(true);
      }
      setBholaError(err instanceof Error ? err.message : 'dashReport রিফ্রেশ ব্যর্থ হয়েছে।');
    } finally {
      setIsRefreshingDash(false);
    }
  };

  const handleSyncSubscribersFromBhola = async (replaceOldFirst = false) => {
    if (!liveBillingSessionToken || isSyncingBillingRows) return;
    setIsSyncingBillingRows(true);
    setBholaError(null);
    setBholaSyncBanner(null);
    try {
      const res = await fetchBillingSubscribers(
        liveBillingSessionToken,
        selectedNavLinkname || undefined
      );

      if (res.rows.length === 0) {
        setBholaSyncBanner(
          `পোর্টালের "${res.sourceLinkname}" পাতায় কোনো সরাসরি গ্রাহক টেবিল পাওয়া যায়নি (${toBengaliNumber(
            res.tables.length
          )}টি টেবিল স্ক্যান হয়েছে)। উপরের ড্রপডাউন থেকে অন্য পাতা বেছে নিয়ে চেষ্টা করুন।`
        );
        return;
      }

      if (liveDashReport) {
        onBillingSessionChange?.(liveBillingSessionToken, {
          ...liveDashReport,
          subscriberRows: res.rows,
          syncedAt: new Date().toISOString()
        });
      }

      if (replaceOldFirst && onDeleteAllCustomers && customers.length > 0) {
        const wiped = await onDeleteAllCustomers();
        if (typeof wiped === 'number' && wiped === 0) {
          setBholaError('পুরাতন গ্রাহক মুছে ফেলতে পরিচালক পিন যাচাই বাতিল করা হয়েছে। লাইভ সিঙ্ক বাতিল হয়েছে।');
          return;
        }
      }

      if (onImportBillingCustomers) {
        const importRes = await onImportBillingCustomers(
          res.rows.map((r) => ({
            ...r,
            addedBy: `admin.bhola.net সিঙ্ক (${liveDashReport?.username || 'Live'})`
          }))
        );
        setBholaSyncBanner(
          `admin.bhola.net (${res.sourceLinkname}) থেকে ${toBengaliNumber(
            importRes.totalProcessed
          )} জন গ্রাহক মিক্সিং ও সেভ হয়েছে — নতুন: ${toBengaliNumber(
            importRes.addedCount
          )}, আপডেট: ${toBengaliNumber(importRes.updatedCount)} জন।`
        );
      } else {
        setBholaSyncBanner(
          `admin.bhola.net থেকে ${toBengaliNumber(res.rows.length)} জন লাইভ গ্রাহক OLT তালিকায় মিক্সিং করা হয়েছে।`
        );
      }
    } catch (err) {
      const expired = (err as Error & { sessionExpired?: boolean })?.sessionExpired;
      if (expired) {
        onBillingSessionChange?.(null, null);
        setShowBholaLoginForm(true);
      }
      setBholaError(err instanceof Error ? err.message : 'গ্রাহক তালিকা সিঙ্ক করা যায়নি।');
    } finally {
      setIsSyncingBillingRows(false);
    }
  };

  const handleBholaLogout = async () => {
    const token = liveBillingSessionToken;
    onBillingSessionChange?.(null, null);
    setShowBholaLoginForm(true);
    setBholaSyncBanner(null);
    if (token) {
      await logoutAdminBholaNet(token);
    }
  };

  const handleOltLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oltUsername.trim() || !oltPassword) {
      setOltError('OLT (103.158.206.4:6560) ইউজারনেম ও পাসওয়ার্ড দিন।');
      return;
    }
    setIsLoggingInOlt(true);
    setOltError(null);
    setOltSyncBanner(null);
    try {
      const res = await loginOltPortal({
        username: oltUsername.trim(),
        password: oltPassword
      });
      setOltPassword('');
      setShowOltLoginForm(false);
      onOltSessionChange?.(res.sessionToken, res.report);
      setLastAutoSyncAt(
        new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      if (res.report.discoveredPages.length > 0 && !selectedOltPagePath) {
        setSelectedOltPagePath(res.report.discoveredPages[0].path);
      }
      setOltSyncBanner(
        `OLT (103.158.206.4:6560) লাইভ সংযুক্ত (${res.report.username}) — মোট ${toBengaliNumber(
          res.report.totalOnus
        )}টি ONU পাওয়া গেছে (Online: ${toBengaliNumber(res.report.onlineOnus)}, সমস্যা/অফলাইন: ${toBengaliNumber(
          res.report.highLossOnus + res.report.losOnus + res.report.offlineOnus
        )})।`
      );
    } catch (err) {
      setOltError(
        err instanceof Error ? err.message : 'OLT (103.158.206.4:6560) পোর্টালে লগইন করা যায়নি।'
      );
    } finally {
      setIsLoggingInOlt(false);
    }
  };

  const handleRefreshOltOnly = async () => {
    if (!liveOltSessionToken || isRefreshingOlt) return;
    setIsRefreshingOlt(true);
    setOltError(null);
    try {
      const updated = await fetchLiveOltReport(liveOltSessionToken);
      onOltSessionChange?.(liveOltSessionToken, updated);
      setLastAutoSyncAt(
        new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setOltSyncBanner(
        `OLT লাইভ রিফ্রেশ সম্পন্ন — Online ${toBengaliNumber(updated.onlineOnus)} / মোট ${toBengaliNumber(
          updated.totalOnus
        )}টি ONU।`
      );
    } catch (err) {
      const expired = (err as Error & { sessionExpired?: boolean })?.sessionExpired;
      if (expired) {
        onOltSessionChange?.(null, null);
        setShowOltLoginForm(true);
      }
      setOltError(err instanceof Error ? err.message : 'OLT লাইভ তথ্য রিফ্রেশ ব্যর্থ হয়েছে।');
    } finally {
      setIsRefreshingOlt(false);
    }
  };

  const handleFetchSelectedOltPage = async () => {
    if (!liveOltSessionToken || !selectedOltPagePath || isFetchingOltPage) return;
    setIsFetchingOltPage(true);
    setOltError(null);
    try {
      const res = await fetchSpecificOltPageRows(liveOltSessionToken, selectedOltPagePath);
      if (liveOltReport) {
        const mergedByMac = new Map<string, OltSyncedOnuRow>();
        [...liveOltReport.onuRows, ...res.onuRows].forEach((row, idx) => {
          const key = normalizeMacHex(row.onuMac) || row.onuId || `${row.ponPort}-${idx}`;
          mergedByMac.set(key, { ...(mergedByMac.get(key) || {}), ...row });
        });
        const nextRows = Array.from(mergedByMac.values());
        onOltSessionChange?.(liveOltSessionToken, {
          ...liveOltReport,
          onuRows: nextRows,
          totalOnus: nextRows.length,
          onlineOnus: nextRows.filter((r) => r.status === 'active').length,
          offlineOnus: nextRows.filter((r) => r.status !== 'active').length,
          highLossOnus: nextRows.filter((r) => r.lossStatus === 'high_loss').length,
          losOnus: nextRows.filter((r) => r.lossStatus === 'los' || r.lossStatus === 'dying_gasp').length,
          syncedAt: new Date().toISOString()
        });
      }
      setOltSyncBanner(
        `OLT পাতা (${res.path}) থেকে ${toBengaliNumber(res.onuRows.length)}টি ONU তথ্য যুক্ত হয়েছে।`
      );
    } catch (err) {
      const expired = (err as Error & { sessionExpired?: boolean })?.sessionExpired;
      if (expired) {
        onOltSessionChange?.(null, null);
        setShowOltLoginForm(true);
      }
      setOltError(err instanceof Error ? err.message : 'নির্বাচিত OLT পাতা আনা যায়নি।');
    } finally {
      setIsFetchingOltPage(false);
    }
  };

  const handleOltLogout = async () => {
    const token = liveOltSessionToken;
    onOltSessionChange?.(null, null);
    setShowOltLoginForm(true);
    setOltSyncBanner(null);
    if (token) {
      await logoutOltPortal(token);
    }
  };

  const handleRefreshAllLive = useCallback(
    async (silent = false) => {
      if ((!liveOltSessionToken && !liveBillingSessionToken) || autoSyncLockRef.current) return;
      autoSyncLockRef.current = true;
      setIsAutoSyncing(true);
      if (!silent) {
        setOltError(null);
        setBholaError(null);
      }
      try {
        const tasks: Array<Promise<void>> = [];

        if (liveOltSessionToken) {
          tasks.push(
            fetchLiveOltReport(liveOltSessionToken)
              .then((report) => {
                onOltSessionChange?.(liveOltSessionToken, report);
              })
              .catch((err) => {
                const expired = (err as Error & { sessionExpired?: boolean })?.sessionExpired;
                if (expired) {
                  onOltSessionChange?.(null, null);
                  setShowOltLoginForm(true);
                }
                if (!silent) {
                  setOltError(err instanceof Error ? err.message : 'OLT অটো-আপডেট ব্যর্থ হয়েছে।');
                }
              })
          );
        }

        if (liveBillingSessionToken) {
          tasks.push(
            fetchLiveDashReport(liveBillingSessionToken)
              .then((report) => {
                onBillingSessionChange?.(liveBillingSessionToken, {
                  ...report,
                  subscriberRows:
                    report.subscriberRows.length > 0
                      ? report.subscriberRows
                      : liveDashReport?.subscriberRows || []
                });
              })
              .catch((err) => {
                const expired = (err as Error & { sessionExpired?: boolean })?.sessionExpired;
                if (expired) {
                  onBillingSessionChange?.(null, null);
                  setShowBholaLoginForm(true);
                }
                if (!silent) {
                  setBholaError(err instanceof Error ? err.message : 'Billing অটো-আপডেট ব্যর্থ হয়েছে।');
                }
              })
          );
        }

        await Promise.allSettled(tasks);
        setLastAutoSyncAt(
          new Date().toLocaleTimeString('bn-BD', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        );
      } finally {
        autoSyncLockRef.current = false;
        setIsAutoSyncing(false);
      }
    },
    [
      liveOltSessionToken,
      liveBillingSessionToken,
      liveDashReport?.subscriberRows,
      onOltSessionChange,
      onBillingSessionChange
    ]
  );

  // Automatic Background Auto-Update Interval (30s / 60s) whenever OLT or Billing session is connected
  useEffect(() => {
    if (autoSyncIntervalSec <= 0 || (!liveOltSessionToken && !liveBillingSessionToken)) return;
    const id = setInterval(() => {
      void handleRefreshAllLive(true);
    }, autoSyncIntervalSec * 1000);
    return () => clearInterval(id);
  }, [autoSyncIntervalSec, liveOltSessionToken, liveBillingSessionToken, handleRefreshAllLive]);

  const handleSaveMixedToDatabase = async () => {
    if (!onImportBillingCustomers || mixedCustomers.length === 0 || isSavingMixedToDb) return;
    setIsSavingMixedToDb(true);
    setOltError(null);
    try {
      const payload = mixedCustomers.map((c) => {
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = c;
        return {
          ...rest,
          addedBy: `OLT+Billing অটো-মিক্সিং (${currentUser.name})`
        };
      });
      const res = await onImportBillingCustomers(payload);
      setOltSyncBanner(
        `OLT + Billing মিক্সড ${toBengaliNumber(res.totalProcessed)} জন গ্রাহকের তথ্য ডাটাবেসে সেভ হয়েছে (নতুন: ${toBengaliNumber(
          res.addedCount
        )}, আপডেট: ${toBengaliNumber(res.updatedCount)})!`
      );
    } catch {
      setOltError('OLT + Billing মিক্সড তথ্য ডাটাবেসে সেভ করার সময় সমস্যা হয়েছে।');
    } finally {
      setIsSavingMixedToDb(false);
    }
  };

  const renderOnuDiagnosticTable = () => (
    <div className="rounded-2xl bg-[#0b1026] border border-indigo-500/35 shadow-xl overflow-hidden">
      {/* Table Top Control Bar */}
      <div className="px-4 py-3 bg-[#101736] border-b border-indigo-500/25 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-400/40 text-indigo-100 text-xs font-black">
            <Router className="w-3.5 h-3.5 text-cyan-300" />
            <span>
              Billing + OLT একত্রে ({toBengaliNumber(filteredTelemetry.length)} জন)
            </span>
          </span>
          {selectedPonFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setSelectedPonFilter('ALL')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/45 text-cyan-200 text-xs font-bold cursor-pointer"
            >
              <span>{selectedPonFilter} ফিল্টার</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Technician Pre-selector for fast Staff Complaint Dispatch */}
          {canAddComplaint && onCreateComplaintFromCustomer && staffs.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[#070b1b] border border-emerald-400/40 rounded-xl px-2.5 py-1">
              <UserCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <select
                value={selectedAssignStaffId}
                onChange={(e) => setSelectedAssignStaffId(e.target.value)}
                aria-label="অভিযোগ পাওয়ার সাথে সাথে যে স্টাফকে অ্যাসাইন করা হবে"
                className="bg-transparent text-emerald-100 text-xs font-bold outline-none cursor-pointer"
              >
                <option value="" className="bg-slate-900 text-white">
                  অটো (এলাকা অনুযায়ী টেকনিশিয়ান)
                </option>
                {staffs.map((s) => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                    {s.name} ({s.designation || 'স্টাফ'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {canEditCustomer && onUpdateCustomer && (
            <button
              type="button"
              onClick={() => {
                setPasteResultMsg(null);
                setIsPasteModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>OLT ডেটা পেস্ট / আপডেট</span>
            </button>
          )}
          {onOpenCustomers && (
            <button
              type="button"
              onClick={onOpenCustomers}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-indigo-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>গ্রাহক ডিরেক্টরি</span>
            </button>
          )}
        </div>
      </div>

      {/* Smart 1-Tap Complaint Assistance Strip for OLT + Billing Faults */}
      {canAddComplaint && onCreateComplaintFromCustomer && suggestedComplaintLines.length > 0 && (
        <div className="px-4 py-3 bg-gradient-to-r from-rose-950/65 via-[#181132] to-amber-950/50 border-b border-rose-500/35 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-black text-rose-200">
              <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
              <span>
                অভিযোগ জমা সহায়তা: {toBengaliNumber(suggestedComplaintLines.length)}টি সমস্যাজনিত লাইন শনাক্ত হয়েছে (১ ক্লিকে স্টাফকে অভিযোগ পাঠান)
              </span>
            </div>
            {suggestedComplaintLines.length > 4 && (
              <button
                type="button"
                onClick={() => setStatusFilter('problem')}
                className="text-[11px] font-black text-amber-200 hover:text-white underline cursor-pointer"
              >
                সব {toBengaliNumber(suggestedComplaintLines.length)}টি ফিল্টার করুন
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {suggestedComplaintLines.slice(0, 6).map((item) => {
              const autoMatch =
                !selectedAssignStaffId && staffs.length > 0
                  ? autoAssignTechnicianByLocation({
                      address: item.customer.address,
                      oltInfo: item.customer.oltInfo || item.ponLabel,
                      staffs,
                      complaints,
                    })
                  : null;
              const manualStaff = selectedAssignStaffId
                ? staffs.find((s) => s.id === selectedAssignStaffId)
                : null;
              const targetTechName = manualStaff?.name || autoMatch?.staff?.name;

              return (
                <div
                  key={`cmp-assist-${item.customer.id}`}
                  className="rounded-xl bg-[#070b1b]/90 border border-rose-400/35 px-3 py-2 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-black text-white truncate">
                      {item.customer.name}{' '}
                      <span className="text-cyan-300 font-mono font-bold">({item.customer.memberId})</span>
                    </div>
                    <div className="text-[10px] text-rose-200 truncate">
                      {item.ponLabel} · {item.rxDisplay} · {item.problemSummary}
                    </div>
                    {targetTechName && (
                      <div className="text-[10px] text-emerald-300 font-bold truncate mt-0.5">
                        👷 {manualStaff ? 'নির্ধারিত' : 'অটো-ম্যাচ'}: {targetTechName}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onCreateComplaintFromCustomer(
                        item.customer,
                        selectedAssignStaffId || autoMatch?.staff?.id || undefined
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black shrink-0 flex items-center gap-1 cursor-pointer"
                  >
                    <Wrench className="w-3 h-3" />
                    <span>অভিযোগ</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Diagnostic Rows */}
      {pagedRows.length === 0 ? (
        <div className="p-8 text-center space-y-2.5 text-slate-300">
          <Router className="w-10 h-10 text-indigo-400/50 mx-auto" />
          <div className="text-sm font-bold text-white">
            {customers.length === 0
              ? 'এখনো কোনো গ্রাহক বা ONU রেকর্ড যুক্ত করা হয়নি'
              : 'এই ফিল্টার বা সার্চে কোনো ONU পাওয়া যায়নি'}
          </div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            গ্রাহক তালিকা থেকে Excel ইমপোর্ট করুন অথবা উপরের <strong>&ldquo;OLT ডেটা পেস্ট / আপডেট&rdquo;</strong> ব্যবহার করে OLT ও ONU তথ্য যুক্ত করুন।
          </p>
          {canEditCustomer && onUpdateCustomer && (
            <button
              type="button"
              onClick={() => {
                setPasteResultMsg(null);
                setIsPasteModalOpen(true);
              }}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black cursor-pointer"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>OLT ডেটা পেস্ট / নতুন ONU যুক্ত করুন</span>
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[820px]">
            <thead>
              <tr className="bg-[#0d132e] border-b border-indigo-500/25 text-[11px] font-black uppercase tracking-wide text-indigo-300">
                <th className="py-2.5 px-3">PON / ID / প্যাকেজ</th>
                <th className="py-2.5 px-3">গ্রাহক ও বিলিং তথ্য</th>
                <th className="py-2.5 px-3">OLT & MAC</th>
                <th className="py-2.5 px-3">OLT Status</th>
                <th className="py-2.5 px-3">RX / TX (dBm)</th>
                <th className="py-2.5 px-3">Length / TJ</th>
                <th className="py-2.5 px-3 text-right">পাওয়ার ও স্টাফ অভিযোগ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-500/15 text-xs">
              {pagedRows.map((row, idx) => {
                const c = row.customer;
                const rowNumber = (currentPage - 1) * PAGE_SIZE + idx + 1;
                const rxColor =
                  row.isLos || (row.rxDbm !== null && row.rxDbm <= -27)
                    ? 'text-rose-400 font-black'
                    : row.rxDbm !== null && row.rxDbm <= -25
                    ? 'text-amber-300 font-black'
                    : row.rxDbm !== null
                    ? 'text-emerald-300 font-bold'
                    : 'text-slate-400';

                return (
                  <tr
                    key={c.id}
                    className={`hover:bg-indigo-950/50 transition-colors ${
                      row.tier === 'critical'
                        ? 'bg-rose-950/15'
                        : row.tier === 'warning'
                        ? 'bg-amber-950/10'
                        : ''
                    }`}
                  >
                    {/* 1. PON / ID / Package */}
                    <td className="py-2.5 px-3 align-top whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-cyan-300">{row.ponLabel}</span>
                        <span className="text-slate-400 font-mono text-[11px]">/ {rowNumber}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/25 border border-indigo-400/35 text-[10px] font-mono font-bold text-indigo-200">
                          {row.techType}
                        </span>
                        {(c.packageName || c.monthlyFee) && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/35 text-[10px] font-bold text-emerald-200">
                            {c.packageName || 'প্যাকেজ'}
                            {c.monthlyFee ? ` · ${formatCurrency(c.monthlyFee)}` : ''}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 2. Customer + Mixed Billing Info (Expiry, Due, StatusLabel) */}
                    <td className="py-2.5 px-3 align-top max-w-[240px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white truncate" title={c.name}>
                          {c.name}
                        </span>
                        {mixSourceById.get(c.id) === 'both' ? (
                          <span className="px-1.5 py-0.2 rounded bg-cyan-400/20 border border-cyan-400/50 text-[9px] font-black text-cyan-200 shrink-0">
                            OLT+Billing
                          </span>
                        ) : mixSourceById.get(c.id) === 'olt' ? (
                          <span className="px-1.5 py-0.2 rounded bg-indigo-400/25 border border-indigo-400/50 text-[9px] font-black text-indigo-200 shrink-0">
                            OLT লাইভ
                          </span>
                        ) : mixSourceById.get(c.id) === 'billing' ? (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-400/20 border border-emerald-400/50 text-[9px] font-black text-emerald-200 shrink-0">
                            Billing
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] font-mono text-cyan-300/90 mt-0.5 truncate">
                        {c.memberId} · {c.phone}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5" title={c.address}>
                        {c.address}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                            c.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/35'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-400/35'
                          }`}
                        >
                          {c.statusLabel || (c.status === 'active' ? 'বিল Active' : 'বিল Expired/বন্ধ')}
                        </span>
                        {c.expiryDate && (
                          <span className="text-[10px] font-mono text-amber-200">
                            মেয়াদ: {c.expiryDate}
                          </span>
                        )}
                        {c.dueAmount !== undefined && c.dueAmount > 0 && (
                          <span className="text-[10px] font-black text-rose-300">
                            বকেয়া: {formatCurrency(c.dueAmount)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 3. OLT & MAC */}
                    <td className="py-2.5 px-3 align-top whitespace-nowrap">
                      <div className="font-bold text-slate-100 text-[11px] truncate max-w-[160px]" title={c.oltInfo || ''}>
                        {c.oltInfo || 'OLT অনির্ধারিত'}
                      </div>
                      <div className="font-mono text-[11px] text-cyan-300/90 mt-0.5">
                        {row.onuMac}
                      </div>
                    </td>

                    {/* 4. Status */}
                    <td className="py-2.5 px-3 align-top whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-extrabold ${
                          row.isOffline || row.isLos
                            ? 'text-rose-400'
                            : row.isHighLoss
                            ? 'text-amber-300'
                            : 'text-emerald-300'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            row.isOffline || row.isLos
                              ? 'bg-rose-400'
                              : row.isHighLoss
                              ? 'bg-amber-300'
                              : 'bg-emerald-400'
                          }`}
                        />
                        <span>{row.isOffline ? 'Offline' : 'Online'}</span>
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5 max-w-[140px] truncate" title={row.problemSummary}>
                        {row.problemSummary}
                      </div>
                    </td>

                    {/* 5. RX / TX */}
                    <td className="py-2.5 px-3 align-top whitespace-nowrap font-mono">
                      <span className={rxColor}>{row.rxDisplay}</span>
                      <span className="text-slate-500 mx-1">/</span>
                      <span className="text-cyan-200">{row.txDisplay}</span>
                    </td>

                    {/* 6. Length / Splitter / TJ */}
                    <td className="py-2.5 px-3 align-top whitespace-nowrap">
                      <div className="font-mono text-slate-200">{row.lengthDisplay}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Split className="w-3 h-3 text-indigo-400 shrink-0" />
                        <span>{row.splitterLabel}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">TJ: {row.tjLabel}</div>
                    </td>

                    {/* 7. Action: সমস্যা ও পাওয়ার + স্টাফকে অভিযোগ দিন */}
                    <td className="py-2.5 px-3 align-top text-right whitespace-nowrap">
                      <div className="inline-flex flex-col sm:flex-row items-end sm:items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setDetailStartEdit(false);
                            setDetailCustomerId(c.id);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-sky-500/25 hover:bg-sky-500/40 border border-sky-400/50 text-sky-100 text-[11px] font-black cursor-pointer transition-colors"
                        >
                          পাওয়ার দেখুন
                        </button>
                        {canAddComplaint && onCreateComplaintFromCustomer && (
                          <button
                            type="button"
                            onClick={() =>
                              onCreateComplaintFromCustomer(
                                c,
                                selectedAssignStaffId || undefined
                              )
                            }
                            title="বিলিং ও OLT তথ্যসহ স্টাফকে অভিযোগ জমা দিন"
                            className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            <Wrench className="w-3 h-3" />
                            <span>স্টাফকে অভিযোগ দিন</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {filteredTelemetry.length > PAGE_SIZE && (
        <div className="px-4 py-3 bg-[#101736] border-t border-indigo-500/25 flex flex-wrap items-center justify-between gap-2 text-xs text-indigo-200">
          <span>
            মোট {toBengaliNumber(filteredTelemetry.length)}টির মধ্যে{' '}
            {toBengaliNumber((currentPage - 1) * PAGE_SIZE + 1)}–
            {toBengaliNumber(Math.min(currentPage * PAGE_SIZE, filteredTelemetry.length))} দেখানো হচ্ছে
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 font-bold cursor-pointer"
            >
              Prev
            </button>
            <span className="font-mono font-bold">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 font-bold cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`space-y-4 ${
        isExpanded ? 'fixed inset-0 z-50 bg-[#070b1d] p-3 sm:p-4 overflow-y-auto' : 'pb-8'
      }`}
    >
      {/* Top CDATA OLT & Troubleshooting Control Header */}
      <div className="bg-gradient-to-r from-[#090d24] via-[#11173b] to-[#0a1936] rounded-2xl p-4 text-white border border-indigo-500/40 shadow-xl space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/25 border border-indigo-400/50 flex items-center justify-center shrink-0">
              <Router className="w-6 h-6 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-xl font-black tracking-tight text-white">
                  CDATA · সমস্যা অনুসন্ধান ও OLT/ONU সমাধান কনসোল
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-[11px] font-bold">
                  {company?.name || 'DIP BHOLA NETWORK'}
                </span>
              </div>
              <p className="text-xs text-indigo-200/85 mt-0.5">
                FD1204S-B0 (4-PON) · Customer + OLT লাইভ সার্চ, Rx/Tx পাওয়ার বিশ্লেষণ, TJ/Splitter ও ফাইবার লস সমাধান
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={Boolean(isExportingFormat)}
              onClick={() => void handleExportMixedSummary('excel')}
              title="মিক্সড OLT ও বিলিং সামারি রিপোর্ট Excel (.xlsx) ডাউনলোড"
              className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 disabled:opacity-60 border border-emerald-400/55 text-emerald-100 text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
              <span>{isExportingFormat === 'excel' ? 'Excel হচ্ছে...' : 'Excel সামারি'}</span>
            </button>
            <button
              type="button"
              disabled={Boolean(isExportingFormat)}
              onClick={() => void handleExportMixedSummary('pdf')}
              title="মিক্সড OLT ও বিলিং সামারি রিপোর্ট PDF (.pdf) ডাউনলোড"
              className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 disabled:opacity-60 border border-cyan-400/55 text-cyan-100 text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-300" />
              <span>{isExportingFormat === 'pdf' ? 'PDF হচ্ছে...' : 'PDF সামারি'}</span>
            </button>
            {onOpenComplaints && (
              <button
                type="button"
                onClick={onOpenComplaints}
                className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/50 text-rose-100 text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>
                  অভিযোগ ({toBengaliNumber(pendingComplaints.length + inProgressComplaints.length)})
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span>{isExpanded ? 'সাধারণ মাপ' : 'বড় স্ক্রিন'}</span>
            </button>
          </div>
        </div>

        {exportBanner && (
          <div
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${
              exportBanner.type === 'success'
                ? 'bg-emerald-500/20 border-emerald-400/55 text-emerald-100'
                : 'bg-rose-500/20 border-rose-400/55 text-rose-100'
            }`}
          >
            <span>{exportBanner.text}</span>
            <button
              type="button"
              onClick={() => setExportBanner(null)}
              className="p-0.5 hover:opacity-75 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Sub-Navigation Tabs (Overview, ONU Table, Optional Web Link) */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-indigo-500/25">
          {(
            [
              { id: 'overview', label: 'Overview ও PON হিটম্যাপ', icon: Activity },
              { id: 'onu_table', label: 'ONU ও সমস্যা-পাওয়ার টেবিল', icon: Router },
              { id: 'web_portal', label: 'এক্সটার্নাল পোর্টাল লিংক', icon: Globe }
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = consoleTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setConsoleTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer border ${
                  active
                    ? 'bg-indigo-500 text-white border-cyan-300 shadow-md shadow-indigo-950/60'
                    : 'bg-[#080d22] hover:bg-indigo-950/70 text-indigo-200 border-indigo-500/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: OVERVIEW & LIVE DIAGNOSTICS + 103.158.206.4:6560 OLT + ADMIN.BHOLA.NET MIXING */}
      {consoleTab === 'overview' && (
        <div className="space-y-4">
          {/* Compact Unified OLT + admin.bhola.net Live Connection & Auto-Sync Bar (so Dashboard sits right at top!) */}
          <div className="rounded-2xl bg-gradient-to-r from-[#0c1334] via-[#101c49] to-[#081938] border border-cyan-400/45 p-3.5 text-white shadow-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              {/* Left: Connection Badges */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#070d25] border border-indigo-400/40">
                  <Server className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                  <span className="font-black text-white">OLT:</span>
                  {liveOltSessionToken && liveOltReport ? (
                    <span className="text-emerald-300 font-black flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>সংযুক্ত ({toBengaliNumber(liveOltReport.totalOnus)} ONU)</span>
                    </span>
                  ) : (
                    <span className="text-amber-300 font-bold">সংযোগ নেই</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#070d25] border border-cyan-400/40">
                  <Database className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                  <span className="font-black text-white">Billing:</span>
                  {liveBillingSessionToken && liveDashReport ? (
                    <span className="text-emerald-300 font-black flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>
                        সংযুক্ত ({liveDashReport.username}
                        {liveDashReport.totalCustomers !== null
                          ? ` · ${toBengaliNumber(liveDashReport.totalCustomers)}`
                          : ''}
                        )
                      </span>
                    </span>
                  ) : (
                    <span className="text-amber-300 font-bold">সংযোগ নেই</span>
                  )}
                </div>

                {(liveOltSessionToken || liveBillingSessionToken) && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#070d25] border border-emerald-400/35 text-[11px]">
                    <Clock className="w-3 h-3 text-cyan-300" />
                    {([30, 60, 0] as const).map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setAutoSyncIntervalSec(sec)}
                        className={`px-1.5 py-0.5 rounded font-black cursor-pointer ${
                          autoSyncIntervalSec === sec
                            ? 'bg-cyan-400 text-slate-950'
                            : 'text-indigo-200 hover:bg-white/10'
                        }`}
                      >
                        {sec === 0 ? 'বন্ধ' : `${toBengaliNumber(sec)}সে`}
                      </button>
                    ))}
                    {lastAutoSyncAt && (
                      <span className="text-emerald-300 font-bold hidden sm:inline">
                        · {lastAutoSyncAt}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Quick Action Controls */}
              <div className="flex flex-wrap items-center gap-1.5">
                {!liveOltSessionToken ? (
                  <button
                    type="button"
                    onClick={() => setShowOltLoginForm((v) => !v)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-400 hover:bg-indigo-300 text-slate-950 text-xs font-black flex items-center gap-1 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{showOltLoginForm ? 'OLT ফর্ম বন্ধ' : 'OLT লগইন'}</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={isRefreshingOlt}
                      onClick={() => void handleRefreshOltOnly()}
                      className="px-2.5 py-1.5 rounded-xl bg-indigo-500/30 hover:bg-indigo-500/45 border border-indigo-400/50 text-indigo-100 text-xs font-black flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingOlt ? 'animate-spin' : ''}`} />
                      <span>OLT রিফ্রেশ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleOltLogout()}
                      className="px-2 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/45 text-rose-100 text-xs font-bold cursor-pointer"
                      title="OLT লগআউট"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}

                {!liveBillingSessionToken ? (
                  <button
                    type="button"
                    onClick={() => setShowBholaLoginForm((v) => !v)}
                    className="px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black flex items-center gap-1 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{showBholaLoginForm ? 'Billing ফর্ম বন্ধ' : 'admin.bhola.net লগইন'}</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={isRefreshingDash}
                      onClick={() => void handleRefreshDashReport()}
                      className="px-2.5 py-1.5 rounded-xl bg-cyan-500/25 hover:bg-cyan-500/40 border border-cyan-400/50 text-cyan-100 text-xs font-black flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingDash ? 'animate-spin' : ''}`} />
                      <span>Billing রিফ্রেশ</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSyncingBillingRows}
                      onClick={() => void handleSyncSubscribersFromBhola(false)}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isSyncingBillingRows ? 'সিঙ্ক...' : 'গ্রাহক সিঙ্ক'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleBholaLogout()}
                      className="px-2 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/45 text-rose-100 text-xs font-bold cursor-pointer"
                      title="admin.bhola.net লগআউট"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}

                {(liveOltSessionToken || liveBillingSessionToken) && (
                  <button
                    type="button"
                    disabled={isAutoSyncing}
                    onClick={() => void handleRefreshAllLive(false)}
                    className="px-2.5 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 text-white text-xs font-black flex items-center gap-1 cursor-pointer"
                  >
                    <Radio className={`w-3.5 h-3.5 ${isAutoSyncing ? 'animate-ping' : ''}`} />
                    <span>একত্রে আপডেট</span>
                  </button>
                )}

                {(liveOltSessionToken || liveBillingSessionToken) &&
                  onImportBillingCustomers &&
                  mixedCustomers.length > 0 && (
                    <button
                      type="button"
                      disabled={isSavingMixedToDb}
                      onClick={() => void handleSaveMixedToDatabase()}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-60 text-slate-950 text-xs font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingMixedToDb ? 'সেভ...' : 'সেভ'}</span>
                    </button>
                  )}

                {isDirectorRole && onDeleteAllCustomers && customers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmResetCustomers((v) => !v)}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-600/85 hover:bg-rose-600 border border-rose-400/50 text-white text-xs font-black flex items-center gap-1 cursor-pointer"
                    title="অ্যাপের পুরাতন সংরক্ষিত গ্রাহক তালিকা মুছে ০ করুন"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>পুরাতন মুছুন ({toBengaliNumber(customers.length)})</span>
                  </button>
                )}
              </div>
            </div>

            {!liveOltSessionToken && !liveBillingSessionToken && mixedCustomers.length === 0 && !showOltLoginForm && !showBholaLoginForm && (
              <div className="px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-400/45 text-amber-100 text-xs font-bold flex flex-wrap items-center justify-between gap-2">
                <span>
                  লাইভ OLT (103.158.206.4:6560) ও admin.bhola.net তথ্য দেখতে উপরের <strong>&ldquo;OLT লগইন&rdquo;</strong> এবং <strong>&ldquo;admin.bhola.net লগইন&rdquo;</strong> বাটনে লগইন করুন।
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowOltLoginForm(true)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-400 hover:bg-indigo-300 text-slate-950 text-[11px] font-black cursor-pointer"
                  >
                    OLT চালু করুন
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBholaLoginForm(true)}
                    className="px-2.5 py-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-[11px] font-black cursor-pointer"
                  >
                    Billing চালু করুন
                  </button>
                </div>
              </div>
            )}

            {/* Inline Banners & Collapsible Login Drawers */}
            {oltError && (
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-400/60 text-rose-100 text-xs font-bold flex items-center justify-between gap-2">
                <span>{oltError}</span>
                <button type="button" onClick={() => setOltError(null)} className="p-0.5 hover:opacity-75 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {oltSyncBanner && (
              <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/60 text-emerald-100 text-xs font-bold flex items-center justify-between gap-2">
                <span>{oltSyncBanner}</span>
                <button type="button" onClick={() => setOltSyncBanner(null)} className="p-0.5 hover:opacity-75 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {bholaError && (
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-400/60 text-rose-100 text-xs font-bold flex items-center justify-between gap-2">
                <span>{bholaError}</span>
                <button type="button" onClick={() => setBholaError(null)} className="p-0.5 hover:opacity-75 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {bholaSyncBanner && (
              <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/60 text-emerald-100 text-xs font-bold flex items-center justify-between gap-2">
                <span>{bholaSyncBanner}</span>
                <button type="button" onClick={() => setBholaSyncBanner(null)} className="p-0.5 hover:opacity-75 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {confirmResetCustomers && onDeleteAllCustomers && (
              <div className="rounded-xl p-3 bg-rose-950/80 border border-rose-400/70 space-y-2">
                <div className="text-xs sm:text-sm font-bold text-rose-100">
                  অ্যাপের ডাটাবেজে থাকা পুরাতন {toBengaliNumber(customers.length)} জন গ্রাহক স্থায়ীভাবে মুছে ০ করতে চান?
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={isResettingCustomers}
                    onClick={() => setConfirmResetCustomers(false)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white cursor-pointer"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    disabled={isResettingCustomers}
                    onClick={async () => {
                      setIsResettingCustomers(true);
                      try {
                        const prevCount = customers.length;
                        const count = await onDeleteAllCustomers();
                        setConfirmResetCustomers(false);
                        if (typeof count === 'number' && count === 0 && prevCount > 0) {
                          setBholaError('পরিচালক পিন যাচাই না হওয়ায় পুরাতন গ্রাহক মোছা হয়নি।');
                        } else {
                          setBholaSyncBanner(
                            `পুরাতন ${toBengaliNumber(typeof count === 'number' ? count : prevCount)} জন গ্রাহক স্থায়ীভাবে মুছে ০ করা হয়েছে।`
                          );
                        }
                      } finally {
                        setIsResettingCustomers(false);
                      }
                    }}
                    className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 disabled:opacity-60 text-white text-xs font-black flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isResettingCustomers ? 'মুছছে...' : 'হ্যাঁ, সব পুরাতন গ্রাহক মুছুন'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Collapsible OLT Login Form */}
            {!liveOltSessionToken && showOltLoginForm && (
              <form
                onSubmit={handleOltLoginSubmit}
                className="rounded-xl bg-[#060b21]/95 border border-indigo-400/45 p-3.5 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
              >
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-indigo-200 mb-1">
                    OLT ইউজারনেম (103.158.206.4:6560) *
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={oltUsername}
                    onChange={(e) => setOltUsername(e.target.value)}
                    placeholder="OLT Username (e.g. admin)"
                    className="w-full px-3 py-2 rounded-lg bg-[#0d153b] border border-indigo-500/45 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-indigo-200 mb-1">
                    OLT পাসওয়ার্ড *
                  </label>
                  <div className="relative">
                    <input
                      type={showOltPass ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={oltPassword}
                      onChange={(e) => setOltPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-3 pr-9 py-2 rounded-lg bg-[#0d153b] border border-indigo-500/45 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOltPass((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showOltPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="sm:col-span-4 flex items-center justify-end gap-2">
                  <a
                    href={OLT_DEVICE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-cyan-100 text-xs font-bold flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>পোর্টাল</span>
                  </a>
                  <button
                    type="submit"
                    disabled={isLoggingInOlt}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{isLoggingInOlt ? 'OLT সংযুক্ত হচ্ছে...' : 'OLT লগইন করুন'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Collapsible admin.bhola.net Login Form */}
            {!liveBillingSessionToken && showBholaLoginForm && (
              <form
                onSubmit={handleBholaLoginSubmit}
                className="rounded-xl bg-[#040d21]/95 border border-cyan-400/45 p-3.5 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
              >
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-cyan-200 mb-1">
                    admin.bhola.net ইউজারনেম *
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={bholaUsername}
                    onChange={(e) => setBholaUsername(e.target.value)}
                    placeholder="Maestro Username"
                    className="w-full px-3 py-2 rounded-lg bg-[#091836] border border-cyan-500/40 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-cyan-200 mb-1">
                    পাসওয়ার্ড *
                  </label>
                  <div className="relative">
                    <input
                      type={showBholaPass ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={bholaPassword}
                      onChange={(e) => setBholaPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-3 pr-9 py-2 rounded-lg bg-[#091836] border border-cyan-500/40 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBholaPass((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showBholaPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="sm:col-span-4 flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-cyan-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bholaRemember}
                      onChange={(e) => setBholaRemember(e.target.checked)}
                      className="accent-cyan-400 rounded"
                    />
                    <span>Save 30 days</span>
                  </label>
                  <button
                    type="submit"
                    disabled={isLoggingInBhola}
                    className="px-4 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 disabled:opacity-60 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{isLoggingInBhola ? 'লগইন হচ্ছে...' : 'লগইন ও dashReport আনুন'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* CARD 1: UNIFIED MEMBER / BILLING + OLT INFORMATION MIXING DASHBOARD */}
          <div className="rounded-2xl bg-[#0b1026] border border-cyan-500/40 p-4 text-white space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-400/45 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white flex flex-wrap items-center gap-2">
                    <span>সদস্য ও বিলিং + OLT INFORMATION একত্রে (Active Lines)</span>
                    {(liveOltSessionToken || liveBillingSessionToken) && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/45 text-emerald-200 text-[10px] font-black">
                        লাইভ মিক্সিং সক্রিয়
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-300/85 mt-0.5">
                    কতগুলো গ্রাহক লাইন এক্টিভ, বকেয়া, Offline ও OLT ONU-তে লিংকড আছে (বিলিং + OLT একত্রে)
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={Boolean(isExportingFormat)}
                  onClick={() => void handleExportMixedSummary('excel')}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/30 disabled:opacity-60 border border-emerald-400/45 text-emerald-200 text-xs font-black flex items-center gap-1 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  disabled={Boolean(isExportingFormat)}
                  onClick={() => void handleExportMixedSummary('pdf')}
                  className="px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/30 disabled:opacity-60 border border-cyan-400/45 text-cyan-200 text-xs font-black flex items-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConsoleTab('onu_table')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/45 text-emerald-200 text-xs font-black cursor-pointer"
                >
                  সদস্য তালিকা →
                </button>
              </div>
            </div>

            {/* Row 1: Billing / Member KPIs (4 tiles) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 tabular-nums">
              <div className="rounded-xl bg-gradient-to-br from-[#062925] to-[#081b28] border border-emerald-500/40 p-3.5 relative">
                <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-emerald-200">
                  <span>Online সদস্য</span>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-300" />
                </div>
                <div className="text-2xl font-black text-emerald-300 mt-1">
                  {toBengaliNumber(unifiedMixStats.onlineMembers)}
                </div>
                <div className="text-[11px] text-emerald-200/80 mt-0.5">
                  {toBengaliNumber(unifiedMixStats.onlineMemberPct)}% · ONU Up{' '}
                  {toBengaliNumber(unifiedMixStats.onuUpLinkedCount)}
                </div>
              </div>

              <div className="rounded-xl bg-gradient-to-br from-[#092347] to-[#081733] border border-cyan-500/40 p-3.5 relative">
                <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-cyan-200">
                  <span>Active সদস্য</span>
                  <Activity className="w-3.5 h-3.5 text-cyan-300" />
                </div>
                <div className="text-2xl font-black text-cyan-300 mt-1">
                  {toBengaliNumber(unifiedMixStats.activeMembers)}
                </div>
                <div className="text-[11px] text-cyan-200/80 mt-0.5">
                  বকেয়া (Due) {toBengaliNumber(unifiedMixStats.dueMemberCount)}
                </div>
              </div>

              <div className="rounded-xl bg-gradient-to-br from-[#2d0f28] to-[#1a0d28] border border-rose-500/40 p-3.5 relative">
                <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-rose-200">
                  <span>Offline সদস্য</span>
                  <WifiOff className="w-3.5 h-3.5 text-rose-300" />
                </div>
                <div className="text-2xl font-black text-rose-400 mt-1">
                  {toBengaliNumber(unifiedMixStats.offlineMembers)}
                </div>
                <div className="text-[11px] text-rose-200/80 mt-0.5">
                  Disabled / Expired {toBengaliNumber(unifiedMixStats.disabledOrExpiredCount)}
                </div>
              </div>

              <div className="rounded-xl bg-[#10132e] border border-indigo-400/35 p-3.5 relative">
                <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-slate-200">
                  <span>মোট সদস্য</span>
                  <Users className="w-3.5 h-3.5 text-indigo-300" />
                </div>
                <div className="text-2xl font-black text-white mt-1">
                  {toBengaliNumber(unifiedMixStats.totalMembers)}
                </div>
                <div className="text-[11px] text-slate-300/85 mt-0.5">
                  ONU লিংকড: {toBengaliNumber(unifiedMixStats.onuLinkedCount)}
                </div>
              </div>
            </div>

            {/* Row 2: OLT ONU KPIs directly underneath inside the SAME card (4 tiles) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 tabular-nums">
              <div className="rounded-xl bg-[#09162d] border border-emerald-500/30 p-3.5">
                <div className="text-[11px] font-bold text-emerald-200">Online অনু</div>
                <div className="text-2xl font-black text-emerald-300 mt-1">
                  {toBengaliNumber(unifiedMixStats.onlineOnus)}
                </div>
                <div className="text-[11px] text-slate-300/80 mt-0.5">
                  {toBengaliNumber(unifiedMixStats.onlineOnuPct)}% Online
                </div>
              </div>

              <div className="rounded-xl bg-[#09162d] border border-cyan-500/30 p-3.5">
                <div className="text-[11px] font-bold text-cyan-200">Active অনু</div>
                <div className="text-2xl font-black text-cyan-300 mt-1">
                  {toBengaliNumber(unifiedMixStats.activeOnus)}
                </div>
                <div className="text-[11px] text-slate-300/80 mt-0.5">
                  {toBengaliNumber(unifiedMixStats.activeOnuPct)}% Active
                </div>
              </div>

              <div className="rounded-xl bg-[#1a0f2b] border border-rose-500/35 p-3.5">
                <div className="text-[11px] font-bold text-rose-200">Off-line অনু</div>
                <div className="text-2xl font-black text-rose-400 mt-1">
                  {toBengaliNumber(unifiedMixStats.offlineOnus)}
                </div>
                <div className="text-[11px] text-rose-200/80 mt-0.5">
                  Alarm {toBengaliNumber(unifiedMixStats.alarmOnus)}
                </div>
              </div>

              <div className="rounded-xl bg-[#10132e] border border-indigo-400/30 p-3.5">
                <div className="text-[11px] font-bold text-slate-200">মোট অনু (OLT)</div>
                <div className="text-2xl font-black text-white mt-1">
                  {toBengaliNumber(unifiedMixStats.totalOnus)}
                </div>
                <div className="text-[11px] text-slate-300/85 mt-0.5">
                  XPON {toBengaliNumber(unifiedMixStats.xponTotal)} · EPON{' '}
                  {toBengaliNumber(unifiedMixStats.eponTotal)}
                </div>
              </div>
            </div>

            {/* Live Member + OLT Mixed Preview Grid */}
            <div className="pt-1 border-t border-indigo-500/25 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-200">
                  সদস্যদের লাইভ অবস্থা (Online ও Offline — Billing + OLT একত্রে)
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-black tabular-nums">
                  <span className="text-emerald-300">
                    {toBengaliNumber(unifiedMixStats.onlineMembers)} Online
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-rose-400">
                    {toBengaliNumber(unifiedMixStats.offlineMembers)} Offline
                  </span>
                </div>
              </div>

              {/* Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    ['all', 'সবাই'],
                    ['linked', 'OLT + Billing লিংকড'],
                    ['online', 'Online'],
                    ['problem', 'Offline / সমস্যা']
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMemberPreviewFilter(key)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                      memberPreviewFilter === key
                        ? 'bg-cyan-400 text-slate-950 border-white font-black'
                        : 'bg-[#080d22] text-slate-300 border-indigo-500/35 hover:bg-indigo-950/70'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {selectedPonFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setSelectedPonFilter('ALL')}
                    className="px-2 py-1 rounded-lg bg-indigo-500/25 border border-cyan-400/50 text-cyan-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>{selectedPonFilter}</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {previewMembers.length === 0 ? (
                <div className="rounded-xl bg-[#070b1d] border border-indigo-500/25 p-4 text-center text-xs text-slate-300">
                  {mixedCustomers.length === 0
                    ? 'উপরের OLT (103.158.206.4:6560) এবং admin.bhola.net লগইন করলে এখানে সব সদস্য ও ONU লাইভ অবস্থা একত্রে দেখাবে।'
                    : 'এই ফিল্টারে কোনো সদস্য পাওয়া যায়নি।'}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {previewMembers
                      .slice(0, showAllPreviewMembers ? 20 : 8)
                      .map((item) => {
                        const c = item.customer;
                        const src = mixSourceById.get(c.id) || 'local';
                        const isOfflineLine = item.isOffline || item.isLos;
                        const packageOrAddress =
                          c.packageName ||
                          (c.dueAmount ? `বকেয়া ৳${c.dueAmount}` : '') ||
                          c.address ||
                          '—';

                        return (
                          <div
                            key={`preview-${c.id}`}
                            className={`rounded-xl px-3.5 py-2.5 border flex items-center justify-between gap-2 transition-colors ${
                              isOfflineLine || item.isHighLoss
                                ? 'bg-[#120e29] border-rose-500/35 hover:border-rose-400/60'
                                : 'bg-[#080f27] border-indigo-500/30 hover:border-cyan-400/50'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setDetailStartEdit(false);
                                setDetailCustomerId(c.id);
                              }}
                              className="min-w-0 flex-1 text-left cursor-pointer"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs sm:text-sm font-black text-white truncate">
                                  {c.name}
                                </span>
                                {src === 'both' && (
                                  <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-[9px] font-black shrink-0">
                                    OLT+Bill
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                                {c.memberId} · {packageOrAddress}
                              </div>
                            </button>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right">
                                <div className="flex items-center justify-end gap-1.5 text-[11px] font-black">
                                  {item.ponPort !== 'OTHER' && (
                                    <span className="text-rose-300 font-mono">{item.ponPort}</span>
                                  )}
                                  {item.ponPort !== 'OTHER' && (
                                    <span className="text-slate-500">·</span>
                                  )}
                                  <span className={isOfflineLine ? 'text-rose-400' : 'text-emerald-400'}>
                                    {isOfflineLine ? 'Offline' : 'Online'}
                                  </span>
                                </div>
                                {item.rxDisplay !== '—' && (
                                  <div
                                    className={`text-[10px] font-mono ${
                                      item.isLos || (item.rxDbm !== null && item.rxDbm <= -27)
                                        ? 'text-rose-300'
                                        : item.isHighLoss
                                        ? 'text-amber-300'
                                        : 'text-emerald-300/85'
                                    }`}
                                  >
                                    {item.rxDisplay === 'LOS' ? 'LOS' : `${item.rxDisplay} dBm`}
                                  </div>
                                )}
                              </div>

                              {canAddComplaint && onCreateComplaintFromCustomer && (item.hasProblem || isOfflineLine) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onCreateComplaintFromCustomer(
                                      c,
                                      selectedAssignStaffId || undefined
                                    )
                                  }
                                  title="স্টাফকে অভিযোগ দিন"
                                  className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black flex items-center gap-1 cursor-pointer"
                                >
                                  <Wrench className="w-3 h-3" />
                                  <span className="hidden sm:inline">অভিযোগ</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {previewMembers.length > 8 && (
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setShowAllPreviewMembers((v) => !v)}
                        className="text-cyan-300 hover:text-cyan-200 font-bold cursor-pointer"
                      >
                        {showAllPreviewMembers
                          ? 'সংক্ষিপ্ত দেখুন (৮টি)'
                          : `আরও দেখুন (মোট ${toBengaliNumber(previewMembers.length)}টি)`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConsoleTab('onu_table')}
                        className="text-emerald-300 hover:text-emerald-200 font-black cursor-pointer"
                      >
                        সম্পূর্ণ মিক্সড টেবিল খুলুন →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* CARD 2: OLT INFORMATION (Active ONUs & PON Breakdown) */}
          <div className="rounded-2xl bg-[#0b1026] border border-indigo-500/40 p-4 text-white space-y-3.5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/50 flex items-center justify-center shrink-0">
                  <Wifi className="w-4 h-4 text-cyan-300" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    OLT INFORMATION (Active ONUs &amp; PON)
                  </h3>
                  <p className="text-[11px] text-slate-300/85 mt-0.5">
                    কতগুলো অনু Active, Online, Offline ও কোন PON-এ কয়টি চালু আছে
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConsoleTab('onu_table')}
                className="px-3 py-1.5 rounded-xl bg-indigo-500/25 hover:bg-indigo-500/40 border border-indigo-400/45 text-indigo-100 text-xs font-black cursor-pointer shrink-0"
              >
                সব ONU →
              </button>
            </div>

            {/* 4 OLT KPI Tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 tabular-nums">
              <div className="rounded-xl bg-gradient-to-br from-[#231d59] to-[#131742] border border-indigo-400/50 p-3.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-indigo-200">
                  <span>Active অনু</span>
                  <Activity className="w-3.5 h-3.5 text-cyan-300" />
                </div>
                <div className="text-2xl font-black text-cyan-300 mt-1">
                  {toBengaliNumber(unifiedMixStats.activeOnus)}
                </div>
                <div className="text-[11px] text-indigo-200/80 mt-0.5">
                  {toBengaliNumber(unifiedMixStats.activeOnuPct)}% Active
                </div>
              </div>

              <div className="rounded-xl bg-[#09182e] border border-emerald-500/35 p-3.5">
                <div className="text-[11px] font-bold text-emerald-200">Online অনু</div>
                <div className="text-2xl font-black text-emerald-300 mt-1">
                  {toBengaliNumber(unifiedMixStats.onlineOnus)}
                </div>
                <div className="text-[11px] text-slate-300/80 mt-0.5">
                  {toBengaliNumber(unifiedMixStats.onlineOnuPct)}% Online
                </div>
              </div>

              <div className="rounded-xl bg-[#0e1330] border border-indigo-400/30 p-3.5">
                <div className="text-[11px] font-bold text-slate-200">নিবন্ধিত অনু</div>
                <div className="text-2xl font-black text-white mt-1">
                  {toBengaliNumber(unifiedMixStats.totalOnus)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Registered Total</div>
              </div>

              <div className="rounded-xl bg-[#1a0f2b] border border-rose-500/35 p-3.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-rose-200">
                  <span>Offline / Alarm</span>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />
                </div>
                <div className="text-2xl font-black text-rose-400 mt-1">
                  {toBengaliNumber(unifiedMixStats.offlineOnus)}
                </div>
                <div className="text-[11px] text-rose-200/80 mt-0.5">
                  Alarm {toBengaliNumber(unifiedMixStats.alarmOnus)} ({toBengaliNumber(unifiedMixStats.alarmOnuPct)}%)
                </div>
              </div>
            </div>

            {/* 4 PON Breakdown Cards (PON1 - PON4 with Act, On, Off, !Alarm, XPON, EPON) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 tabular-nums">
              {unifiedMixStats.ponDetailed.map((pon) => {
                const isSelected = selectedPonFilter === pon.ponId;
                return (
                  <button
                    key={`olt-info-${pon.ponId}`}
                    type="button"
                    onClick={() => setSelectedPonFilter(isSelected ? 'ALL' : pon.ponId)}
                    className={`text-left rounded-xl p-3 border transition-all cursor-pointer space-y-1.5 ${
                      isSelected
                        ? 'bg-indigo-950/95 border-cyan-300 ring-2 ring-cyan-400/35'
                        : 'bg-[#080d22] hover:bg-[#0f1636] border-indigo-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-white">{pon.ponId}</span>
                      <span className="text-xs font-mono font-black text-cyan-300">
                        Act {pon.online}/{pon.total}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono flex flex-wrap items-center gap-1.5">
                      <span className="text-slate-300">
                        On: <strong className="text-emerald-300">{pon.online}</strong>
                      </span>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-300">
                        Off: <strong className="text-rose-400">{pon.offline}</strong>
                      </span>
                      {pon.alarmCount > 0 && (
                        <>
                          <span className="text-slate-500">·</span>
                          <span className="text-amber-300 font-black">!{pon.alarmCount}</span>
                        </>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-cyan-300/90">
                      XPON: {pon.xponCount} · EPON: {pon.eponCount}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live OLT System Metrics + Subpage Scanner & admin.bhola.net dashReport Extra Cards */}
          {(liveOltReport || liveDashReport) && (
            <div className="rounded-2xl bg-[#0b1026] border border-cyan-500/35 p-4 text-white space-y-3 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-cyan-200">
                  <Server className="w-4 h-4 text-cyan-300" />
                  <span>লাইভ পোর্টাল ডিটেইলস (OLT পাতা স্ক্যান ও admin.bhola.net কার্ড)</span>
                </div>
                <span className="text-[11px] text-slate-300">
                  স্বয়ংক্রিয় মিক্সিং চালু আছে
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* OLT Subpage Scan & System Info */}
                {liveOltReport && (
                  <div className="rounded-xl bg-[#070d23] border border-indigo-500/35 p-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-black text-indigo-200">
                        OLT ডিভাইস ({liveOltReport.deviceModel || 'FD1204S'}) · {toBengaliNumber(liveOltReport.onuRows.length)}টি ONU
                      </span>
                      <span className="text-[10px] font-mono text-emerald-300">
                        {liveOltReport.pageTitle}
                      </span>
                    </div>

                    {liveOltReport.systemMetrics.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {liveOltReport.systemMetrics.slice(0, 6).map((m, i) => (
                          <div key={`olt-sys-${i}`} className="rounded-lg bg-[#0d1536] border border-indigo-500/25 px-2.5 py-1.5">
                            <div className="text-[10px] text-indigo-300 truncate">{m.label}</div>
                            <div className="text-xs font-bold text-white truncate">{m.value}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {liveOltReport.discoveredPages.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <select
                          value={selectedOltPagePath}
                          onChange={(e) => setSelectedOltPagePath(e.target.value)}
                          aria-label="OLT পাতা নির্বাচন"
                          className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg bg-[#0c1433] border border-indigo-400/40 text-xs text-white"
                        >
                          {liveOltReport.discoveredPages.map((pg) => (
                            <option key={pg.path} value={pg.path} className="bg-slate-900">
                              {pg.label} ({pg.path})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={isFetchingOltPage || !selectedOltPagePath}
                          onClick={() => void handleFetchSelectedOltPage()}
                          className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{isFetchingOltPage ? 'স্ক্যান হচ্ছে...' : 'এই OLT পাতা আনুন'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* admin.bhola.net dashReport Cards & Customer Page Picker */}
                {liveDashReport && (
                  <div className="rounded-xl bg-[#070d23] border border-cyan-500/35 p-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-black text-cyan-200">
                        admin.bhola.net dashReport ({toBengaliNumber(liveDashReport.metricCards.length)}টি কার্ড)
                      </span>
                      <span className="text-[10px] font-mono text-emerald-300">
                        {toBengaliNumber(liveDashReport.subscriberRows.length)} জন গ্রাহক সারিতে লোড
                      </span>
                    </div>

                    {liveDashReport.metricCards.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {liveDashReport.metricCards.slice(0, 6).map((card, i) => (
                          <div key={`dash-card-${i}`} className="rounded-lg bg-[#0a1834] border border-cyan-500/25 px-2.5 py-1.5">
                            <div className="text-[10px] text-cyan-200/80 truncate">{card.label}</div>
                            <div className="text-xs font-black text-white truncate">{card.value}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {liveDashReport.navLinks.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <select
                          value={selectedNavLinkname}
                          onChange={(e) => setSelectedNavLinkname(e.target.value)}
                          aria-label="admin.bhola.net পাতা নির্বাচন"
                          className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg bg-[#0a1834] border border-cyan-400/40 text-xs text-white"
                        >
                          <option value="" className="bg-slate-900">
                            অটো গ্রাহক পাতা নির্বাচন
                          </option>
                          {liveDashReport.navLinks.map((lnk) => (
                            <option key={lnk.linkname} value={lnk.linkname} className="bg-slate-900">
                              {lnk.label} ({lnk.linkname})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={isSyncingBillingRows}
                          onClick={() => void handleSyncSubscribersFromBhola(false)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-black flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{isSyncingBillingRows ? 'আনা হচ্ছে...' : 'পাতা থেকে সিঙ্ক'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PON Threshold Alert Banner (Real Data) */}
          {summaryStats.alertPons.length > 0 || summaryStats.highLoss > 0 || summaryStats.losOrOffline > 0 ? (
            <div className="px-4 py-2.5 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldAlert className="w-4 h-4 text-rose-300 shrink-0" />
                <span className="font-bold">
                  PON Threshold Alert: মোট {toBengaliNumber(summaryStats.highLoss)}টি ONU &lt; -25 dBm হাই-লস এবং{' '}
                  {toBengaliNumber(summaryStats.losOrOffline)}টি Offline/LOS অবস্থায় রয়েছে
                  {summaryStats.alertPons.length > 0 ? ` (${summaryStats.alertPons.join(', ')})` : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStatusFilter('problem')}
                className="px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-black cursor-pointer shrink-0"
              >
                শুধু সমস্যাজনিত লাইন দেখুন
              </button>
            </div>
          ) : (
            <div className="px-4 py-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                <span className="font-bold">
                  সব PON লাইন স্থিতিশীল — বর্তমানে কোনো হাই অপটিক্যাল লস বা ক্রিটিকাল LOS এলার্ট নেই।
                </span>
              </div>
            </div>
          )}

          {/* Interactive FD1204S-B0 (4-PON) Visual Chassis & PON Heatmap */}
          <div className="rounded-2xl bg-[#0b1026] border border-indigo-500/35 p-4 text-white space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-indigo-100">
                <Activity className="w-4 h-4 text-amber-400" />
                <span>FD1204S-B0 (4-PON) OLT · PON অপটিক্যাল হিটম্যাপ (চাপ দিয়ে PON ফিল্টার করুন)</span>
              </div>
              <span className="text-[11px] font-mono text-indigo-300">SN: AF2704-2110000341</span>
            </div>

            {/* Chassis Front Panel Strip */}
            <div className="rounded-xl bg-[#070b1b] border border-slate-700/80 p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {(['PON1', 'PON2', 'PON3', 'PON4'] as const).map((ponId) => {
                  const b = ponBuckets[ponId];
                  const active = selectedPonFilter === ponId;
                  const hasAlert = b.losCount > 0 || b.highLossCount > 0;
                  return (
                    <button
                      key={ponId}
                      type="button"
                      onClick={() => setSelectedPonFilter(active ? 'ALL' : ponId)}
                      className={`px-3 py-2 rounded-xl border text-left transition-all cursor-pointer min-w-[92px] ${
                        active
                          ? 'bg-cyan-500/25 border-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.4)]'
                          : hasAlert
                          ? 'bg-emerald-950/50 border-rose-400/70 hover:border-rose-300'
                          : 'bg-emerald-950/35 border-emerald-500/50 hover:border-cyan-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[11px] font-black text-emerald-300">{ponId}</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            hasAlert ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'
                          }`}
                        />
                      </div>
                      <div className="text-[11px] font-mono text-slate-200 mt-0.5">
                        {b.online}/{b.total} ONUs
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 text-[10px] font-mono text-slate-300">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> PWR1
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> SYS
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      summaryStats.highLoss + summaryStats.losOrOffline > 0
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-emerald-400'
                    }`}
                  />{' '}
                  ALM
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-200">
                  MGMT UP
                </span>
              </div>
            </div>

            {/* 4 PON Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {(['PON1', 'PON2', 'PON3', 'PON4'] as const).map((ponId) => {
                const b = ponBuckets[ponId];
                const isSelected = selectedPonFilter === ponId;
                const barColor =
                  b.problemRatePct >= 50
                    ? 'bg-rose-500'
                    : b.problemRatePct > 15
                    ? 'bg-amber-400'
                    : 'bg-emerald-400';

                return (
                  <button
                    key={`card-${ponId}`}
                    type="button"
                    onClick={() => setSelectedPonFilter(isSelected ? 'ALL' : ponId)}
                    className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                      isSelected
                        ? 'bg-indigo-950/90 border-cyan-300 ring-2 ring-cyan-400/35'
                        : 'bg-[#080e24] hover:bg-[#0f1738] border-indigo-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-cyan-300">{b.ponId}</span>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-white/10 text-white">
                        {b.avgRxDbm !== null ? `Avg ${b.avgRxDbm} dBm` : 'RX অনির্ধারিত'}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full ${barColor} transition-all`}
                        style={{ width: `${Math.max(8, 100 - b.problemRatePct)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-300 tabular-nums">
                      <span>{b.subtitle}</span>
                      <span className="font-bold text-white">
                        সচল {toBengaliNumber(b.online)}/{toBengaliNumber(b.total)}
                      </span>
                    </div>
                    {(b.highLossCount > 0 || b.losCount > 0) && (
                      <div className="text-[10px] font-bold text-rose-300">
                        হাই লস: {toBengaliNumber(b.highLossCount)} · LOS/বন্ধ: {toBengaliNumber(b.offline)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customer + OLT Live Search Card */}
          <div className="rounded-2xl bg-[#0b1026] border border-indigo-500/35 p-4 text-white space-y-3 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-cyan-300" />
                  <span>Customer + OLT Live Search (সার্চ করলেই পাওয়ার, লস ও সমাধান দেখাবে)</span>
                </h3>
                <p className="text-[11px] text-indigo-200/80 mt-0.5">
                  নাম, আইডি (যেমন DBN-101 / NEBW242), মোবাইল, ঠিকানা, ONU MAC বা PON লিখে সার্চ করুন
                </p>
              </div>
              {canEditCustomer && onUpdateCustomer && (
                <button
                  type="button"
                  onClick={() => {
                    setPasteResultMsg(null);
                    setIsPasteModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-black flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>OLT ডেটা পেস্ট</span>
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-indigo-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Name, ID, Phone, MAC, PON, TJ Box..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-[#070b1b] border border-indigo-500/40 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1 mr-1">
                <Filter className="w-3 h-3" />
                <span>ফিল্টার:</span>
              </span>
              {(
                [
                  ['all', `সবাই (${toBengaliNumber(summaryStats.total)})`],
                  ['problem', `সমস্যাজনিত / Loss (${toBengaliNumber(summaryStats.problem)})`],
                  ['healthy', `স্বাভাবিক Online (${toBengaliNumber(summaryStats.healthy)})`],
                  ['offline', `Offline / LOS (${toBengaliNumber(summaryStats.losOrOffline)})`]
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                    statusFilter === key
                      ? 'bg-cyan-400 text-slate-950 border-white font-black'
                      : 'bg-[#080e24] text-indigo-200 border-indigo-500/35 hover:bg-indigo-950'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* OLT & ONU INFORMATION KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-[#0d1433] border border-indigo-500/35 p-4 text-white">
              <div className="text-xs font-bold text-indigo-200 flex items-center gap-1.5">
                <Router className="w-3.5 h-3.5 text-cyan-300" />
                <span>মোট নিবন্ধিত গ্রাহক / ONU</span>
              </div>
              <div className="text-2xl font-black text-cyan-300 mt-1 tabular-nums">
                {toBengaliNumber(summaryStats.total)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                সিগন্যাল / MAC যুক্ত: {toBengaliNumber(summaryStats.withOnuMac)}টি
              </div>
            </div>

            <div className="rounded-2xl bg-[#0d1433] border border-emerald-500/35 p-4 text-white">
              <div className="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-emerald-300" />
                <span>স্বাভাবিক / Online</span>
              </div>
              <div className="text-2xl font-black text-emerald-300 mt-1 tabular-nums">
                {toBengaliNumber(summaryStats.healthy)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">সুস্থ অপটিক্যাল সিগন্যাল</div>
            </div>

            <div className="rounded-2xl bg-[#0d1433] border border-amber-500/35 p-4 text-white">
              <div className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                <span>হাই লস (&lt; -25 dBm)</span>
              </div>
              <div className="text-2xl font-black text-amber-300 mt-1 tabular-nums">
                {toBengaliNumber(summaryStats.highLoss)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">TJ / স্প্লিটার চেক প্রয়োজন</div>
            </div>

            <div className="rounded-2xl bg-[#0d1433] border border-rose-500/35 p-4 text-white">
              <div className="text-xs font-bold text-rose-200 flex items-center gap-1.5">
                <WifiOff className="w-3.5 h-3.5 text-rose-300" />
                <span>Offline / LOS</span>
              </div>
              <div className="text-2xl font-black text-rose-400 mt-1 tabular-nums">
                {toBengaliNumber(summaryStats.losOrOffline)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                পেন্ডিং অভিযোগ: {toBengaliNumber(pendingComplaints.length)}টি
              </div>
            </div>
          </div>

          {/* Diagnostic ONU Table */}
          {renderOnuDiagnosticTable()}
        </div>
      )}

      {/* TAB 2: DEDICATED FULL ONU DIAGNOSTIC TABLE */}
      {consoleTab === 'onu_table' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#0b1026] border border-indigo-500/35 p-3.5 text-white flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-indigo-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Name, ID, Phone, MAC, PON, TJ..."
                className="w-full pl-10 pr-8 py-2 rounded-xl bg-[#070b1b] border border-indigo-500/40 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['ALL', 'PON1', 'PON2', 'PON3', 'PON4'] as const).map((pon) => (
                <button
                  key={pon}
                  type="button"
                  onClick={() => setSelectedPonFilter(pon)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black border cursor-pointer ${
                    selectedPonFilter === pon
                      ? 'bg-cyan-400 text-slate-950 border-white'
                      : 'bg-[#080e24] text-indigo-200 border-indigo-500/35'
                  }`}
                >
                  {pon === 'ALL' ? 'সব PON' : pon}
                </button>
              ))}
            </div>
          </div>
          {renderOnuDiagnosticTable()}
        </div>
      )}

      {/* TAB 3: EXTERNAL WEB PORTAL LINK & HEALTH CHECK */}
      {consoleTab === 'web_portal' && (
        <div className="space-y-3">
          <div className="bg-gradient-to-r from-[#02122b] via-[#05234d] to-[#04364a] rounded-2xl p-4 text-white border border-cyan-400/35 shadow-lg space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Globe className="w-4 h-4 text-cyan-300" />
                    <span>এক্সটার্নাল সমাধান ওয়েব পোর্টাল লিংক</span>
                  </h3>
                  {health.checking ? (
                    <span className="px-2 py-0.5 rounded-md bg-cyan-400/20 border border-cyan-400/40 text-cyan-200 text-[11px] font-bold flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>টেস্ট হচ্ছে...</span>
                    </span>
                  ) : health.active ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-400/20 border border-emerald-400/50 text-emerald-200 text-[11px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>সচল (HTTP {health.status})</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-rose-500/25 border border-rose-400/60 text-rose-200 text-[11px] font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>
                        {health.status === 404 ? 'সচল হয়নি (HTTP 404)' : 'অফলাইন / সংযোগ নেই'}
                      </span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[11px] text-cyan-200 bg-slate-950/60 border border-cyan-400/30 px-2.5 py-1 rounded-lg truncate max-w-full sm:max-w-lg">
                    {portalUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyUrl(portalUrl, 'portal')}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-cyan-100 text-[11px] font-bold flex items-center gap-1 border border-white/15 cursor-pointer"
                  >
                    {copiedKey === 'portal' ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'portal' ? 'কপি হয়েছে' : 'কপি'}</span>
                  </button>
                  {isDirectorRole && onSavePortalUrl && (
                    <button
                      type="button"
                      onClick={() => setIsEditingUrl((v) => !v)}
                      className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 text-[11px] font-bold flex items-center gap-1 border border-amber-400/40 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{isEditingUrl ? 'বন্ধ' : 'লিংক বদলান'}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsLoadingFrame(true);
                    setReloadNonce((n) => n + 1);
                  }}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 border border-white/20 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${health.checking ? 'animate-spin' : ''}`} />
                  <span>রিফ্রেশ</span>
                </button>
                <a
                  href={portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>নতুন ট্যাবে খুলুন</span>
                </a>
                {isDirectorRole && onOpenCompanySetup && (
                  <button
                    type="button"
                    onClick={onOpenCompanySetup}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-cyan-100 border border-white/20 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>সেটআপ</span>
                  </button>
                )}
              </div>
            </div>

            {saveMessage && (
              <div
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${
                  saveMessage.type === 'success'
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-100'
                    : 'bg-rose-500/20 border-rose-400/50 text-rose-100'
                }`}
              >
                <span>{saveMessage.text}</span>
              </div>
            )}

            {isDirectorRole && onSavePortalUrl && isEditingUrl && (
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-cyan-400/35 space-y-2.5">
                <div className="text-xs font-black text-cyan-200 flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-cyan-300" />
                  <span>পোর্টাল ওয়েব লিংক পরিবর্তন (পরিচালক কন্ট্রোল)</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={draftUrl}
                    onChange={(e) => setDraftUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-cyan-500/40 text-xs font-mono text-white"
                  />
                  <button
                    type="button"
                    disabled={isSavingUrl}
                    onClick={() => void handlePersistUrl(draftUrl)}
                    className="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingUrl ? 'সেভ হচ্ছে...' : 'সেভ করুন'}</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => void handlePersistUrl(DEFAULT_TROUBLESHOOT_PORTAL_URL)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 font-bold cursor-pointer"
                  >
                    ডিফল্ট ERP ও সমাধান লিংক (fyeuetew...)
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-cyan-400/35 bg-slate-950 min-h-[55vh] h-[60vh]">
            {isSelfAppUrl ? (
              <div className="h-full flex items-center justify-center p-6 text-center text-white">
                <div className="max-w-md space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <h4 className="text-base font-black">ERP SYSTEM লিংক সক্রিয় আছে</h4>
                  <p className="text-xs text-slate-300">
                    আপনি ইতিমধ্যেই এই ERP SYSTEM-এর ভেতরেই রয়েছেন। মূল সমাধান কনসোল ব্যবহার করতে প্রথম ট্যাবে ফিরে যান।
                  </p>
                </div>
              </div>
            ) : health.checked && !health.checking && !health.active && !forceShowFrame ? (
              <div className="h-full flex items-center justify-center p-6 text-center text-white">
                <div className="max-w-md space-y-3">
                  <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
                  <h4 className="text-base font-black">
                    এক্সটার্নাল লিংকটি এখনো সচল হয়নি ({health.status === 404 ? 'HTTP 404' : 'অফলাইন'})
                  </h4>
                  <p className="text-xs text-slate-300">
                    বাইরের লিংক অফলাইন থাকলেও এই অ্যাপের বিল্ট-ইন <strong>Overview ও ONU সমাধান কনসোল</strong> পুরোপুরি সচল রয়েছে।
                  </p>
                  <button
                    type="button"
                    onClick={() => setForceShowFrame(true)}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>তবুও ফ্রেম খুলুন</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {isLoadingFrame && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/85 text-cyan-200 text-xs font-bold">
                    পোর্টাল লোড হচ্ছে...
                  </div>
                )}
                <iframe
                  key={`${portalUrl}-${reloadNonce}`}
                  src={portalUrl}
                  title="এক্সটার্নাল পোর্টাল"
                  onLoad={() => setIsLoadingFrame(false)}
                  className="w-full h-full border-0 bg-white"
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* OLT / ONU Bulk Paste Sync Modal */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0d132e] text-white rounded-2xl max-w-2xl w-full border border-indigo-400/50 shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 bg-[#121a3f] border-b border-indigo-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardPaste className="w-5 h-5 text-cyan-300" />
                <div>
                  <h3 className="text-sm font-black">OLT / ONU ডেটা পেস্ট করে দ্রুত সিঙ্ক করুন</h3>
                  <p className="text-[11px] text-indigo-200/80">
                    C-DATA OLT থেকে কপি করা সারি পেস্ট করুন — মেম্বার আইডি, MAC বা ফোন অনুযায়ী অটো আপডেট হবে
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {pasteResultMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold border ${
                    pasteResultMsg.type === 'success'
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-100'
                      : 'bg-rose-500/20 border-rose-400/50 text-rose-100'
                  }`}
                >
                  {pasteResultMsg.text}
                </div>
              )}

              <textarea
                rows={7}
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                placeholder={`উদাহরণ (প্রতি লাইনে একটি ONU):\nPON1, NEBW242, Md Monzur, 00:D5:9E:60:92:46, -16.76 dBm, 3337 meter, Online\nPON1, 5642, Ariful, 00:D3:9F:57:12:58, LOS, 998 meter, Offline dying-gasp`}
                className="w-full p-3 rounded-xl bg-[#070b1b] border border-indigo-500/40 text-xs font-mono text-cyan-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-indigo-200 font-bold">
                  শনাক্তকৃত সারি: {toBengaliNumber(parsedPastePreview.length)} টি
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPasteModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold cursor-pointer"
                  >
                    বন্ধ করুন
                  </button>
                  <button
                    type="button"
                    disabled={isSyncingPaste || parsedPastePreview.length === 0}
                    onClick={() => void handleApplyOltPasteSync()}
                    className="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-slate-950 font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isSyncingPaste ? 'সংরক্ষণ হচ্ছে...' : 'ডাটাবেসে আপডেট করুন'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Full ONU Power, Loss & Repair Diagnosis Modal */}
      <CustomerOnuDetailModal
        customer={activeDetailCustomer}
        onClose={() => setDetailCustomerId(null)}
        onUpdateCustomer={canEditCustomer ? onUpdateCustomer : undefined}
        onCreateComplaint={
          canAddComplaint && onCreateComplaintFromCustomer
            ? (c) => {
                setDetailCustomerId(null);
                onCreateComplaintFromCustomer(c, selectedAssignStaffId || undefined);
              }
            : undefined
        }
        startInEditMode={detailStartEdit}
      />
    </div>
  );
};
