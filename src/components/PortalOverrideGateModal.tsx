import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Clock,
  KeyRound,
  Lock,
  Unlock,
  UserCheck,
  X
} from 'lucide-react';
import { AdminAuth, UserSession } from '../types';
import {
  DEFAULT_OVERRIDE_DURATION_MINUTES,
  getPortalBengaliLabel,
  grantTemporaryPortalOverride,
  isPortalOverridableForUser
} from '../utils/portalPermissions';
import { toBengaliNumber } from '../utils/formatters';

interface PortalOverrideGateModalProps {
  isOpen: boolean;
  portalId: string | null;
  portalTitle?: string;
  currentUser: UserSession | null;
  adminAuth: AdminAuth | null;
  onClose: () => void;
  onUnlocked: (portalId: string, durationMinutes: number) => void;
}

const DURATION_OPTIONS = [
  { minutes: 15, label: '১৫ মিনিট' },
  { minutes: 30, label: '৩০ মিনিট' },
  { minutes: 60, label: '১ ঘণ্টা' }
];

export const PortalOverrideGateModal: React.FC<PortalOverrideGateModalProps> = ({
  isOpen,
  portalId,
  portalTitle,
  currentUser,
  adminAuth,
  onClose,
  onUnlocked
}) => {
  const [pin, setPin] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(DEFAULT_OVERRIDE_DURATION_MINUTES);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
      setDurationMinutes(DEFAULT_OVERRIDE_DURATION_MINUTES);
    }
  }, [isOpen, portalId]);

  if (!isOpen || !portalId || !currentUser || !isPortalOverridableForUser(portalId, currentUser)) {
    return null;
  }

  const displayTitle = portalTitle || getPortalBengaliLabel(portalId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = grantTemporaryPortalOverride(
      portalId,
      currentUser,
      pin,
      adminAuth,
      durationMinutes
    );
    if (!result.success) {
      setError(result.error || 'ভুল পরিচালক ওভাররাইড পিন! সঠিক পিন দিন।');
      return;
    }
    setPin('');
    setError('');
    onUnlocked(portalId, durationMinutes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full shadow-2xl border border-cyan-500/40 dark:border-cyan-500/40 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#020a18] via-[#041d42] to-slate-900 text-white flex items-center justify-between border-b border-cyan-500/30">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center border border-amber-400/40 shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white truncate">পোর্টাল এন্ট্রি গেট · ওভাররাইড</h3>
              <p className="text-[11px] text-cyan-200 truncate">{displayTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1.5 rounded-lg cursor-pointer"
            aria-label="বন্ধ করুন"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400 font-semibold">স্টাফ:</span>
              <span className="font-black text-slate-900 dark:text-white truncate">{currentUser.name}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400 font-semibold">লক করা পোর্টাল:</span>
              <span className="font-black text-rose-600 dark:text-rose-400 flex items-center gap-1 truncate">
                <Lock className="w-3 h-3 shrink-0" />
                <span>{displayTitle}</span>
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            পরিচালক এই স্টাফের জন্য সাময়িকভাবে শুধু <strong>{displayTitle}</strong> পোর্টালটি আনলক করতে চাইলে তাঁর গোপন ওভাররাইড পিন প্রদান করুন।
          </p>

          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Temporary Duration Selector */}
            <div>
              <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>সাময়িক আনলক সময়সীমা</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.minutes}
                    type="button"
                    onClick={() => setDurationMinutes(opt.minutes)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-black border transition-colors cursor-pointer ${
                      durationMinutes === opt.minutes
                        ? 'bg-cyan-600 text-white border-cyan-500 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Masked Override PIN Input */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                পরিচালক ওভাররাইড পিন *
              </label>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full text-center tracking-widest text-2xl font-mono py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-transform active:scale-95 cursor-pointer"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>আনলক ({toBengaliNumber(durationMinutes)} মিঃ)</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
