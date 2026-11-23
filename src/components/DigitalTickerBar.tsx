import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Edit3,
  Clock,
  Eye,
  BellRing,
  Bell,
  Pause,
  Play,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  DigitalNotice,
  DisplayColor,
  DisplayFontSize,
  DisplaySpeed,
  Company,
  Partner,
  Transaction,
  UserSession,
  CustomerComplaint,
  CustomerDue,
  JoinRequest,
  NotificationControl
} from '../types';
import type { OfflineSyncState } from '../services/offlineSync';
import { isNotificationCleared } from '../services/dataService';
import { toBengaliNumber, formatCurrency } from '../utils/formatters';

export const DISPLAY_SPEED_PX_PRESETS: Record<DisplaySpeed, number> = {
  veryslow: 14,
  slow: 22,
  normal: 30,
  fast: 46,
};

export function resolveDisplayPxPerSec(notice?: Partial<DigitalNotice> | null): number {
  if (
    typeof notice?.customSpeedPxPerSec === 'number' &&
    Number.isFinite(notice.customSpeedPxPerSec)
  ) {
    return Math.min(100, Math.max(8, notice.customSpeedPxPerSec));
  }
  const preset = notice?.speed || 'slow';
  return DISPLAY_SPEED_PX_PRESETS[preset] || DISPLAY_SPEED_PX_PRESETS.slow;
}

export function resolveRow3PxPerSec(notice?: Partial<DigitalNotice> | null): number {
  if (
    typeof notice?.row3SpeedPxPerSec === 'number' &&
    Number.isFinite(notice.row3SpeedPxPerSec)
  ) {
    return Math.min(60, Math.max(8, notice.row3SpeedPxPerSec));
  }
  // Even if main notice uses legacy 'normal' in Firestore, keep Row 3 ultra gentle by default
  const preset = notice?.speed;
  if (preset === 'veryslow') return 11;
  if (preset === 'fast') return 26;
  return 16;
}

interface SmoothMarqueeTrackProps {
  pxPerSec: number;
  isSteady: boolean;
  isPaused: boolean;
  pauseOnHover: boolean;
  children: React.ReactNode;
}

const SmoothMarqueeTrack: React.FC<SmoothMarqueeTrackProps> = ({
  pxPerSec,
  isSteady,
  isPaused,
  pauseOnHover,
  children,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [durationSec, setDurationSec] = useState<number>(48);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || isSteady) return;

    const recalc = () => {
      // Track renders 2 identical halves; travelling -50% covers exact 1 copy width
      const singleLoopPx = Math.max(320, el.scrollWidth / 2);
      const safeVelocity = Math.max(8, pxPerSec);
      // Never cap duration artificially — preserve exact Admin px/s velocity!
      const sec = Math.max(10, singleLoopPx / safeVelocity);
      setDurationSec(sec);
    };

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pxPerSec, isSteady, children]);

  const effectivePaused = isPaused || (pauseOnHover && isHovered);

  if (isSteady) {
    return (
      <div className="w-full overflow-x-auto no-scrollbar flex items-center py-0.5">
        <div className="whitespace-nowrap inline-flex items-center">{children}</div>
      </div>
    );
  }

  return (
    <div
      className="w-full overflow-hidden relative flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        ref={trackRef}
        className="whitespace-nowrap inline-flex items-center will-change-transform"
        style={{
          animationName: 'dip-smooth-marquee',
          animationDuration: `${durationSec.toFixed(1)}s`,
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
          animationPlayState: effectivePaused ? 'paused' : 'running',
        }}
      >
        <div className="inline-flex items-center shrink-0 pr-12">{children}</div>
        <div className="inline-flex items-center shrink-0 pr-12" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
};

interface DigitalTickerBarProps {
  notice: DigitalNotice;
  company?: Company | null;
  partners?: Partner[];
  transactions?: Transaction[];
  complaints?: CustomerComplaint[];
  customerDues?: CustomerDue[];
  joinRequests?: JoinRequest[];
  offlineSyncState?: OfflineSyncState;
  notificationControl?: NotificationControl | null;
  currentUser?: UserSession;
  onOpenDisplayTab: () => void;
  onToggleNotificationWindow?: () => void;
}

function formatBengaliClockStrings(date: Date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ampm = hours >= 12 ? 'অপরাহ্ন' : 'পূর্বাহ্ন';
  const displayHours = hours % 12 || 12;
  const padZero = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const bengaliTime = `${toBengaliNumber(padZero(displayHours))}:${toBengaliNumber(padZero(minutes))}:${toBengaliNumber(padZero(seconds))} ${ampm}`;
  const months = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  const days = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
  const formattedDate = `${toBengaliNumber(date.getDate())} ${months[date.getMonth()]} ${toBengaliNumber(date.getFullYear())}, ${days[date.getDay()]}`;
  return { bengaliTime, formattedDate };
}

const LiveTickerClockPanel = React.memo(() => {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const { bengaliTime, formattedDate } = formatBengaliClockStrings(now);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#020c1e]/95 border border-cyan-400/45 shadow-[0_0_16px_rgba(56,189,248,0.28)] font-mono shrink-0">
      <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-300 animate-pulse shrink-0" />
      <div className="flex flex-col text-left leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="text-sm sm:text-base font-black text-amber-300 tracking-wider">
            {bengaliTime}
          </span>
          <span className="text-[11px] font-bold px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-200 border border-cyan-400/45 font-sans">
            সময়
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-cyan-200 tracking-tight font-sans">
          <span className="text-slate-400">তারিখ:</span>
          <span>{formattedDate}</span>
        </div>
      </div>
    </div>
  );
});

const LiveTickerClockInline = React.memo(() => {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const { bengaliTime, formattedDate } = formatBengaliClockStrings(now);

  return (
    <span className="mx-5 text-amber-400 font-black text-xs sm:text-sm px-2.5 py-0.5 rounded-lg bg-amber-950/70 border border-amber-500/50">
      ⏰ সময়: {bengaliTime} • 📅 তারিখ: {formattedDate}
    </span>
  );
});

export const DigitalTickerBar: React.FC<DigitalTickerBarProps> = ({
  notice,
  company,
  partners = [],
  transactions = [],
  complaints = [],
  customerDues = [],
  joinRequests = [],
  offlineSyncState,
  notificationControl,
  currentUser,
  onOpenDisplayTab,
  onToggleNotificationWindow,
}) => {
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [spotlightIndex, setSpotlightIndex] = useState(0);

  // Calculate Net Profit/Loss and Today's Summary for Live Ticker
  const { netBalance, todaySummary } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    const today = new Date().toISOString().split('T')[0];
    let todayInc = 0;
    let todayExp = 0;

    (transactions || []).forEach((t) => {
      if (t.type === 'income') inc += t.amount;
      else exp += t.amount;

      if (t.date === today) {
        if (t.type === 'income') todayInc += t.amount;
        else todayExp += t.amount;
      }
    });

    return {
      netBalance: inc - exp,
      todaySummary: {
        income: todayInc,
        expense: todayExp,
        net: todayInc - todayExp
      }
    };
  }, [transactions]);

  // Build Row 3 Live Notification items (scoped for Staff vs Director/Manager/Partner)
  const { row3Alerts, activeAlertCount } = useMemo(() => {
    const isStaff = currentUser?.role === 'staff';
    const isRestricted = isStaff || currentUser?.role === 'partner';
    const alerts: Array<{ id: string; badge: string; text: string; tone: 'rose' | 'amber' | 'violet' | 'cyan' }> = [];

    if (
      offlineSyncState &&
      (!offlineSyncState.isOnline || offlineSyncState.pendingCount > 0) &&
      !isNotificationCleared('sys-offline-sync', undefined, notificationControl)
    ) {
      alerts.push({
        id: 'sync-status',
        badge: !offlineSyncState.isOnline ? 'অফলাইন মোড' : 'অটো-সিঙ্ক',
        text: !offlineSyncState.isOnline
          ? `ইন্টারনেট নেই — ${toBengaliNumber(offlineSyncState.pendingCount)}টি এন্ট্রি সংরক্ষিত আছে, অনলাইনে আসলেই সিঙ্ক হবে`
          : `${toBengaliNumber(offlineSyncState.pendingCount)}টি অফলাইন এন্ট্রি অনলাইন হচ্ছে`,
        tone: 'cyan',
      });
    }

    if (!isRestricted) {
      const pendingJoins = (joinRequests || []).filter(
        (r) =>
          r.status === 'pending' &&
          !isNotificationCleared(`join-${r.id}`, r.createdAt, notificationControl)
      );
      pendingJoins.forEach((req) => {
        alerts.push({
          id: `join-${req.id}`,
          badge: req.role === 'partner' ? 'পার্টনার আবেদন' : 'স্টাফ আবেদন',
          text: `${req.name} (${req.phone}) যোগদানের আবেদন করেছেন`,
          tone: 'violet',
        });
      });
    }

    const priorityRank: Record<string, number> = { critical: 0, urgent: 1, normal: 2 };
    const activeComplaints = (complaints || [])
      .filter((c) => {
        if (c.status === 'resolved') return false;
        if (isNotificationCleared(`cmp-${c.id}`, c.updatedAt || c.createdAt, notificationControl)) {
          return false;
        }
        if (isStaff && currentUser) {
          return (
            c.assignedStaffId === currentUser.id ||
            (c.assignedStaffName || '').trim() === currentUser.name.trim() ||
            c.reportedById === currentUser.id
          );
        }
        return true;
      })
      .sort((a, b) => (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2));

    activeComplaints.forEach((c) => {
      alerts.push({
        id: `cmp-${c.id}`,
        badge: c.priority === 'critical' ? 'অতি জরুরি অভিযোগ' : c.priority === 'urgent' ? 'জরুরি অভিযোগ' : 'অভিযোগ',
        text: `${c.name} (#${c.idNumber}) · ${c.complainDetails} [${c.address}]`,
        tone: 'rose',
      });
    });

    if (!isStaff) {
      const dueList = (customerDues || [])
        .filter(
          (d) =>
            (d.currentDue || 0) > 0 &&
            !isNotificationCleared(`due-${d.id}`, d.updatedAt, notificationControl)
        )
        .sort((a, b) => (b.currentDue || 0) - (a.currentDue || 0));
      dueList.slice(0, 8).forEach((d) => {
        alerts.push({
          id: `due-${d.id}`,
          badge: `বকেয়া ${formatCurrency(d.currentDue)}`,
          text: `${d.customerName} (${d.phone || 'নম্বর নেই'}) · ${d.address || 'ভোলা'}`,
          tone: 'amber',
        });
      });
    }

    return {
      row3Alerts: alerts,
      activeAlertCount: alerts.length,
    };
  }, [complaints, customerDues, joinRequests, offlineSyncState, notificationControl, currentUser]);

  const defaultLine1 = 'স্বাগতম! DIP BHOLA NETWORK কেন্দ্রীয় সার্ভার ও হাই-স্পিড অপটিক্যাল ফাইবার সংযোগ • নিরবচ্ছিন্ন ইন্টারনেট সেবা';
  const defaultLine2 = 'সার্ভিস মনিটরিং সক্রিয় • জরুরি লাইন মেরামত ও ২৪ ঘণ্টা হেল্পলাইন: ০১৭২১২০০০৪৯ • ৩নং পশ্চিম ইলিশা, ভোলা';

  const line1Text = notice?.text?.trim() || defaultLine1;
  const line2Text = notice?.subText?.trim() || defaultLine2;

  const colorStyles: Record<DisplayColor, {
    primaryText: string;
    subText: string;
    bg: string;
    dot: string;
    border: string;
    glow: string;
    accentPill: string;
  }> = {
    emerald: {
      primaryText: 'text-cyan-300 drop-shadow-[0_0_14px_rgba(56,189,248,0.95)]',
      subText: 'text-sky-200 drop-shadow-[0_0_10px_rgba(125,211,252,0.85)]',
      bg: 'bg-gradient-to-r from-[#020a18] via-[#041d42] to-[#020e21]',
      dot: 'bg-cyan-400 shadow-[0_0_12px_#38bdf8]',
      border: 'border-cyan-400/45',
      glow: 'shadow-[0_0_24px_rgba(56,189,248,0.28)]',
      accentPill: 'bg-[#031632]/95 text-cyan-100 border-cyan-400/55'
    },
    amber: {
      primaryText: 'text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.95)]',
      subText: 'text-yellow-200 drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]',
      bg: 'bg-gradient-to-r from-[#291701] via-[#3d2303] to-[#291701]',
      dot: 'bg-amber-400 shadow-[0_0_10px_#fbbf24]',
      border: 'border-amber-700/80',
      glow: 'shadow-[0_0_20px_rgba(217,119,6,0.3)]',
      accentPill: 'bg-amber-900/90 text-amber-200 border-amber-500/50'
    },
    cyan: {
      primaryText: 'text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.95)]',
      subText: 'text-sky-200 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]',
      bg: 'bg-gradient-to-r from-[#022129] via-[#04333f] to-[#022129]',
      dot: 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]',
      border: 'border-cyan-700/80',
      glow: 'shadow-[0_0_20px_rgba(8,145,178,0.3)]',
      accentPill: 'bg-cyan-900/90 text-cyan-200 border-cyan-500/50'
    },
    rose: {
      primaryText: 'text-rose-300 drop-shadow-[0_0_12px_rgba(251,113,133,0.95)]',
      subText: 'text-pink-200 drop-shadow-[0_0_8px_rgba(244,114,182,0.8)]',
      bg: 'bg-gradient-to-r from-[#2b030b] via-[#400612] to-[#2b030b]',
      dot: 'bg-rose-400 shadow-[0_0_10px_#fb7185]',
      border: 'border-rose-700/80',
      glow: 'shadow-[0_0_20px_rgba(225,29,72,0.3)]',
      accentPill: 'bg-rose-900/90 text-rose-200 border-rose-500/50'
    },
    purple: {
      primaryText: 'text-fuchsia-300 drop-shadow-[0_0_12px_rgba(232,121,249,0.95)]',
      subText: 'text-purple-200 drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]',
      bg: 'bg-gradient-to-r from-[#20032b] via-[#350747] to-[#20032b]',
      dot: 'bg-fuchsia-400 shadow-[0_0_10px_#e879f9]',
      border: 'border-purple-700/80',
      glow: 'shadow-[0_0_20px_rgba(147,51,234,0.3)]',
      accentPill: 'bg-purple-900/90 text-purple-200 border-purple-500/50'
    },
    gold: {
      primaryText: 'text-yellow-300 drop-shadow-[0_0_12px_rgba(253,224,71,0.95)]',
      subText: 'text-amber-200 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]',
      bg: 'bg-gradient-to-r from-[#2e2302] via-[#453403] to-[#2e2302]',
      dot: 'bg-yellow-400 shadow-[0_0_10px_#facc15]',
      border: 'border-yellow-700/80',
      glow: 'shadow-[0_0_20px_rgba(202,138,4,0.3)]',
      accentPill: 'bg-yellow-900/90 text-yellow-200 border-yellow-500/50'
    },
    neonblue: {
      primaryText: 'text-blue-300 drop-shadow-[0_0_12px_rgba(96,165,250,0.95)]',
      subText: 'text-indigo-200 drop-shadow-[0_0_8px_rgba(129,140,248,0.8)]',
      bg: 'bg-gradient-to-r from-[#02132e] via-[#041f4d] to-[#02132e]',
      dot: 'bg-blue-400 shadow-[0_0_10px_#60a5fa]',
      border: 'border-blue-700/80',
      glow: 'shadow-[0_0_20px_rgba(37,99,235,0.3)]',
      accentPill: 'bg-blue-900/90 text-blue-200 border-blue-500/50'
    }
  };

  const theme = colorStyles[notice?.color || 'emerald'] || colorStyles.emerald;
  const pxPerSec = resolveDisplayPxPerSec(notice);
  const subPxPerSec = Math.max(10, Math.round(pxPerSec * 0.85));
  const row3PxPerSec = resolveRow3PxPerSec(notice);
  const isSteady = notice?.mode === 'steady';
  const row3Mode = notice?.row3Mode || (isSteady ? 'steady' : 'slow_scroll');
  const row3SlideIntervalSec = Math.min(
    20,
    Math.max(3, Number(notice?.row3SlideIntervalSec) || 6)
  );
  const pauseOnHover = notice?.pauseOnHover !== false;
  const showRow3 = notice?.showRow3Notifications !== false;

  // Auto-advance spotlight slide when row3Mode === 'spotlight_slide'
  useEffect(() => {
    if (row3Mode !== 'spotlight_slide' || isUserPaused || row3Alerts.length <= 1) return;
    const timer = setInterval(() => {
      setSpotlightIndex((prev) => (prev + 1) % row3Alerts.length);
    }, row3SlideIntervalSec * 1000);
    return () => clearInterval(timer);
  }, [row3Mode, isUserPaused, row3Alerts.length, row3SlideIntervalSec]);

  const safeSpotlightIdx =
    row3Alerts.length > 0 ? spotlightIndex % row3Alerts.length : 0;
  const currentSpotlightAlert = row3Alerts[safeSpotlightIdx] || null;
  // Cap marquee DOM nodes to top 15 urgent items on Android WebAPK so wide GPU layers stay sharp & buttery slow
  const marqueeRow3Alerts = useMemo(() => row3Alerts.slice(0, 15), [row3Alerts]);
  const hiddenMoreCount = Math.max(0, row3Alerts.length - marqueeRow3Alerts.length);

  const line1FontClasses: Record<DisplayFontSize, string> = {
    medium: 'text-base sm:text-lg md:text-xl',
    large: 'text-lg sm:text-2xl md:text-3xl',
    extralarge: 'text-xl sm:text-3xl md:text-4xl',
  };
  const row3FontClasses: Record<DisplayFontSize, string> = {
    medium: 'text-base sm:text-lg md:text-xl',
    large: 'text-lg sm:text-2xl md:text-3xl',
    extralarge: 'text-xl sm:text-3xl md:text-4xl',
  };
  const line1FontClass = line1FontClasses[notice?.fontSize || 'large'] || line1FontClasses.large;
  const row3FontClass = row3FontClasses[notice?.row3FontSize || 'large'] || row3FontClasses.large;

  const companyLogo = company?.logoUrl || '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg';
  const companyName = company?.name || 'DIP BHOLA NETWORK';
  const isStaffRole = !currentUser || currentUser.role === 'staff';
  const isAdminOnly = Boolean(currentUser && (currentUser.role === 'admin' || currentUser.role === 'director'));

  // If Admin explicitly paused/turned off Display Board, keep clean slim strip
  if (notice?.active === false) {
    return (
      <div className="w-full bg-slate-950 border-b border-slate-800 px-3 sm:px-4 py-1.5 flex items-center justify-between gap-2 text-xs text-slate-300 print:hidden">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
          <span className="font-bold">ডিজিটাল ডিসপ্লে বোর্ড বর্তমানে বন্ধ (Admin Pause) রয়েছে।</span>
        </div>
        {isAdminOnly && (
          <button
            type="button"
            onClick={onOpenDisplayTab}
            className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px]"
          >
            ডিসপ্লে চালু/সেট করুন
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`w-full ${theme.bg} border-b ${theme.border} px-3 sm:px-4 py-1.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 select-none print:hidden transition-all`}
    >
      {/* LEFT SIDE: COMPANY LOGO & LIVE DIGITAL CLOCK & DATE */}
      <div className="flex items-center justify-between md:justify-start gap-2.5 shrink-0">
        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border shadow-inner ${theme.accentPill}`}>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden bg-white border border-cyan-300/80 shrink-0 flex items-center justify-center p-0.5 shadow-[0_0_12px_rgba(56,189,248,0.45)]">
            <img
              src={companyLogo}
              alt={companyName}
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
          <span className={`w-2.5 h-2.5 rounded-full ${theme.dot} animate-ping`} />
          <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm uppercase tracking-wider">
            <span>{companyName.split(' ')[0]}</span>
            <span className="hidden sm:inline text-[10px] px-1.5 py-0.2 rounded bg-cyan-400 text-[#020a18] font-black">
              ERP
            </span>
          </div>
        </div>

        {/* LIVE DIGITAL CLOCK (তারিখ ও সময় সার্বক্ষণিক দৃশ্যমান) */}
        {notice?.showClock !== false && <LiveTickerClockPanel />}
      </div>

      {/* CENTER: 3-LINE SMOOTH CONSTANT-SPEED MARQUEE DISPLAY */}
      <div className="flex-1 flex flex-col justify-center min-w-0 overflow-hidden py-0.5 space-y-1">
        {/* LINE 1: BIG PRIMARY DISPLAY HEADLINE */}
        <div className="h-8 sm:h-10 flex items-center overflow-hidden">
          <SmoothMarqueeTrack
            pxPerSec={pxPerSec}
            isSteady={isSteady}
            isPaused={isUserPaused}
            pauseOnHover={pauseOnHover}
          >
            <span className={`font-black tracking-wide font-mono ${line1FontClass} ${theme.primaryText} ${notice?.mode === 'glow' ? 'animate-pulse' : ''}`}>
              📢 {line1Text}
            </span>
            <LiveTickerClockInline />
            {!isStaffRole && (
              <span className="mx-4 text-cyan-200 font-black text-sm sm:text-base px-2.5 py-0.5 rounded bg-[#031632]/90 border border-cyan-400/50">
                💵 আজকের জমা: {formatCurrency(todaySummary.income)} • 💳 আজকের খরচ: {formatCurrency(todaySummary.expense)} • 💰 নিট: {formatCurrency(todaySummary.net)}
              </span>
            )}
            <span className="mx-6 text-cyan-400 font-black text-lg">✦✦✦</span>
          </SmoothMarqueeTrack>
        </div>

        {/* LINE 2: SECONDARY COLORFUL NOTICE + LIVE NETWORK STATUS */}
        <div className="h-6 sm:h-7 flex items-center border-t border-cyan-400/20 pt-0.5 overflow-hidden">
          <SmoothMarqueeTrack
            pxPerSec={subPxPerSec}
            isSteady={isSteady}
            isPaused={isUserPaused}
            pauseOnHover={pauseOnHover}
          >
            <span className="mr-4 text-cyan-200 font-mono text-xs sm:text-sm font-bold px-2.5 py-0.2 rounded bg-[#031632]/90 border border-cyan-400/45">
              🔵 নেটওয়ার্ক স্ট্যাটাস: অপটিক্যাল ফাইবার সচল (৯৯.৯% আপটাইম)
            </span>
            {line2Text && (
              <>
                <span className={`font-bold tracking-wide text-sm sm:text-base font-mono ${theme.subText}`}>
                  ⚡ {line2Text}
                </span>
                <span className="mx-5 text-cyan-400/60 font-bold text-xs">• • •</span>
              </>
            )}

            {/* LIVE PARTNER RATIO & DIVIDEND TICKER — strictly hidden for Staff */}
            {!isStaffRole && partners && partners.length > 0 && (
              <span className="text-amber-300 font-mono text-xs sm:text-sm font-bold">
                ✦ অংশীদার মূলধন ও শেয়ার বণ্টন:{' '}
                {partners.map((p, idx) => {
                  const pShare = (netBalance * (p.sharePercentage || 0)) / 100;
                  return (
                    <span key={p.id || idx} className="mx-2 text-white">
                      👤 {p.name} ({toBengaliNumber(p.sharePercentage)}% শেয়ার):{' '}
                      <strong className={pShare >= 0 ? 'text-cyan-300' : 'text-rose-400'}>
                        {pShare >= 0 ? '+' : ''}{formatCurrency(pShare)}
                      </strong>{' '}
                      {idx < partners.length - 1 ? '|' : ''}
                    </span>
                  );
                })}
              </span>
            )}
            <span className="mx-6 text-cyan-400/60 font-bold text-xs">•••</span>
          </SmoothMarqueeTrack>
        </div>

        {/* LINE 3: LARGE PROMINENT LIVE NOTIFICATION TICKER ROW (ডিজিটাল ডিসপ্লের ৩য় সারি - বড় সাইজ) */}
        {showRow3 && (
          <div
            onClick={() => onToggleNotificationWindow && onToggleNotificationWindow()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && onToggleNotificationWindow) {
                e.preventDefault();
                onToggleNotificationWindow();
              }
            }}
            title="বিস্তারিত নোটিফিকেশন উইন্ডো খুলতে এখানে ক্লিক করুন"
            className={`flex items-center gap-2 border-t pt-1 mt-0.5 rounded-lg px-2 h-10 sm:h-12 overflow-hidden cursor-pointer transition-colors ${
              activeAlertCount > 0
                ? 'border-rose-500/50 bg-gradient-to-r from-rose-950/90 via-amber-950/80 to-rose-950/90 hover:from-rose-900/90 hover:to-amber-900/85 shadow-[inset_0_0_16px_rgba(244,63,94,0.28)]'
                : 'border-cyan-400/35 bg-[#031632]/90 hover:bg-[#05234d]'
            }`}
          >
            {/* Fixed Left Large Notification Label */}
            <div
              className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-black text-xs sm:text-sm shadow-sm ${
                activeAlertCount > 0
                  ? 'bg-gradient-to-r from-rose-600 via-orange-500 to-amber-500 text-white'
                  : 'bg-cyan-400 text-[#020a18]'
              }`}
            >
              {activeAlertCount > 0 ? (
                <BellRing className="w-4 h-4 animate-bounce shrink-0" />
              ) : (
                <Bell className="w-4 h-4 shrink-0" />
              )}
              <span className="hidden xs:inline sm:inline">নোটিফিকেশন</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-950/40 text-white text-xs font-black tabular-nums">
                {toBengaliNumber(activeAlertCount)}
              </span>
            </div>

            {/* Large Smooth / Spotlight Notification Feed */}
            {row3Mode === 'spotlight_slide' ? (
              <div className="flex-1 min-w-0 flex items-center justify-between gap-2 overflow-hidden">
                {currentSpotlightAlert ? (
                  <div className="min-w-0 flex-1 flex items-center gap-2 overflow-hidden">
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs sm:text-sm font-sans font-black uppercase shadow-xs shrink-0 ${
                        currentSpotlightAlert.tone === 'rose'
                          ? 'bg-rose-600 text-white'
                          : currentSpotlightAlert.tone === 'amber'
                          ? 'bg-amber-400 text-slate-950'
                          : currentSpotlightAlert.tone === 'violet'
                          ? 'bg-violet-500 text-white'
                          : 'bg-cyan-400 text-slate-950'
                      }`}
                    >
                      {currentSpotlightAlert.badge}
                    </span>
                    <span
                      className={`truncate font-black font-mono tracking-wide ${row3FontClass} ${
                        currentSpotlightAlert.tone === 'rose'
                          ? 'text-rose-200 drop-shadow-[0_0_10px_rgba(251,113,133,0.95)]'
                          : currentSpotlightAlert.tone === 'amber'
                          ? 'text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.95)]'
                          : currentSpotlightAlert.tone === 'violet'
                          ? 'text-fuchsia-200 drop-shadow-[0_0_10px_rgba(232,121,249,0.9)]'
                          : 'text-cyan-200 drop-shadow-[0_0_10px_rgba(34,211,238,0.9)]'
                      }`}
                    >
                      {currentSpotlightAlert.text}
                    </span>
                  </div>
                ) : (
                  <span className={`text-cyan-200 font-black font-mono tracking-wide truncate ${row3FontClass}`}>
                    ✅ সব সেবা সচল — বর্তমানে কোনো পেন্ডিং নোটিফিকেশন নেই
                  </span>
                )}

                {row3Alerts.length > 1 && (
                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSpotlightIndex((prev) => (prev - 1 + row3Alerts.length) % row3Alerts.length)
                      }
                      className="p-1 rounded-md bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                      title="আগের নোটিফিকেশন"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-mono font-bold text-amber-200 px-1 tabular-nums">
                      {toBengaliNumber(safeSpotlightIdx + 1)}/{toBengaliNumber(row3Alerts.length)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSpotlightIndex((prev) => (prev + 1) % row3Alerts.length)
                      }
                      className="p-1 rounded-md bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                      title="পরের নোটিফিকেশন"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-hidden relative h-9 sm:h-11 flex items-center">
                <SmoothMarqueeTrack
                  pxPerSec={row3PxPerSec}
                  isSteady={isSteady || row3Mode === 'steady'}
                  isPaused={isUserPaused}
                  pauseOnHover={pauseOnHover}
                >
                  {marqueeRow3Alerts.length === 0 ? (
                    <span className={`text-cyan-200 font-black font-mono tracking-wide drop-shadow-[0_0_10px_rgba(56,189,248,0.85)] ${row3FontClass}`}>
                      ✅ সব সেবা সচল — বর্তমানে কোনো পেন্ডিং অভিযোগ, বকেয়া সতর্কতা বা নতুন নোটিফিকেশন নেই
                    </span>
                  ) : (
                    <div className="inline-flex items-center gap-8">
                      {marqueeRow3Alerts.map((item) => (
                        <span
                          key={item.id}
                          className={`inline-flex items-center gap-2 font-black font-mono tracking-wide ${row3FontClass}`}
                        >
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs sm:text-sm font-sans font-black uppercase shadow-xs ${
                              item.tone === 'rose'
                                ? 'bg-rose-600 text-white'
                                : item.tone === 'amber'
                                ? 'bg-amber-400 text-slate-950'
                                : item.tone === 'violet'
                                ? 'bg-violet-500 text-white'
                                : 'bg-cyan-400 text-slate-950'
                            }`}
                          >
                            {item.badge}
                          </span>
                          <span
                            className={
                              item.tone === 'rose'
                                ? 'text-rose-200 drop-shadow-[0_0_10px_rgba(251,113,133,0.95)]'
                                : item.tone === 'amber'
                                ? 'text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.95)]'
                                : item.tone === 'violet'
                                ? 'text-fuchsia-200 drop-shadow-[0_0_10px_rgba(232,121,249,0.9)]'
                                : 'text-cyan-200 drop-shadow-[0_0_10px_rgba(34,211,238,0.9)]'
                            }
                          >
                            {item.text}
                          </span>
                          <span className="text-amber-400/80 mx-2">✦</span>
                        </span>
                      ))}
                      {hiddenMoreCount > 0 && (
                        <span className="px-2.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 font-sans font-black text-xs sm:text-sm">
                          + আরো {toBengaliNumber(hiddenMoreCount)}টি নোটিফিকেশন দেখতে ক্লিক করুন
                        </span>
                      )}
                    </div>
                  )}
                </SmoothMarqueeTrack>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT SIDE: Quick Pause/Play + Admin Speed/Display Customize or View Mode */}
      <div className="flex sm:flex-col items-center justify-end gap-1.5 shrink-0 self-center">
        {!isSteady && (
          <button
            type="button"
            onClick={() => setIsUserPaused((p) => !p)}
            className={`text-xs font-bold px-2.5 py-1 rounded-xl border transition-all flex items-center gap-1 cursor-pointer ${
              isUserPaused
                ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-xs'
                : 'bg-[#031632]/90 hover:bg-cyan-500/20 text-cyan-100 border-cyan-400/40'
            }`}
            title={isUserPaused ? 'লেখা পুনরায় চালান' : 'লেখা থামিয়ে পড়ুন'}
          >
            {isUserPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isUserPaused ? 'চালান' : 'থামান'}</span>
          </button>
        )}

        {isAdminOnly ? (
          <button
            type="button"
            onClick={onOpenDisplayTab}
            className="text-xs font-bold text-white bg-[#031632]/90 hover:bg-cyan-500/20 border border-cyan-400/45 px-3 py-1.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5 hover:scale-105 active:scale-95 cursor-pointer"
            title="Admin কাস্টমাইজেশন: ডিসপ্লের গতি, লেখা, ফন্ট সাইজ ও কালার পরিবর্তন করুন"
          >
            <Edit3 className="w-3.5 h-3.5 text-cyan-300" />
            <span className="hidden lg:inline">গতি ও ডিসপ্লে সেটিংস</span>
            <span className="lg:hidden">কাস্টমাইজ</span>
          </button>
        ) : (
          <span className="text-xs font-bold text-cyan-200 bg-[#031632]/90 border border-cyan-400/40 px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-xs">
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden lg:inline">লাইভ ডিসপ্লে</span>
          </span>
        )}
      </div>

      <style>{`
        @keyframes dip-smooth-marquee {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
      `}</style>
    </div>
  );
};
