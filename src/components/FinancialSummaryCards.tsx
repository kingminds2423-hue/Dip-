import React, { useMemo, useState } from 'react';
import {
  Clock,
  CalendarDays,
  Layers,
  TrendingUp,
  TrendingDown,
  Wallet,
  FileBarChart2
} from 'lucide-react';
import { Transaction } from '../types';
import {
  formatCurrency,
  getTodayString,
  getTransactionDateKey,
  toBengaliNumber
} from '../utils/formatters';

interface FinancialSummaryCardsProps {
  transactions: Transaction[];
  onOpenMonthlyPnL: () => void;
  titleBadge?: string;
}

interface PeriodBucket {
  income: number;
  expense: number;
  net: number;
  count: number;
  activeDays: number;
}

type SummaryMetricMode = 'total' | 'daily';

function calcBucket(list: Transaction[]): PeriodBucket {
  let income = 0;
  let expense = 0;
  const uniqueDates = new Set<string>();
  for (const t of list) {
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') income += amt;
    else expense += amt;
    const dk = getTransactionDateKey(t);
    if (dk) uniqueDates.add(dk);
  }
  return {
    income,
    expense,
    net: income - expense,
    count: list.length,
    activeDays: Math.max(1, uniqueDates.size)
  };
}

export const FinancialSummaryCards: React.FC<FinancialSummaryCardsProps> = ({
  transactions,
  onOpenMonthlyPnL,
  titleBadge
}) => {
  const [metricMode, setMetricMode] = useState<SummaryMetricMode>('total');
  const todayStr = getTodayString();
  const currentMonthStr = todayStr.substring(0, 7);

  const { daily, monthly, total, todayDateLabel, monthLabel } = useMemo(() => {
    const dailyList: Transaction[] = [];
    const monthlyList: Transaction[] = [];

    for (const tx of transactions) {
      const dateKey = getTransactionDateKey(tx);
      if (dateKey === todayStr) {
        dailyList.push(tx);
      }
      if (dateKey.startsWith(currentMonthStr)) {
        monthlyList.push(tx);
      }
    }

    const monthNames = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    const [yr, mo, dy] = todayStr.split('-');
    const mIdx = Math.max(0, Math.min(11, (parseInt(mo, 10) || 1) - 1));
    const formattedToday = `${toBengaliNumber(dy || '')} ${monthNames[mIdx]}, ${toBengaliNumber(yr || '')}`;
    const formattedMonth = `${monthNames[mIdx]} ${toBengaliNumber(yr || '')}`;

    return {
      daily: calcBucket(dailyList),
      monthly: calcBucket(monthlyList),
      total: calcBucket(transactions),
      todayDateLabel: formattedToday,
      monthLabel: formattedMonth
    };
  }, [transactions, todayStr, currentMonthStr]);

  const isDailyAvg = metricMode === 'daily';

  const cards = [
    {
      id: 'daily',
      title: 'দৈনিক হিসাব (আজ)',
      subtitle: isDailyAvg
        ? `তারিখ: ${todayDateLabel} • আজকের ১ দিনের হার`
        : `তারিখ: ${todayDateLabel} • লাইভ দৈনিক ব্যালেন্স`,
      icon: Clock,
      accentBorder: 'border-emerald-400/80 dark:border-emerald-700',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300',
      data: daily,
      divisorDays: 1,
      incomeLabel: isDailyAvg ? 'আজকের গড় জমা/দিন' : 'দৈনিক জমা (Income)',
      expenseLabel: isDailyAvg ? 'আজকের গড় খরচ/দিন' : 'দৈনিক খরচ (Expense)',
      netProfitLabel: isDailyAvg ? 'গড় লাভ/দিন' : 'দৈনিক লাভ / উদ্বৃত্ত',
      netLossLabel: isDailyAvg ? 'গড় ঘাটতি/দিন' : 'দৈনিক ক্ষতি / ঘাটতি'
    },
    {
      id: 'monthly',
      title: isDailyAvg ? 'মাসিক দৈনিক গড়' : 'মাসিক হিসাব (চলতি মাস)',
      subtitle: isDailyAvg
        ? `মাস: ${monthLabel} • ${toBengaliNumber(monthly.activeDays)} সক্রিয় দিনের গড়`
        : `মাস: ${monthLabel} • মাসিক জমা ও খরচ`,
      icon: CalendarDays,
      accentBorder: 'border-indigo-300 dark:border-indigo-700',
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300',
      badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300',
      data: monthly,
      divisorDays: monthly.activeDays,
      incomeLabel: isDailyAvg ? 'মাসিক গড় জমা/দিন' : 'মাসিক জমা (Income)',
      expenseLabel: isDailyAvg ? 'মাসিক গড় খরচ/দিন' : 'মাসিক খরচ (Expense)',
      netProfitLabel: isDailyAvg ? 'গড় লাভ/দিন' : 'মাসিক লাভ (Profit)',
      netLossLabel: isDailyAvg ? 'গড় ক্ষতি/দিন' : 'মাসিক ক্ষতি (Loss)'
    },
    {
      id: 'total',
      title: isDailyAvg ? 'সর্বমোট দৈনিক গড়' : 'সর্বমোট হিসাব (Total)',
      subtitle: isDailyAvg
        ? `মোট ${toBengaliNumber(total.activeDays)} সক্রিয় দিনের দৈনিক গড়`
        : 'সব সংরক্ষিত লেনদেনের মোট হিসাব',
      icon: Layers,
      accentBorder: 'border-amber-300 dark:border-amber-700',
      iconBg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
      data: total,
      divisorDays: total.activeDays,
      incomeLabel: isDailyAvg ? 'গড় জমা / দিন' : 'সর্বমোট জমা (Income)',
      expenseLabel: isDailyAvg ? 'গড় খরচ / দিন' : 'সর্বমোট খরচ (Expense)',
      netProfitLabel: isDailyAvg ? 'গড় উদ্বৃত্ত / দিন' : 'মোট লাভ / ব্যালেন্স',
      netLossLabel: isDailyAvg ? 'গড় ঘাটতি / দিন' : 'মোট ক্ষতি / ঘাটতি'
    }
  ];

  return (
    <div className="space-y-3">
      {/* Top Action Header with Total vs Daily Average Switch + Monthly Report Button */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          <h3 className="text-sm font-black text-slate-900 dark:text-white">
            দৈনিক, মাসিক ও সর্বমোট জমা-খরচ এবং লাভ-ক্ষতি হিসাব
          </h3>
          {titleBadge && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {titleBadge}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Smooth Total vs Daily Average Toggle Switch */}
          <div
            role="group"
            aria-label="হিসাব দেখার ধরন পরিবর্তন (মোট বনাম দৈনিক গড়)"
            className="relative inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs"
          >
            <button
              type="button"
              onClick={() => setMetricMode('total')}
              aria-pressed={!isDailyAvg}
              className={`relative z-10 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-300 ${
                !isDailyAvg
                  ? 'bg-[#064e3b] text-white shadow-sm scale-[1.02]'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              মোট হিসাব (Total)
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('daily')}
              aria-pressed={isDailyAvg}
              className={`relative z-10 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-300 ${
                isDailyAvg
                  ? 'bg-emerald-600 text-white shadow-sm scale-[1.02]'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              দৈনিক গড় (Daily)
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenMonthlyPnL}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white text-xs font-extrabold shadow-sm transition-all active:scale-95"
          >
            <FileBarChart2 className="w-4 h-4 text-amber-300" />
            <span>মাসিক লাভ-ক্ষতি রিপোর্ট</span>
          </button>
        </div>
      </div>

      {/* 3 Separate Structured Cards: Daily, Monthly, Total */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {cards.map((card) => {
          const IconComp = card.icon;
          const divisor = Math.max(1, card.divisorDays);
          const avgIncome = Math.round(card.data.income / divisor);
          const avgExpense = Math.round(card.data.expense / divisor);
          const avgNet = Math.round(card.data.net / divisor);

          const displayIncome = isDailyAvg ? avgIncome : card.data.income;
          const displayExpense = isDailyAvg ? avgExpense : card.data.expense;
          const displayNet = isDailyAvg ? avgNet : card.data.net;
          const isProfit = displayNet >= 0;

          const altIncomeText = isDailyAvg
            ? `মোট: ${formatCurrency(card.data.income)}`
            : `গড়: ${formatCurrency(avgIncome)}/দিন`;
          const altExpenseText = isDailyAvg
            ? `মোট: ${formatCurrency(card.data.expense)}`
            : `গড়: ${formatCurrency(avgExpense)}/দিন`;
          const altNetText = isDailyAvg
            ? `মোট: ${card.data.net >= 0 ? '+' : '-'}${formatCurrency(Math.abs(card.data.net))}`
            : `গড়: ${avgNet >= 0 ? '+' : '-'}${formatCurrency(Math.abs(avgNet))}/দিন`;

          return (
            <div
              key={card.id}
              className={`group/card bg-white dark:bg-slate-900 rounded-2xl border-2 ${card.accentBorder} p-4 shadow-xs transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover/card:scale-110 ${card.iconBg}`}>
                    <IconComp className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {card.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {card.subtitle}
                    </p>
                  </div>
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 transition-transform duration-300 group-hover/card:scale-105 ${card.badgeBg}`}>
                  {toBengaliNumber(card.data.count)}টি লেনদেন
                </span>
              </div>

              {/* 3 Inner Metric Boxes (Deposit, Expense, Profit/Loss) with Smooth Hover Contrast Reveal */}
              <div className="grid grid-cols-3 gap-2">
                {/* Deposit / Income */}
                <div className="group/metric rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/70 p-2.5 transition-all duration-300 ease-out hover:scale-[1.03] hover:bg-emerald-100/80 dark:hover:bg-emerald-950/70 hover:shadow-sm">
                  <div className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1 leading-tight">
                    <TrendingUp className="w-3 h-3 shrink-0 transition-transform duration-300 group-hover/metric:translate-x-0.5 group-hover/metric:-translate-y-0.5" />
                    <span className="truncate">{card.incomeLabel}</span>
                  </div>
                  <div className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums transition-all duration-300">
                    {formatCurrency(displayIncome)}
                  </div>
                  <div className="text-[10px] font-semibold text-emerald-700/80 dark:text-emerald-300/80 mt-0.5 tabular-nums truncate opacity-65 group-hover/card:opacity-100 group-hover/metric:translate-x-0.5 transition-all duration-300">
                    {altIncomeText}
                  </div>
                </div>

                {/* Expense */}
                <div className="group/metric rounded-xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/70 p-2.5 transition-all duration-300 ease-out hover:scale-[1.03] hover:bg-rose-100/80 dark:hover:bg-rose-950/70 hover:shadow-sm">
                  <div className="text-[10px] font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1 leading-tight">
                    <TrendingDown className="w-3 h-3 shrink-0 transition-transform duration-300 group-hover/metric:translate-x-0.5 group-hover/metric:translate-y-0.5" />
                    <span className="truncate">{card.expenseLabel}</span>
                  </div>
                  <div className="text-sm sm:text-base font-black text-rose-700 dark:text-rose-300 mt-1 tabular-nums transition-all duration-300">
                    {formatCurrency(displayExpense)}
                  </div>
                  <div className="text-[10px] font-semibold text-rose-700/80 dark:text-rose-300/80 mt-0.5 tabular-nums truncate opacity-65 group-hover/card:opacity-100 group-hover/metric:translate-x-0.5 transition-all duration-300">
                    {altExpenseText}
                  </div>
                </div>

                {/* Net Profit / Loss */}
                <div
                  className={`group/metric rounded-xl border p-2.5 transition-all duration-300 ease-out hover:scale-[1.03] hover:shadow-sm ${
                    isProfit
                      ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      : 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/70 hover:bg-amber-100/80 dark:hover:bg-amber-950/60'
                  }`}
                >
                  <div
                    className={`text-[10px] font-bold leading-tight truncate ${
                      isProfit
                        ? 'text-slate-700 dark:text-slate-300'
                        : 'text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {isProfit ? card.netProfitLabel : card.netLossLabel}
                  </div>
                  <div
                    className={`text-sm sm:text-base font-black mt-1 tabular-nums transition-all duration-300 ${
                      isProfit
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {isProfit ? '+' : '-'}
                    {formatCurrency(Math.abs(displayNet))}
                  </div>
                  <div
                    className={`text-[10px] font-semibold mt-0.5 tabular-nums truncate opacity-65 group-hover/card:opacity-100 group-hover/metric:translate-x-0.5 transition-all duration-300 ${
                      isProfit
                        ? 'text-slate-600 dark:text-slate-400'
                        : 'text-amber-800/80 dark:text-amber-300/80'
                    }`}
                  >
                    {altNetText}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
