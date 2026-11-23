import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  Wrench,
  Coins,
  UserPlus,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Pin,
  PinOff,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  X,
  Trash2,
  RotateCcw,
  ShieldCheck
} from 'lucide-react';
import {
  CustomerComplaint,
  CustomerDue,
  JoinRequest,
  NotificationControl,
  UserSession
} from '../types';
import type { OfflineSyncState } from '../services/offlineSync';
import { formatCurrency, toBengaliNumber } from '../utils/formatters';
import { useAppUpdate } from '../hooks/useAppUpdate';
import { isNotificationCleared } from '../services/dataService';

const ACK_STORAGE_KEY = 'dip_bhola_notif_ack_ids';
const WINDOW_PIN_STORAGE_KEY = 'dip_bhola_notif_window_pinned';
const ACK_SYNC_EVENT = 'dip-notif-ack-sync';

function loadAckIds(): string[] {
  try {
    const raw = localStorage.getItem(ACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveAckIds(ids: string[]) {
  try {
    localStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(ids.slice(-200)));
    window.dispatchEvent(new CustomEvent(ACK_SYNC_EVENT, { detail: ids }));
  } catch {
    // ignore storage quota errors
  }
}

interface FixedNotificationBarProps {
  currentUser: UserSession;
  complaints: CustomerComplaint[];
  customerDues: CustomerDue[];
  joinRequests: JoinRequest[];
  offlineSyncState: OfflineSyncState;
  notificationControl?: NotificationControl | null;
  toggleWindowNonce?: number;
  onManualSync: () => void;
  onNavigateTab: (tab: string) => void;
  onOpenJoinRequests: () => void;
  onDeleteAllNotifications?: (allKeys: string[]) => Promise<void>;
  onRestoreNotifications?: () => Promise<void>;
}

export const FixedNotificationBar: React.FC<FixedNotificationBarProps> = ({
  currentUser,
  complaints,
  customerDues,
  joinRequests,
  offlineSyncState,
  notificationControl,
  toggleWindowNonce = 0,
  onManualSync,
  onNavigateTab,
  onOpenJoinRequests,
  onDeleteAllNotifications,
  onRestoreNotifications,
}) => {
  const { updateAvailable, openUpdateModal } = useAppUpdate();
  const [acknowledgedIds, setAcknowledgedIds] = useState<string[]>(() => loadAckIds());
  const [isPinnedOpen, setIsPinnedOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(WINDOW_PIN_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [isWindowOpen, setIsWindowOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(WINDOW_PIN_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [activeFilter, setActiveFilter] = useState<'all' | 'complaints' | 'dues' | 'system'>('all');
  const [tickerIndex, setTickerIndex] = useState(0);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (toggleWindowNonce > 0) {
      setIsWindowOpen((prev) => !prev);
    }
  }, [toggleWindowNonce]);

  useEffect(() => {
    const onSync = (e: Event) => {
      const custom = e as CustomEvent<string[]>;
      if (Array.isArray(custom.detail)) {
        setAcknowledgedIds(custom.detail);
      } else {
        setAcknowledgedIds(loadAckIds());
      }
    };
    window.addEventListener(ACK_SYNC_EVENT, onSync);
    return () => window.removeEventListener(ACK_SYNC_EVENT, onSync);
  }, []);

  const isStaffRole = currentUser.role === 'staff';
  const isPartnerRole = currentUser.role === 'partner';
  const isRestrictedRole = isStaffRole || isPartnerRole;
  // STRICT: Only Admin / Director can Delete All Notifications
  const isAdminOnly = currentUser.role === 'admin' || currentUser.role === 'director';

  const urgentComplaints = useMemo(() => {
    const priorityRank: Record<string, number> = { critical: 0, urgent: 1, normal: 2 };
    return (complaints || [])
      .filter((c) => {
        if (c.status === 'resolved') return false;
        if (isNotificationCleared(`cmp-${c.id}`, c.updatedAt || c.createdAt, notificationControl)) {
          return false;
        }
        if (isStaffRole) {
          return (
            c.assignedStaffId === currentUser.id ||
            (c.assignedStaffName || '').trim() === currentUser.name.trim() ||
            c.reportedById === currentUser.id
          );
        }
        return true;
      })
      .sort((a, b) => (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2));
  }, [complaints, isStaffRole, currentUser, notificationControl]);

  const urgentDues = useMemo(() => {
    if (isStaffRole) return [];
    return (customerDues || [])
      .filter((d) => {
        if ((d.currentDue || 0) <= 0) return false;
        return !isNotificationCleared(`due-${d.id}`, d.updatedAt, notificationControl);
      })
      .sort((a, b) => (b.currentDue || 0) - (a.currentDue || 0));
  }, [customerDues, isStaffRole, notificationControl]);

  const pendingJoinRequests = useMemo(() => {
    if (isRestrictedRole) return [];
    return (joinRequests || []).filter(
      (r) =>
        r.status === 'pending' &&
        !isNotificationCleared(`join-${r.id}`, r.createdAt, notificationControl)
    );
  }, [joinRequests, isRestrictedRole, notificationControl]);

  const totalDueAmount = useMemo(
    () => urgentDues.reduce((sum, d) => sum + (d.currentDue || 0), 0),
    [urgentDues]
  );

  // Build unified live feed items so the fixed strip & fixed window stay informative
  const feedItems = useMemo(() => {
    const items: Array<{
      key: string;
      kind: 'complaint' | 'due' | 'join' | 'sync' | 'update';
      badge: string;
      title: string;
      subtitle: string;
      urgent: boolean;
      onClick: () => void;
    }> = [];

    if (
      (!offlineSyncState.isOnline || offlineSyncState.pendingCount > 0) &&
      !isNotificationCleared('sys-offline-sync', undefined, notificationControl)
    ) {
      items.push({
        key: 'sys-offline-sync',
        kind: 'sync',
        badge: !offlineSyncState.isOnline ? 'অফলাইন মোড' : 'অটো সিঙ্ক',
        title: !offlineSyncState.isOnline
          ? `অফলাইন (${toBengaliNumber(offlineSyncState.pendingCount)}টি সিঙ্ক বাকি)`
          : `${toBengaliNumber(offlineSyncState.pendingCount)}টি অফলাইন এন্ট্রি সিঙ্ক হচ্ছে`,
        subtitle: !offlineSyncState.isOnline
          ? 'এন্ট্রি সংরক্ষিত আছে — ইন্টারনেট আসলেই অটো অনলাইন হয়ে যাবে।'
          : 'ক্লাউডের সাথে অটোমেটিক সিঙ্ক চলছে বা চাপ দিয়ে এখনই সিঙ্ক করুন।',
        urgent: true,
        onClick: () => onManualSync(),
      });
    }

    if (isAdminOnly && updateAvailable && !isNotificationCleared('sys-app-update', undefined, notificationControl)) {
      items.push({
        key: 'sys-app-update',
        kind: 'update',
        badge: 'নতুন আপডেট',
        title: 'অ্যাপের নতুন ভার্সন পাওয়া গেছে',
        subtitle: '১-ক্লিকে নতুন ফিচার আপডেট করতে এখানে ট্যাপ করুন।',
        urgent: true,
        onClick: () => openUpdateModal(),
      });
    }

    pendingJoinRequests.forEach((req) => {
      items.push({
        key: `join-${req.id}`,
        kind: 'join',
        badge: req.role === 'partner' ? 'পার্টনার আবেদন' : 'স্টাফ আবেদন',
        title: `${req.name} (${req.phone})`,
        subtitle: req.designationOrRole || (req.role === 'partner' ? 'শেয়ার অংশীদার হিসেবে যোগদান আবেদন' : 'নতুন স্টাফ যোগদান আবেদন'),
        urgent: true,
        onClick: () => {
          if (!isPinnedOpen) setIsWindowOpen(false);
          onOpenJoinRequests();
        },
      });
    });

    urgentComplaints.forEach((cmp) => {
      items.push({
        key: `cmp-${cmp.id}`,
        kind: 'complaint',
        badge: cmp.priority === 'critical' ? 'অতি জরুরি' : cmp.priority === 'urgent' ? 'জরুরি' : 'অভিযোগ',
        title: `${cmp.name} (${cmp.idNumber})`,
        subtitle: `${cmp.complainDetails} · ${cmp.address}`,
        urgent: cmp.priority === 'critical' || cmp.priority === 'urgent',
        onClick: () => {
          if (isStaffRole) {
            setIsWindowOpen(true);
            return;
          }
          if (!isPinnedOpen) setIsWindowOpen(false);
          onNavigateTab('complaints');
        },
      });
    });

    urgentDues.forEach((due) => {
      items.push({
        key: `due-${due.id}`,
        kind: 'due',
        badge: formatCurrency(due.currentDue),
        title: `বকেয়া: ${due.customerName}`,
        subtitle: `${due.phone || 'নম্বর নেই'} · ${due.address || 'ঠিকানা নেই'}`,
        urgent: (due.currentDue || 0) >= 1000,
        onClick: () => {
          if (!isPinnedOpen) setIsWindowOpen(false);
          onNavigateTab('dues');
        },
      });
    });

    return items;
  }, [
    offlineSyncState,
    updateAvailable,
    pendingJoinRequests,
    urgentComplaints,
    urgentDues,
    notificationControl,
    isAdminOnly,
    isStaffRole,
    isPinnedOpen,
    onManualSync,
    openUpdateModal,
    onOpenJoinRequests,
    onNavigateTab,
  ]);

  const unacknowledgedItems = useMemo(
    () => feedItems.filter((item) => !acknowledgedIds.includes(item.key)),
    [feedItems, acknowledgedIds]
  );

  // Cycle headline notification every 4 seconds inside the slim fixed bar
  useEffect(() => {
    if (feedItems.length <= 1) {
      setTickerIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % feedItems.length);
    }, 4200);
    return () => clearInterval(timer);
  }, [feedItems.length]);

  const currentHeadline = feedItems[tickerIndex % Math.max(feedItems.length, 1)] || null;

  const filteredItems = useMemo(() => {
    return feedItems.filter((item) => {
      if (activeFilter === 'complaints') return item.kind === 'complaint';
      if (activeFilter === 'dues') return item.kind === 'due';
      if (activeFilter === 'system') return item.kind === 'join' || item.kind === 'sync' || item.kind === 'update';
      return true;
    });
  }, [feedItems, activeFilter]);

  const handleTogglePin = () => {
    const nextPinned = !isPinnedOpen;
    setIsPinnedOpen(nextPinned);
    setIsWindowOpen(nextPinned);
    try {
      localStorage.setItem(WINDOW_PIN_STORAGE_KEY, nextPinned ? 'true' : 'false');
    } catch {
      // ignore
    }
  };

  const handleAcknowledgeAll = () => {
    const next = Array.from(new Set([...acknowledgedIds, ...feedItems.map((i) => i.key)]));
    setAcknowledgedIds(next);
    saveAckIds(next);
  };

  const handleConfirmDeleteAll = async () => {
    if (!isAdminOnly || !onDeleteAllNotifications) return;
    try {
      setIsDeletingAll(true);
      const allKeys = feedItems.map((i) => i.key);
      await onDeleteAllNotifications(allKeys);
      setAcknowledgedIds([]);
      saveAckIds([]);
      setConfirmDeleteAll(false);
      setDeleteFeedback('সকল নোটিফিকেশন সফলভাবে ডিলিট ও পরিষ্কার করা হয়েছে।');
      setTimeout(() => setDeleteFeedback(null), 4000);
    } catch (err) {
      console.error('Error deleting all notifications:', err);
      setDeleteFeedback('নোটিফিকেশন ডিলিট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
      setTimeout(() => setDeleteFeedback(null), 4000);
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleRestoreAll = async () => {
    if (!isAdminOnly || !onRestoreNotifications) return;
    try {
      setIsDeletingAll(true);
      await onRestoreNotifications();
      setDeleteFeedback('পূর্বের সক্রিয় নোটিফিকেশন পুনরুদ্ধার করা হয়েছে।');
      setTimeout(() => setDeleteFeedback(null), 3500);
    } finally {
      setIsDeletingAll(false);
    }
  };

  const unreadCount = unacknowledgedItems.length;
  const totalCount = feedItems.length;

  return (
    <div className="relative w-full print:hidden select-none">
      {/* ALWAYS-VISIBLE FIXED NOTIFICATION DOCK BAR RIGHT BELOW DIGITAL DISPLAY */}
      <div
        className={`w-full border-b px-2.5 sm:px-4 py-1.5 transition-colors ${
          unreadCount > 0
            ? 'bg-gradient-to-r from-[#2c0915] via-[#3a120a] to-[#041d42] border-rose-500/50 text-white'
            : 'bg-gradient-to-r from-[#020a18] via-[#041a3b] to-[#020e21] border-cyan-400/30 text-cyan-50'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* LEFT: Fixed Notification App Badge + Unread Count */}
          <button
            type="button"
            onClick={() => setIsWindowOpen((o) => !o)}
            className="flex items-center gap-1.5 shrink-0 cursor-pointer group"
            title="নোটিফিকেশন ফিক্সড উইন্ডো খুলুন/বন্ধ করুন"
          >
            <span
              className={`relative w-7 h-7 rounded-lg flex items-center justify-center shadow-sm transition-transform group-hover:scale-105 ${
                unreadCount > 0
                  ? 'bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 text-white'
                  : 'bg-gradient-to-br from-cyan-400 to-sky-500 text-slate-950'
              }`}
            >
              {unreadCount > 0 ? (
                <BellRing className="w-4 h-4 animate-pulse" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-300 animate-ping" />
              )}
            </span>

            <span className="text-xs sm:text-sm font-black tracking-tight flex items-center gap-1.5">
              <span>নোটিফিকেশন</span>
              <span
                className={`px-2 py-0.5 rounded-md text-xs font-black tabular-nums ${
                  unreadCount > 0
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/45'
                }`}
              >
                {unreadCount > 0 ? toBengaliNumber(unreadCount) : '০'}
              </span>
            </span>
          </button>

          {/* CENTER: Live Fixed Notification Strip Headline + Category Quick Chips */}
          <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
            {currentHeadline ? (
              <button
                type="button"
                onClick={currentHeadline.onClick}
                className="flex-1 min-w-0 flex items-center gap-1.5 text-left px-2.5 py-0.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/25 transition-colors cursor-pointer"
                title="বিস্তারিত দেখতে ক্লিক করুন"
              >
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-black shrink-0 ${
                    currentHeadline.kind === 'complaint'
                      ? 'bg-rose-500 text-white'
                      : currentHeadline.kind === 'due'
                      ? 'bg-amber-400 text-slate-950'
                      : currentHeadline.kind === 'join'
                      ? 'bg-violet-500 text-white'
                      : 'bg-cyan-400 text-slate-950'
                  }`}
                >
                  {currentHeadline.badge}
                </span>
                <span className="text-xs sm:text-sm font-bold text-white truncate">
                  {currentHeadline.title} — <span className="text-cyan-100/85 font-medium">{currentHeadline.subtitle}</span>
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-cyan-200 truncate px-1">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="truncate">সব স্বাভাবিক আছে — কোনো পেন্ডিং অভিযোগ বা জরুরি নোটিফিকেশন নেই</span>
              </div>
            )}

            {/* Quick Category Pills (Desktop / Tablet) */}
            <div className="hidden md:flex items-center gap-1 shrink-0 text-[10px] font-black">
              {urgentComplaints.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter('complaints');
                    setIsWindowOpen(true);
                  }}
                  className="px-2 py-0.5 rounded-md bg-rose-600/80 hover:bg-rose-500 text-white border border-rose-400/50 transition-colors cursor-pointer tabular-nums"
                >
                  অভিযোগ: {toBengaliNumber(urgentComplaints.length)}
                </button>
              )}
              {!isStaffRole && urgentDues.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter('dues');
                    setIsWindowOpen(true);
                  }}
                  className="px-2 py-0.5 rounded-md bg-amber-500/85 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer tabular-nums"
                >
                  বাকি: {toBengaliNumber(urgentDues.length)}
                </button>
              )}
              {pendingJoinRequests.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter('system');
                    setIsWindowOpen(true);
                  }}
                  className="px-2 py-0.5 rounded-md bg-violet-600 hover:bg-violet-500 text-white transition-colors cursor-pointer tabular-nums"
                >
                  আবেদন: {toBengaliNumber(pendingJoinRequests.length)}
                </button>
              )}
            </div>
          </div>

          {/* RIGHT: Fixed Window Toggle + Pin + Read All + Admin Delete All */}
          <div className="flex items-center gap-1 shrink-0">
            {isAdminOnly && totalCount > 0 && onDeleteAllNotifications && (
              <button
                type="button"
                onClick={() => {
                  setIsWindowOpen(true);
                  setConfirmDeleteAll(true);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white border border-rose-300/60 text-[10px] font-black shadow-xs transition-colors cursor-pointer"
                title="অ্যাডমিন: সব নোটিফিকেশন একসাথে ডিলিট করুন"
              >
                <Trash2 className="w-3 h-3" />
                <span className="hidden sm:inline">অল ডিলিট</span>
              </button>
            )}

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleAcknowledgeAll}
                className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/40 text-[10px] font-bold transition-colors cursor-pointer"
                title="সব নোটিফিকেশন দেখা হয়েছে চিহ্নিত করুন"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>সব দেখা</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleTogglePin}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                isPinnedOpen
                  ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-xs'
                  : 'bg-white/10 hover:bg-white/20 text-slate-100 border-white/20'
              }`}
              title={isPinnedOpen ? 'ফিক্সড উইন্ডো আনপিন করুন' : 'নোটিফিকেশন উইন্ডো সবসময় পিন করে রাখুন'}
            >
              {isPinnedOpen ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
              <span className="hidden sm:inline">{isPinnedOpen ? 'পিন করা' : 'পিন উইন্ডো'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsWindowOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-cyan-400 text-slate-950 hover:bg-cyan-300 text-[11px] sm:text-xs font-black shadow-xs transition-colors cursor-pointer"
              title={isWindowOpen ? 'উইন্ডো ছোট করুন' : 'নোটিফিকেশন উইন্ডো খুলুন'}
            >
              <span>{isWindowOpen ? 'লুকান' : `উইন্ডো (${toBengaliNumber(totalCount)})`}</span>
              {isWindowOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* EXPANDED FIXED NOTIFICATION WINDOW DIRECTLY BELOW DIGITAL DISPLAY */}
      {isWindowOpen && (
        <div
          className={`${
            isPinnedOpen
              ? 'relative w-full'
              : 'absolute left-0 right-0 top-full z-50 px-2 sm:px-4 pt-1'
          }`}
        >
          <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-b-2xl sm:rounded-2xl shadow-2xl border-2 border-cyan-500/45 overflow-hidden">
            {/* Fixed Window Header */}
            <div className="px-3.5 py-2.5 bg-gradient-to-r from-[#020a18] via-[#041d42] to-[#020e21] text-white flex flex-wrap items-center justify-between gap-2 border-b border-cyan-400/35">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 flex items-center justify-center shadow-md shrink-0">
                  <AlertTriangle className="w-4 h-4 text-white" />
                </span>
                <div>
                  <h3 className="text-xs sm:text-sm font-black flex items-center gap-1.5">
                    <span>ফিক্সড নোটিফিকেশন উইন্ডো</span>
                    <span className="px-1.5 py-0.2 rounded bg-cyan-400 text-slate-950 text-[9px] font-black">
                      LIVE
                    </span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-cyan-200/90">
                    ডিজিটাল ডিসপ্লের নিচে স্থায়ী সতর্কতা কেন্দ্র · অভিযোগ, বাকি ও সিঙ্ক স্ট্যাটাস
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleTogglePin}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer ${
                    isPinnedOpen
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-white/15 hover:bg-white/25 text-white'
                  }`}
                >
                  {isPinnedOpen ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                  <span>{isPinnedOpen ? 'আনপিন' : 'সবসময় পিন রাখুন'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPinnedOpen(false);
                    setIsWindowOpen(false);
                    try {
                      localStorage.setItem(WINDOW_PIN_STORAGE_KEY, 'false');
                    } catch {
                      // ignore
                    }
                  }}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-rose-600 text-white transition-colors cursor-pointer"
                  aria-label="উইন্ডো বন্ধ করুন"
                  title="বন্ধ করুন"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold whitespace-nowrap cursor-pointer ${
                    activeFilter === 'all'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  সব ({toBengaliNumber(feedItems.length)})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('complaints')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold whitespace-nowrap cursor-pointer ${
                    activeFilter === 'complaints'
                      ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  অভিযোগ ({toBengaliNumber(urgentComplaints.length)})
                </button>
                {!isStaffRole && (
                  <button
                    type="button"
                    onClick={() => setActiveFilter('dues')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold whitespace-nowrap cursor-pointer ${
                      activeFilter === 'dues'
                        ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    বাকি ({toBengaliNumber(urgentDues.length)})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveFilter('system')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold whitespace-nowrap cursor-pointer ${
                    activeFilter === 'system'
                      ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  আবেদন ও সিঙ্ক
                </button>
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleAcknowledgeAll}
                    className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline px-2 cursor-pointer whitespace-nowrap"
                  >
                    সব দেখা হয়েছে চিহ্নিত করুন
                  </button>
                )}

                {isAdminOnly && totalCount > 0 && onDeleteAllNotifications && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteAll((c) => !c)}
                    disabled={isDeletingAll}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                    title="শুধুমাত্র অ্যাডমিন সব নোটিফিকেশন একসাথে ডিলিট করতে পারবেন"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>অল নোটিফিকেশন ডিলিট</span>
                  </button>
                )}
              </div>
            </div>

            {/* Inline Admin Delete All Confirmation Banner */}
            {isAdminOnly && confirmDeleteAll && totalCount > 0 && (
              <div className="px-3.5 py-2.5 bg-rose-50 dark:bg-rose-950/50 border-b border-rose-200 dark:border-rose-800/70 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-start gap-2 text-rose-900 dark:text-rose-200">
                  <ShieldCheck className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black">অ্যাডমিন নিশ্চিতকরণ: </span>
                    <span>
                      আপনি কি সব <strong>{toBengaliNumber(totalCount)}টি</strong> নোটিফিকেশন ডিলিট করতে চান? (মূল হিসাব ও বাকি খাতা অক্ষত থাকবে, শুধু নোটিফিকেশন ও ডিজিটাল ডিসপ্লে ৩য় সারি থেকে মুছে যাবে)
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleConfirmDeleteAll}
                    disabled={isDeletingAll}
                    className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    {isDeletingAll ? 'ডিলিট হচ্ছে...' : 'হ্যাঁ, অল ডিলিট করুন'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteAll(false)}
                    disabled={isDeletingAll}
                    className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold text-[11px] cursor-pointer"
                  >
                    বাতিল
                  </button>
                </div>
              </div>
            )}

            {/* Delete / Restore Inline Feedback Banner */}
            {deleteFeedback && (
              <div className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/50 border-b border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{deleteFeedback}</span>
              </div>
            )}

            {/* Notification Scrollable List */}
            <div className="max-h-60 sm:max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                    এই মুহূর্তে কোনো নতুন নোটিফিকেশন নেই
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    নতুন অভিযোগ, বাকি বিল বা স্টাফ আবেদন এলেই এখানে তাৎক্ষণিক দেখাবে।
                  </p>
                  {isAdminOnly && notificationControl?.clearedAt && onRestoreNotifications && (
                    <div className="pt-1 flex flex-col items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">
                        অ্যাডমিন ({notificationControl.clearedBy || 'পরিচালক'}) কর্তৃক পূর্বের নোটিফিকেশন ডিলিট করা হয়েছে
                      </span>
                      <button
                        type="button"
                        onClick={handleRestoreAll}
                        disabled={isDeletingAll}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-[10px] font-bold cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>পূর্বের সক্রিয় নোটিফিকেশন পুনরুদ্ধার করুন</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isAck = acknowledgedIds.includes(item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={item.onClick}
                      className={`w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors flex items-start gap-3 cursor-pointer ${
                        isAck ? 'opacity-65' : 'bg-amber-50/20 dark:bg-emerald-950/10'
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-white shadow-xs ${
                          item.kind === 'complaint'
                            ? 'bg-gradient-to-br from-rose-500 to-orange-600'
                            : item.kind === 'due'
                            ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                            : item.kind === 'join'
                            ? 'bg-gradient-to-br from-violet-500 to-purple-600'
                            : item.kind === 'update'
                            ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                            : 'bg-gradient-to-br from-cyan-500 to-blue-600'
                        }`}
                      >
                        {item.kind === 'complaint' ? (
                          <Wrench className="w-4 h-4" />
                        ) : item.kind === 'due' ? (
                          <Coins className="w-4 h-4" />
                        ) : item.kind === 'join' ? (
                          <UserPlus className="w-4 h-4" />
                        ) : item.kind === 'update' ? (
                          <Sparkles className="w-4 h-4" />
                        ) : !offlineSyncState.isOnline ? (
                          <WifiOff className="w-4 h-4" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                            {item.title}
                          </span>
                          <span
                            className={`text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 ${
                              item.kind === 'complaint'
                                ? 'bg-rose-600 text-white'
                                : item.kind === 'due'
                                ? 'bg-amber-500 text-slate-950'
                                : item.kind === 'join'
                                ? 'bg-violet-600 text-white'
                                : 'bg-cyan-600 text-white'
                            }`}
                          >
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5">
                          {item.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer Summary & Quick Links */}
            <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                {!isStaffRole
                  ? `পেন্ডিং অভিযোগ: ${toBengaliNumber(urgentComplaints.length)} · মোট বকেয়া: ${formatCurrency(totalDueAmount)}`
                  : `নির্ধারিত অভিযোগ: ${toBengaliNumber(urgentComplaints.length)}টি`}
              </div>
              <div className="flex items-center gap-1.5">
                {!isStaffRole ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isPinnedOpen) setIsWindowOpen(false);
                        onNavigateTab('complaints');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>অভিযোগ</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isPinnedOpen) setIsWindowOpen(false);
                        onNavigateTab('dues');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>বাকি খাতা</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!isPinnedOpen) setIsWindowOpen(false);
                      onNavigateTab('display');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>ডিজিটাল ডিসপ্লে</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
