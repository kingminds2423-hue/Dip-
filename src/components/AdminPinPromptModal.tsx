import React, { useState } from 'react';
import {
  ShieldAlert,
  Key,
  X,
  UserCheck,
  AlertCircle,
  HelpCircle,
  Lock
} from 'lucide-react';
import { AdminAuth, UserSession } from '../types';
import { isDirector } from '../services/authService';
import { toEnglishDigits } from '../utils/formatters';

interface AdminPinPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  adminAuth: AdminAuth | null;
  currentUser: UserSession;
  title?: string;
  description?: string;
  onOpenForgotPin?: () => void;
}

export const AdminPinPromptModal: React.FC<AdminPinPromptModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  adminAuth,
  currentUser,
  title = 'অ্যাডমিন সিকিউরিটি ভেরিফিকেশন',
  description = 'এই সুরক্ষিত সেটিংসে প্রবেশ করতে প্রধান পরিচালকের ৪-ডিজিট পিন কোড প্রদান করুন।',
  onOpenForgotPin
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (!isOpen || !isDirector(currentUser)) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const targetPin = toEnglishDigits(adminAuth?.pin || '1234').trim();
    const enteredPin = toEnglishDigits(pin).trim();

    if (enteredPin === targetPin) {
      setPin('');
      setError('');
      onSuccess();
      onClose();
    } else {
      setError('ভুল পিন কোড! প্রধান পরিচালকের সঠিক পিন প্রদান করুন।');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 to-rose-950 text-white flex items-center justify-between border-b border-rose-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{title}</h3>
              <p className="text-[10px] text-rose-300">পরিচালক অনুমোদন আবশ্যক</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {description}
          </p>

          {error && (
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  ৪-সংখ্যার পরিচালক পিন *
                </label>
                {onOpenForgotPin && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenForgotPin();
                    }}
                    className="text-[10px] text-amber-600 dark:text-amber-400 font-bold hover:underline"
                  >
                    পিন ভুলে গেছেন?
                  </button>
                )}
              </div>
              <input
                type="password"
                maxLength={6}
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full text-center tracking-widest text-2xl font-mono py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-950/30 transition-transform active:scale-95"
              >
                <UserCheck className="w-4 h-4" />
                যাচাই করুন
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
