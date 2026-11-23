import React, { useEffect, useMemo, useState } from 'react';
import {
  Menu,
  LogOut,
  MessageCircle,
  Plus,
  Minus,
  Wallet,
  Wrench,
  Lock,
  Cpu,
  Settings,
  X
} from 'lucide-react';
import { Company, CustomerComplaint, Transaction, TransactionType, UserSession, WhatsAppGroupConfig } from '../types';
import { normalizeWhatsAppGroupLink } from '../utils/appUrls';
import { formatCurrency, getTodayString, getTransactionDateKey, toBengaliNumber } from '../utils/formatters';
import { AppFontSize, getSavedAppFontSize, subscribeAppFontSize } from '../utils/fontScale';

interface QuickCommandBarProps {
  currentUser: UserSession;
  company?: Company | null;
  transactions?: Transaction[];
  complaints?: CustomerComplaint[];
  canTransactions?: boolean;
  canAddTransactions?: boolean;
  canComplaints?: boolean;
  canAddComplaints?: boolean;
  canViewFinancialTotals?: boolean;
  showFinancialSummary?: boolean;
  showBackToErp?: boolean;
  onBackToErp?: () => void;
  onLockedAction?: (msg: string, portalId?: string, portalTitle?: string) => void;
  onOpenAddModal?: (type: TransactionType) => void;
  onOpenLedger?: () => void;
  onOpenComplaints?: () => void;
  onOpenSidebarMenu?: () => void;
  onOpenSettings?: () => void;
  whatsappGroupConfig?: WhatsAppGroupConfig;
  onLogout: () => void;
}

export const QuickCommandBar: React.FC<QuickCommandBarProps> = ({
  currentUser,
  company,
  transactions = [],
  complaints = [],
  canTransactions = true,
  canAddTransactions,
  canComplaints = true,
  canAddComplaints,
  canViewFinancialTotals,
  showFinancialSummary = false,
  showBackToErp = false,
  onBackToErp,
  onLockedAction,
  onOpenAddModal,
  onOpenLedger,
  onOpenComplaints,
  onOpenSidebarMenu,
  onOpenSettings,
  whatsappGroupConfig,
  onLogout,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [appFontSize, setAppFontSizeState] = useState<AppFontSize>(() => getSavedAppFontSize());

  useEffect(() => subscribeAppFontSize((sz) => setAppFontSizeState(sz)), []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const fontBadgeLabel = appFontSize === 'small' ? 'ছোট' : appFontSize === 'large' ? 'বড়' : 'মাঝারি';
  const isStaffRole = currentUser.role === 'staff';
  const isPartnerRole = currentUser.role === 'partner';
  const allowTxAdd = canTransactions && (canAddTransactions ?? true);
  const allowFinancialTotals = canViewFinancialTotals ?? (!isStaffRole && !isPartnerRole);
  const allowComplaintsOpen = canComplaints && (canAddComplaints ?? true);

  const quickSummary = useMemo(() => {
    const todayKey = getTodayString();
    let todayIncome = 0;
    let todayExpense = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    transactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      const d = getTransactionDateKey(tx);
      if (tx.type === 'income') {
        totalIncome += amt;
        if (d === todayKey) todayIncome += amt;
      } else {
        totalExpense += amt;
        if (d === todayKey) todayExpense += amt;
      }
    });
    return {
      todayIncome,
      todayExpense,
      netBalance: totalIncome - totalExpense
    };
  }, [transactions]);

  const activeComplaintCount = useMemo(
    () => complaints.filter((c) => c.status !== 'resolved').length,
    [complaints]
  );

  const directGroupUrl = normalizeWhatsAppGroupLink(
    isPartnerRole
      ? whatsappGroupConfig?.partnerGroupInviteLink || whatsappGroupConfig?.groupInviteLink
      : isStaffRole
      ? whatsappGroupConfig?.staffGroupInviteLink || whatsappGroupConfig?.groupInviteLink
      : ''
  );

  return (
    <>
      {/* Backdrop when Quick Entry Logo Panel is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[1px] print:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Always-Pinned Floating Quick Entry System Logo at the bottom of the app */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2.5 select-none print:hidden">
        {isOpen && (
          <div className="w-[92vw] max-w-sm rounded-3xl bg-gradient-to-br from-[#020a18] via-[#041d42] to-[#020e21] border-2 border-cyan-300/80 shadow-[0_12px_40px_rgba(2,10,24,0.85),0_0_24px_rgba(56,189,248,0.35)] p-3.5 text-white space-y-3">
            {/* Compact Header inside Popup */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-cyan-400/25">
              <div className="min-w-0">
                <div className="text-xs font-black text-cyan-300 tracking-wide uppercase">
                  Quick Entry System
                </div>
                <div className="text-[11px] text-cyan-100/85 font-semibold truncate">
                  {currentUser.name} · দ্রুত জমা, খরচ ও হিসাব এন্ট্রি
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-rose-500/30 text-cyan-100 cursor-pointer shrink-0"
                aria-label="বন্ধ করুন"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Optional Financial Summary Strip when inside an active programme */}
            {showFinancialSummary && allowFinancialTotals && (
              <div className="grid grid-cols-3 gap-1.5 text-center font-mono tabular-nums text-[11px]">
                <div className="rounded-xl bg-[#03132b] border border-emerald-400/35 px-2 py-1.5">
                  <div className="font-sans text-[10px] text-emerald-200/80">আজকের জমা</div>
                  <div className="font-black text-emerald-300 truncate">+{formatCurrency(quickSummary.todayIncome)}</div>
                </div>
                <div className="rounded-xl bg-[#03132b] border border-rose-400/35 px-2 py-1.5">
                  <div className="font-sans text-[10px] text-rose-200/80">আজকের খরচ</div>
                  <div className="font-black text-rose-300 truncate">-{formatCurrency(quickSummary.todayExpense)}</div>
                </div>
                <div className="rounded-xl bg-[#03132b] border border-cyan-400/35 px-2 py-1.5">
                  <div className="font-sans text-[10px] text-cyan-200/80">নিট ক্যাশ</div>
                  <div className="font-black text-cyan-200 truncate">{formatCurrency(quickSummary.netBalance)}</div>
                </div>
              </div>
            )}

            {/* Primary Accounting Quick Entry Actions: জমা ও খরচ */}
            {!isPartnerRole && onOpenAddModal && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    if (!allowTxAdd) {
                      onLockedAction?.(
                        !canTransactions
                          ? '🔒 "হিসাব খাতা" পোর্টালটি লক করা আছে — জমা এন্ট্রির অনুমতি নেই।'
                          : '🔒 নতুন জমা ও খরচ এন্ট্রি করার অনুমতি অ্যাডমিন বন্ধ রেখেছেন।',
                        !canTransactions ? 'transactions' : undefined,
                        !canTransactions ? 'হিসাব খাতা (জমা ও খরচ এন্ট্রি)' : undefined
                      );
                      return;
                    }
                    onOpenAddModal('income');
                  }}
                  className={`py-3 px-3 rounded-2xl text-sm font-black border shadow-md flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer ${
                    allowTxAdd
                      ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-[#020c1b] border-white/70'
                      : 'bg-slate-800/90 text-slate-300 border-rose-400/50'
                  }`}
                >
                  {allowTxAdd ? <Plus className="w-4 h-4 stroke-[3]" /> : <Lock className="w-3.5 h-3.5 text-rose-300" />}
                  <span>জমা এন্ট্রি</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    if (!allowTxAdd) {
                      onLockedAction?.(
                        !canTransactions
                          ? '🔒 "হিসাব খাতা" পোর্টালটি লক করা আছে — খরচ এন্ট্রির অনুমতি নেই।'
                          : '🔒 নতুন জমা ও খরচ এন্ট্রি করার অনুমতি অ্যাডমিন বন্ধ রেখেছেন।',
                        !canTransactions ? 'transactions' : undefined,
                        !canTransactions ? 'হিসাব খাতা (জমা ও খরচ এন্ট্রি)' : undefined
                      );
                      return;
                    }
                    onOpenAddModal('expense');
                  }}
                  className={`py-3 px-3 rounded-2xl text-sm font-black border shadow-md flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer ${
                    allowTxAdd
                      ? 'bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 text-white border-rose-300/70'
                      : 'bg-slate-800/90 text-slate-300 border-rose-400/50'
                  }`}
                >
                  {allowTxAdd ? <Minus className="w-4 h-4 stroke-[3]" /> : <Lock className="w-3.5 h-3.5 text-rose-300" />}
                  <span>খরচ এন্ট্রি</span>
                </button>
              </div>
            )}

            {/* Ledger & Complaints Row */}
            {!isPartnerRole && (onOpenLedger || onOpenComplaints) && (
              <div className="grid grid-cols-2 gap-2">
                {onOpenLedger && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      if (!canTransactions) {
                        onLockedAction?.(
                          '🔒 "হিসাব খাতা" পোর্টালটি লক করা আছে।',
                          'transactions',
                          'হিসাব খাতা (জমা ও খরচ এন্ট্রি)'
                        );
                        return;
                      }
                      onOpenLedger();
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black border flex items-center justify-center gap-1.5 cursor-pointer ${
                      canTransactions
                        ? 'bg-[#031632] hover:bg-[#05234d] text-cyan-100 border-cyan-400/60'
                        : 'bg-slate-800/90 text-slate-400 border-rose-400/45'
                    }`}
                  >
                    {canTransactions ? <Wallet className="w-4 h-4 text-cyan-300" /> : <Lock className="w-3.5 h-3.5 text-rose-300" />}
                    <span>হিসাব খাতা</span>
                  </button>
                )}

                {onOpenComplaints && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      if (!canComplaints) {
                        onLockedAction?.(
                          '🔒 "অভিযোগ" পোর্টালটি লক করা আছে।',
                          'complaints',
                          'অভিযোগ ও লাইন সার্ভিস'
                        );
                        return;
                      }
                      onOpenComplaints();
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black border flex items-center justify-center gap-1.5 cursor-pointer ${
                      allowComplaintsOpen
                        ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-200'
                        : 'bg-slate-800/90 text-slate-400 border-rose-400/45'
                    }`}
                  >
                    {canComplaints ? <Wrench className="w-3.5 h-3.5 stroke-[2.5]" /> : <Lock className="w-3.5 h-3.5 text-rose-300" />}
                    <span>অভিযোগ</span>
                    {showFinancialSummary && canComplaints && activeComplaintCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-black tabular-nums">
                        {toBengaliNumber(activeComplaintCount)}
                      </span>
                    )}
                  </button>
                )}
              </div>
            )}

            {isPartnerRole && directGroupUrl && (
              <a
                href={directGroupUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsOpen(false)}
                className="w-full py-2.5 px-3 rounded-xl text-xs font-black bg-[#25D366] hover:bg-[#20ba59] text-slate-950 flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp গ্রুপে যান</span>
              </a>
            )}

            {/* Utility Controls: Menu, Back to ERP, Settings, Logout */}
            <div className="pt-2 border-t border-cyan-400/20 flex flex-wrap items-center gap-1.5">
              {onOpenSidebarMenu && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenSidebarMenu();
                  }}
                  className="flex-1 min-w-[75px] py-2 px-2.5 rounded-xl bg-[#031632] hover:bg-cyan-500/25 text-cyan-100 border border-cyan-400/40 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Menu className="w-3.5 h-3.5 text-cyan-300" />
                  <span>মেন্যু</span>
                </button>
              )}

              {showBackToErp && onBackToErp && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onBackToErp();
                  }}
                  className="flex-1 min-w-[80px] py-2 px-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-100 border border-cyan-400/60 text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Cpu className="w-3.5 h-3.5 text-cyan-300" />
                  <span>ERP হাব</span>
                </button>
              )}

              {onOpenSettings && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenSettings();
                  }}
                  className="flex-1 min-w-[85px] py-2 px-2.5 rounded-xl bg-[#031632] hover:bg-cyan-500/25 text-cyan-100 border border-cyan-400/40 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-cyan-300" />
                  <span>সেটিংস ({fontBadgeLabel})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onLogout();
                }}
                className="py-2 px-2.5 rounded-xl bg-rose-950/90 hover:bg-rose-900 text-rose-100 border border-rose-500/60 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                title="লগআউট বা অ্যাকাউন্ট বদলান"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-300" />
                <span>বদলান</span>
              </button>
            </div>
          </div>
        )}

        {/* Iconic Circular Company + Quick Entry Logo Trigger (Always Visible at Bottom) */}
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          aria-label="Quick Entry System খুলুন"
          title="Quick Entry System — চাপ দিলে জমা ও খরচ হিসাব এন্ট্রি দিতে পারবেন"
          className={`group relative flex items-center gap-2 rounded-full p-1.5 pr-3.5 transition-all duration-150 cursor-pointer border-2 shadow-[0_8px_28px_rgba(2,10,24,0.75),0_0_22px_rgba(56,189,248,0.45)] ${
            isOpen
              ? 'bg-cyan-300 text-[#020c1b] border-white scale-105'
              : 'bg-gradient-to-r from-[#020a18] via-[#05234d] to-[#020e21] text-white border-cyan-300/85 hover:border-white hover:scale-105'
          }`}
        >
          <span className="relative w-11 h-11 rounded-full bg-white p-0.5 border border-cyan-300 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
            <img
              src={company?.logoUrl || '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg'}
              alt="Quick Entry"
              className="w-full h-full object-contain rounded-full"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (!img.dataset.fallback) {
                  img.dataset.fallback = '1';
                  img.src = '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg';
                }
              }}
            />
            {!isPartnerRole && (
              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 border border-white text-[#020c1b] font-black text-[10px] flex items-center justify-center shadow">
                ৳
              </span>
            )}
          </span>
          <div className="text-left leading-tight">
            <div className={`text-xs font-black tracking-wide ${isOpen ? 'text-[#020c1b]' : 'text-white'}`}>
              Quick Entry
            </div>
            <div className={`text-[10px] font-bold ${isOpen ? 'text-slate-900' : 'text-cyan-300'}`}>
              {isPartnerRole ? 'মেন্যু ও সেটিংস' : 'জমা · খরচ · হিসাব'}
            </div>
          </div>
        </button>
      </div>
    </>
  );
};
