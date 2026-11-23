import React, { useState } from 'react';
import {
  Download,
  RefreshCw,
  X,
  ShieldCheck,
  CheckCircle2,
  Smartphone,
  Send,
  Sparkles,
  Check,
  Clock,
  Copy
} from 'lucide-react';
import { useAppUpdate } from '../hooks/useAppUpdate';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { toBengaliNumber } from '../utils/formatters';
import { UserSession } from '../types';
import { getGooglePlayStoreUrl } from '../utils/appUrls';

interface PlayStoreUpdateModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
  currentUser?: UserSession | null;
}

export const PlayStoreUpdateModal: React.FC<PlayStoreUpdateModalProps> = ({
  forceOpen = false,
  onClose,
  currentUser,
}) => {
  const {
    currentVersion,
    currentBuildId,
    updateAvailable,
    versionInfo,
    isUpdating,
    updateProgress,
    updateStageLabel,
    isChecking,
    checkStatusMessage,
    lastCheckedAt,
    autoUpdateEnabled,
    setAutoUpdateEnabled,
    isUpdateModalOpen,
    closeUpdateModal,
    applyUpdate,
    dismissUpdate,
    triggerManualCheck,
    isPushingRelease,
    pushLiveUpdateToDevices,
  } = useAppUpdate();

  const { isInstalled, isInstallable, isIOS, install } = usePWAInstall();
  const [customPushNote, setCustomPushNote] = useState('');
  const [pushSuccessToast, setPushSuccessToast] = useState(false);
  const [copiedPlayLink, setCopiedPlayLink] = useState(false);

  const isOpen = forceOpen || isUpdateModalOpen;
  if (!isOpen) return null;

  const playStoreLink = getGooglePlayStoreUrl();

  const handleCopyPlayStoreLink = () => {
    navigator.clipboard.writeText(playStoreLink);
    setCopiedPlayLink(true);
    setTimeout(() => setCopiedPlayLink(false), 2500);
  };

  const handleClose = () => {
    closeUpdateModal();
    if (onClose) onClose();
  };

  const handleInstallApp = async () => {
    await install();
  };

  const handlePushUpdate = async () => {
    const ok = await pushLiveUpdateToDevices(customPushNote);
    if (ok) {
      setPushSuccessToast(true);
      setCustomPushNote('');
      setTimeout(() => setPushSuccessToast(false), 4000);
    }
  };

  const isDirectorOrAdmin =
    currentUser?.role === 'director' || currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const newVersion = versionInfo?.version || currentVersion;
  const releaseNotes = versionInfo?.releaseNotes || [];

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in print:hidden">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border-2 border-emerald-500/50 overflow-hidden text-slate-900 dark:text-slate-100 flex flex-col my-auto">
        {/* Google Play Store Header Bar */}
        <div className="bg-slate-50 dark:bg-slate-800/90 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 select-none">
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
              <path d="M4 3.5V20.5L16.5 12L4 3.5Z" fill="#00C1A4" />
              <path d="M4 3.5L13.5 12.8L16.5 12L4 3.5Z" fill="#00A0FF" />
              <path d="M16.5 12L13.5 11.2L4 20.5L16.5 12Z" fill="#FF3333" />
              <path d="M16.5 12L13.5 11.2L13.5 12.8L16.5 12Z" fill="#FFBA00" />
            </svg>
            <div>
              <span className="text-xs sm:text-sm font-black tracking-tight text-slate-800 dark:text-white block leading-none">
                Google Play · অ্যাপ ইনস্টল ও অটো-আপডেট সেন্টার
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                AI Studio লাইভ সিঙ্ক ও ভার্সন ম্যানেজার
              </span>
            </div>
          </div>

          {!isUpdating && (
            <button
              onClick={handleClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="বন্ধ করুন"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* App Identity Header */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#020c1b] p-0.5 shadow-md border border-cyan-400/70 shrink-0 overflow-hidden flex items-center justify-center">
              <img
                src="/icon-192.png"
                alt="DIP BHOLA NETWORK"
                className="w-full h-full object-cover rounded-xl"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg';
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>প্লে প্রটেক্ট ভেরিফাইড · DIP BHOLA NETWORK</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug truncate">
                হিসাব খাতা ও স্টাফ মনিটরিং অ্যাপ
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span>
                  বর্তমান ভার্সন: <strong className="font-mono text-slate-800 dark:text-slate-200">v{currentVersion}</strong>
                </span>
                <span>•</span>
                <span className="font-mono text-[10px] truncate max-w-[160px]" title={currentBuildId}>
                  Build: {currentBuildId}
                </span>
              </div>
            </div>
          </div>

          {/* 1. INSTALL APP STATUS CARD (PWA Install System) */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  অ্যাপ ইনস্টলেশন স্ট্যাটাস (Install System)
                </h4>
              </div>
              {isInstalled ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  ইনস্টলড (Standalone)
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                  ব্রাউজারে চলছে
                </span>
              )}
            </div>

            {isInstalled ? (
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                এই ডিভাইসে অ্যাপটি অফিসিয়াল অ্যাপ হিসেবে ইনস্টল করা আছে। AI Studio-তে কোনো আপডেট দিলে এই অ্যাপে স্বয়ংক্রিয়ভাবে আপডেট পৌঁছে যাবে।
              </p>
            ) : isInstallable ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  ব্রাউজার বার ছাড়া আসল অ্যান্ড্রয়েড/ডেস্কটপ অ্যাপ হিসেবে এখনই ইনস্টল করুন।
                </p>
                <button
                  onClick={handleInstallApp}
                  className="px-4 py-2 rounded-xl bg-[#01875f] hover:bg-[#01704f] text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>অ্যাপ ইনস্টল করুন</span>
                </button>
              </div>
            ) : isIOS ? (
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                আইফোনে ইনস্টল করতে Safari ব্রাউজারের নিচের <strong>Share (↑)</strong> আইকনে চাপুন এবং{' '}
                <strong>"Add to Home Screen"</strong> নির্বাচন করুন।
              </p>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                মোবাইল বা ডেস্কটপে সরাসরি অ্যাপ ইনস্টল করতে ব্রাউজার মেন্যু (⋮) থেকে{' '}
                <strong>"Install App" / "Add to Home Screen"</strong> নির্বাচন করুন।
              </p>
            )}

            {/* Unified Google Play Store Download & Install Link */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                Download &amp; Install App Link (Google Play Store):
              </div>
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <input
                  type="text"
                  readOnly
                  value={playStoreLink}
                  className="flex-1 bg-transparent px-2 text-[11px] font-mono text-slate-700 dark:text-emerald-300 outline-none select-all truncate"
                />
                <button
                  type="button"
                  onClick={handleCopyPlayStoreLink}
                  className="px-2.5 py-1 rounded-lg bg-[#01875f] hover:bg-[#01704f] text-white text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  {copiedPlayLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedPlayLink ? 'কপি!' : 'কপি'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. AUTO-UPDATE SYSTEM & PROGRESS */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    অটো-আপডেট সিস্টেম (Google Play Style)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    চালু রাখলে AI Studio আপডেট স্বয়ংক্রিয়ভাবে ইনস্টল হবে
                  </p>
                </div>
              </div>

              {/* Auto-Update Switch */}
              <button
                type="button"
                onClick={() => setAutoUpdateEnabled(!autoUpdateEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  autoUpdateEnabled ? 'bg-[#01875f]' : 'bg-slate-300 dark:bg-slate-700'
                }`}
                role="switch"
                aria-checked={autoUpdateEnabled}
                title="অটো-আপডেট চালু/বন্ধ"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
                    autoUpdateEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Update Status & Progress */}
            {isUpdating ? (
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#01875f]" />
                    <span>{updateStageLabel}</span>
                  </span>
                  <span className="font-mono text-[#01875f]">{toBengaliNumber(updateProgress)}%</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-[#01875f] transition-all duration-300 ease-out"
                    style={{ width: `${updateProgress}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  অনুগ্রহ করে অপেক্ষা করুন, আপডেট শেষ হলে অ্যাপটি নতুন ভার্সন নিয়ে রিস্টার্ট হবে।
                </p>
              </div>
            ) : (
              <>
                {/* Check status message */}
                {checkStatusMessage && (
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{checkStatusMessage}</span>
                  </div>
                )}

                {/* Release Notes */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      {updateAvailable ? `নতুন আপডেট (v${newVersion}) বিবরণ:` : `বর্তমান ভার্সন (v${currentVersion}) বৈশিষ্ট্য:`}
                    </span>
                    {lastCheckedAt && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        চেক: {lastCheckedAt}
                      </span>
                    )}
                  </div>
                  {releaseNotes.map((note, idx) => (
                    <div key={idx} className="flex items-start gap-2 pt-0.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="text-slate-700 dark:text-slate-300 text-[11px] leading-snug">{note}</span>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <button
                    onClick={() => triggerManualCheck()}
                    disabled={isChecking}
                    className="flex-1 py-2.5 px-3.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isChecking ? 'animate-spin' : ''}`} />
                    <span>{isChecking ? 'আপডেট খোঁজা হচ্ছে...' : 'আপডেট চেক করুন'}</span>
                  </button>

                  <button
                    onClick={applyUpdate}
                    className={`flex-1 py-2.5 px-4 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer ${
                      updateAvailable
                        ? 'bg-[#01875f] hover:bg-[#01704f] text-white'
                        : 'bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{updateAvailable ? 'এখনই আপডেট করুন' : 'ক্যাশ পরিষ্কার ও রিফ্রেশ'}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 3. DIRECTOR AI STUDIO -> INSTALLED APPS LIVE PUSH */}
          {isDirectorOrAdmin && !isUpdating && (
            <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/70 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                  AI Studio আপডেট সকল ফোনে পাঠান (Director Live Sync)
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                  ক্লাউড পুশ
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                AI Studio-তে নতুন পরিবর্তন করার পর নিচের বাটনে চাপ দিলে সকল ইনস্টল করা মোবাইল/ডেস্কটপ অ্যাপে সাথে সাথেই অটো-আপডেট নোটিফিকেশন চলে যাবে।
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={customPushNote}
                  onChange={(e) => setCustomPushNote(e.target.value)}
                  placeholder="আপডেটের নোট লিখুন (ঐচ্ছিক, যেমন: নতুন বিলিং ফিচার যুক্ত হয়েছে)"
                  className="flex-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-700 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handlePushUpdate}
                  disabled={isPushingRelease}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs shrink-0 cursor-pointer disabled:opacity-60"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isPushingRelease ? 'পাঠানো হচ্ছে...' : 'সকল অ্যাপে পাঠান'}</span>
                </button>
              </div>

              {pushSuccessToast && (
                <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>সকল ইনস্টল করা ডিভাইসে আপডেট বার্তা পাঠানো সম্পন্ন হয়েছে!</span>
                </div>
              )}
            </div>
          )}

          {/* Footer Dismiss */}
          {!isUpdating && updateAvailable && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  dismissUpdate();
                  handleClose();
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
              >
                পরে আপডেট করব
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
