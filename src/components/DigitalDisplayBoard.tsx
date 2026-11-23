import React, { useState, useEffect, useMemo } from 'react';
import {
  Monitor,
  Radio,
  Send,
  Zap,
  Sliders,
  Sparkles,
  Power,
  RotateCcw,
  Check,
  Eye,
  Activity,
  Layers,
  Clock,
  Maximize2,
  Minimize2,
  Type,
  Volume2,
  TrendingUp,
  TrendingDown,
  PieChart,
  Users,
  Award,
  Wallet,
  Building2,
  Calendar,
  BellRing
} from 'lucide-react';
import {
  DigitalNotice,
  DisplayColor,
  DisplayMode,
  DisplaySpeed,
  DisplayFontSize,
  Row3NotificationMode,
  UserSession,
  Partner,
  Company,
  Transaction
} from '../types';
import { toBengaliNumber, formatCurrency, formatBengaliDate } from '../utils/formatters';
import { DISPLAY_SPEED_PX_PRESETS, resolveRow3PxPerSec } from './DigitalTickerBar';

interface DigitalDisplayBoardProps {
  notice: DigitalNotice;
  currentUser: UserSession;
  company: Company | null;
  partners?: Partner[];
  transactions?: Transaction[];
  onSaveNotice: (notice: Partial<DigitalNotice>) => Promise<void>;
}

export const DigitalDisplayBoard: React.FC<DigitalDisplayBoardProps> = ({
  notice,
  currentUser,
  company,
  partners = [],
  transactions = [],
  onSaveNotice,
}) => {
  const isAdminOnly = currentUser.role === 'admin' || currentUser.role === 'director';

  // Line 1 & Line 2 texts
  const [line1Text, setLine1Text] = useState(notice.text || '');
  const [line2Text, setLine2Text] = useState(notice.subText || '');
  const [color, setColor] = useState<DisplayColor>(notice.color || 'emerald');
  const [mode, setMode] = useState<DisplayMode>(notice.mode || 'scroll');
  const [speed, setSpeed] = useState<DisplaySpeed>(notice.speed || 'slow');
  const [customSpeedPxPerSec, setCustomSpeedPxPerSec] = useState<number>(
    typeof notice.customSpeedPxPerSec === 'number'
      ? notice.customSpeedPxPerSec
      : DISPLAY_SPEED_PX_PRESETS[notice.speed || 'slow'] || 22
  );
  const [pauseOnHover, setPauseOnHover] = useState<boolean>(notice.pauseOnHover !== false);
  const [showRow3Notifications, setShowRow3Notifications] = useState<boolean>(
    notice.showRow3Notifications !== false
  );
  const [row3FontSize, setRow3FontSize] = useState<DisplayFontSize>(notice.row3FontSize || 'large');
  const [row3Mode, setRow3Mode] = useState<Row3NotificationMode>(notice.row3Mode || 'slow_scroll');
  const [row3SpeedPxPerSec, setRow3SpeedPxPerSec] = useState<number>(resolveRow3PxPerSec(notice));
  const [row3SlideIntervalSec, setRow3SlideIntervalSec] = useState<number>(
    typeof notice.row3SlideIntervalSec === 'number'
      ? Math.min(15, Math.max(3, notice.row3SlideIntervalSec))
      : 6
  );
  const [fontSize, setFontSize] = useState<DisplayFontSize>(notice.fontSize || 'large');
  const [showClock, setShowClock] = useState<boolean>(notice.showClock !== false);
  const [isActive, setIsActive] = useState<boolean>(notice.active !== false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isBillboardFullscreen, setIsBillboardFullscreen] = useState(false);

  // Real-time Clock State for the board
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync when cloud notice updates externally
  useEffect(() => {
    if (notice) {
      setLine1Text(notice.text || '');
      setLine2Text(notice.subText || '');
      setColor(notice.color || 'emerald');
      setMode(notice.mode || 'scroll');
      const nextSpeed = notice.speed || 'slow';
      setSpeed(nextSpeed);
      setCustomSpeedPxPerSec(
        typeof notice.customSpeedPxPerSec === 'number'
          ? notice.customSpeedPxPerSec
          : DISPLAY_SPEED_PX_PRESETS[nextSpeed] || 22
      );
      setPauseOnHover(notice.pauseOnHover !== false);
      setShowRow3Notifications(notice.showRow3Notifications !== false);
      setRow3FontSize(notice.row3FontSize || 'large');
      setRow3Mode(notice.row3Mode || 'slow_scroll');
      setRow3SpeedPxPerSec(resolveRow3PxPerSec(notice));
      setRow3SlideIntervalSec(
        typeof notice.row3SlideIntervalSec === 'number'
          ? Math.min(15, Math.max(3, notice.row3SlideIntervalSec))
          : 6
      );
      setFontSize(notice.fontSize || 'large');
      setShowClock(notice.showClock !== false);
      setIsActive(notice.active !== false);
    }
  }, [notice]);

  // Company and Financial Calculations
  const companyName = company?.name || 'DIP BHOLA NETWORK';
  const companyLogo = company?.logoUrl || '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg';

  const totalIncome = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const totalExpense = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const netBalance = totalIncome - totalExpense;

  // Effective partners (fallback if empty)
  const effectivePartners = useMemo(() => {
    if (partners && partners.length > 0) return partners;
    return [
      {
        id: 'p-1',
        name: company?.ownerName || 'জাহিদুল ইসলাম',
        phone: company?.phone || '01721200049',
        role: 'প্রধান পরিচালক ও অংশীদার',
        investment: 600000,
        sharePercentage: 60,
        investmentHistory: []
      },
      {
        id: 'p-2',
        name: 'মোঃ হাবিবুর রহমান',
        phone: '01700000000',
        role: 'সহযোগী অংশীদার',
        investment: 400000,
        sharePercentage: 40,
        investmentHistory: []
      }
    ];
  }, [partners, company]);

  // Save / Broadcast to cloud (Admin Only)
  const handleBroadcast = async () => {
    if (!isAdminOnly) return;
    try {
      setIsSaving(true);
      setSaveError(null);
      await onSaveNotice({
        text: line1Text.trim() || 'DIP BHOLA NETWORK কেন্দ্রীয় ডিজিটাল ডিসপ্লে সিস্টেম',
        subText: line2Text.trim(),
        color,
        mode,
        speed,
        customSpeedPxPerSec,
        pauseOnHover,
        showRow3Notifications,
        row3FontSize,
        row3Mode,
        row3SpeedPxPerSec,
        row3SlideIntervalSec,
        fontSize,
        showClock,
        active: isActive,
        updatedBy: currentUser.name
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving notice:', err);
      setSaveError('ডিসপ্লে সেটিংস সংরক্ষণ করতে সাময়িক সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsSaving(false);
    }
  };

  // 7 Vibrant Neon Themes
  const colorThemes: Record<
    DisplayColor,
    {
      name: string;
      line1Color: string;
      line2Color: string;
      boardBorder: string;
      boardGlow: string;
      cardBg: string;
      ledDot: string;
      accentBg: string;
      timeColor: string;
      badgeBorder: string;
    }
  > = {
    emerald: {
      name: 'পান্না নিয়ন (Emerald Cyber)',
      line1Color: 'text-emerald-300 drop-shadow-[0_0_20px_rgba(52,211,153,1)]',
      line2Color: 'text-teal-200 drop-shadow-[0_0_12px_rgba(45,212,191,0.9)]',
      boardBorder: 'border-emerald-500/80',
      boardGlow: 'shadow-[0_0_50px_rgba(16,185,129,0.35)]',
      cardBg: 'from-[#012217] via-[#023827] to-[#012217]',
      ledDot: 'bg-emerald-400 shadow-[0_0_15px_#34d399]',
      accentBg: 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200',
      timeColor: 'text-emerald-300',
      badgeBorder: 'border-emerald-500'
    },
    amber: {
      name: 'অগ্নিকুণ্ড কমলা (Amber Matrix)',
      line1Color: 'text-amber-300 drop-shadow-[0_0_20px_rgba(251,191,36,1)]',
      line2Color: 'text-yellow-200 drop-shadow-[0_0_12px_rgba(253,224,71,0.9)]',
      boardBorder: 'border-amber-500/80',
      boardGlow: 'shadow-[0_0_50px_rgba(245,158,11,0.35)]',
      cardBg: 'from-[#2e1501] via-[#452002] to-[#2e1501]',
      ledDot: 'bg-amber-400 shadow-[0_0_15px_#fbbf24]',
      accentBg: 'bg-amber-950/80 border-amber-500/50 text-amber-200',
      timeColor: 'text-amber-300',
      badgeBorder: 'border-amber-500'
    },
    cyan: {
      name: 'সাইবার আকাশি (Cyan Neon)',
      line1Color: 'text-cyan-300 drop-shadow-[0_0_20px_rgba(34,211,238,1)]',
      line2Color: 'text-sky-200 drop-shadow-[0_0_12px_rgba(56,189,248,0.9)]',
      boardBorder: 'border-cyan-500/80',
      boardGlow: 'shadow-[0_0_50px_rgba(6,182,212,0.35)]',
      cardBg: 'from-[#022129] via-[#033b49] to-[#022129]',
      ledDot: 'bg-cyan-400 shadow-[0_0_15px_#22d3ee]',
      accentBg: 'bg-cyan-950/80 border-cyan-500/50 text-cyan-200',
      timeColor: 'text-cyan-300',
      badgeBorder: 'border-cyan-500'
    },
    rose: {
      name: 'নিয়ন গোলাপি (Neon Rose)',
      line1Color: 'text-rose-300 drop-shadow-[0_0_20px_rgba(251,113,133,1)]',
      line2Color: 'text-pink-200 drop-shadow-[0_0_12px_rgba(244,114,182,0.9)]',
      boardBorder: 'border-rose-500/80',
      boardGlow: 'shadow-[0_0_50px_rgba(244,63,94,0.35)]',
      cardBg: 'from-[#2b030b] via-[#480614] to-[#2b030b]',
      ledDot: 'bg-rose-400 shadow-[0_0_15px_#fb7185]',
      accentBg: 'bg-rose-950/80 border-rose-500/50 text-rose-200',
      timeColor: 'text-rose-300',
      badgeBorder: 'border-rose-500'
    },
    purple: {
      name: 'রাজকীয় বেগুনি (Electric Purple)',
      line1Color: 'text-fuchsia-300 drop-shadow-[0_0_20px_rgba(232,121,249,1)]',
      line2Color: 'text-purple-200 drop-shadow-[0_0_12px_rgba(192,132,252,0.9)]',
      boardBorder: 'border-fuchsia-500/80',
      boardGlow: 'shadow-[0_0_50px_rgba(168,85,247,0.35)]',
      cardBg: 'from-[#22022e] via-[#3a044e] to-[#22022e]',
      ledDot: 'bg-fuchsia-400 shadow-[0_0_15px_#e879f9]',
      accentBg: 'bg-purple-950/80 border-purple-500/50 text-purple-200',
      timeColor: 'text-fuchsia-300',
      badgeBorder: 'border-fuchsia-500'
    },
    gold: {
      name: 'উজ্জ্বল সোনালী (Gold Matrix)',
      line1Color: 'text-yellow-300 drop-shadow-[0_0_20px_rgba(253,224,71,1)]',
      line2Color: 'text-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.9)]',
      boardBorder: 'border-yellow-400/80',
      boardGlow: 'shadow-[0_0_50px_rgba(234,179,8,0.35)]',
      cardBg: 'from-[#2d2201] via-[#473501] to-[#2d2201]',
      ledDot: 'bg-yellow-400 shadow-[0_0_15px_#facc15]',
      accentBg: 'bg-yellow-950/80 border-yellow-500/50 text-yellow-200',
      timeColor: 'text-yellow-300',
      badgeBorder: 'border-yellow-400'
    },
    neonblue: {
      name: 'ডিপ ভোল্ট নীল (Deep Neon Blue)',
      line1Color: 'text-blue-300 drop-shadow-[0_0_20px_rgba(96,165,250,1)]',
      line2Color: 'text-indigo-200 drop-shadow-[0_0_12px_rgba(129,140,248,0.9)]',
      boardBorder: 'border-blue-500/80',
      boardGlow: 'shadow-[0_0_50px_rgba(59,130,246,0.35)]',
      cardBg: 'from-[#02132e] via-[#042152] to-[#02132e]',
      ledDot: 'bg-blue-400 shadow-[0_0_15px_#60a5fa]',
      accentBg: 'bg-blue-950/80 border-blue-500/50 text-blue-200',
      timeColor: 'text-blue-300',
      badgeBorder: 'border-blue-500'
    }
  };

  const theme = colorThemes[color] || colorThemes.emerald;

  // Real-time Bengali clock string
  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const seconds = currentTime.getSeconds();
  const ampm = hours >= 12 ? 'অপরাহ্ন' : 'পূর্বাহ্ন';
  const displayHours = hours % 12 || 12;
  const padZero = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const formattedBengaliTime = `${toBengaliNumber(padZero(displayHours))}:${toBengaliNumber(
    padZero(minutes)
  )}:${toBengaliNumber(padZero(seconds))} ${ampm}`;

  const months = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  const days = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
  const formattedBengaliDate = `${toBengaliNumber(currentTime.getDate())} ${months[currentTime.getMonth()]} ${toBengaliNumber(currentTime.getFullYear())}, ${days[currentTime.getDay()]}`;

  // Font size classes for Line 1
  const fontSizeClasses: Record<DisplayFontSize, string> = {
    medium: 'text-xl sm:text-2xl md:text-3xl',
    large: 'text-2xl sm:text-4xl md:text-5xl',
    extralarge: 'text-3xl sm:text-5xl md:text-6xl tracking-wide'
  };

  const currentFontSizeClass = fontSizeClasses[fontSize] || fontSizeClasses.large;
  const effectivePxPerSec = Math.min(100, Math.max(8, customSpeedPxPerSec || 22));
  const previewPrimarySec = Math.max(
    18,
    Math.round(((line1Text.length || 60) * 18 + 600) / effectivePxPerSec)
  );
  const previewSubSec = Math.max(
    22,
    Math.round(((line2Text.length || 70) * 14 + 700) / Math.max(8, effectivePxPerSec * 0.88))
  );
  const isSteadyPreview = mode === 'steady';

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Monitor className="w-6 h-6 text-emerald-600" />
              <span>বড় আধুনিক ডিজিটাল ডিসপ্লে বোর্ড ও লাইভ পার্টনার মনিটরিং</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
              লাইভ এলইডি
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            কোম্পানির লোগো, শেয়ার অংশীদারদের ছবি ও রেশিও, স্বয়ংক্রিয় লাভ-লোকসান বিশ্লেষণ এবং লাইভ সময় ও তারিখ প্রদর্শন।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Power Toggle - Admin Only */}
          {isAdminOnly && (
            <button
              onClick={() => setIsActive(!isActive)}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
              }`}
            >
              <Power className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>{isActive ? 'ডিসপ্লে: চালু (ON)' : 'ডিসপ্লে: বন্ধ (OFF)'}</span>
            </button>
          )}

          {/* Fullscreen Big Billboard Mode */}
          <button
            onClick={() => setIsBillboardFullscreen(!isBillboardFullscreen)}
            className="px-3.5 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition flex items-center gap-1.5"
            title="মনিটর বা টিভিতে বড় করে প্রদর্শন করতে ফুলস্ক্রিন করুন"
          >
            {isBillboardFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isBillboardFullscreen ? 'স্বাভাবিক ভিউ' : 'টিভি / বিলবোর্ড মোড'}</span>
          </button>

          {/* Cloud Broadcast Button - Admin Only */}
          {isAdminOnly && (
            <button
              onClick={handleBroadcast}
              disabled={isSaving}
              className="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 rounded-xl transition-all shadow-md flex items-center gap-1.5"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>প্রচার সফল!</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-emerald-200" />
                  <span>{isSaving ? 'সংরক্ষণ হচ্ছে...' : 'ডিসপ্লেতে প্রচার করুন'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* THE GIANT MODERN MULTI-COLOR DIGITAL LED BILLBOARD SCREEN */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div
        className={`relative rounded-3xl bg-slate-950 p-4 sm:p-6 border-4 ${theme.boardBorder} ${theme.boardGlow} overflow-hidden transition-all space-y-5 ${
          isBillboardFullscreen
            ? 'fixed inset-0 z-50 rounded-none border-none p-6 sm:p-10 flex flex-col justify-between overflow-y-auto'
            : ''
        }`}
      >
        {/* Background Dot-Matrix Overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle, #38bdf8 1px, transparent 1px)',
            backgroundSize: '18px 18px'
          }}
        />

        {/* 1. TOP BEZEL: COMPANY LOGO, BRAND, & LIVE CLOCK & DATE */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/90 font-mono text-xs">
          {/* Company Brand & Logo */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/10 p-1 border-2 border-emerald-400/60 shadow-[0_0_20px_rgba(52,211,153,0.4)] flex items-center justify-center shrink-0 overflow-hidden">
              <img src={companyLogo} alt={companyName} className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${isActive ? theme.ledDot : 'bg-slate-700'} animate-ping`} />
                <h1 className="text-lg sm:text-2xl font-black text-white tracking-wider uppercase font-sans">
                  {companyName}
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  ডিজিটাল সেন্ট্রাল ডিসপ্লে
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                {company?.subTitle || 'কেন্দ্রীয় ব্রডব্যান্ড নেটওয়ার্ক ও ফাইন্যান্সিয়াল মনিটরিং বোর্ড'}
              </p>
            </div>
          </div>

          {/* REAL-TIME DIGITAL CLOCK & DATE BADGE */}
          {showClock && (
            <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-900/90 border border-amber-500/50 shadow-[0_0_25px_rgba(245,158,11,0.25)]">
              <Clock className="w-5 h-5 text-amber-400 animate-pulse shrink-0" />
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <div className="flex items-center gap-2">
                  <span className={`text-base sm:text-xl font-black font-mono tracking-widest ${theme.timeColor}`}>
                    {formattedBengaliTime}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-sans">
                    লাইভ সময়
                  </span>
                </div>
                <div className="text-xs font-bold text-emerald-400 font-sans border-t sm:border-t-0 sm:border-l border-slate-700 pt-0.5 sm:pt-0 sm:pl-3">
                  📅 তারিখ: {formattedBengaliDate}
                </div>
              </div>
            </div>
          )}

          {isBillboardFullscreen && (
            <button
              onClick={() => setIsBillboardFullscreen(false)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl shadow-md"
              title="ফুলস্ক্রিন বন্ধ করুন"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 2. MAIN 2-LINE BIG NEON MARQUEE DISPLAY */}
        <div className="relative z-10 bg-slate-900/80 rounded-2xl p-4 sm:p-6 border border-slate-800 shadow-inner space-y-3">
          {/* LINE 1: BIG HEADLINE */}
          <div className={`overflow-hidden relative min-h-12 sm:min-h-16 flex items-center ${pauseOnHover ? 'hover:[&>*]:[animation-play-state:paused]' : ''}`}>
            <div
              className={isSteadyPreview ? 'whitespace-normal leading-snug' : 'whitespace-nowrap inline-flex items-center'}
              style={
                isSteadyPreview
                  ? undefined
                  : { animation: `dip-board-marquee ${previewPrimarySec}s linear infinite` }
              }
            >
              <span className={`font-black tracking-wider ${currentFontSizeClass} font-mono ${theme.line1Color} ${mode === 'glow' ? 'animate-pulse' : ''}`}>
                📢 {line1Text || 'স্বাগতম! DIP BHOLA NETWORK ডিজিটাল সার্ভার ও অপটিক্যাল ফাইবার সংযোগ'}
              </span>
              {!isSteadyPreview && (
                <>
                  <span className="mx-8 text-amber-400 font-black text-2xl">✦✦✦</span>
                  <span className={`font-black tracking-wider ${currentFontSizeClass} font-mono ${theme.line1Color} ${mode === 'glow' ? 'animate-pulse' : ''}`}>
                    📢 {line1Text || 'স্বাগতম! DIP BHOLA NETWORK ডিজিটাল সার্ভার ও অপটিক্যাল ফাইবার সংযোগ'}
                  </span>
                  <span className="mx-8 text-amber-400 font-black text-2xl">✦✦✦</span>
                </>
              )}
            </div>
          </div>

          {/* LINE 2: VIBRANT NEON SUB-LINE */}
          <div className={`overflow-hidden relative min-h-7 sm:min-h-9 flex items-center border-t border-slate-800 pt-2 ${pauseOnHover ? 'hover:[&>*]:[animation-play-state:paused]' : ''}`}>
            <div
              className={isSteadyPreview ? 'whitespace-normal leading-snug' : 'whitespace-nowrap inline-flex items-center'}
              style={
                isSteadyPreview
                  ? undefined
                  : { animation: `dip-board-marquee ${previewSubSec}s linear infinite` }
              }
            >
              <span className={`font-bold tracking-wide text-sm sm:text-lg font-mono ${theme.line2Color}`}>
                ⚡ {line2Text || 'জরুরি মেইনটেন্যান্স ও হেল্পলাইন: ০১৭২১২০০০৪৯ (২৪ ঘণ্টা সেবা চালু)'}
              </span>
              <span className="mx-6 text-slate-500 font-black">• • •</span>
              <span className="text-amber-300 font-mono font-bold text-sm sm:text-base px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/40">
                ⏰ {formattedBengaliTime} • 📅 {formattedBengaliDate}
              </span>
              {!isSteadyPreview && (
                <>
                  <span className="mx-6 text-slate-500 font-black">• • •</span>
                  <span className={`font-bold tracking-wide text-sm sm:text-lg font-mono ${theme.line2Color}`}>
                    ⚡ {line2Text || 'জরুরি মেইনটেন্যান্স ও হেল্পলাইন: ০১৭২১২০০০৪৯ (২৪ ঘণ্টা সেবা চালু)'}
                  </span>
                  <span className="mx-6 text-slate-500 font-black">• • •</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 3. SHARE PARTNERS SHOWCASE WITH PHOTO, RATIO & PROFIT-LOSS */}
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm sm:text-base font-extrabold text-white tracking-wide">
                অংশীদারদের প্রোফাইল, স্বয়ংক্রিয় শেয়ার রেশিও ও লাভ-ক্ষতি বণ্টন (Live Equity & Dividend)
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/40">
              অটো রেশিও গণনাকৃত
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {effectivePartners.map((partner, pIdx) => {
              const partnerShare = (netBalance * (partner.sharePercentage || 0)) / 100;
              return (
                <div
                  key={partner.id || pIdx}
                  className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-emerald-500/40 rounded-2xl p-4 shadow-[0_0_20px_rgba(16,185,129,0.15)] flex flex-col justify-between space-y-3 relative overflow-hidden group hover:border-emerald-400 transition-all"
                >
                  <div className="flex items-start gap-3">
                    {/* Partner Photo with glowing neon border */}
                    <div className="w-14 h-14 rounded-2xl bg-slate-800 border-2 border-emerald-400/70 p-0.5 overflow-hidden shrink-0 shadow-[0_0_12px_rgba(52,211,153,0.4)] flex items-center justify-center">
                      {partner.photoUrl ? (
                        <img src={partner.photoUrl} alt={partner.name} className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-emerald-700 to-teal-800 text-white rounded-xl">
                          <Users className="w-6 h-6 opacity-80" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white truncate" title={partner.name}>
                          {partner.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/50">
                          {toBengaliNumber(partner.sharePercentage)}% শেয়ার
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-semibold mt-0.5 truncate">
                        {partner.role || 'অংশীদার'}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {partner.phone}
                      </div>
                    </div>
                  </div>

                  {/* Financials & Auto Dividend Share */}
                  <div className="pt-2 border-t border-slate-800 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>মূলধন বিনিয়োগ:</span>
                      <span className="font-bold text-slate-200">{formatCurrency(partner.investment || 0)}</span>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-slate-800/80">
                      <span className="text-[11px] font-bold text-amber-300">চলতি লাভ/ক্ষতি:</span>
                      <span
                        className={`font-black text-xs sm:text-sm tracking-wide ${
                          partnerShare >= 0 ? 'text-emerald-400 drop-shadow-[0_0_10px_#34d399]' : 'text-rose-400 drop-shadow-[0_0_10px_#fb7185]'
                        }`}
                      >
                        {partnerShare >= 0 ? '+' : ''}{formatCurrency(partnerShare)}
                      </span>
                    </div>

                    {/* Progress Bar of Equity */}
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_#34d399]"
                        style={{ width: `${Math.min(100, Math.max(5, partner.sharePercentage || 0))}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. LIVE PROFIT-LOSS ANALYSIS SUMMARY BAR */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Income */}
          <div className="bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                সর্বমোট আয় / জমা
              </span>
              <div className="text-lg sm:text-xl font-black text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)] mt-0.5">
                +{formatCurrency(totalIncome)}
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>

          {/* Expense */}
          <div className="bg-slate-900/90 border border-rose-500/40 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" />
                সর্বমোট ব্যয় / খরচ
              </span>
              <div className="text-lg sm:text-xl font-black text-rose-300 drop-shadow-[0_0_10px_rgba(244,63,94,0.5)] mt-0.5">
                -{formatCurrency(totalExpense)}
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <PieChart className="w-4 h-4" />
            </div>
          </div>

          {/* Net Balance */}
          <div className="bg-slate-900/90 border border-amber-500/40 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                নিট ক্যাশ / লাভ-লোকসান
              </span>
              <div className={`text-lg sm:text-xl font-black mt-0.5 ${
                netBalance >= 0 ? 'text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'text-rose-300 drop-shadow-[0_0_10px_rgba(244,63,94,0.8)]'
              }`}>
                {formatCurrency(netBalance)}
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* 5. BOTTOM RUNNING PARTNER DIVIDEND TICKER */}
        <div className={`relative z-10 bg-slate-900 border-t border-slate-800 pt-2 pb-1 overflow-hidden ${pauseOnHover ? 'hover:[&>*]:[animation-play-state:paused]' : ''}`}>
          <div
            className={isSteadyPreview ? 'whitespace-normal font-mono text-xs text-amber-300 font-bold leading-relaxed' : 'whitespace-nowrap inline-flex items-center font-mono text-xs text-amber-300 font-bold'}
            style={
              isSteadyPreview
                ? undefined
                : {
                    animation: `dip-board-marquee ${Math.max(20, Math.round((effectivePartners.length * 260 + 500) / effectivePxPerSec))}s linear infinite`
                  }
            }
          >
            <span className="inline-flex items-center">
              <span>✦ অংশীদারদের লাইভ লভ্যাংশ বণ্টন: </span>
              {effectivePartners.map((p, idx) => {
                const pShare = (netBalance * (p.sharePercentage || 0)) / 100;
                return (
                  <span key={p.id || idx} className="mx-3 text-white">
                    👤 <strong className="text-amber-300">{p.name}</strong> ({toBengaliNumber(p.sharePercentage)}% শেয়ার):{' '}
                    <span className={pShare >= 0 ? 'text-emerald-400 font-black' : 'text-rose-400 font-black'}>
                      {pShare >= 0 ? '+' : ''}{formatCurrency(pShare)}
                    </span>
                    {' '}•
                  </span>
                );
              })}
              <span className="mx-6 text-slate-500">✦✦✦</span>
            </span>
            {!isSteadyPreview && (
              <span className="inline-flex items-center" aria-hidden="true">
                <span>✦ অংশীদারদের লাইভ লভ্যাংশ বণ্টন: </span>
                {effectivePartners.map((p, idx) => {
                  const pShare = (netBalance * (p.sharePercentage || 0)) / 100;
                  return (
                    <span key={`dup-${p.id || idx}`} className="mx-3 text-white">
                      👤 <strong className="text-amber-300">{p.name}</strong> ({toBengaliNumber(p.sharePercentage)}% শেয়ার):{' '}
                      <span className={pShare >= 0 ? 'text-emerald-400 font-black' : 'text-rose-400 font-black'}>
                        {pShare >= 0 ? '+' : ''}{formatCurrency(pShare)}
                      </span>
                      {' '}•
                    </span>
                  );
                })}
                <span className="mx-6 text-slate-500">✦✦✦</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 6. CONTROL PANEL: EDIT TEXTS, FONT SIZES & 7 NEON COLOR THEMES (ADMIN ONLY) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {!isAdminOnly ? (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-3xl p-6 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
            <Eye className="w-5 h-5 text-emerald-600" />
            <span>ডিজিটাল ডিসপ্লে বোর্ড (শুধুমাত্র দেখার মোড সক্রিয়)</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            আপনি ডিজিটাল ডিসপ্লের সমস্ত বার্তা, লাইভ সময় ও তথ্য সরাসরি দেখতে পারছেন। ডিসপ্লে কন্ট্রোল, গতি, নোটিশ ও কালার পরিবর্তনের অনুমতি শুধুমাত্র অ্যাডমিনের রয়েছে।
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-600" />
                <span>ডিসপ্লে মেসেজ ও নিয়ন কালার কন্ট্রোল প্যানেল</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                স্ক্রিনের বড় শিরোনাম, উপ-বার্তা, ফন্ট সাইজ এবং নিয়ন রঙের থিম পরিবর্তন ও প্রচার করুন
              </p>
            </div>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Line 1 Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>১ম লাইন (বড় ডিসপ্লে শিরোনাম):</span>
              <span className="text-[11px] text-emerald-600 font-mono">প্রধান ঘোষণা</span>
            </label>
            <textarea
              rows={3}
              value={line1Text}
              onChange={(e) => setLine1Text(e.target.value)}
              placeholder="বড় করে প্রচার করার জন্য প্রধান বার্তা লিখুন..."
              className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3.5 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Line 2 Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>২য় লাইন (সহযোগী নোটিশ / হেল্পলাইন):</span>
              <span className="text-[11px] text-amber-600 font-mono">উপ-বার্তা</span>
            </label>
            <textarea
              rows={3}
              value={line2Text}
              onChange={(e) => setLine2Text(e.target.value)}
              placeholder="জরুরি নোটিশ, হেল্পলাইন বা অফার বার্তা লিখুন..."
              className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3.5 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>
        </div>

        {/* 7 Vibrant Color Selectors */}
        <div className="space-y-3 pt-2">
          <label className="text-xs font-bold text-slate-800 block">
            আকর্ষণীয় নিয়ন কালার থিম বেছে নিন:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {(Object.keys(colorThemes) as DisplayColor[]).map((cKey) => {
              const cTheme = colorThemes[cKey];
              const isSelected = color === cKey;
              return (
                <button
                  key={cKey}
                  type="button"
                  onClick={() => setColor(cKey)}
                  className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1.5 text-xs font-bold ${
                    isSelected
                      ? `${cTheme.badgeBorder} bg-slate-900 text-white shadow-lg scale-105`
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full ${cTheme.ledDot}`} />
                  <span className="text-[11px] truncate">{cTheme.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Admin Speed, Mode, Font Size & Notification Line Controls */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-5 text-xs">
          {saveError && (
            <div className="bg-rose-50 border border-rose-300 text-rose-800 px-3.5 py-2.5 rounded-xl font-bold">
              {saveError}
            </div>
          )}

          {/* Custom Speed Presets & Smooth Pixel-Per-Second Slider */}
          <div className="bg-emerald-50/70 dark:bg-slate-800/70 border border-emerald-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <span>অ্যাডমিন গতি ও পড়া-সুবিধা কন্ট্রোল (Speed Customization)</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  সব লাইনের লেখা স্থির গতিতে চলবে যাতে ব্যবহারকারীরা প্রতিটি শব্দ স্পষ্ট পড়তে পারেন।
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-emerald-300 font-mono font-black text-xs">
                গতি: {toBengaliNumber(customSpeedPxPerSec)} px/s
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'veryslow', label: 'সুপার স্লো', sub: '১৪ px/s · অত্যন্ত ধীর ও সহজ', px: 14 },
                  { id: 'slow', label: 'খুব ধীর (প্রস্তাবিত)', sub: '২২ px/s · আরামদায়ক পড়া', px: 22 },
                  { id: 'normal', label: 'ধীর-মাঝারি', sub: '৩০ px/s · স্বাভাবিক', px: 30 },
                  { id: 'fast', label: 'দ্রুত', sub: '৪৬ px/s · দ্রুতগতি', px: 46 }
                ] as const
              ).map((sp) => {
                const isSelected = speed === sp.id && Math.abs(customSpeedPxPerSec - sp.px) <= 2;
                return (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => {
                      setSpeed(sp.id);
                      setCustomSpeedPxPerSec(sp.px);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-emerald-50'
                    }`}
                  >
                    <div className="font-black text-xs">{sp.label}</div>
                    <div className={`text-[10px] ${isSelected ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'}`}>
                      {sp.sub}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Fine Speed Slider */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                স্লাইড করে মূল ডিসপ্লের গতি সেট করুন:
              </span>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">সুপার স্লো (৮)</span>
              <input
                type="range"
                min={8}
                max={100}
                step={1}
                value={customSpeedPxPerSec}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCustomSpeedPxPerSec(val);
                  if (val <= 17) setSpeed('veryslow');
                  else if (val <= 26) setSpeed('slow');
                  else if (val <= 38) setSpeed('normal');
                  else setSpeed('fast');
                }}
                className="flex-1 min-w-[160px] accent-emerald-600 cursor-pointer"
                aria-label="স্ক্রলিং গতি px/s"
              />
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">দ্রুত (১০০)</span>
            </div>
          </div>

          {/* Dedicated Row 3 Notification Display Speed & Mode Admin Controls */}
          <div className="bg-amber-50/80 dark:bg-amber-950/20 border border-amber-300/80 dark:border-amber-700/60 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                  <BellRing className="w-4 h-4 text-amber-600" />
                  <span>নোটিফিকেশন ডিসপ্লে (৩য় সারি) গতি ও ধরন কন্ট্রোল (Admin Control)</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  নোটিফিকেশন ডিসপ্লে যেন দ্রুত দৌড়ে না যায়, সেজন্য এখান থেকে গতি কমান অথবা একটি-একটি স্থির স্লাইড চালু করুন।
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-300 font-mono font-black text-xs">
                {row3Mode === 'spotlight_slide'
                  ? `স্লাইড: প্রতি ${toBengaliNumber(row3SlideIntervalSec)} সে.`
                  : row3Mode === 'steady'
                  ? 'সম্পূর্ণ স্থির'
                  : `নোটিফিকেশন গতি: ${toBengaliNumber(row3SpeedPxPerSec)} px/s`}
              </span>
            </div>

            {/* Row 3 Mode Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  {
                    id: 'slow_scroll',
                    title: 'খুব ধীর চলমান (Ultra Slow)',
                    desc: 'লেখা একদম ধীরে চলবে — সহজে পড়া যাবে'
                  },
                  {
                    id: 'spotlight_slide',
                    title: 'একটি-একটি স্থির স্লাইড (Spotlight)',
                    desc: 'একবারে ১টি নোটিফিকেশন স্থিরভাবে দেখাবে'
                  },
                  {
                    id: 'steady',
                    title: 'সম্পূর্ণ স্থির (Steady)',
                    desc: 'নিজে থেকে চলবে না, হাত দিয়ে স্ক্রল হবে'
                  }
                ] as const
              ).map((mOpt) => {
                const active = row3Mode === mOpt.id;
                return (
                  <button
                    key={mOpt.id}
                    type="button"
                    onClick={() => setRow3Mode(mOpt.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      active
                        ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-amber-200 dark:border-slate-700 hover:bg-amber-50'
                    }`}
                  >
                    <div className="font-black text-xs">{mOpt.title}</div>
                    <div className={`text-[10px] ${active ? 'text-amber-100' : 'text-slate-500 dark:text-slate-400'}`}>
                      {mOpt.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            {row3Mode === 'slow_scroll' && (
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { label: 'সুপার স্লো', sub: '১০ px/s · অতি ধীর', px: 10 },
                      { label: 'খুব ধীর (প্রস্তাবিত)', sub: '১৬ px/s · সহজ পাঠ্য', px: 16 },
                      { label: 'ধীর', sub: '২৪ px/s · মাঝারি ধীর', px: 24 },
                      { label: 'মাঝারি', sub: '৩৬ px/s · অপেক্ষাকৃত দ্রুত', px: 36 }
                    ] as const
                  ).map((preset) => {
                    const selected = Math.abs(row3SpeedPxPerSec - preset.px) <= 1;
                    return (
                      <button
                        key={preset.px}
                        type="button"
                        onClick={() => setRow3SpeedPxPerSec(preset.px)}
                        className={`p-2 rounded-xl border text-left transition-all ${
                          selected
                            ? 'bg-slate-900 text-amber-300 border-amber-400 shadow-sm'
                            : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-amber-50'
                        }`}
                      >
                        <div className="font-black text-xs">{preset.label}</div>
                        <div className={`text-[10px] ${selected ? 'text-amber-200' : 'text-slate-500 dark:text-slate-400'}`}>
                          {preset.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                    নোটিফিকেশন কাস্টম গতি:
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">সুপার স্লো (৮)</span>
                  <input
                    type="range"
                    min={8}
                    max={60}
                    step={1}
                    value={row3SpeedPxPerSec}
                    onChange={(e) => setRow3SpeedPxPerSec(Number(e.target.value))}
                    className="flex-1 min-w-[160px] accent-amber-600 cursor-pointer"
                    aria-label="৩য় সারি নোটিফিকেশন গতি px/s"
                  />
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">দ্রুত (৬০)</span>
                </div>
              </div>
            )}

            {row3Mode === 'spotlight_slide' && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                  প্রতিটি নোটিফিকেশন কত সেকেন্ড স্থির থাকবে:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[4, 6, 8, 10, 12].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setRow3SlideIntervalSec(sec)}
                      className={`px-2.5 py-1 rounded-lg border font-bold text-xs transition ${
                        row3SlideIntervalSec === sec
                          ? 'bg-amber-600 text-white border-amber-500'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-50'
                      }`}
                    >
                      {toBengaliNumber(sec)} সে.
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min={3}
                  max={15}
                  step={1}
                  value={row3SlideIntervalSec}
                  onChange={(e) => setRow3SlideIntervalSec(Number(e.target.value))}
                  className="flex-1 min-w-[120px] accent-amber-600 cursor-pointer"
                  aria-label="স্লাইড পরিবর্তনের সময় সেকেন্ড"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">প্রদর্শনের ধরন:</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as DisplayMode)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold focus:ring-emerald-500"
              >
                <option value="scroll">ধীরে চলমান (Scroll)</option>
                <option value="glow">চলমান + নিয়ন গ্লো (Glow)</option>
                <option value="steady">স্থির প্রদর্শন (একদম দৌড়াবে না)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">১ম লাইনের ফন্ট সাইজ:</label>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value as DisplayFontSize)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold focus:ring-emerald-500"
              >
                <option value="medium">মাঝারি (Medium)</option>
                <option value="large">বড় (Large - প্রস্তাবিত)</option>
                <option value="extralarge">সুবিশাল (Extra Large)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">৩য় সারির নোটিফিকেশন ফন্ট:</label>
              <select
                value={row3FontSize}
                onChange={(e) => setRow3FontSize(e.target.value as DisplayFontSize)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold focus:ring-emerald-500"
              >
                <option value="medium">মাঝারি (Medium)</option>
                <option value="large">বড় (Large - প্রস্তাবিত)</option>
                <option value="extralarge">সুবিশাল (Extra Large)</option>
              </select>
            </div>

            <div className="flex flex-col justify-end space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={showClock}
                  onChange={(e) => setShowClock(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span>লাইভ ঘড়ি ও তারিখ দেখান</span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 font-bold text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={pauseOnHover}
                  onChange={(e) => setPauseOnHover(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span>মাউস নিলে লেখা থেমে থাকবে (পড়ার সুবিধা)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 font-bold text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={showRow3Notifications}
                  onChange={(e) => setShowRow3Notifications(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span>ডিসপ্লে ৩য় সারিতে নোটিফিকেশন দেখান</span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleBroadcast}
              disabled={isSaving}
              className="px-5 py-2.5 text-xs sm:text-sm font-black text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>সেভ ও প্রচার সফল!</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-emerald-200" />
                  <span>{isSaving ? 'সংরক্ষণ হচ্ছে...' : 'অ্যাডমিন সেটিংস সেভ ও প্রচার করুন'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

      <style>{`
        @keyframes dip-board-marquee {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
      `}</style>
    </div>
  );
};
