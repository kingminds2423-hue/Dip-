import React, { useMemo, useState } from 'react';
import {
  X,
  FileBarChart2,
  TrendingUp,
  TrendingDown,
  Printer,
  Calendar,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Company, Transaction } from '../types';
import {
  formatCurrency,
  getTodayString,
  getTransactionDateKey,
  toBengaliNumber
} from '../utils/formatters';

interface MonthlyProfitLossModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  company?: Company | null;
}

interface CategorySummary {
  category: string;
  amount: number;
  count: number;
  percent: number;
}

export const MonthlyProfitLossModal: React.FC<MonthlyProfitLossModalProps> = ({
  isOpen,
  onClose,
  transactions,
  company
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getTodayString().substring(0, 7));

  const {
    monthTxCount,
    totalIncome,
    totalExpense,
    netProfit,
    profitMargin,
    incomeByCategory,
    expenseByCategory,
    monthTitle
  } = useMemo(() => {
    const filtered = transactions.filter((t) => {
      const dk = getTransactionDateKey(t);
      return dk.startsWith(selectedMonth);
    });

    let inc = 0;
    let exp = 0;
    const incMap = new Map<string, { amount: number; count: number }>();
    const expMap = new Map<string, { amount: number; count: number }>();

    for (const tx of filtered) {
      const amt = Number(tx.amount) || 0;
      const cat = (tx.category || '').trim() || 'অন্যান্য';
      if (tx.type === 'income') {
        inc += amt;
        const cur = incMap.get(cat) || { amount: 0, count: 0 };
        incMap.set(cat, { amount: cur.amount + amt, count: cur.count + 1 });
      } else {
        exp += amt;
        const cur = expMap.get(cat) || { amount: 0, count: 0 };
        expMap.set(cat, { amount: cur.amount + amt, count: cur.count + 1 });
      }
    }

    const toSortedList = (
      map: Map<string, { amount: number; count: number }>,
      total: number
    ): CategorySummary[] => {
      return Array.from(map.entries())
        .map(([category, info]) => ({
          category,
          amount: info.amount,
          count: info.count,
          percent: total > 0 ? Math.round((info.amount / total) * 100) : 0
        }))
        .sort((a, b) => b.amount - a.amount);
    };

    const monthNamesBangla: Record<string, string> = {
      '01': 'জানুয়ারি',
      '02': 'ফেব্রুয়ারি',
      '03': 'মার্চ',
      '04': 'এপ্রিল',
      '05': 'মে',
      '06': 'জুন',
      '07': 'জুলাই',
      '08': 'আগস্ট',
      '09': 'সেপ্টেম্বর',
      '10': 'অক্টোবর',
      '11': 'নভেম্বর',
      '12': 'ডিসেম্বর'
    };
    const [yr, mo] = selectedMonth.split('-');
    const title = `${monthNamesBangla[mo] || mo} ${toBengaliNumber(yr || '')}`;
    const net = inc - exp;
    const margin = inc > 0 ? ((net / inc) * 100).toFixed(1) : '0';

    return {
      monthTxCount: filtered.length,
      totalIncome: inc,
      totalExpense: exp,
      netProfit: net,
      profitMargin: margin,
      incomeByCategory: toSortedList(incMap, inc),
      expenseByCategory: toSortedList(expMap, exp),
      monthTitle: title
    };
  }, [transactions, selectedMonth]);

  if (!isOpen) return null;

  const isProfit = netProfit >= 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#064e3b] via-emerald-800 to-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <FileBarChart2 className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black">
                মাসিক লাভ-ক্ষতি রিপোর্ট (Monthly Profit & Loss)
              </h2>
              <p className="text-xs text-emerald-100">
                {company?.name || 'DIP BHOLA NETWORK'} • আয়ের উৎস বনাম ব্যয়ের খাতসমূহ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Month Selector & Summary Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
            <div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">নির্বাচিত মাস</div>
              <div className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>{monthTitle}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  {toBengaliNumber(monthTxCount)}টি লেনদেন
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 no-print"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>প্রিন্ট</span>
              </button>
            </div>
          </div>

          {/* 3 Main Figures */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                <span>মাসের মোট আয় / জমা</span>
              </div>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">
                {formatCurrency(totalIncome)}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
              <div className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4" />
                <span>মাসের মোট ব্যয় / খরচ</span>
              </div>
              <div className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-1 tabular-nums">
                {formatCurrency(totalExpense)}
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border-2 ${
                isProfit
                  ? 'bg-emerald-700 text-white border-emerald-600'
                  : 'bg-rose-700 text-white border-rose-600'
              }`}
            >
              <div className="text-xs font-bold flex items-center gap-1.5 opacity-95">
                {isProfit ? <CheckCircle2 className="w-4 h-4 text-amber-300" /> : <AlertTriangle className="w-4 h-4 text-amber-300" />}
                <span>{isProfit ? 'মাসের নিট লাভ (Profit)' : 'মাসের নিট ক্ষতি (Loss)'}</span>
              </div>
              <div className="text-2xl font-black mt-1 tabular-nums">
                {isProfit ? '+' : '-'}
                {formatCurrency(Math.abs(netProfit))}
              </div>
              <div className="text-[11px] opacity-90 mt-0.5">
                লাভের হার: {toBengaliNumber(profitMargin)}%
              </div>
            </div>
          </div>

          {/* Income Sources & Expense Heads Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Income Sources */}
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/70 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-950/50 border-b border-emerald-100 dark:border-emerald-800/70 flex items-center justify-between">
                <span className="text-xs font-black text-emerald-900 dark:text-emerald-200">
                  আয়ের উৎসসমূহ (Income Sources)
                </span>
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(totalIncome)}
                </span>
              </div>

              <div className="p-3 space-y-2.5">
                {incomeByCategory.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    এই মাসে কোনো আয়ের লেনদেন পাওয়া যায়নি।
                  </p>
                ) : (
                  incomeByCategory.map((item) => (
                    <div key={item.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {item.category}{' '}
                          <span className="text-[10px] font-semibold text-slate-400">
                            ({toBengaliNumber(item.count)}টি)
                          </span>
                        </span>
                        <span className="font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                          {formatCurrency(item.amount)} ({toBengaliNumber(item.percent)}%)
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(100, item.percent)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Expense Heads */}
            <div className="rounded-2xl border border-rose-200 dark:border-rose-800/70 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-4 py-3 bg-rose-50 dark:bg-rose-950/50 border-b border-rose-100 dark:border-rose-800/70 flex items-center justify-between">
                <span className="text-xs font-black text-rose-900 dark:text-rose-200">
                  ব্যয়ের খাতসমূহ (Expense Categories)
                </span>
                <span className="text-xs font-black text-rose-700 dark:text-rose-300">
                  {formatCurrency(totalExpense)}
                </span>
              </div>

              <div className="p-3 space-y-2.5">
                {expenseByCategory.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    এই মাসে কোনো খরচের লেনদেন পাওয়া যায়নি।
                  </p>
                ) : (
                  expenseByCategory.map((item) => (
                    <div key={item.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {item.category}{' '}
                          <span className="text-[10px] font-semibold text-slate-400">
                            ({toBengaliNumber(item.count)}টি)
                          </span>
                        </span>
                        <span className="font-black text-rose-700 dark:text-rose-300 tabular-nums">
                          {formatCurrency(item.amount)} ({toBengaliNumber(item.percent)}%)
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-rose-100 dark:bg-rose-950 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-rose-500"
                          style={{ width: `${Math.min(100, item.percent)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Simple Summary Formula */}
          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs font-bold text-slate-700 dark:text-slate-200 flex flex-wrap items-center justify-between gap-2">
            <span>
              সহজ হিসাব: মোট আয় ({formatCurrency(totalIncome)}) − মোট ব্যয় ({formatCurrency(totalExpense)}) ={' '}
              <strong className={isProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
                {isProfit ? 'লাভ ' : 'ক্ষতি '}
                {formatCurrency(Math.abs(netProfit))}
              </strong>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold no-print"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
