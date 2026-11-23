import React, { useEffect, useState } from 'react';
import {
  X,
  Settings,
  Type,
  Check,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  RefreshCw,
  Building2,
  RotateCcw,
  Sliders
} from 'lucide-react';
import { UserSession } from '../types';
import {
  APP_FONT_SIZE_OPTIONS,
  AppFontSize,
  getSavedAppFontSize,
  setAppFontSize,
  subscribeAppFontSize
} from '../utils/fontScale';
import { isDirector } from '../services/authService';

interface AppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserSession;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  autoRefreshIntervalSec: number;
  onChangeAutoRefresh: (sec: 0 | 30 | 60 | 300) => void;
  onOpenCompanySetup?: () => void;
  onOpenPortalControl?: () => void;
}

export const AppSettingsModal: React.FC<AppSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  isDarkMode,
  onToggleDarkMode,
  isFullScreen,
  onToggleFullScreen,
  autoRefreshIntervalSec,
  onChangeAutoRefresh,
  onOpenCompanySetup,
  onOpenPortalControl
}) => {
  const [fontSize, setFontSizeState] = useState<AppFontSize>(() => getSavedAppFontSize());
  const [justChangedFont, setJustChangedFont] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeAppFontSize((sz) => setFontSizeState(sz));
    return unsub;
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setJustChangedFont(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDirectorRole = isDirector(currentUser);

  const handleSelectFontSize = (sz: AppFontSize) => {
    setAppFontSize(sz);
    setFontSizeState(sz);
    const chosen = APP_FONT_SIZE_OPTIONS.find((o) => o.id === sz);
    if (chosen) {
      setJustChangedFont(`পুরো অ্যাপের ফন্ট সাইজ "${chosen.label}" হিসেবে সক্রিয় ও সেভ হয়েছে!`);
    }
  };

  const activeFontOption =
    APP_FONT_SIZE_OPTIONS.find((o) => o.id === fontSize) || APP_FONT_SIZE_OPTIONS[1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-settings-modal-title"
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-cyan-500/35 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#020a18] via-[#041d42] to-[#020e21] px-5 py-4 flex items-center justify-between text-white border-b border-cyan-400/30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-400/20 border border-cyan-300/60 flex items-center justify-center text-cyan-300 shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="app-settings-modal-title" className="text-lg font-black tracking-tight truncate">
                অ্যাপ সেটিংস ও ডিসপ্লে কন্ট্রোল
              </h2>
              <p className="text-xs text-cyan-200 font-medium truncate">
                ফন্ট সাইজ, থিম ও স্ক্রিন প্রিফারেন্স সবার জন্য পরিবর্তনযোগ্য
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-cyan-200 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
            aria-label="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* 1. GLOBAL APP FONT SIZE SETTING (Small / Medium / Large) */}
          <div className="p-4 rounded-2xl bg-sky-50 dark:bg-[#031632] border border-sky-200 dark:border-cyan-400/35 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
                  <Type className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight">
                    অ্যাপের ফন্ট সাইজ (Font Size)
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-cyan-200/80">
                    পুরো অ্যাপের লেখা ও সংখ্যা ছোট, মাঝারি বা বড় করুন
                  </p>
                </div>
              </div>
              {fontSize !== 'medium' && (
                <button
                  type="button"
                  onClick={() => handleSelectFontSize('medium')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer shrink-0"
                  title="ডিফল্ট মাঝারি সাইজে ফিরুন"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>ডিফল্ট</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {APP_FONT_SIZE_OPTIONS.map((opt) => {
                const isSelected = fontSize === opt.id;
                const sampleSizeStyle =
                  opt.id === 'small' ? '13px' : opt.id === 'medium' ? '16px' : '20px';
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectFontSize(opt.id)}
                    aria-pressed={isSelected}
                    className={`relative p-3 rounded-xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-between gap-1.5 ${
                      isSelected
                        ? 'bg-sky-600 dark:bg-cyan-400 text-white dark:text-[#020c1b] border-sky-700 dark:border-white shadow-md scale-[1.01]'
                        : 'bg-white dark:bg-[#05234d]/70 text-slate-800 dark:text-cyan-50 border-slate-200 dark:border-cyan-400/25 hover:border-sky-400 dark:hover:border-cyan-300'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white/25 dark:bg-slate-950/20 flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                    <span
                      className="font-black leading-none py-1 select-none"
                      style={{ fontSize: sampleSizeStyle }}
                    >
                      অA
                    </span>
                    <div>
                      <div className="text-xs sm:text-sm font-black leading-tight">
                        {opt.label.split(' ')[0]}
                      </div>
                      <div
                        className={`text-[11px] font-bold ${
                          isSelected
                            ? 'text-sky-100 dark:text-slate-900'
                            : 'text-slate-500 dark:text-cyan-200/75'
                        }`}
                      >
                        {opt.englishLabel} · {opt.px}px
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Live Preview Box (reflects active preset clearly) */}
            <div className="p-3 rounded-xl bg-white dark:bg-[#020a18] border border-sky-200 dark:border-cyan-500/30 space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-sky-700 dark:text-cyan-300">
                <span>লাইভ প্রিভিউ ({activeFontOption.label})</span>
                <span className="font-mono tabular-nums">{activeFontOption.px}px</span>
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                DIP BHOLA NETWORK · আজকের নিট ব্যালেন্স{' '}
                <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-300">
                  ৳ ১২,৫০০
                </span>
              </p>
              <p className="text-xs text-slate-600 dark:text-cyan-200/85">
                {activeFontOption.description}
              </p>
            </div>

            {justChangedFont && (
              <div className="px-3 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-400/50 text-emerald-900 dark:text-emerald-100 text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-300 shrink-0" />
                <span>{justChangedFont}</span>
              </div>
            )}
          </div>

          {/* 2. THEME & DISPLAY CONTROLS */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">
              থিম ও স্ক্রিন ডিসপ্লে
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Dark Mode Toggle */}
              <button
                type="button"
                onClick={onToggleDarkMode}
                className="flex items-center justify-between gap-2.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-sky-400 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 flex items-center justify-center shrink-0">
                    {isDarkMode ? (
                      <Sun className="w-4 h-4 text-slate-950" />
                    ) : (
                      <Moon className="w-4 h-4 text-slate-950" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                      {isDarkMode ? 'লাইট মোড' : 'ডার্ক মোড'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {isDarkMode ? 'নাইট ভিউ চালু আছে' : 'সাধারণ আলো থিম'}
                    </div>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-black shrink-0 ${
                    isDarkMode
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {isDarkMode ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Fullscreen Header Toggle */}
              <button
                type="button"
                onClick={onToggleFullScreen}
                className="flex items-center justify-between gap-2.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-sky-400 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shrink-0">
                    {isFullScreen ? (
                      <Maximize2 className="w-4 h-4 text-slate-950" />
                    ) : (
                      <Minimize2 className="w-4 h-4 text-slate-950" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                      {isFullScreen ? 'প্যাড হেডার দেখান' : 'ফুল স্ক্রিন ভিউ'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      টপ কোম্পানি প্যাড নিয়ন্ত্রণ
                    </div>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-black shrink-0 ${
                    isFullScreen
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {isFullScreen ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>

            {/* Auto-Refresh Interval */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                <RefreshCw className="w-4 h-4 text-sky-600 dark:text-cyan-400 shrink-0" />
                <span>অটো-রিফ্রেশ সময়:</span>
              </div>
              <div className="flex items-center gap-1.5">
                {([0, 30, 60, 300] as const).map((sec) => (
                  <button
                    key={`settings-ar-${sec}`}
                    type="button"
                    onClick={() => onChangeAutoRefresh(sec)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer transition-colors ${
                      autoRefreshIntervalSec === sec
                        ? 'bg-sky-600 dark:bg-cyan-400 text-white dark:text-slate-950'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {sec === 0 ? 'বন্ধ' : sec === 30 ? '৩০সে' : sec === 60 ? '১মি' : '৫মি'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. DIRECTOR APPS & PORTAL FULL CONTROL */}
          {(isDirectorRole || currentUser.role === 'manager') && onOpenPortalControl && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPortalControl();
              }}
              className="w-full p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-700/60 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Sliders className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-black text-indigo-950 dark:text-indigo-100 truncate">
                    অ্যাপস ও পোর্টাল ফুল কন্ট্রোল সিস্টেম
                  </div>
                  <div className="text-[11px] text-indigo-700 dark:text-indigo-300/85 truncate">
                    যেকোনো পোর্টাল ডিলিট/লক করুন বা নতুন ওয়েব লিংক পোর্টাল এড করুন
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-black shrink-0">
                কন্ট্রোল
              </span>
            </button>
          )}

          {/* 4. DIRECTOR COMPANY SETUP SHORTCUT */}
          {isDirectorRole && onOpenCompanySetup && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCompanySetup();
              }}
              className="w-full p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/35 hover:bg-emerald-100 dark:hover:bg-emerald-950/55 border border-emerald-200 dark:border-emerald-700/60 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-black text-emerald-950 dark:text-emerald-100 truncate">
                    কোম্পানি, পোর্টাল লিংক ও ক্যাশ সেটআপ
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-300/85 truncate">
                    প্রতিষ্ঠানের নাম, লোগো, OLT লিংক ও ডেটা ক্যাশ রিসেট
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-black shrink-0">
                খুলুন
              </span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
            ব্যবহারকারী: <strong className="text-slate-700 dark:text-slate-200">{currentUser.name}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-cyan-400 hover:bg-slate-800 dark:hover:bg-cyan-300 text-white dark:text-slate-950 text-sm font-black transition-colors cursor-pointer"
          >
            সম্পন্ন
          </button>
        </div>
      </div>
    </div>
  );
};
