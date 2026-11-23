import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  Plus,
  Minus,
  Trash2,
  Edit,
  Calendar,
  RotateCcw,
  Printer,
  MessageCircle,
  WifiOff,
  RefreshCw,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  QrCode
} from 'lucide-react';
import { Transaction, UserSession, WhatsAppGroupConfig, Company, Staff } from '../types';
import {
  formatCurrency,
  toBengaliNumber,
  formatBengaliDate,
  CATEGORIES_EXPENSE,
  CATEGORIES_INCOME,
  getTodayString,
  getYesterdayString,
  getTransactionDateKey,
  matchesTransactionSearch
} from '../utils/formatters';
import { canUserPerformAction } from '../utils/portalPermissions';
import { normalizeWhatsAppGroupLink } from '../utils/appUrls';
import type { OfflineSyncState } from '../services/offlineSync';
import { PrintStudioModal } from './PrintStudioModal';
import { FinancialSummaryCards } from './FinancialSummaryCards';
import { MonthlyProfitLossModal } from './MonthlyProfitLossModal';
import { createSharedReportAndQrUrl } from '../services/sharedReportService';

type PeriodMode = 'all' | 'day' | 'range' | 'week' | 'month' | 'year';
type SortField = 'date' | 'amount' | 'category';
type SortDir = 'asc' | 'desc';

function shiftDaysFromToday(daysDelta: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysDelta);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekBounds(anchorDateStr: string): { start: string; end: string } {
  const parts = anchorDateStr.split('-').map(Number);
  const d =
    parts.length === 3 && !parts.some(isNaN)
      ? new Date(parts[0], parts[1] - 1, parts[2])
      : new Date();
  const day = d.getDay(); // 0 Sun..6 Sat; week starts Saturday in BD
  const diffToSat = (day + 1) % 7;
  const startD = new Date(d);
  startD.setDate(d.getDate() - diffToSat);
  const endD = new Date(startD);
  endD.setDate(startD.getDate() + 6);
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  return { start: fmt(startD), end: fmt(endD) };
}

interface TransactionsTableProps {
  transactions: Transaction[];
  currentUser: UserSession;
  staffs?: Staff[];
  company?: Company | null;
  whatsappGroupConfig?: WhatsAppGroupConfig;
  offlineSyncState?: OfflineSyncState;
  onManualSyncNow?: () => void;
  onOpenAddModal: (type: 'income' | 'expense') => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onExportCsv: (periodLabel?: string, filteredRows?: Transaction[]) => void;
}

export const TransactionsTable: React.FC<TransactionsTableProps> = ({
  transactions,
  currentUser,
  staffs = [],
  company,
  whatsappGroupConfig,
  offlineSyncState,
  onManualSyncNow,
  onOpenAddModal,
  onEditTransaction,
  onDeleteTransaction,
  onExportCsv,
}) => {
  const todayStr = useMemo(() => getTodayString(), []);
  const yesterdayStr = useMemo(() => getYesterdayString(), []);
  const currentMonthStr = useMemo(() => todayStr.substring(0, 7), [todayStr]);
  const currentYearStr = useMemo(() => todayStr.substring(0, 4), [todayStr]);

  const [isPrintStudioOpen, setIsPrintStudioOpen] = useState(false);
  const [isMonthlyPnLOpen, setIsMonthlyPnLOpen] = useState(false);
  const [ledgerQr, setLedgerQr] = useState<{ qrDataUrl: string; shareUrl: string; reportId: string } | null>(null);
  // Default view shows all saved entries sorted newest first so previous records are immediately visible, with 1-click Today/Yesterday/Month filters
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);
  const [weekAnchorDate, setWeekAnchorDate] = useState<string>(todayStr);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [visibleTxLimit, setVisibleTxLimit] = useState<number>(80);

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterPerson, setFilterPerson] = useState<string>('all');
  const [filterSpecificDate, setFilterSpecificDate] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

  const isStaffRole = currentUser.role === 'staff';
  const isPartnerRole = currentUser.role === 'partner';
  const isAdminOnly = currentUser.role === 'admin' || currentUser.role === 'director';
  const canAddEntry =
    !isPartnerRole && canUserPerformAction('canAddTransaction', currentUser, staffs);
  const canEditEntry =
    !isPartnerRole && canUserPerformAction('canEditTransaction', currentUser, staffs);
  const canDeleteEntry =
    isAdminOnly ||
    (!isPartnerRole && canUserPerformAction('canDeleteTransaction', currentUser, staffs));
  const canViewFinancialTotals =
    !isPartnerRole && canUserPerformAction('canViewFinancialTotals', currentUser, staffs);
  const canExportOrPrint =
    isPartnerRole || canUserPerformAction('canExportOrPrintReports', currentUser, staffs);
  const isViewOnlyAction = !canEditEntry && !canDeleteEntry;

  useEffect(() => {
    setVisibleTxLimit(80);
  }, [
    periodMode,
    search,
    filterType,
    filterCategory,
    filterMonth,
    filterPerson,
    filterSpecificDate,
    filterDateFrom,
    filterDateTo,
    selectedYear,
    weekAnchorDate
  ]);

  // Admin, Staff, Share Partner, and Manager view ledger based on Admin-granted permissions
  const scopedTransactions = transactions;

  const latestAvailableDate = useMemo(() => {
    let latest = '';
    scopedTransactions.forEach((tx) => {
      if (tx.date && tx.date > latest) latest = tx.date;
    });
    return latest;
  }, [scopedTransactions]);

  // Extract distinct months & years
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    scopedTransactions.forEach((tx) => {
      if (tx.date && tx.date.length >= 7) {
        months.add(tx.date.substring(0, 7));
      }
    });
    return Array.from(months).sort().reverse();
  }, [scopedTransactions]);

  const availableYears = useMemo(() => {
    const years = new Set<string>([currentYearStr]);
    scopedTransactions.forEach((tx) => {
      if (tx.date && tx.date.length >= 4) {
        years.add(tx.date.substring(0, 4));
      }
    });
    return Array.from(years).sort().reverse();
  }, [scopedTransactions, currentYearStr]);

  // Extract distinct addedBy names
  const availablePersons = useMemo(() => {
    const persons = new Set<string>();
    scopedTransactions.forEach((tx) => {
      if (tx.addedBy) persons.add(tx.addedBy);
    });
    return Array.from(persons);
  }, [scopedTransactions]);

  const weekBounds = useMemo(() => getWeekBounds(weekAnchorDate || todayStr), [weekAnchorDate, todayStr]);

  const handleSelectPeriodMode = (mode: PeriodMode) => {
    setPeriodMode(mode);
    if (mode === 'day') {
      setFilterSpecificDate(todayStr);
      setFilterMonth('all');
      setFilterDateFrom('');
      setFilterDateTo('');
    } else if (mode === 'range') {
      setFilterSpecificDate('');
      setFilterMonth('all');
      if (!filterDateFrom && !filterDateTo) {
        setFilterDateFrom(`${currentMonthStr}-01`);
        setFilterDateTo(todayStr);
      }
    } else if (mode === 'week') {
      setFilterSpecificDate('');
      setFilterMonth('all');
      setFilterDateFrom('');
      setFilterDateTo('');
    } else if (mode === 'month') {
      setFilterSpecificDate('');
      setFilterMonth(currentMonthStr);
      setFilterDateFrom('');
      setFilterDateTo('');
    } else if (mode === 'year') {
      setFilterSpecificDate('');
      setFilterMonth('all');
      setFilterDateFrom('');
      setFilterDateTo('');
    } else {
      setFilterSpecificDate('');
      setFilterMonth('all');
      setFilterDateFrom('');
      setFilterDateTo('');
    }
  };

  // Quick Date Setters
  const handleSetToday = () => {
    setPeriodMode('day');
    setFilterSpecificDate(todayStr);
    setFilterMonth('all');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const handleSetYesterday = () => {
    setPeriodMode('day');
    setFilterSpecificDate(yesterdayStr);
    setFilterMonth('all');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const handleSetCurrentMonth = () => {
    setPeriodMode('month');
    setFilterMonth(currentMonthStr);
    setFilterSpecificDate('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const handleSetDateRangePreset = (fromStr: string, toStr: string) => {
    setPeriodMode('range');
    setFilterSpecificDate('');
    setFilterMonth('all');
    setFilterDateFrom(fromStr);
    setFilterDateTo(toStr);
  };

  const handleResetFilters = () => {
    setPeriodMode('all');
    setSearch('');
    setFilterType('all');
    setFilterCategory('all');
    setFilterMonth('all');
    setFilterPerson('all');
    setFilterSpecificDate('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const handleToggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'category' ? 'asc' : 'desc');
    }
  };

  // Normalized date range bounds (auto-handles swapped From/To safely)
  const normalizedRange = useMemo(() => {
    const f = filterDateFrom.trim();
    const t = filterDateTo.trim();
    if (f && t && f > t) {
      return { from: t, to: f };
    }
    return { from: f, to: t };
  }, [filterDateFrom, filterDateTo]);

  // Searching while on a specific day expands to search all saved ledger records if requested
  const isSearchAutoExpandedAcrossArchive = Boolean(
    search.trim() && periodMode === 'day' && filterSpecificDate === todayStr
  );

  // Filtered and Sorted list
  const filteredList = useMemo(() => {
    const filtered = scopedTransactions.filter((tx) => {
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (filterCategory !== 'all' && tx.category !== filterCategory) return false;
      if (filterPerson !== 'all' && tx.addedBy !== filterPerson) return false;

      const txDate = getTransactionDateKey(tx);

      if (!isSearchAutoExpandedAcrossArchive) {
        if (periodMode === 'range') {
          if (normalizedRange.from && (!txDate || txDate < normalizedRange.from)) return false;
          if (normalizedRange.to && (!txDate || txDate > normalizedRange.to)) return false;
        } else if (periodMode === 'week') {
          if (!txDate || txDate < weekBounds.start || txDate > weekBounds.end) return false;
        } else if (periodMode === 'year') {
          if (!txDate || !txDate.startsWith(selectedYear)) return false;
        } else if (filterSpecificDate.trim()) {
          if (txDate !== filterSpecificDate) return false;
        } else {
          if (normalizedRange.from && (!txDate || txDate < normalizedRange.from)) return false;
          if (normalizedRange.to && (!txDate || txDate > normalizedRange.to)) return false;
          if (filterMonth !== 'all' && (!txDate || !txDate.startsWith(filterMonth))) return false;
        }
      }

      // Search Query (supports English & Bengali digits, titles, notes, dates, amounts)
      if (search.trim()) {
        if (!matchesTransactionSearch(tx, search)) {
          return false;
        }
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'amount') {
        cmp = (a.amount || 0) - (b.amount || 0);
      } else if (sortField === 'category') {
        cmp = (a.category || '').localeCompare(b.category || '', 'bn');
      } else {
        cmp = (a.date || '').localeCompare(b.date || '');
        if (cmp === 0) {
          cmp = (a.createdAt || '').localeCompare(b.createdAt || '');
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [
    scopedTransactions,
    filterType,
    filterCategory,
    filterMonth,
    filterPerson,
    filterSpecificDate,
    normalizedRange,
    isSearchAutoExpandedAcrossArchive,
    periodMode,
    weekBounds,
    selectedYear,
    search,
    sortField,
    sortDir
  ]);

  const archiveSearchTotalCount = useMemo(() => {
    if (!search.trim() || periodMode === 'all' || isSearchAutoExpandedAcrossArchive) return 0;
    return scopedTransactions.filter((tx) => matchesTransactionSearch(tx, search)).length;
  }, [scopedTransactions, search, periodMode, isSearchAutoExpandedAcrossArchive]);

  // Totals for filtered list
  const totals = useMemo(() => {
    let inc = 0;
    let exp = 0;
    filteredList.forEach((tx) => {
      if (tx.type === 'income') inc += tx.amount;
      else exp += tx.amount;
    });
    return {
      income: inc,
      expense: exp,
      net: inc - exp,
    };
  }, [filteredList]);

  const allCategories = useMemo(() => {
    return Array.from(new Set([...CATEGORIES_EXPENSE, ...CATEGORIES_INCOME]));
  }, []);

  const hasActiveFilters = Boolean(
    periodMode !== 'all' ||
    search ||
    filterType !== 'all' ||
    filterCategory !== 'all' ||
    filterMonth !== 'all' ||
    filterPerson !== 'all' ||
    filterSpecificDate ||
    filterDateFrom ||
    filterDateTo
  );

  const activePeriodLabel = isSearchAutoExpandedAcrossArchive
    ? `সার্চ ফলাফল: সব সংরক্ষিত লেনদেন ("${search.trim()}")`
    : periodMode === 'day'
    ? `দৈনিক (${formatBengaliDate(filterSpecificDate || todayStr)})`
    : periodMode === 'range'
    ? `তারিখ সীমা (${
        normalizedRange.from ? formatBengaliDate(normalizedRange.from) : 'শুরু'
      } — ${normalizedRange.to ? formatBengaliDate(normalizedRange.to) : 'আজ পর্যন্ত'})`
    : periodMode === 'week'
    ? `সাপ্তাহিক (${formatBengaliDate(weekBounds.start)} — ${formatBengaliDate(weekBounds.end)})`
    : periodMode === 'month'
    ? `মাসিক (${filterMonth !== 'all' ? toBengaliNumber(filterMonth) : toBengaliNumber(currentMonthStr)})`
    : periodMode === 'year'
    ? `বাৎসরিক (${toBengaliNumber(selectedYear)})`
    : 'সকল লেনদেন';

  const pendingOfflineCount = scopedTransactions.filter((t) => t._pendingSync).length;
  const paginatedRows = useMemo(
    () => filteredList.slice(0, visibleTxLimit),
    [filteredList, visibleTxLimit]
  );

  useEffect(() => {
    if (!isPrintStudioOpen) return;
    let cancelled = false;
    const mappedType =
      periodMode === 'day'
        ? 'daily'
        : periodMode === 'month'
        ? 'monthly'
        : periodMode === 'year'
        ? 'yearly'
        : periodMode === 'all'
        ? 'all'
        : 'custom';
    createSharedReportAndQrUrl({
      company: company || null,
      periodType: mappedType,
      periodLabel: activePeriodLabel,
      verificationCode: `LDG-${todayStr.replace(/-/g, '')}-${filteredList.length}`,
      generatedBy: currentUser.name,
      summary: {
        totalIncome: totals.income,
        totalExpense: totals.expense,
        netBalance: totals.net,
        txCount: filteredList.length,
        pendingDue: 0
      },
      transactions: filteredList
    })
      .then((res) => {
        if (!cancelled) {
          setLedgerQr({ qrDataUrl: res.qrDataUrl, shareUrl: res.shareUrl, reportId: res.reportId });
        }
      })
      .catch(() => {
        // ignore offline qr snapshot failure
      });
    return () => {
      cancelled = true;
    };
  }, [isPrintStudioOpen, company, periodMode, activePeriodLabel, todayStr, currentUser.name, totals, filteredList]);

  return (
    <div className="space-y-4">
      {/* Role-Specific Daily View & Protection Banner */}
      {(isStaffRole || isPartnerRole) && (
        <div className="bg-gradient-to-r from-[#022c20] via-[#054431] to-slate-900 rounded-2xl p-4 sm:p-5 text-white border border-emerald-500/40 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold mb-1">
              <span>{isPartnerRole ? 'শেয়ার অংশীদার পর্যবেক্ষণ প্যানেল' : 'স্টাফ দৈনিক হিসাব প্যানেল'} · {currentUser.designation}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight">
              স্বাগতম, {currentUser.name}
            </h2>
            <p className="text-xs text-emerald-200/90 mt-0.5">
              {isPartnerRole
                ? 'এখান থেকে আপনি দৈনিক হিসাব এবং তারিখ অনুযায়ী পূর্ববর্তী সকল সংরক্ষিত লেনদেন দেখতে ও প্রিন্ট করতে পারবেন।'
                : `অনুমোদিত অ্যাক্সেস: ${canAddEntry ? 'নতুন এন্ট্রি ✓' : 'এন্ট্রি বন্ধ 🔒'} · ${canEditEntry ? 'এডিট ✓' : 'এডিট লক 🔒'} · ${canDeleteEntry ? 'ডিলিট ✓' : 'ডিলিট লক 🔒'} · ${canViewFinancialTotals ? 'মোট ক্যাশ দেখা ✓' : 'মোট ক্যাশ গোপন 🔒'}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-right">
              <div className="text-[10px] text-emerald-200">মোট সংরক্ষিত আর্কাইভ</div>
              <div className="text-sm font-black text-white">{toBengaliNumber(scopedTransactions.length)} টি</div>
            </div>
          </div>
        </div>
      )}

      {/* Separate Daily, Monthly & Total Deposit / Expense / Profit-Loss Cards (Controlled by Admin Permission) */}
      {canViewFinancialTotals ? (
        <FinancialSummaryCards
          transactions={scopedTransactions}
          onOpenMonthlyPnL={() => setIsMonthlyPnLOpen(true)}
          titleBadge={isStaffRole ? 'অনুমোদিত হিসাব সামারি' : undefined}
        />
      ) : isStaffRole ? (
        <div className="rounded-2xl px-4 py-3 bg-slate-900/90 border border-slate-700/80 text-xs text-slate-300 flex items-center justify-between gap-2">
          <span>🔒 মোট আয়, ব্যয় ও ক্যাশ ব্যালেন্স সামারি দেখার অনুমতি অ্যাডমিন কর্তৃক সীমাবদ্ধ করা হয়েছে।</span>
          <span className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-400 shrink-0">হিসাব গোপন</span>
        </div>
      ) : null}

      <MonthlyProfitLossModal
        isOpen={isMonthlyPnLOpen}
        onClose={() => setIsMonthlyPnLOpen(false)}
        transactions={scopedTransactions}
        company={company}
      />

      {/* Offline / Pending Auto-Sync Strip */}
      {((offlineSyncState && !offlineSyncState.isOnline) || pendingOfflineCount > 0) && (
        <div className="rounded-2xl p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2.5 text-amber-950 dark:text-amber-200">
            <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {offlineSyncState && !offlineSyncState.isOnline
                ? 'অফলাইন মোড: এন্ট্রিগুলো নিরাপদে ডিভাইসে সংরক্ষিত থাকছে, ইন্টারনেট আসলেই স্বয়ংক্রিয়ভাবে অনলাইন সিঙ্ক হবে।'
                : `${toBengaliNumber(pendingOfflineCount)}টি অফলাইন এন্ট্রি অনলাইন সার্ভারে সিঙ্ক হওয়ার অপেক্ষায় আছে।`}
            </span>
          </div>
          {offlineSyncState?.isOnline && onManualSyncNow && pendingOfflineCount > 0 && (
            <button
              type="button"
              onClick={onManualSyncNow}
              disabled={offlineSyncState.isSyncing}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${offlineSyncState.isSyncing ? 'animate-spin' : ''}`} />
              <span>{offlineSyncState.isSyncing ? 'সিঙ্ক হচ্ছে...' : 'এখনই অনলাইন সিঙ্ক করুন'}</span>
            </button>
          )}
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
            <span>দৈনিক আয়-ব্যয় খাতা (Transactions Ledger)</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
              {toBengaliNumber(filteredList.length)} টি প্রদর্শিত
            </span>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
              মোট জমা: {toBengaliNumber(scopedTransactions.length)} টি
            </span>
          </h2>
          {canViewFinancialTotals ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              নির্বাচিত হিসাবের জমা: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatCurrency(totals.income)}</span> | মোট খরচ: <span className="text-rose-600 dark:text-rose-400 font-bold">{formatCurrency(totals.expense)}</span> | নিট ব্যালেন্স: <span className={`font-bold ${totals.net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>{formatCurrency(totals.net)}</span>
            </p>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              দৈনিক লেনদেন তালিকা ({toBengaliNumber(filteredList.length)} টি রেকর্ড) · মোট ক্যাশ হিসাব অ্যাডমিন দ্বারা সংরক্ষিত
            </p>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {canExportOrPrint && (
            <>
              <button
                onClick={() => setIsPrintStudioOpen(true)}
                className="px-3 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
                title="A4/Legal প্রিন্ট, PDF ডাউনলোড, PDF Reader এবং WhatsApp/Gmail শেয়ার"
              >
                <Printer className="w-3.5 h-3.5" />
                প্রিন্ট / PDF
              </button>
              <button
                onClick={() =>
                  onExportCsv(
                    periodMode === 'month' && filterMonth !== 'all'
                      ? filterMonth
                      : periodMode === 'year'
                      ? selectedYear
                      : periodMode === 'range'
                      ? `${normalizedRange.from || 'start'}_to_${normalizedRange.to || todayStr}`
                      : periodMode === 'day'
                      ? filterSpecificDate || todayStr
                      : undefined,
                    filteredList
                  )
                }
                className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-colors border border-slate-300 dark:border-slate-700 flex items-center gap-1.5"
                title="নির্বাচিত সময়কালের CSV ফাইল ডাউনলোড করুন"
              >
                <Download className="w-3.5 h-3.5" />
                CSV এক্সপোর্ট
              </button>
            </>
          )}
          {canAddEntry && (
            <>
              <button
                onClick={() => onOpenAddModal('income')}
                className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                + জমা এন্ট্রি
              </button>
              <button
                onClick={() => onOpenAddModal('expense')}
                className="px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Minus className="w-3.5 h-3.5" />
                - খরচ এন্ট্রি
              </button>
            </>
          )}
        </div>
      </div>

      {/* Period View Switcher Tabs: Day (default) / Date Range / Week / Month / Year / All Archive */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-black text-slate-600 dark:text-slate-300 mr-1">হিসাবের সময়কাল:</span>
          {(
            [
              { id: 'day', label: 'দৈনিক (আজ / নির্দিষ্ট দিন)' },
              { id: 'range', label: 'তারিখ থেকে তারিখ' },
              { id: 'week', label: 'সাপ্তাহিক' },
              { id: 'month', label: 'মাসিক' },
              { id: 'year', label: 'বাৎসরিক (বছর)' },
              { id: 'all', label: `সব সংরক্ষিত (${toBengaliNumber(scopedTransactions.length)})` }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelectPeriodMode(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                periodMode === tab.id
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Period-specific quick picker */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {periodMode === 'week' && (
            <label className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-slate-500">সপ্তাহের তারিখ:</span>
              <input
                type="date"
                value={weekAnchorDate}
                onChange={(e) => setWeekAnchorDate(e.target.value || todayStr)}
                className="bg-transparent text-xs font-bold text-slate-900 dark:text-white border-none p-0 focus:ring-0"
              />
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                ({formatBengaliDate(weekBounds.start)} — {formatBengaliDate(weekBounds.end)})
              </span>
            </label>
          )}
          {periodMode === 'year' && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  বছর: {toBengaliNumber(yr)}
                </option>
              ))}
            </select>
          )}
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[11px] font-black">
            সক্রিয়: {activePeriodLabel}
          </span>
        </div>
      </div>

      {/* Filter and Date Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        {/* Quick Date Buttons Row */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              তারিখ নির্বাচন:
            </span>
            <button
              onClick={handleSetToday}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                periodMode === 'day' && filterSpecificDate === todayStr
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              আজ
            </button>
            <button
              onClick={handleSetYesterday}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                periodMode === 'day' && filterSpecificDate === yesterdayStr
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              গতকাল
            </button>
            <button
              onClick={() => handleSetDateRangePreset(shiftDaysFromToday(-6), todayStr)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                periodMode === 'range' && normalizedRange.from === shiftDaysFromToday(-6) && normalizedRange.to === todayStr
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              গত ৭ দিন
            </button>
            <button
              onClick={() => handleSetDateRangePreset(shiftDaysFromToday(-29), todayStr)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                periodMode === 'range' && normalizedRange.from === shiftDaysFromToday(-29) && normalizedRange.to === todayStr
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              গত ৩০ দিন
            </button>
            <button
              onClick={handleSetCurrentMonth}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                filterMonth === currentMonthStr && !filterSpecificDate && periodMode === 'month'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              চলতি মাস
            </button>
            {filterSpecificDate && periodMode === 'day' && (
              <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                নির্বাচিত তারিখ: {formatBengaliDate(filterSpecificDate)}
              </span>
            )}
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900"
            >
              <RotateCcw className="w-3 h-3" />
              সব লেনদেন দেখুন / রিসেট
            </button>
          )}
        </div>

        {/* Dedicated From-To Date Range Search Box (এত তারিখ থেকে এত তারিখ সার্চ) */}
        <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/60 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-black text-emerald-900 dark:text-emerald-300 shrink-0">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>এত তারিখ থেকে এত তারিখ সার্চ:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-1">
            <label className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 text-xs">
              <span className="font-bold text-slate-500 dark:text-slate-400">থেকে:</span>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilterDateFrom(val);
                  if (val || filterDateTo) {
                    setPeriodMode('range');
                    setFilterSpecificDate('');
                    setFilterMonth('all');
                  } else {
                    setPeriodMode('all');
                  }
                }}
                aria-label="শুরুর তারিখ (থেকে)"
                className="bg-transparent text-xs sm:text-sm font-bold text-slate-900 dark:text-white border-none p-0 focus:ring-0"
              />
            </label>

            <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">—</span>

            <label className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 text-xs">
              <span className="font-bold text-slate-500 dark:text-slate-400">পর্যন্ত:</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilterDateTo(val);
                  if (val || filterDateFrom) {
                    setPeriodMode('range');
                    setFilterSpecificDate('');
                    setFilterMonth('all');
                  } else {
                    setPeriodMode('all');
                  }
                }}
                aria-label="শেষ তারিখ (পর্যন্ত)"
                className="bg-transparent text-xs sm:text-sm font-bold text-slate-900 dark:text-white border-none p-0 focus:ring-0"
              />
            </label>

            {(filterDateFrom || filterDateTo) && (
              <button
                type="button"
                onClick={() => {
                  setFilterDateFrom('');
                  setFilterDateTo('');
                  setPeriodMode('all');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50"
              >
                তারিখ সীমা মুছুন
              </button>
            )}
          </div>

          {periodMode === 'range' && (
            <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
              পাওয়া গেছে: {toBengaliNumber(filteredList.length)} টি লেনদেন
            </div>
          )}
        </div>

        {/* Search and Dropdowns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          {/* Search box */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="বিবরণ, টাকা, তারিখ, পেমেন্ট বা আইডি দিয়ে খুঁজুন..."
              className="w-full pl-9 pr-8 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1"
                title="সার্চ মুছুন"
              >
                ✕
              </button>
            )}
          </div>

          {/* Specific Date Picker Input */}
          <div>
            <input
              type="date"
              value={filterSpecificDate}
              onChange={(e) => {
                setFilterSpecificDate(e.target.value);
                if (e.target.value) {
                  setPeriodMode('day');
                  setFilterMonth('all');
                  setFilterDateFrom('');
                  setFilterDateTo('');
                } else {
                  setPeriodMode('all');
                }
              }}
              title="নির্দিষ্ট যেকোনো একদিন বেছে নিন"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Type filter */}
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">সব ধরনের হিসাব (All)</option>
              <option value="expense">ব্যয় / খরচ (Expense)</option>
              <option value="income">আয় / জমা (Income)</option>
            </select>
          </div>

          {/* Month filter */}
          <div>
            <select
              value={filterMonth}
              onChange={(e) => {
                setFilterMonth(e.target.value);
                if (e.target.value !== 'all') {
                  setPeriodMode('month');
                  setFilterSpecificDate('');
                } else if (periodMode === 'month') {
                  setPeriodMode('all');
                }
              }}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">সব মাস (All Months)</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  মাস: {toBengaliNumber(m)}
                </option>
              ))}
            </select>
          </div>

          {/* Added By Person filter */}
          <div>
            <select
              value={filterPerson}
              onChange={(e) => setFilterPerson(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">সকল এন্ট্রিদাতা</option>
              {availablePersons.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">ক্যাটাগরি:</span>
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              filterCategory === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            সব ক্যাটাগরি
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filterCategory === cat
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        {/* Archive-search context banner */}
        {(isSearchAutoExpandedAcrossArchive || archiveSearchTotalCount > filteredList.length) && (
          <div className="rounded-xl px-3 py-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-indigo-900 dark:text-indigo-200">
              {isSearchAutoExpandedAcrossArchive
                ? `"${search.trim()}" — সব সংরক্ষিত লেনদেন থেকে ${toBengaliNumber(filteredList.length)}টি মিল পাওয়া গেছে।`
                : `পুরো আর্কাইভে "${search.trim()}" মিলে এমন মোট ${toBengaliNumber(archiveSearchTotalCount)}টি লেনদেন রয়েছে।`}
            </span>
            {isSearchAutoExpandedAcrossArchive ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                সার্চ মুছে আজকের হিসাব দেখুন
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPeriodMode('all');
                  setFilterSpecificDate('');
                  setFilterDateFrom('');
                  setFilterDateTo('');
                  setFilterMonth('all');
                }}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                সব তারিখ থেকে দেখুন
              </button>
            )}
          </div>
        )}
      </div>

      {/* Transactions Table (Fades in cleanly on period filter transitions) */}
      <div
        key={`tx-period-${periodMode}-${filterSpecificDate}-${filterMonth}-${selectedYear}-${normalizedRange.from}-${normalizedRange.to}-${weekBounds.start}`}
        className="animate-period-fade bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-3.5 whitespace-nowrap text-center">ক্রমিক</th>
                <th className="py-3 px-3.5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleToggleSort('date')}
                    className="inline-flex items-center gap-1 hover:text-emerald-600 font-bold uppercase whitespace-nowrap"
                    title="তারিখ অনুযায়ী ছোট-বড় সাজান"
                  >
                    <span>তারিখ</span>
                    {sortField === 'date' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3.5 whitespace-nowrap">ধরন</th>
                <th className="py-3 px-3.5 min-w-[200px]">কাজের বিবরণ / খাত</th>
                <th className="py-3 px-3.5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleToggleSort('category')}
                    className="inline-flex items-center gap-1 hover:text-emerald-600 font-bold uppercase whitespace-nowrap"
                    title="ক্যাটাগরি অনুযায়ী সাজান"
                  >
                    <span>ক্যাটাগরি</span>
                    {sortField === 'category' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleToggleSort('amount')}
                    className="inline-flex items-center gap-1 hover:text-emerald-600 font-bold uppercase ml-auto whitespace-nowrap"
                    title="টাকার পরিমাণ অনুযায়ী ছোট-বড় সাজান"
                  >
                    <span>টাকার পরিমাণ</span>
                    {sortField === 'amount' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3.5 whitespace-nowrap">পেমেন্ট</th>
                <th className="py-3 px-3.5 whitespace-nowrap">এন্ট্রিদাতা</th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 px-4 text-center text-slate-500">
                    <div className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {periodMode === 'day' && filterSpecificDate === todayStr && !search.trim()
                        ? `আজকের (${formatBengaliDate(todayStr)}) কোনো দৈনিক এন্ট্রি এখনো নেই।`
                        : periodMode === 'range'
                        ? `নির্বাচিত তারিখ সীমায় (${
                            normalizedRange.from ? formatBengaliDate(normalizedRange.from) : 'শুরু'
                          } — ${
                            normalizedRange.to ? formatBengaliDate(normalizedRange.to) : 'আজ'
                          }) কোনো লেনদেন পাওয়া যায়নি।`
                        : 'নির্বাচিত তারিখে বা সার্চে কোনো লেনদেন পাওয়া যায়নি।'}
                    </div>
                    <p className="text-xs text-slate-400 mb-3">
                      পূর্বের সব {toBengaliNumber(scopedTransactions.length)}টি লেনদেন নিরাপদে আর্কাইভে জমা আছে — তারিখ সীমা ("থেকে — পর্যন্ত") বা নিচের বাটন থেকে সহজেই দেখতে পারবেন।
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {latestAvailableDate && latestAvailableDate !== filterSpecificDate && (
                        <button
                          type="button"
                          onClick={() => {
                            setPeriodMode('day');
                            setFilterSpecificDate(latestAvailableDate);
                            setFilterDateFrom('');
                            setFilterDateTo('');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                        >
                          সর্বশেষ তারিখ দেখুন ({formatBengaliDate(latestAvailableDate)})
                        </button>
                      )}
                      {scopedTransactions.length > 0 && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold"
                        >
                          সব সংরক্ষিত হিসাব দেখুন ({toBengaliNumber(scopedTransactions.length)} টি)
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((tx, idx) => {
                  const isIncome = tx.type === 'income';
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-medium">
                        {toBengaliNumber(idx + 1)}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        <div className="font-semibold">{tx.date}</div>
                        <div className="text-[10px] text-slate-400">{formatBengaliDate(tx.date)}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          isIncome
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}>
                          {isIncome ? '+ জমা (Income)' : '- খরচ (Expense)'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-900 dark:text-white font-medium max-w-xs">
                        <div className="font-semibold flex flex-wrap items-center gap-1.5">
                          <span>{tx.title}</span>
                          {tx._pendingSync && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                              <Clock className="w-2.5 h-2.5" />
                              অফলাইন · সিঙ্ক বাকি
                            </span>
                          )}
                        </div>
                        {tx.note && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5">
                            নোট: {tx.note}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          ID: {tx.id}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs">
                          {tx.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-extrabold text-sm sm:text-base">
                        <span className={isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                          {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs">
                        {tx.paymentMethod === 'bkash' ? 'বিকাশ (bKash)' : tx.paymentMethod === 'nagad' ? 'নগদ (Nagad)' : tx.paymentMethod === 'bank' ? 'ব্যাংক' : 'নগদ ক্যাশ'}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        <div className="font-medium text-xs">{tx.addedBy}</div>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isViewOnlyAction ? (
                          <span
                            className="text-[10px] text-slate-500 font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800"
                            title="এডিট বা ডিলিট অ্যাডমিন দ্বারা বন্ধ করা আছে"
                          >
                            শুধুমাত্র দেখুন (এডিট বন্ধ)
                          </span>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            {canEditEntry && (
                              <button
                                onClick={() => onEditTransaction(tx)}
                                className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors"
                                title="সম্পাদনা করুন"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {canDeleteEntry && (
                              confirmDeleteId === tx.id ? (
                                <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-lg px-1.5 py-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConfirmDeleteId(null);
                                      onDeleteTransaction(tx.id);
                                    }}
                                    className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black hover:bg-rose-700"
                                  >
                                    মুছুন
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold"
                                  >
                                    না
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(tx.id)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 transition-colors"
                                  title="মুছে ফেলুন"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredList.length > visibleTxLimit && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              প্রদর্শিত হচ্ছে {toBengaliNumber(paginatedRows.length)} / {toBengaliNumber(filteredList.length)} টি লেনদেন
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVisibleTxLimit((prev) => prev + 80)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer"
              >
                +৮০ আরও দেখুন
              </button>
              <button
                type="button"
                onClick={() => setVisibleTxLimit(filteredList.length)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-bold cursor-pointer"
              >
                সব দেখুন ({toBengaliNumber(filteredList.length)})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Print & PDF Publication Studio Modal for Ledger */}
      <PrintStudioModal
        isOpen={isPrintStudioOpen}
        onClose={() => setIsPrintStudioOpen(false)}
        documentTitle={`আয়-ব্যয় খাতা · ${activePeriodLabel} (${toBengaliNumber(filteredList.length)} টি)`}
        fileNamePrefix={`DIP-BHOLA-Ledger-${todayStr}`}
        summaryText={[
          `📒 *${company?.name || 'DIP BHOLA NETWORK'} — আয়-ব্যয় লেনদেন খাতা (${activePeriodLabel})*`,
          `👤 ব্যবহারকারী: ${currentUser.name}`,
          `📝 রেকর্ড সংখ্যা: ${filteredList.length} টি`,
          `➕ মোট জমা: ৳ ${totals.income.toLocaleString()}`,
          `➖ মোট খরচ: ৳ ${totals.expense.toLocaleString()}`,
          `💰 নিট ব্যালেন্স: ৳ ${totals.net.toLocaleString()}`
        ].join('\n')}
        whatsappGroupConfig={whatsappGroupConfig}
      >
        <div className="bg-white text-black space-y-4">
          <div data-print-section="header" className="border-b-2 border-slate-900 pb-3 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-black">{company?.name || 'DIP BHOLA NETWORK'}</h1>
              <p className="text-xs text-slate-900 font-bold">{company?.subTitle || 'দৈনিক, সাপ্তাহিক, মাসিক ও বাৎসরিক আয়-ব্যয় বিবরণী'}</p>
              <p className="text-[11px] text-slate-800 font-semibold">ঠিকানা: {company?.address || '৩নং পশ্চিম ইলিশা, ভোলা সদর'} · সময়কাল: {activePeriodLabel}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right text-xs text-black space-y-0.5">
                <div className="font-black text-black">লেনদেনের প্রিন্ট কপি</div>
                <div data-print-section="audit">তারিখ: <strong>{formatBengaliDate(todayStr)}</strong></div>
                <div data-print-section="added-by">প্রস্তুতকারী: <strong>{currentUser.name}</strong></div>
              </div>
              {ledgerQr?.qrDataUrl ? (
                <div className="flex flex-col items-center shrink-0 pl-2 border-l border-slate-400">
                  <div className="w-18 h-18 bg-white p-0.5 rounded-lg border-2 border-slate-900">
                    <img
                      src={ledgerQr.qrDataUrl}
                      alt="Ledger PDF QR"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-[8.5px] font-black text-emerald-900 mt-0.5 text-center leading-tight">
                    স্ক্যান করে PDF দেখুন
                  </span>
                </div>
              ) : (
                <div className="w-14 h-14 rounded-lg border border-slate-300 flex items-center justify-center text-slate-400">
                  <QrCode className="w-7 h-7" />
                </div>
              )}
            </div>
          </div>

          <div data-print-section="summary" className="grid grid-cols-4 gap-2.5 text-center">
            <div className="p-2.5 border-2 border-slate-400 rounded-lg bg-white">
              <div className="text-[11px] text-slate-800 font-extrabold">মোট রেকর্ড</div>
              <div className="text-base font-black text-black">{toBengaliNumber(filteredList.length)} টি</div>
            </div>
            <div className="p-2.5 border-2 border-emerald-500 rounded-lg bg-emerald-50">
              <div className="text-[11px] text-emerald-950 font-extrabold">মোট জমা</div>
              <div className="text-base font-black text-emerald-800">+{formatCurrency(totals.income)}</div>
            </div>
            <div className="p-2.5 border-2 border-rose-500 rounded-lg bg-rose-50">
              <div className="text-[11px] text-rose-950 font-extrabold">মোট খরচ</div>
              <div className="text-base font-black text-rose-800">-{formatCurrency(totals.expense)}</div>
            </div>
            <div className="p-2.5 border-2 border-indigo-500 rounded-lg bg-indigo-50">
              <div className="text-[11px] text-indigo-950 font-extrabold">নিট ব্যালেন্স</div>
              <div className="text-base font-black text-indigo-950">{formatCurrency(totals.net)}</div>
            </div>
          </div>

          <table className="w-full text-[11px] text-left border-collapse border-2 border-slate-500">
            <thead>
              <tr className="bg-slate-200 text-black font-black">
                <th className="p-2 border border-slate-400 text-center whitespace-nowrap">নং</th>
                <th className="p-2 border border-slate-400 whitespace-nowrap">তারিখ</th>
                <th className="p-2 border border-slate-400 whitespace-nowrap">ধরন</th>
                <th className="p-2 border border-slate-400">বিবরণ / খাত</th>
                <th className="p-2 border border-slate-400">ক্যাটাগরি</th>
                <th className="p-2 border border-slate-400 text-right whitespace-nowrap">পরিমাণ</th>
                <th className="p-2 border border-slate-400 whitespace-nowrap">পেমেন্ট</th>
                <th data-print-section="added-by" className="p-2 border border-slate-400 whitespace-nowrap">এন্ট্রিদাতা</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-slate-600 font-semibold">কোনো লেনদেন পাওয়া যায়নি।</td>
                </tr>
              ) : (
                filteredList.map((tx, idx) => {
                  const isIncome = tx.type === 'income';
                  return (
                    <tr key={tx.id}>
                      <td className="p-1.5 border border-slate-400 text-center font-bold text-black whitespace-nowrap">{toBengaliNumber(idx + 1)}</td>
                      <td className="p-1.5 border border-slate-400 font-bold text-black whitespace-nowrap">{formatBengaliDate(tx.date)}</td>
                      <td className={`p-1.5 border border-slate-400 font-black whitespace-nowrap ${isIncome ? 'text-emerald-800' : 'text-rose-800'}`}>
                        {isIncome ? 'জমা' : 'খরচ'}
                      </td>
                      <td className="p-1.5 border border-slate-400 font-bold text-black break-words">
                        {tx.title}
                        {tx.note && <div className="text-[10px] text-slate-800 font-medium">নোট: {tx.note}</div>}
                      </td>
                      <td className="p-1.5 border border-slate-400 font-semibold text-slate-900">{tx.category}</td>
                      <td className={`p-1.5 border border-slate-400 text-right font-black whitespace-nowrap ${isIncome ? 'text-emerald-800' : 'text-rose-800'}`}>
                        {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                      </td>
                      <td className="p-1.5 border border-slate-400 font-semibold text-slate-900 whitespace-nowrap">
                        {tx.paymentMethod === 'bkash' ? 'বিকাশ' : tx.paymentMethod === 'nagad' ? 'নগদ' : tx.paymentMethod === 'bank' ? 'ব্যাংক' : 'ক্যাশ'}
                      </td>
                      <td data-print-section="added-by" className="p-1.5 border border-slate-400 font-semibold text-slate-900">{tx.addedBy}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr data-print-section="totals" className="bg-slate-200 font-black text-black">
                <td colSpan={5} className="p-2 border border-slate-400 text-right">
                  মোট হিসাব ({toBengaliNumber(filteredList.length)}টি) — জমা: {formatCurrency(totals.income)} | খরচ: {formatCurrency(totals.expense)}
                </td>
                <td className="p-2 border border-slate-400 text-right">
                  নিট: {formatCurrency(totals.net)}
                </td>
                <td colSpan={2} className="p-2 border border-slate-400 text-center text-[10px] text-slate-900 font-bold">
                  {activePeriodLabel}
                </td>
              </tr>
            </tfoot>
          </table>

          <div data-print-section="signatures" className="pt-8 grid grid-cols-2 gap-8 text-center text-xs text-black">
            <div>
              <div className="border-t-2 border-slate-900 pt-1.5 font-black">এন্ট্রিদাতা / স্টাফ স্বাক্ষর</div>
            </div>
            <div>
              <div className="border-t-2 border-slate-900 pt-1.5 font-black">পরিচালক / ম্যানেজার অনুমোদন</div>
            </div>
          </div>
        </div>
      </PrintStudioModal>
    </div>
  );
};
