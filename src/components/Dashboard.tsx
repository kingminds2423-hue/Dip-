import React, { useMemo, useState } from 'react';
import {
  Wallet,
  Calendar,
  Users,
  PieChart,
  Plus,
  Minus,
  ArrowRight,
  Printer,
  AlertTriangle,
  Wrench,
  Hash,
  Search,
  RotateCcw,
  Zap,
  CheckCircle,
  X,
  Coins,
  RefreshCw,
  Activity,
  CheckCircle2,
  Router,
  Globe
} from 'lucide-react';
import {
  Transaction,
  Staff,
  Partner,
  Company,
  UserSession,
  CustomerComplaint,
  WhatsAppGroupConfig,
  AuditLog,
  CustomerMember,
  CustomerDue
} from '../types';
import {
  formatCurrency,
  toBengaliNumber,
  formatBengaliDate,
  getTodayString,
  getYesterdayString,
  getLastMonthString,
  getTransactionDateKey,
  matchesTransactionSearch,
  parseNumericInput
} from '../utils/formatters';
import { isCustomerExpired } from '../utils/customerStatus';
import {
  analyzeCustomerDatabaseBloat,
  cleanupAndDeduplicateCustomers
} from '../services/dataService';
import { PrintStudioModal } from './PrintStudioModal';
import { FinancialSummaryCards } from './FinancialSummaryCards';
import { MonthlyProfitLossModal } from './MonthlyProfitLossModal';
const MonthlyComparisonChart = React.lazy(() =>
  import('./MonthlyComparisonChart').then((m) => ({ default: m.MonthlyComparisonChart }))
);

interface DashboardProps {
  transactions: Transaction[];
  staffs: Staff[];
  partners: Partner[];
  company: Company | null;
  currentUser: UserSession;
  complaints?: CustomerComplaint[];
  customers?: CustomerMember[];
  customerDues?: CustomerDue[];
  auditLogs?: AuditLog[];
  whatsappGroupConfig?: WhatsAppGroupConfig | null;
  onOpenAddModal: (type: 'income' | 'expense') => void;
  onViewAllTransactions: () => void;
  onViewStaff: () => void;
  onViewPartners: () => void;
  onViewComplaints?: () => void;
  onOpenAddComplaint?: () => void;
  onQuickExpense?: (data: { title: string; category: string; amount: number; paymentMethod: string; note?: string }) => Promise<void>;
  onNavigateTab?: (tab: string) => void;
}

type QuickDateFilter = 'today' | 'yesterday' | 'this_month' | 'last_month' | 'pick_month' | 'this_year' | 'custom_single' | 'custom_range' | 'all';

export const Dashboard: React.FC<DashboardProps> = ({
  transactions,
  staffs,
  partners,
  company,
  currentUser,
  complaints = [],
  customers = [],
  customerDues = [],
  auditLogs = [],
  whatsappGroupConfig,
  onOpenAddModal,
  onViewAllTransactions,
  onViewStaff,
  onViewPartners,
  onViewComplaints,
  onOpenAddComplaint,
  onQuickExpense,
  onNavigateTab,
}) => {
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);
  const [isPrintStudioOpen, setIsPrintStudioOpen] = useState(false);
  const [isMonthlyPnLOpen, setIsMonthlyPnLOpen] = useState(false);
  const [isCleaningDb, setIsCleaningDb] = useState(false);
  const [dbCleanMessage, setDbCleanMessage] = useState<string | null>(null);

  // Quick Expense state
  const [isQuickExpenseOpen, setIsQuickExpenseOpen] = useState(false);
  const [quickSuccessToast, setQuickSuccessToast] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [customCategory, setCustomCategory] = useState('অফিস পরিচালনা খরচ');
  const [customPayment, setCustomPayment] = useState('cash');
  const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);

  const quickPresets = [
    { title: 'অফিসের নাস্তা ও চা-বিস্কুট', amount: 100, category: 'অফিস পরিচালনা খরচ', icon: '☕' },
    { title: 'যাতায়াত ও রিকশা ভাড়া', amount: 60, category: 'যাতায়াত ও ডেলিভারি খরচ', icon: '🛺' },
    { title: 'স্টেশনারি ও খাতা-কলম', amount: 120, category: 'স্টেশনারি ও প্রিন্টিং', icon: '📝' },
    { title: 'জরুরি ড্রপ ক্যাবল ও ক্লিপ', amount: 200, category: 'নেটওয়ার্ক সরঞ্জাম ও অপটিক্যাল ফাইবার', icon: '🔌' },
    { title: 'জেনারেটর / বাইক তেল খরচ', amount: 350, category: 'পরিবহন ও ফুয়েল', icon: '⛽' },
    { title: 'ইন্টারনেট ব্যান্ডউইথ ও আপস্ট্রিম বিল', amount: 5000, category: 'ইন্টারনেট ব্যান্ডউইথ বিল', icon: '🌐' }
  ];

  const triggerQuickExpense = async (data: { title: string; category: string; amount: number; paymentMethod?: string }) => {
    if (!data.amount || data.amount <= 0 || !data.title.trim()) return;
    setIsSubmittingQuick(true);
    try {
      if (onQuickExpense) {
        await onQuickExpense({
          title: data.title.trim(),
          category: data.category,
          amount: data.amount,
          paymentMethod: data.paymentMethod || 'cash',
          note: 'দ্রুত খরচ এন্ট্রি'
        });
      } else {
        onOpenAddModal('expense');
      }
      setQuickSuccessToast(`"৳${toBengaliNumber(data.amount)} - ${data.title}" খরচ সফলভাবে সংরক্ষিত হয়েছে!`);
      setTimeout(() => setQuickSuccessToast(null), 3500);
      setIsQuickExpenseOpen(false);
      setCustomTitle('');
      setCustomAmount('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingQuick(false);
    }
  };

  // Today & Month strings
  const todayStr = useMemo(() => getTodayString(), []);
  const yesterdayStr = useMemo(() => getYesterdayString(), []);
  const currentMonthStr = useMemo(() => todayStr.substring(0, 7), [todayStr]);
  const lastMonthStr = useMemo(() => getLastMonthString(), []);

  // Dedicated Date Search & Filter States (default 'all' so all saved records show immediately)
  const [activeDateFilter, setActiveDateFilter] = useState<QuickDateFilter>('all');
  const [selectedSingleDate, setSelectedSingleDate] = useState<string>(todayStr);
  const [selectedMonthSearch, setSelectedMonthSearch] = useState<string>(currentMonthStr);
  const [selectedYearSearch, setSelectedYearSearch] = useState<string>(todayStr.substring(0, 4));
  const [dateRangeStart, setDateRangeStart] = useState<string>(todayStr);
  const [dateRangeEnd, setDateRangeEnd] = useState<string>(todayStr);
  const [dateSearchQuery, setDateSearchQuery] = useState<string>('');

  const availableYears = useMemo(() => {
    const yrs = new Set<string>([todayStr.substring(0, 4)]);
    transactions.forEach((tx) => {
      if (tx.date && tx.date.length >= 4) yrs.add(tx.date.substring(0, 4));
    });
    return Array.from(yrs).sort().reverse();
  }, [transactions, todayStr]);

  // 1. Overall Lifetime Statistics (used internally & for partner section)
  const lifetimeStats = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    transactions.forEach((tx) => {
      if (tx.type === 'income') totalIncome += tx.amount;
      else totalExpense += tx.amount;
    });
    const totalInvestment = partners.reduce((sum, p) => sum + (p.investment || 0), 0);
    return {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      totalCount: transactions.length,
      totalInvestment
    };
  }, [transactions, partners]);

  // 2. Today's Statistics
  const todayStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    let count = 0;
    transactions.forEach((tx) => {
      if (getTransactionDateKey(tx) === todayStr) {
        count++;
        if (tx.type === 'income') income += tx.amount;
        else expense += tx.amount;
      }
    });
    return {
      income,
      expense,
      net: income - expense,
      count
    };
  }, [transactions, todayStr]);

  // 2b. Live Customer Database, Collection, Active & Expired Customer Summary
  const customerLiveOverview = useMemo(() => {
    let activeDb = 0;
    let expiredDb = 0;
    let inactiveDb = 0;
    let totalCustomerBillDue = 0;

    customers.forEach((c) => {
      if (isCustomerExpired(c)) {
        expiredDb++;
      } else if (c.status === 'active') {
        activeDb++;
      } else {
        inactiveDb++;
      }
      if (typeof c.dueAmount === 'number' && Number.isFinite(c.dueAmount) && c.dueAmount > 0) {
        totalCustomerBillDue += c.dueAmount;
      }
    });

    const monthlyLedgerIncome = transactions.reduce((sum, tx) => {
      if (tx.type === 'income' && getTransactionDateKey(tx).startsWith(currentMonthStr)) {
        return sum + (tx.amount || 0);
      }
      return sum;
    }, 0);

    const ledgerTotalDue = customerDues.reduce((sum, d) => sum + Math.max(0, d.currentDue || 0), 0);

    return {
      activeDb,
      expiredDb,
      inactiveDb,
      totalDb: customers.length,
      activeDisplay: activeDb,
      expiredDisplay: expiredDb,
      todayLedgerIncome: todayStats.income,
      monthlyLedgerIncome,
      totalDueDisplay: ledgerTotalDue > 0 ? ledgerTotalDue : totalCustomerBillDue
    };
  }, [customers, customerDues, transactions, currentMonthStr, todayStats.income]);

  const bloatReport = useMemo(
    () => analyzeCustomerDatabaseBloat(customers),
    [customers]
  );

  const canCleanCustomers =
    currentUser.role === 'director' ||
    currentUser.role === 'admin' ||
    currentUser.role === 'manager';

  const handleQuickCleanDbBloat = async () => {
    if (isCleaningDb) return;
    setIsCleaningDb(true);
    setDbCleanMessage(null);
    try {
      const res = await cleanupAndDeduplicateCustomers(customers, {
        mergeDuplicates: true,
        deletePhantoms: true
      });
      setDbCleanMessage(
        `${toBengaliNumber(res.mergedGroupCount)} টি ডুপ্লিকেট একত্রিত ও ${toBengaliNumber(res.deletedCount)} টি বাড়তি/ভুয়া রেকর্ড মুছে ফেলা হয়েছে — বর্তমান গ্রাহক ${toBengaliNumber(res.remainingCount)} জন।`
      );
    } catch {
      setDbCleanMessage('ডাটাবেস পরিষ্কার করতে সাময়িক সমস্যা হয়েছে।');
    } finally {
      setIsCleaningDb(false);
    }
  };

  // 3. Interactive Date / Month / Year Filtered Transactions List & Stats
  const { filteredTransactions, filteredStats, filterLabel } = useMemo(() => {
    let list: Transaction[] = [];
    let label = '';

    if (activeDateFilter === 'today') {
      label = `আজকের হিসাব (${formatBengaliDate(todayStr)})`;
      list = transactions.filter((t) => getTransactionDateKey(t) === todayStr);
    } else if (activeDateFilter === 'yesterday') {
      label = `গতকালের হিসাব (${formatBengaliDate(yesterdayStr)})`;
      list = transactions.filter((t) => getTransactionDateKey(t) === yesterdayStr);
    } else if (activeDateFilter === 'this_month') {
      label = `চলতি মাসের হিসাব (${toBengaliNumber(currentMonthStr)})`;
      list = transactions.filter((t) => getTransactionDateKey(t).startsWith(currentMonthStr));
    } else if (activeDateFilter === 'last_month') {
      label = `গত মাসের হিসাব (${toBengaliNumber(lastMonthStr)})`;
      list = transactions.filter((t) => getTransactionDateKey(t).startsWith(lastMonthStr));
    } else if (activeDateFilter === 'pick_month') {
      label = `নির্বাচিত মাসের হিসাব (${toBengaliNumber(selectedMonthSearch)})`;
      list = transactions.filter((t) => getTransactionDateKey(t).startsWith(selectedMonthSearch));
    } else if (activeDateFilter === 'this_year') {
      label = `বাৎসরিক হিসাব (${toBengaliNumber(selectedYearSearch)})`;
      list = transactions.filter((t) => getTransactionDateKey(t).startsWith(selectedYearSearch));
    } else if (activeDateFilter === 'custom_single') {
      label = `নির্দিষ্ট তারিখ: ${formatBengaliDate(selectedSingleDate)}`;
      list = transactions.filter((t) => getTransactionDateKey(t) === selectedSingleDate);
    } else if (activeDateFilter === 'custom_range') {
      const start = dateRangeStart <= dateRangeEnd ? dateRangeStart : dateRangeEnd;
      const end = dateRangeStart <= dateRangeEnd ? dateRangeEnd : dateRangeStart;
      label = `${formatBengaliDate(start)} থেকে ${formatBengaliDate(end)}`;
      list = transactions.filter((t) => {
        const dk = getTransactionDateKey(t);
        if (!dk) return false;
        return dk >= start && dk <= end;
      });
    } else {
      label = 'সর্বমোট সকল দিনের হিসাব';
      list = [...transactions];
    }

    // Additional search query within date filter (supports Bengali & English numerals)
    if (dateSearchQuery.trim()) {
      list = list.filter((t) => matchesTransactionSearch(t, dateSearchQuery));
    }

    let inc = 0;
    let exp = 0;
    list.forEach((t) => {
      if (t.type === 'income') inc += t.amount;
      else exp += t.amount;
    });

    return {
      filteredTransactions: list,
      filteredStats: {
        income: inc,
        expense: exp,
        net: inc - exp,
        count: list.length
      },
      filterLabel: label
    };
  }, [
    transactions,
    activeDateFilter,
    todayStr,
    yesterdayStr,
    currentMonthStr,
    lastMonthStr,
    selectedMonthSearch,
    selectedYearSearch,
    selectedSingleDate,
    dateRangeStart,
    dateRangeEnd,
    dateSearchQuery
  ]);

  // 4. Activity Feed: Last 5 combined recent transactions & audit logs
  const activityFeedItems = useMemo(() => {
    type FeedItem = {
      id: string;
      kind: 'audit' | 'income' | 'expense';
      title: string;
      subtitle: string;
      actor: string;
      timestamp: string;
      amount?: number;
      pending?: boolean;
    };

    const items: FeedItem[] = [];
    auditLogs.slice(0, 8).forEach((log) => {
      items.push({
        id: `audit-${log.id}`,
        kind: 'audit',
        title: log.actionBengali,
        subtitle: log.details,
        actor: log.performedBy,
        timestamp: log.timestamp
      });
    });

    transactions.slice(0, 8).forEach((tx) => {
      items.push({
        id: `tx-${tx.id}`,
        kind: tx.type === 'income' ? 'income' : 'expense',
        title: tx.title,
        subtitle: `${tx.category} • ${formatBengaliDate(tx.date)}`,
        actor: tx.addedBy,
        timestamp: tx.createdAt || `${tx.date}T00:00:00.000Z`,
        amount: tx.amount,
        pending: tx._pendingSync
      });
    });

    return items
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  }, [auditLogs, transactions]);

  const threshold = company?.dailyExpenseThreshold || 5000;
  const isAdminOnly = currentUser.role === 'admin' || currentUser.role === 'director';
  const isManagerOrDirector = isAdminOnly || currentUser.role === 'manager';
  const isThresholdCrossed = isManagerOrDirector && todayStats.expense >= threshold;

  return (
    <div className="space-y-6">
      <div className="space-y-6 print:hidden">
      {/* Daily Expense Alert Notification Banner for Manager & Director */}
      {isThresholdCrossed && !isAlertDismissed && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-900 via-red-900 to-rose-950 text-white border-2 border-rose-500 shadow-xl shadow-rose-950/40 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600/90 border border-rose-400 flex items-center justify-center shrink-0 shadow-md">
                <AlertTriangle className="w-5 h-5 text-yellow-300 animate-bounce" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-1.5">
                    <span>⚠️ আজকের মোট ব্যয় নির্ধারিত সীমা অতিক্রম করেছে!</span>
                  </h3>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-400 text-slate-950">
                    দৈনিক সীমা সতর্কবার্তা
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-rose-100 mt-1">
                  কোম্পানি সেটিংসে নির্ধারিত দৈনিক ব্যয়ের সীমা <strong>{formatCurrency(threshold)}</strong>। কিন্তু আজ মোট ব্যয় হয়েছে{' '}
                  <strong className="text-yellow-300 text-sm">{formatCurrency(todayStats.expense)}</strong>{' '}
                  (সীমার চেয়ে অতিরিক্ত: <strong>{formatCurrency(todayStats.expense - threshold)}</strong>)।
                </p>
                <div className="mt-3 flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={() => {
                      setActiveDateFilter('today');
                      const el = document.getElementById('date-explorer-section');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-3.5 py-1.5 bg-white hover:bg-rose-50 text-rose-950 text-xs font-bold rounded-lg shadow-sm transition-all"
                  >
                    আজকের খরচের তালিকা পরীক্ষা করুন →
                  </button>
                  <button
                    onClick={() => setIsAlertDismissed(true)}
                    className="px-3 py-1.5 bg-rose-800/90 hover:bg-rose-800 text-rose-200 text-xs font-semibold rounded-lg transition-all"
                  >
                    অবহিত হলাম (বন্ধ করুন)
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsAlertDismissed(true)}
              className="p-1 rounded-lg text-rose-300 hover:text-white hover:bg-rose-800/60 transition-colors shrink-0"
              title="বিজ্ঞপ্তি বন্ধ করুন"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-5 sm:p-6 text-white shadow-lg relative overflow-hidden border border-slate-700/50">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white p-1.5 flex items-center justify-center shrink-0 shadow-md">
              <img
                src={company?.logoUrl || '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg'}
                alt={company?.name || 'Dip Bhola network'}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  স্বাগতম, {currentUser.name} ({currentUser.role === 'admin' ? 'পরিচালক' : currentUser.role === 'manager' ? 'ম্যানেজার' : 'স্টাফ'})
                </span>
                <span className="text-xs text-slate-400">
                  • আজ: {formatBengaliDate(todayStr)}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                {company?.name || 'DIP BHOLA NETWORK'} এর কেন্দ্রীয় হিসাব ড্যাশবোর্ড
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                দৈনিক খরচ ও জমা, মাসিক বিবরণী এবং যেকোনো তারিখ সার্চ করে হিসাব বের করার রিয়েল-টাইম সিস্টেম।
              </p>
            </div>
          </div>

          {/* Quick Add Buttons */}
          <div className="flex items-center flex-wrap gap-2 shrink-0">
            <button
              onClick={() => setIsQuickExpenseOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-amber-950/40 transition-transform active:scale-95"
              title="ছোট ছোট নিয়মিত খরচ ১-ক্লিকে এন্ট্রি করুন"
            >
              <Zap className="w-4 h-4 fill-amber-200 text-white animate-pulse" />
              দ্রুত খরচ (Quick Expense)
            </button>
            <button
              onClick={() => onOpenAddModal('income')}
              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-emerald-900/40 transition-transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              নতুন জমা / আয়
            </button>
            <button
              onClick={() => onOpenAddModal('expense')}
              className="px-3.5 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-rose-900/40 transition-transform active:scale-95"
            >
              <Minus className="w-4 h-4" />
              নতুন খরচ / ব্যয়
            </button>
          </div>
        </div>

        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-emerald-500/10 to-transparent pointer-events-none"></div>
      </div>


      {/* ========================================================================= */}
      {/* গ্রাহক সংযোগ, আদায়, Active ও Expired সংক্ষিপ্ত চিত্র                       */}
      {/* ========================================================================= */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                গ্রাহক সংযোগ, আদায়, Active ও Expired সারাংশ
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                সদস্য ডিরেক্টরি, হিসাব খাতা ও সমস্যা সমাধান পোর্টালের সমন্বিত তথ্য
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab?.('troubleshoot_portal')}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              সমস্যা সমাধান পোর্টাল খুলুন
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Customer Active */}
          <button
            type="button"
            onClick={() => onNavigateTab?.('customers')}
            className="text-left p-3.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              <span>কাস্টমার Active</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2 tabular-nums">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {toBengaliNumber(customerLiveOverview.activeDisplay)}
              </span>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">জন সচল</span>
            </div>
            <div className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400 tabular-nums space-y-0.5">
              <div>ডাটাবেস সচল: <strong>{toBengaliNumber(customerLiveOverview.activeDb)}</strong> / {toBengaliNumber(customerLiveOverview.totalDb)} জন</div>
            </div>
          </button>

          {/* Card 2: Customer Expired / Inactive */}
          <button
            type="button"
            onClick={() => onNavigateTab?.('customers')}
            className="text-left p-3.5 rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-rose-800 dark:text-rose-300">
              <span>কাস্টমার Expired / বন্ধ</span>
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2 tabular-nums">
              <span className="text-2xl font-extrabold text-rose-700 dark:text-rose-300">
                {toBengaliNumber(customerLiveOverview.expiredDisplay)}
              </span>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">জন মেয়াদ শেষ</span>
            </div>
            <div className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400 tabular-nums space-y-0.5">
              <div>ডাটাবেস Expired: <strong className="text-rose-700 dark:text-rose-300">{toBengaliNumber(customerLiveOverview.expiredDb)}</strong> জন</div>
              <div>বন্ধ / বিচ্ছিন্ন (Inactive): <strong>{toBengaliNumber(customerLiveOverview.inactiveDb)}</strong> জন</div>
            </div>
          </button>

          {/* Card 3: Collection (আজকের ও মাসিক আদায়) */}
          <button
            type="button"
            onClick={onViewAllTransactions}
            className="text-left p-3.5 rounded-xl border border-sky-200/80 dark:border-sky-900/60 bg-sky-50/40 dark:bg-sky-950/20 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-sky-800 dark:text-sky-300">
              <span>বিল আদায় (হিসাব খাতা)</span>
              <Coins className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2 tabular-nums">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {formatCurrency(customerLiveOverview.todayLedgerIncome)}
              </span>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">আজকে</span>
            </div>
            <div className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400 tabular-nums space-y-0.5">
              <div>হিসাব খাতা চলতি মাস: <strong>{formatCurrency(customerLiveOverview.monthlyLedgerIncome)}</strong></div>
            </div>
          </button>

          {/* Card 4: Remaining Due */}
          <button
            type="button"
            onClick={() => onNavigateTab?.('dues')}
            className="text-left p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-amber-800 dark:text-amber-300">
              <span>মোট বকেয়া ও বাকি খাতা</span>
              <Router className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2 tabular-nums">
              <span className="text-2xl font-extrabold text-amber-700 dark:text-amber-300">
                {formatCurrency(customerLiveOverview.totalDueDisplay)}
              </span>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">মোট বকেয়া</span>
            </div>
            <div className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400 tabular-nums space-y-0.5">
              <div>বাকি খাতা এন্ট্রি: <strong>{toBengaliNumber(customerDues.filter((d) => (d.currentDue || 0) > 0).length)}</strong> জন</div>
            </div>
          </button>
        </div>

        {(bloatReport.hasSignificantBloat ||
          bloatReport.cleanupCandidateIds.length > 0 ||
          dbCleanMessage) && (
          <div
            className={`rounded-xl p-3.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              dbCleanMessage && bloatReport.cleanupCandidateIds.length === 0
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/70'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/80'
            }`}
          >
            <div className="space-y-1 text-xs">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  {dbCleanMessage
                    ? dbCleanMessage
                    : `ডাটাবেজে মোট ${toBengaliNumber(bloatReport.totalDb)} টি রেকর্ড রয়েছে — কিছু ডুপ্লিকেট বা ভুয়া এন্ট্রি পরিষ্কারযোগ্য`}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                ডুপ্লিকেট: <strong>{toBengaliNumber(bloatReport.duplicateDocIds.length)}</strong> টি •{' '}
                ভুয়া/লগ/MAC-only: <strong>{toBengaliNumber(bloatReport.phantomDocIds.length)}</strong> টি
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {canCleanCustomers && bloatReport.cleanupCandidateIds.length > 0 && (
                <button
                  type="button"
                  disabled={isCleaningDb}
                  onClick={() => void handleQuickCleanDbBloat()}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCleaningDb ? 'animate-spin' : ''}`} />
                  <span>
                    {isCleaningDb
                      ? 'পরিষ্কার হচ্ছে...'
                      : '১ ক্লিকে ডুপ্লিকেট ও ভুয়া রেকর্ড পরিষ্কার করুন'}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigateTab?.('customers')}
                className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
              >
                গ্রাহক তালিকায় বিস্তারিত দেখুন
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* আলাদা আলাদা দৈনিক, মাসিক ও সর্বমোট জমা-খরচ এবং লাভ-ক্ষতি কার্ডসমূহ */}
      {/* ========================================================================= */}
      <FinancialSummaryCards
        transactions={transactions}
        onOpenMonthlyPnL={() => setIsMonthlyPnLOpen(true)}
      />

      <MonthlyProfitLossModal
        isOpen={isMonthlyPnLOpen}
        onClose={() => setIsMonthlyPnLOpen(false)}
        transactions={transactions}
        company={company}
      />

      {/* ========================================================================= */}
      {/* তারিখ, মাস ও বছর অনুযায়ী সার্চ ও খরচ-জমা অনুসন্ধান সেকশন */}
      {/* ========================================================================= */}
      <div id="date-explorer-section" className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-emerald-400 dark:border-emerald-700 shadow-lg p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                দিন, মাস বা বছর সার্চ করে খরচ ও জমার হিসাব অনুসন্ধান
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              যেকোনো নির্দিষ্ট তারিখ, মাস, বছর অথবা তারিখের রেঞ্জ দিয়ে সরাসরি খরচ ও জমা হিসাব বের করুন।
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setActiveDateFilter('today');
                setSelectedSingleDate(todayStr);
                setSelectedMonthSearch(currentMonthStr);
                setDateSearchQuery('');
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              রিসেট
            </button>
            <button
              onClick={() => setIsPrintStudioOpen(true)}
              className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-xs"
              title="নির্বাচিত তারিখের ভাউচার A4/Legal প্রিন্ট, PDF ডাউনলোড ও WhatsApp/Gmail এ শেয়ার করুন"
            >
              <Printer className="w-3.5 h-3.5" />
              এই তারিখের ভাউচার প্রিন্ট / PDF
            </button>
          </div>
        </div>

        {/* Quick Date Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">দ্রুত ফিল্টার:</span>
          <button
            onClick={() => setActiveDateFilter('today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeDateFilter === 'today'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            আজ (Today)
          </button>
          <button
            onClick={() => setActiveDateFilter('yesterday')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeDateFilter === 'yesterday'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            গতকাল (Yesterday)
          </button>
          <button
            onClick={() => setActiveDateFilter('this_month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeDateFilter === 'this_month'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            চলতি মাস
          </button>
          <button
            onClick={() => setActiveDateFilter('last_month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeDateFilter === 'last_month'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            গত মাস
          </button>
          <button
            onClick={() => setActiveDateFilter('pick_month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeDateFilter === 'pick_month'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            মাস নির্বাচন
          </button>
          <button
            onClick={() => setActiveDateFilter('this_year')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeDateFilter === 'this_year'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            বাৎসরিক হিসাব
          </button>
          <button
            onClick={() => setActiveDateFilter('custom_single')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeDateFilter === 'custom_single'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            নির্দিষ্ট তারিখ
          </button>
          <button
            onClick={() => setActiveDateFilter('custom_range')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeDateFilter === 'custom_range'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            তারিখের রেঞ্জ (From - To)
          </button>
          <button
            onClick={() => setActiveDateFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeDateFilter === 'all'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            সব হিসাব
          </button>
        </div>

        {/* Date Pickers Bar & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
          {activeDateFilter === 'pick_month' ? (
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                যেকোনো মাস নির্বাচন করুন:
              </label>
              <input
                type="month"
                value={selectedMonthSearch}
                onChange={(e) => setSelectedMonthSearch(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ) : activeDateFilter === 'this_year' ? (
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                বছর নির্বাচন করুন:
              </label>
              <select
                value={selectedYearSearch}
                onChange={(e) => setSelectedYearSearch(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {toBengaliNumber(yr)} সাল
                  </option>
                ))}
              </select>
            </div>
          ) : activeDateFilter === 'custom_single' ? (
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                নির্দিষ্ট তারিখ নির্বাচন করুন:
              </label>
              <input
                type="date"
                value={selectedSingleDate}
                onChange={(e) => setSelectedSingleDate(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          ) : activeDateFilter === 'custom_range' ? (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  শুরু তারিখ (From):
                </label>
                <input
                  type="date"
                  value={dateRangeStart}
                  onChange={(e) => setDateRangeStart(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  শেষ তারিখ (To):
                </label>
                <input
                  type="date"
                  value={dateRangeEnd}
                  onChange={(e) => setDateRangeEnd(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </>
          ) : (
            <div className="lg:col-span-2 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <span className="font-bold">বর্তমান ফিল্টার:</span>
              <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold rounded-md">
                {filterLabel}
              </span>
            </div>
          )}

          {/* Search by text inside the date */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              বিবরণ, এন্ট্রিদাতা বা ক্যাটাগরি দিয়ে খুঁজুন:
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={dateSearchQuery}
                onChange={(e) => setDateSearchQuery(e.target.value)}
                placeholder="যেমন: লাইন সমস্যা, তেল খরচ, বা নাম..."
                className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Selected Period Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">মোট জমা (Income)</span>
            <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatCurrency(filteredStats.income)}
            </div>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">মোট খরচ (Expense)</span>
            <div className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">
              {formatCurrency(filteredStats.expense)}
            </div>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">নিট উদ্বৃত্ত (Net)</span>
            <div className={`text-base sm:text-lg font-black mt-0.5 ${
              filteredStats.net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
            }`}>
              {formatCurrency(filteredStats.net)}
            </div>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">মোট রেকর্ড</span>
            <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {toBengaliNumber(filteredStats.count)} টি
            </div>
          </div>
        </div>

        {/* Selected Period Transactions Table */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 font-bold text-xs text-slate-700 dark:text-slate-200 flex items-center justify-between">
            <span>{filterLabel} এর সকল লেনদেনের তালিকা:</span>
            <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
              {toBengaliNumber(filteredTransactions.length)}টি এন্ট্রি পাওয়া গেছে
            </span>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            {filteredTransactions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                এই তারিখ বা রেঞ্জে কোনো আয় বা ব্যয়ের রেকর্ড পাওয়া যায়নি।
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 text-[11px] font-bold border-b border-slate-200 dark:border-slate-700 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10">নং</th>
                    <th className="py-2.5 px-3">তারিখ</th>
                    <th className="py-2.5 px-3">ধরন</th>
                    <th className="py-2.5 px-3">বিবরণ (Title)</th>
                    <th className="py-2.5 px-3">ক্যাটাগরি</th>
                    <th className="py-2.5 px-3">পেমেন্ট</th>
                    <th className="py-2.5 px-3">এন্ট্রিদাতা</th>
                    <th className="py-2.5 px-3 text-right">টাকার পরিমাণ (BDT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTransactions.map((tx, idx) => {
                    const isIncome = tx.type === 'income';
                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {toBengaliNumber(idx + 1)}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatBengaliDate(tx.date)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isIncome
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {isIncome ? 'আয় / জমা' : 'ব্যয় / খরচ'}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {tx.title}
                          </div>
                          {tx.note && (
                            <div className="text-[10px] text-slate-400 italic">
                              নোট: {tx.note}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px]">
                            {tx.category}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300 text-[11px]">
                          {tx.paymentMethod === 'bkash' ? 'বিকাশ' : tx.paymentMethod === 'nagad' ? 'নগদ' : tx.paymentMethod === 'bank' ? 'ব্যাংক' : 'নগদ ক্যাশ'}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300 text-[11px]">
                          {tx.addedBy}
                        </td>
                        <td className={`py-2 px-3 text-right font-extrabold ${
                          isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Trend Chart (6 Months) + Activity Feed (Last 5 Transactions & Audit Logs) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <React.Suspense
            fallback={
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 h-72 flex items-center justify-center text-xs text-slate-400">
                চার্ট লোড হচ্ছে...
              </div>
            }
          >
            <MonthlyComparisonChart transactions={transactions} />
          </React.Suspense>
        </div>

        {/* Activity Feed Component */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    সাম্প্রতিক কার্যক্রম (Activity Feed)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    সর্বশেষ ৫টি লেনদেন ও অডিট লগ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onViewAllTransactions}
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                সব দেখুন
              </button>
            </div>

            <div className="mt-3.5 space-y-2.5">
              {activityFeedItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  এখনো কোনো কার্যক্রম রেকর্ড হয়নি।
                </div>
              ) : (
                activityFeedItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/80 flex items-start justify-between gap-2.5"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-xs font-black ${
                          item.kind === 'income'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : item.kind === 'expense'
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                            : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                        }`}
                      >
                        {item.kind === 'income' ? '+' : item.kind === 'expense' ? '-' : '✓'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {item.subtitle}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                          <span>{item.actor}</span>
                          <span>•</span>
                          <span>{new Date(item.timestamp).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>

                    {typeof item.amount === 'number' && (
                      <div
                        className={`text-xs font-black whitespace-nowrap shrink-0 ${
                          item.kind === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {item.kind === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Customer Complaints Quick Overview Banner / Section */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-5 text-white border border-slate-700/80 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white tracking-wide">
                  গ্রাহক অভিযোগ ও সার্ভিস মনিটরিং (Live Support Tickets)
                </h3>
                {complaints.filter((c) => c.status === 'pending').length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold animate-pulse">
                    {toBengaliNumber(complaints.filter((c) => c.status === 'pending').length)}টি পেন্ডিং
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {toBengaliNumber(complaints.filter((c) => c.status === 'resolved').length)}টি সমাধানকৃত
                </span>
              </div>
              <p className="text-xs text-slate-400">
                গ্রাহক লাইন সমস্যা, ফাইবার মেরামত ও টেকনিশিয়ান ট্র্যাকিং
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {onOpenAddComplaint && (
              <button
                onClick={onOpenAddComplaint}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>নতুন অভিযোগ</span>
              </button>
            )}
            {onViewComplaints && (
              <button
                onClick={onViewComplaints}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors flex items-center gap-1 border border-white/10"
              >
                <span>সব অভিযোগ দেখুন</span>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            )}
          </div>
        </div>

        {/* Complaints Mini Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
          {complaints.slice(0, 3).map((cmp) => (
            <div
              key={cmp.id}
              onClick={onViewComplaints}
              className={`p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border transition-all cursor-pointer space-y-1.5 ${
                cmp.priority === 'critical'
                  ? 'border-l-4 border-l-red-500 border-slate-700'
                  : cmp.priority === 'urgent'
                  ? 'border-l-4 border-l-orange-500 border-slate-700'
                  : 'border-l-4 border-l-blue-500 border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {cmp.idNumber}
                  </span>
                  {cmp.priority === 'critical' ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-red-500/25 text-red-300 border border-red-500/40">
                      অতি জরুরি
                    </span>
                  ) : cmp.priority === 'urgent' ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-orange-500/25 text-orange-300 border border-orange-500/40">
                      জরুরি
                    </span>
                  ) : (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-blue-500/25 text-blue-300 border border-blue-500/40">
                      সাধারণ
                    </span>
                  )}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  cmp.status === 'pending'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : cmp.status === 'in_progress'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {cmp.status === 'pending' ? 'পেন্ডিং' : cmp.status === 'in_progress' ? 'কাজ চলছে' : 'সমাধানকৃত'}
                </span>
              </div>
              <div className="text-xs font-bold text-white truncate">{cmp.name}</div>
              <div className="text-[11px] text-slate-400 truncate">{cmp.complainDetails}</div>
              <div className="text-[10px] text-slate-400 pt-1 flex items-center justify-between border-t border-slate-700/60">
                <span>{cmp.address}</span>
                <span className="text-emerald-300 font-semibold">{cmp.assignedStaffName || 'স্টাফ অনির্ধারিত'}</span>
              </div>
            </div>
          ))}
          {complaints.length === 0 && (
            <div className="col-span-3 text-center py-4 text-xs text-slate-400">
              বর্তমানে কোনো পেন্ডিং অভিযোগ নেই। সব লাইন সচল রয়েছে।
            </div>
          )}
        </div>
      </div>

      {/* Partners Equity & Staff Quick Overview Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Partner Equity Status */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                <PieChart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  অংশীদার মূলধন ও শেয়ার বণ্টন
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  মোট পার্টনার বিনিয়োগ: {formatCurrency(lifetimeStats.totalInvestment)}
                </p>
              </div>
            </div>
            <button
              onClick={onViewPartners}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              বিস্তারিত <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 flex overflow-hidden">
              {partners.map((p, idx) => (
                <div
                  key={p.id}
                  style={{ width: `${p.sharePercentage}%` }}
                  className={`h-full transition-all ${
                    idx === 0 ? 'bg-emerald-600' : 'bg-teal-400'
                  }`}
                  title={`${p.name}: ${toBengaliNumber(p.sharePercentage)}%`}
                />
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {partners.map((p, idx) => (
                <div
                  key={p.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-3.5 h-3.5 rounded-full ${idx === 0 ? 'bg-emerald-600' : 'bg-teal-400'}`} />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{p.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{p.role}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white">{formatCurrency(p.investment)}</div>
                    <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">{toBengaliNumber(p.sharePercentage)}% শেয়ার</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Staff Quick Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">কেন্দ্রীয় স্টাফ মনিটরিং</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">মোট সক্রিয় স্টাফ: {toBengaliNumber(staffs.length)} জন</p>
              </div>
            </div>
            <button
              onClick={onViewStaff}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              সকল স্টাফ <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {staffs.map((st) => (
              <div
                key={st.id}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs overflow-hidden shrink-0 border border-emerald-200">
                    {st.photoUrl && st.photoUrl.startsWith('data:') ? (
                      <img src={st.photoUrl} alt={st.name} className="w-full h-full object-cover" />
                    ) : (
                      st.name.substring(0, 2)
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{st.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{st.designation}</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{formatCurrency(st.salary)}</span>
                  <div className="text-[10px] text-slate-400">মাসিক বেতন</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>

      {/* Dedicated Printable Summary Report (Visible ONLY during Direct Print) */}
      <div id="printable-daily-summary" className="hidden print:block p-6 bg-white text-slate-900 font-sans space-y-5">
        <div className="border-b-2 border-slate-900 pb-4 text-center">
          <h1 className="text-2xl font-black uppercase tracking-wide">
            {company?.name || 'DIP BHOLA NETWORK'}
          </h1>
          <p className="text-xs font-semibold text-slate-600 mt-0.5">
            {company?.subTitle || 'কেন্দ্রীয় দৈনিক আয়-ব্যয় ও স্টাফ মনিটরিং ব্যবস্থা'}
          </p>
          <div className="text-xs text-slate-700 mt-1 flex justify-center gap-4">
            <span>পরিচালক: {company?.ownerName || 'জাহিদুল ইসলাম'}</span>
            <span>•</span>
            <span>মোবাইল: {company?.phone || '01721200049'}</span>
            <span>•</span>
            <span>ঠিকানা: {company?.address || '৩নং পশ্চিম ইলিশা, ভোলা সদর'}</span>
          </div>
          <div className="mt-3 inline-block px-4 py-1 rounded bg-slate-100 border border-slate-300 text-xs font-bold">
            হিসাব বিবরণী • {filterLabel}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="p-3 border border-slate-300 rounded-lg">
            <div className="text-[11px] text-slate-500 font-bold">মোট জমা (Income)</div>
            <div className="text-base font-extrabold text-emerald-800 mt-0.5">
              {formatCurrency(filteredStats.income)}
            </div>
          </div>
          <div className="p-3 border border-slate-300 rounded-lg">
            <div className="text-[11px] text-slate-500 font-bold">মোট খরচ (Expense)</div>
            <div className="text-base font-extrabold text-rose-800 mt-0.5">
              {formatCurrency(filteredStats.expense)}
            </div>
          </div>
          <div className="p-3 border border-slate-300 rounded-lg">
            <div className="text-[11px] text-slate-500 font-bold">নিট ক্যাশ ব্যালেন্স</div>
            <div className="text-base font-extrabold text-slate-900 mt-0.5">
              {formatCurrency(filteredStats.net)}
            </div>
          </div>
          <div className="p-3 border border-slate-300 rounded-lg">
            <div className="text-[11px] text-slate-500 font-bold">মোট লেনদেন</div>
            <div className="text-base font-extrabold text-slate-900 mt-0.5">
              {toBengaliNumber(filteredStats.count)} টি
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-400 pb-1 mb-2">
            লেনদেন বিবরণী ({toBengaliNumber(filteredTransactions.length)}টি এন্ট্রি):
          </h3>
          {filteredTransactions.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">কোনো লেনদেন রেকর্ড নেই।</p>
          ) : (
            <table className="w-full text-xs text-left border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 p-2 text-center w-10">নং</th>
                  <th className="border border-slate-300 p-2">তারিখ</th>
                  <th className="border border-slate-300 p-2">বিবরণ (Title)</th>
                  <th className="border border-slate-300 p-2">ক্যাটাগরি</th>
                  <th className="border border-slate-300 p-2">পেমেন্ট</th>
                  <th className="border border-slate-300 p-2">এন্ট্রিদাতা</th>
                  <th className="border border-slate-300 p-2 text-right">পরিমাণ (BDT)</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx, idx) => (
                  <tr key={tx.id}>
                    <td className="border border-slate-300 p-1.5 text-center font-mono">{idx + 1}</td>
                    <td className="border border-slate-300 p-1.5 whitespace-nowrap">{formatBengaliDate(tx.date)}</td>
                    <td className="border border-slate-300 p-1.5 font-bold">
                      {tx.title}
                      {tx.note && <span className="block text-[10px] text-slate-500 font-normal">({tx.note})</span>}
                    </td>
                    <td className="border border-slate-300 p-1.5">{tx.category}</td>
                    <td className="border border-slate-300 p-1.5">{tx.paymentMethod}</td>
                    <td className="border border-slate-300 p-1.5">{tx.addedBy}</td>
                    <td className="border border-slate-300 p-1.5 text-right font-extrabold">
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="pt-16 grid grid-cols-2 gap-8 text-center text-xs">
          <div>
            <div className="border-t border-slate-800 pt-1.5 font-bold">
              শাখা ও জেনারেল ম্যানেজার স্বাক্ষর
            </div>
            <div className="text-[10px] text-slate-500">DIP BHOLA NETWORK</div>
          </div>
          <div>
            <div className="border-t border-slate-800 pt-1.5 font-bold">
              প্রধান পরিচালক / স্বত্বাধিকারী স্বাক্ষর
            </div>
            <div className="text-[10px] text-slate-500">DIP BHOLA NETWORK</div>
          </div>
        </div>
      </div>

      {/* Floating Success Toast for Quick Expense */}
      {quickSuccessToast && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border-2 border-emerald-500 flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div className="text-xs font-bold">{quickSuccessToast}</div>
        </div>
      )}

      {/* Quick Expense Modal Dialog */}
      {isQuickExpenseOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 fill-amber-200" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold">দ্রুত খরচ এন্ট্রি (Quick Expense)</h3>
                  <p className="text-[11px] text-amber-100">১-ক্লিকে নিয়মিত ছোট খরচসমূহ রেকর্ড করুন</p>
                </div>
              </div>
              <button
                onClick={() => setIsQuickExpenseOpen(false)}
                className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Preset 1-Click Buttons */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  ১-ক্লিকে তাৎক্ষণিক রেকর্ড করুন:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {quickPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      disabled={isSubmittingQuick}
                      onClick={() => triggerQuickExpense(preset)}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-slate-200 dark:border-slate-700 hover:border-amber-400 text-left transition-all active:scale-95 group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-base">{preset.icon}</span>
                        <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                          {formatCurrency(preset.amount)}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 truncate">
                        {preset.title}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {preset.category}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Or Quick Custom Expense */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  অথবা কাস্টম পরিমাণ দিয়ে দ্রুত সেভ করুন:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-1">খরচের বিবরণ *</label>
                    <input
                      type="text"
                      placeholder="যেমন: লাইন ক্লিপ, পানি, চা ইত্যাদি"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-1">টাকার পরিমাণ (BDT) *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="টাকা (যেমন: 150 বা ১৫০)"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-1">ক্যাটাগরি</label>
                    <select
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                    >
                      <option value="অফিস পরিচালনা খরচ">অফিস পরিচালনা খরচ</option>
                      <option value="যাতায়াত ও ডেলিভারি খরচ">যাতায়াত ও ডেলিভারি খরচ</option>
                      <option value="নেটওয়ার্ক সরঞ্জাম ও অপটিক্যাল ফাইবার">নেটওয়ার্ক সরঞ্জাম</option>
                      <option value="স্টেশনারি ও প্রিন্টিং">স্টেশনারি ও প্রিন্টিং</option>
                      <option value="পরিবহন ও ফুয়েল">পরিবহন ও ফুয়েল</option>
                      <option value="ইন্টারনেট ব্যান্ডউইথ বিল">ইন্টারনেট ব্যান্ডউইথ বিল</option>
                      <option value="অন্যান্য বিবিধ খরচ">অন্যান্য বিবিধ খরচ</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-1">পেমেন্ট মাধ্যম</label>
                    <select
                      value={customPayment}
                      onChange={(e) => setCustomPayment(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                    >
                      <option value="cash">নগদ ক্যাশ (Cash)</option>
                      <option value="bkash">বিকাশ (bKash)</option>
                      <option value="nagad">নগদ (Nagad)</option>
                      <option value="bank">ব্যাংক (Bank)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSubmittingQuick || !customTitle.trim() || parseNumericInput(customAmount) <= 0}
                  onClick={() => triggerQuickExpense({
                    title: customTitle,
                    category: customCategory,
                    amount: parseNumericInput(customAmount),
                    paymentMethod: customPayment
                  })}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-950/30 disabled:opacity-50 transition-all active:scale-95"
                >
                  <Zap className="w-4 h-4 fill-amber-200" />
                  <span>{isSubmittingQuick ? 'সংরক্ষণ হচ্ছে...' : 'তাত্ক্ষণিক খরচ সেভ করুন'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print & PDF Publication Studio Modal */}
      <PrintStudioModal
        isOpen={isPrintStudioOpen}
        onClose={() => setIsPrintStudioOpen(false)}
        documentTitle={`দৈনিক হিসাব ভাউচার — ${filterLabel}`}
        fileNamePrefix={`DIP-BHOLA-Voucher-${todayStr}`}
        summaryText={[
          `🧾 *${company?.name || 'DIP BHOLA NETWORK'} — হিসাব বিবরণী (${filterLabel})*`,
          `➕ মোট জমা: ৳ ${filteredStats.income.toLocaleString()}`,
          `➖ মোট খরচ: ৳ ${filteredStats.expense.toLocaleString()}`,
          `💰 নিট ক্যাশ ব্যালেন্স: ৳ ${filteredStats.net.toLocaleString()}`,
          `📝 মোট লেনদেন: ${filteredStats.count} টি`
        ].join('\n')}
        whatsappGroupConfig={whatsappGroupConfig}
      >
        <div className="bg-white text-slate-900 space-y-4 leading-relaxed">
          <div data-print-section="header" className="border-b-2 border-slate-900 pb-3 text-center space-y-1">
            <h1 className="text-xl font-black uppercase leading-snug">
              {company?.name || 'DIP BHOLA NETWORK'}
            </h1>
            <p className="text-[11px] font-semibold text-slate-600 leading-snug">
              {company?.subTitle || 'কেন্দ্রীয় দৈনিক আয়-ব্যয় ও স্টাফ মনিটরিং ব্যবস্থা'}
            </p>
            <div className="text-[10px] text-slate-700 pt-0.5 flex justify-center gap-3 flex-wrap">
              <span>পরিচালক: {company?.ownerName || 'জাহিদুল ইসলাম'}</span>
              <span>•</span>
              <span>মোবাইল: {company?.phone || '01721200049'}</span>
              <span>•</span>
              <span>ঠিকানা: {company?.address || '৩নং পশ্চিম ইলিশা, ভোলা সদর'}</span>
            </div>
            <div className="mt-2 inline-block px-3 py-1 rounded bg-slate-100 border border-slate-300 text-xs font-bold">
              হিসাব বিবরণী • {filterLabel}
            </div>
          </div>

          <div data-print-section="summary" className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2.5 border border-slate-300 rounded-lg space-y-0.5">
              <div className="text-[10px] text-slate-500 font-bold leading-snug">মোট জমা (Income)</div>
              <div className="text-sm font-extrabold text-emerald-800 leading-snug">{formatCurrency(filteredStats.income)}</div>
            </div>
            <div className="p-2.5 border border-slate-300 rounded-lg space-y-0.5">
              <div className="text-[10px] text-slate-500 font-bold leading-snug">মোট খরচ (Expense)</div>
              <div className="text-sm font-extrabold text-rose-800 leading-snug">{formatCurrency(filteredStats.expense)}</div>
            </div>
            <div className="p-2.5 border border-slate-300 rounded-lg space-y-0.5">
              <div className="text-[10px] text-slate-500 font-bold leading-snug">নিট ব্যালেন্স</div>
              <div className="text-sm font-extrabold text-slate-900 leading-snug">{formatCurrency(filteredStats.net)}</div>
            </div>
            <div className="p-2.5 border border-slate-300 rounded-lg space-y-0.5">
              <div className="text-[10px] text-slate-500 font-bold leading-snug">মোট লেনদেন</div>
              <div className="text-sm font-extrabold text-slate-900 leading-snug">{toBengaliNumber(filteredStats.count)} টি</div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-900 border-b border-slate-400 pb-1 mb-2">
              লেনদেন বিবরণী ({toBengaliNumber(filteredTransactions.length)}টি এন্ট্রি):
            </h3>
            {filteredTransactions.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">কোনো লেনদেন রেকর্ড নেই।</p>
            ) : (
              <table className="w-full text-[10px] text-left border-collapse border border-slate-300 table-auto">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 p-1.5 text-center whitespace-nowrap">নং</th>
                    <th className="border border-slate-300 p-1.5 whitespace-nowrap">তারিখ</th>
                    <th className="border border-slate-300 p-1.5">বিবরণ (Title)</th>
                    <th className="border border-slate-300 p-1.5 whitespace-nowrap">ক্যাটাগরি</th>
                    <th className="border border-slate-300 p-1.5 whitespace-nowrap">পেমেন্ট</th>
                    <th data-print-section="added-by" className="border border-slate-300 p-1.5 whitespace-nowrap">এন্ট্রিদাতা</th>
                    <th className="border border-slate-300 p-1.5 text-right whitespace-nowrap">পরিমাণ (BDT)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx, idx) => (
                    <tr key={tx.id} className="align-top">
                      <td className="border border-slate-300 p-1.5 text-center font-mono whitespace-nowrap">{toBengaliNumber(idx + 1)}</td>
                      <td className="border border-slate-300 p-1.5 whitespace-nowrap">{formatBengaliDate(tx.date)}</td>
                      <td className="border border-slate-300 p-1.5 font-bold break-words">
                        {tx.title}
                        {tx.note && <div className="text-[9px] text-slate-500 font-normal mt-0.5 break-words">({tx.note})</div>}
                      </td>
                      <td className="border border-slate-300 p-1.5 break-words">{tx.category}</td>
                      <td className="border border-slate-300 p-1.5 whitespace-nowrap">
                        {tx.paymentMethod === 'bkash' ? 'বিকাশ' : tx.paymentMethod === 'nagad' ? 'নগদ' : tx.paymentMethod === 'bank' ? 'ব্যাংক' : 'ক্যাশ'}
                      </td>
                      <td data-print-section="added-by" className="border border-slate-300 p-1.5 break-words">{tx.addedBy}</td>
                      <td className={`border border-slate-300 p-1.5 text-right font-extrabold whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot data-print-section="totals">
                  <tr className="bg-slate-100 font-extrabold text-slate-900">
                    <td colSpan={6} className="border border-slate-300 p-1.5 text-right">সর্বমোট (জমা / খরচ / নিট):</td>
                    <td className="border border-slate-300 p-1.5 text-right whitespace-nowrap">
                      +{formatCurrency(filteredStats.income)} / -{formatCurrency(filteredStats.expense)} ({formatCurrency(filteredStats.net)})
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          <div data-print-section="audit" className="text-[9px] text-slate-500 border-t border-slate-200 pt-1.5 flex items-center justify-between gap-2">
            <span>প্রস্তুতকারক: {currentUser.name} ({currentUser.role})</span>
            <span>প্রিন্ট সময়: {new Date().toLocaleString('bn-BD')}</span>
          </div>

          <div data-print-section="signatures" className="pt-10 grid grid-cols-2 gap-8 text-center text-[11px]">
            <div className="space-y-1">
              <div className="border-t border-slate-800 pt-1.5 font-bold leading-snug">শাখা ও জেনারেল ম্যানেজার স্বাক্ষর</div>
              <div className="text-[9px] text-slate-500 leading-snug">{company?.name || 'DIP BHOLA NETWORK'}</div>
            </div>
            <div className="space-y-1">
              <div className="border-t border-slate-800 pt-1.5 font-bold leading-snug">প্রধান পরিচালক / স্বত্বাধিকারী স্বাক্ষর</div>
              <div className="text-[9px] text-slate-500 leading-snug">{company?.name || 'DIP BHOLA NETWORK'}</div>
            </div>
          </div>
        </div>
      </PrintStudioModal>
    </div>
  );
};
