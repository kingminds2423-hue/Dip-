import React, { useState, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  Building2,
  TrendingUp,
  TrendingDown,
  Wallet,
  CheckCircle,
  Clock,
  PieChart,
  FileText,
  ShieldCheck,
  PenLine,
  Users,
  Settings,
  RotateCcw,
  Check,
  Award,
  BadgeCheck,
  UserCheck,
  Cloud,
  Share2,
  Bot,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Lock,
  BarChart3,
  QrCode
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  Transaction,
  Company,
  Partner,
  Staff,
  OfficersState,
  WhatsAppGroupConfig,
  CustomerComplaint
} from '../types';
import { formatCurrency, toBengaliNumber, formatBengaliDate, getTodayString, getTransactionDateKey } from '../utils/formatters';
import {
  getAccessToken,
  googleSignIn,
  uploadMonthlyA4StatementToDrive,
  uploadCsvStatementToDrive,
  formatGoogleDriveAuthError
} from '../services/googleDriveService';
import { generateCsvData } from '../services/dataService';
import {
  PaperSize,
  getSavedPrintPreferences,
  savePrintPreferences,
  applyDynamicPrintPageRule
} from '../services/pdfPrintService';
import { PrintStudioModal } from './PrintStudioModal';
import { OfficialRoundSeal } from './OfficialSealAndSign';
import { FinancialSummaryCards } from './FinancialSummaryCards';
import { MonthlyProfitLossModal } from './MonthlyProfitLossModal';
import {
  AiMonitoringReport,
  buildAutoSystemMonitoringReport,
  fetchLiveAiMonitoringReport
} from '../services/aiMonitoringService';
import { createSharedReportAndQrUrl } from '../services/sharedReportService';

interface ReportsViewProps {
  transactions: Transaction[];
  company: Company | null;
  partners?: Partner[];
  staffs?: Staff[];
  officers?: OfficersState;
  complaints?: CustomerComplaint[];
  whatsappGroupConfig?: WhatsAppGroupConfig | null;
  openPrintStudioNonce?: number;
  canExportOrPrint?: boolean;
  onExportCsv: (monthStr?: string, customList?: Transaction[]) => void;
}

interface SignatoryConfig {
  directorName: string;
  directorTitle: string;
  auditorName: string;
  auditorTitle: string;
  auditorRemarks: string;
  managerName: string;
  managerTitle: string;
  showPartnerShares: boolean;
  showSealStamp: boolean;
  statementDate: string;
}

const STORAGE_KEY = 'dip_bhola_report_signatories_v2';

type ReportPeriodMode = 'monthly' | 'yearly' | 'custom_range' | 'today' | 'last_7_days' | 'all';

export const ReportsView: React.FC<ReportsViewProps> = ({
  transactions,
  company,
  partners = [],
  staffs = [],
  officers,
  complaints = [],
  whatsappGroupConfig,
  openPrintStudioNonce = 0,
  canExportOrPrint = true,
  onExportCsv,
}) => {
  const todayStr = useMemo(() => getTodayString(), []);
  const currentMonthStr = useMemo(() => todayStr.substring(0, 7), [todayStr]);
  const currentYearStr = useMemo(() => todayStr.substring(0, 4), [todayStr]);

  const [periodMode, setPeriodMode] = useState<ReportPeriodMode>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (transactions.length > 0 && transactions[0].date) {
      return transactions[0].date.substring(0, 7);
    }
    return new Date().toISOString().split('T')[0].substring(0, 7);
  });
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => todayStr);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPrintStudioOpen, setIsPrintStudioOpen] = useState(false);
  const [isMonthlyPnLOpen, setIsMonthlyPnLOpen] = useState(false);
  const [barChartMode, setBarChartMode] = useState<'monthly_year' | 'period_compare' | 'daily_month'>('monthly_year');
  const [quickPaperSize, setQuickPaperSize] = useState<PaperSize>(() => getSavedPrintPreferences().size);
  const [liveAiReport, setLiveAiReport] = useState<AiMonitoringReport | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiErrorMsg, setAiErrorMsg] = useState<string | null>(null);
  const [forceAutoSignNow, setForceAutoSignNow] = useState(false);

  useEffect(() => {
    const current = getSavedPrintPreferences();
    applyDynamicPrintPageRule(
      quickPaperSize,
      current.orientation,
      current.marginMm,
      current.customWidthMm,
      current.customHeightMm
    );
  }, [quickPaperSize]);

  useEffect(() => {
    if (openPrintStudioNonce > 0) {
      setIsPrintStudioOpen(true);
    }
  }, [openPrintStudioNonce]);

  // Auto-detect manager from staffs list if exists
  const detectedManager = useMemo(() => {
    const mgr = staffs.find(
      (s) =>
        s.designation?.toLowerCase().includes('ম্যানেজার') ||
        s.designation?.toLowerCase().includes('manager')
    );
    return mgr ? `${mgr.name} (ম্যানেজার)` : 'মোঃ সাইফুল ইসলাম';
  }, [staffs]);

  // Signatory State with LocalStorage persistence
  const [signatories, setSignatories] = useState<SignatoryConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return {
      directorName: company?.ownerName || 'জাহিদুল ইসলাম',
      directorTitle: 'প্রধান পরিচালক ও ব্যবস্থাপনা অংশীদার',
      auditorName: 'মোঃ কাওসার আহমেদ',
      auditorTitle: 'অভ্যন্তরীণ হিসাব নিরীক্ষক (অডিট কর্মকর্তা)',
      auditorRemarks: 'চলতি মাসের সকল আয়-ব্যয়ের ভাউচার, ক্যাশ মেমো ও হিসাব বহি পুঙ্খানুপুঙ্খভাবে অডিট করে সঠিক ও নির্ভুল পাওয়া গেল।',
      managerName: 'মোঃ সাইফুল ইসলাম',
      managerTitle: 'শাখা / জেনারেল ম্যানেজার',
      showPartnerShares: true,
      showSealStamp: true,
      statementDate: new Date().toISOString().split('T')[0]
    };
  });

  // Sync director, manager and auditor if company or officers change
  useEffect(() => {
    setSignatories((prev) => ({
      ...prev,
      directorName: company?.ownerName || prev.directorName,
      managerName: officers?.manager?.name || prev.managerName,
      managerTitle: officers?.manager?.designation || prev.managerTitle,
      auditorName: officers?.auditor?.name || prev.auditorName,
      auditorTitle: officers?.auditor?.designation || prev.auditorTitle,
      auditorRemarks: officers?.auditor?.scopeOfWork
        ? `হিসাব নিরীক্ষা প্রতিবেদন: ${officers.auditor.scopeOfWork}`
        : prev.auditorRemarks
    }));
  }, [company?.ownerName, officers]);

  const updateSignatory = (field: keyof SignatoryConfig, value: string | boolean) => {
    setSignatories((prev) => {
      const updated = { ...prev, [field]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const resetSignatoriesToDefault = () => {
    const def: SignatoryConfig = {
      directorName: company?.ownerName || 'জাহিদুল ইসলাম',
      directorTitle: 'প্রধান পরিচালক ও ব্যবস্থাপনা অংশীদার',
      auditorName: 'মোঃ কাওসার আহমেদ',
      auditorTitle: 'অভ্যন্তরীণ হিসাব নিরীক্ষক (অডিট কর্মকর্তা)',
      auditorRemarks: 'চলতি মাসের সকল আয়-ব্যয়ের ভাউচার, ক্যাশ মেমো ও হিসাব বহি পুঙ্খানুপুঙ্খভাবে অডিট করে সঠিক ও নির্ভুল পাওয়া গেল।',
      managerName: detectedManager,
      managerTitle: 'শাখা / জেনারেল ম্যানেজার',
      showPartnerShares: true,
      showSealStamp: true,
      statementDate: new Date().toISOString().split('T')[0]
    };
    setSignatories(def);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(def));
    } catch {
      // ignore
    }
  };

  // Distinct months & years from transactions
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.date && tx.date.length >= 7) {
        months.add(tx.date.substring(0, 7));
      }
    });
    return Array.from(months).sort().reverse();
  }, [transactions]);

  const availableYears = useMemo(() => {
    const years = new Set<string>([currentYearStr]);
    transactions.forEach((tx) => {
      if (tx.date && tx.date.length >= 4) {
        years.add(tx.date.substring(0, 4));
      }
    });
    return Array.from(years).sort().reverse();
  }, [transactions, currentYearStr]);

  // Effective period range label & key
  const periodMeta = useMemo(() => {
    if (periodMode === 'all') {
      return {
        label: 'সর্বমোট সময় (All Time)',
        key: 'ALL',
        isMonthEnded: true
      };
    }
    if (periodMode === 'yearly') {
      return {
        label: `বাৎসরিক হিসাব: ${toBengaliNumber(selectedYear)} সাল`,
        key: selectedYear,
        isMonthEnded: selectedYear < currentYearStr
      };
    }
    if (periodMode === 'today') {
      return {
        label: `আজকের হিসাব (${formatBengaliDate(todayStr)})`,
        key: todayStr,
        isMonthEnded: false
      };
    }
    if (periodMode === 'last_7_days') {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      const startStr = start.toISOString().split('T')[0];
      return {
        label: `গত ৭ দিন (${formatBengaliDate(startStr)} – ${formatBengaliDate(todayStr)})`,
        key: `${startStr}_to_${todayStr}`,
        isMonthEnded: false
      };
    }
    if (periodMode === 'custom_range') {
      return {
        label: `কাস্টম সময়: ${formatBengaliDate(customStartDate)} থেকে ${formatBengaliDate(customEndDate)}`,
        key: `${customStartDate}_to_${customEndDate}`,
        isMonthEnded: customEndDate < todayStr
      };
    }

    // Monthly mode
    const [yr, mo] = selectedMonth.split('-').map(Number);
    const lastDayOfMonth = yr && mo ? new Date(yr, mo, 0).getDate() : 30;
    const todayDateObj = new Date(todayStr);
    const isLastDayToday =
      selectedMonth === currentMonthStr && todayDateObj.getDate() >= lastDayOfMonth;
    const isEnded = selectedMonth < currentMonthStr || isLastDayToday;

    return {
      label: `মাসিক হিসাব: ${toBengaliNumber(selectedMonth)}`,
      key: selectedMonth,
      isMonthEnded: isEnded
    };
  }, [periodMode, selectedMonth, selectedYear, currentYearStr, currentMonthStr, customStartDate, customEndDate, todayStr]);

  // Transactions filtered by selected period (Daily, Monthly, Yearly, Custom Date Range, Last 7 Days, or All)
  const monthTransactions = useMemo(() => {
    if (periodMode === 'all') return transactions;
    if (periodMode === 'yearly') {
      return transactions.filter((tx) => tx.date && tx.date.startsWith(selectedYear));
    }
    if (periodMode === 'today') {
      return transactions.filter((tx) => tx.date === todayStr);
    }
    if (periodMode === 'last_7_days') {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      const startStr = start.toISOString().split('T')[0];
      return transactions.filter((tx) => tx.date >= startStr && tx.date <= todayStr);
    }
    if (periodMode === 'custom_range') {
      const s = customStartDate <= customEndDate ? customStartDate : customEndDate;
      const e = customStartDate <= customEndDate ? customEndDate : customStartDate;
      return transactions.filter((tx) => tx.date >= s && tx.date <= e);
    }
    return transactions.filter((tx) => tx.date && tx.date.startsWith(selectedMonth));
  }, [transactions, periodMode, selectedMonth, selectedYear, customStartDate, customEndDate, todayStr]);

  // Calculations
  const summary = useMemo(() => {
    let inc = 0;
    let exp = 0;
    const catBreakdown: Record<string, { income: number; expense: number }> = {};

    monthTransactions.forEach((tx) => {
      const isIncome = tx.type === 'income';
      if (isIncome) {
        inc += tx.amount;
      } else {
        exp += tx.amount;
      }

      if (!catBreakdown[tx.category]) {
        catBreakdown[tx.category] = { income: 0, expense: 0 };
      }
      if (isIncome) {
        catBreakdown[tx.category].income += tx.amount;
      } else {
        catBreakdown[tx.category].expense += tx.amount;
      }
    });

    return {
      totalRecords: monthTransactions.length,
      totalIncome: inc,
      totalExpense: exp,
      netBalance: inc - exp,
      catBreakdown
    };
  }, [monthTransactions]);

  // Multi-month aggregation breakdown for custom date ranges / all-time trend reporting
  const multiMonthBreakdown = useMemo(() => {
    const map: Record<string, { month: string; income: number; expense: number; net: number; count: number }> = {};
    monthTransactions.forEach((tx) => {
      const m = tx.date && tx.date.length >= 7 ? tx.date.substring(0, 7) : 'অজানা';
      if (!map[m]) {
        map[m] = { month: m, income: 0, expense: 0, net: 0, count: 0 };
      }
      map[m].count += 1;
      if (tx.type === 'income') map[m].income += tx.amount;
      else map[m].expense += tx.amount;
      map[m].net = map[m].income - map[m].expense;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [monthTransactions]);

  // Recharts dataset comparing Daily, Monthly (12 months of current year), and Total Income vs Expenses
  const rechartsBarData = useMemo(() => {
    const currentYear = todayStr.substring(0, 4);
    const monthLabels = [
      'জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'
    ];

    if (barChartMode === 'period_compare') {
      let dInc = 0, dExp = 0;
      let mInc = 0, mExp = 0;
      let yInc = 0, yExp = 0;
      let tInc = 0, tExp = 0;
      transactions.forEach((tx) => {
        const dk = getTransactionDateKey(tx);
        const amt = Number(tx.amount) || 0;
        const isInc = tx.type === 'income';
        if (isInc) tInc += amt; else tExp += amt;
        if (dk.startsWith(currentYear)) {
          if (isInc) yInc += amt; else yExp += amt;
        }
        if (dk.startsWith(currentMonthStr)) {
          if (isInc) mInc += amt; else mExp += amt;
        }
        if (dk === todayStr) {
          if (isInc) dInc += amt; else dExp += amt;
        }
      });
      return [
        { label: 'দৈনিক (আজ)', income: dInc, expense: dExp, net: dInc - dExp },
        { label: 'মাসিক (চলতি মাস)', income: mInc, expense: mExp, net: mInc - mExp },
        { label: `চলতি বছর (${toBengaliNumber(currentYear)})`, income: yInc, expense: yExp, net: yInc - yExp },
        { label: 'সর্বমোট (Total)', income: tInc, expense: tExp, net: tInc - tExp }
      ];
    }

    if (barChartMode === 'daily_month') {
      const targetMonth = selectedMonth || currentMonthStr;
      const dayMap = new Map<string, { income: number; expense: number }>();
      transactions.forEach((tx) => {
        const dk = getTransactionDateKey(tx);
        if (!dk.startsWith(targetMonth)) return;
        const cur = dayMap.get(dk) || { income: 0, expense: 0 };
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'income') cur.income += amt;
        else cur.expense += amt;
        dayMap.set(dk, cur);
      });
      return Array.from(dayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dk, vals]) => ({
          label: `${toBengaliNumber(dk.substring(8, 10))} তাং`,
          income: vals.income,
          expense: vals.expense,
          net: vals.income - vals.expense
        }));
    }

    // Default: all 12 months of the current year
    const monthsArr = monthLabels.map((lbl, idx) => {
      const mKey = `${currentYear}-${String(idx + 1).padStart(2, '0')}`;
      return { monthKey: mKey, label: lbl, income: 0, expense: 0, net: 0 };
    });
    transactions.forEach((tx) => {
      const dk = getTransactionDateKey(tx);
      if (!dk.startsWith(currentYear) || dk.length < 7) return;
      const mIdx = parseInt(dk.substring(5, 7), 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'income') monthsArr[mIdx].income += amt;
        else monthsArr[mIdx].expense += amt;
        monthsArr[mIdx].net = monthsArr[mIdx].income - monthsArr[mIdx].expense;
      }
    });
    return monthsArr;
  }, [transactions, barChartMode, todayStr, currentMonthStr, selectedMonth]);

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

  const autoMonitoringBaseline = useMemo(
    () =>
      buildAutoSystemMonitoringReport({
        companyName: company?.name || 'DIP BHOLA NETWORK',
        periodLabel: periodMeta.label,
        periodKey: periodMeta.key,
        isMonthEnded: periodMeta.isMonthEnded || forceAutoSignNow,
        transactions: monthTransactions,
        partners: effectivePartners,
        complaints,
        totalIncome: summary.totalIncome,
        totalExpense: summary.totalExpense,
        netBalance: summary.netBalance,
        catBreakdown: summary.catBreakdown
      }),
    [
      company?.name,
      periodMeta,
      forceAutoSignNow,
      monthTransactions,
      effectivePartners,
      complaints,
      summary
    ]
  );

  // Clear stale live AI report when period changes so baseline updates immediately
  useEffect(() => {
    setLiveAiReport(null);
    setAiErrorMsg(null);
  }, [periodMeta.key]);

  const activeAiReport = liveAiReport || autoMonitoringBaseline;
  const isAiAutoSigned = periodMeta.isMonthEnded || forceAutoSignNow || Boolean(liveAiReport);

  const [statementQr, setStatementQr] = useState<{
    qrDataUrl: string;
    shareUrl: string;
    reportId: string;
  } | null>(null);

  useEffect(() => {
    if (!canExportOrPrint) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const mappedPeriodType =
        periodMode === 'today'
          ? 'daily'
          : periodMode === 'monthly'
          ? 'monthly'
          : periodMode === 'yearly'
          ? 'yearly'
          : periodMode === 'all'
          ? 'all'
          : 'custom';
      createSharedReportAndQrUrl({
        company: company || null,
        officers,
        periodType: mappedPeriodType,
        periodLabel: periodMeta.label,
        verificationCode: activeAiReport.verificationCode,
        auditScore: activeAiReport.auditScore,
        generatedBy: company?.ownerName || 'জাহিদুল ইসলাম',
        summary: {
          totalIncome: summary.totalIncome,
          totalExpense: summary.totalExpense,
          netBalance: summary.netBalance,
          txCount: summary.totalRecords,
          pendingDue: 0
        },
        categorySummary: Object.entries(summary.catBreakdown).map(([name, vals]) => ({
          name,
          income: vals.income,
          expense: vals.expense,
          count: 1
        })),
        multiMonthSummary: multiMonthBreakdown.map((m) => ({
          month: m.month,
          label: toBengaliNumber(m.month),
          income: m.income,
          expense: m.expense,
          net: m.net,
          count: m.count
        })),
        transactions: monthTransactions
      })
        .then((res) => {
          if (!cancelled) {
            setStatementQr({
              qrDataUrl: res.qrDataUrl,
              shareUrl: res.shareUrl,
              reportId: res.reportId
            });
          }
        })
        .catch(() => {
          // ignore offline snapshot error
        });
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    canExportOrPrint,
    company,
    officers,
    periodMode,
    periodMeta.label,
    activeAiReport.verificationCode,
    activeAiReport.auditScore,
    summary,
    multiMonthBreakdown,
    monthTransactions
  ]);

  const handleGenerateLiveAiReport = async () => {
    setIsGeneratingAi(true);
    setAiErrorMsg(null);
    try {
      const result = await fetchLiveAiMonitoringReport({
        companyName: company?.name || 'DIP BHOLA NETWORK',
        periodLabel: periodMeta.label,
        periodKey: periodMeta.key,
        isMonthEnded: periodMeta.isMonthEnded || forceAutoSignNow,
        transactions: monthTransactions,
        partners: effectivePartners,
        complaints,
        totalIncome: summary.totalIncome,
        totalExpense: summary.totalExpense,
        netBalance: summary.netBalance,
        catBreakdown: summary.catBreakdown
      });
      setLiveAiReport(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI মনিটরিং সার্ভার থেকে উত্তর পাওয়া যায়নি।';
      setAiErrorMsg(msg);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const [isDriveUploading, setIsDriveUploading] = useState(false);
  const [driveUploadSuccess, setDriveUploadSuccess] = useState(false);
  const [driveErrorMsg, setDriveErrorMsg] = useState<string | null>(null);

  const handleUploadA4ToDrive = async () => {
    setDriveErrorMsg(null);
    let token = getAccessToken();
    if (!token) {
      try {
        const res = await googleSignIn();
        if (res) token = res.accessToken;
      } catch (authErr: any) {
        setDriveErrorMsg(formatGoogleDriveAuthError(authErr));
        return;
      }
    }
    if (!token) return;

    setIsDriveUploading(true);
    try {
      const monthStr = selectedMonth === 'all' ? todayStr.substring(0, 7) : selectedMonth;
      const statementEl = document.getElementById('printable-financial-statement');
      const htmlBody = statementEl ? statementEl.innerHTML : '';
      
      const fullHtmlDoc = `<!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8"><title>${companyName} - A4 আর্থিক বিবরণী (${monthStr})</title><style>body { font-family: 'Hind Siliguri', Arial, sans-serif; margin: 25px; color: #1e293b; font-size: 10pt; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #cbd5e1; padding: 6px 8px; } th { background: #f8fafc; font-weight: bold; } .page-break-avoid { page-break-inside: avoid; } @media print { @page { size: A4 portrait; margin: 10mm; } }</style></head><body>${htmlBody}</body></html>`;

      await uploadMonthlyA4StatementToDrive(token, fullHtmlDoc, monthStr, companyName);
      const csvStr = generateCsvData(monthTransactions, companyName, monthStr);
      await uploadCsvStatementToDrive(token, csvStr, monthStr);

      setDriveUploadSuccess(true);
      setTimeout(() => setDriveUploadSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setDriveErrorMsg('Google Drive-এ A4 স্টেটমেন্ট আপলোডে সমস্যা হয়েছে।');
    } finally {
      setIsDriveUploading(false);
    }
  };

  const handleChangeQuickPaperSize = (size: PaperSize) => {
    setQuickPaperSize(size);
    const prefs = getSavedPrintPreferences();
    const updated = { ...prefs, size };
    savePrintPreferences(updated);
    applyDynamicPrintPageRule(
      updated.size,
      updated.orientation,
      updated.marginMm,
      updated.customWidthMm,
      updated.customHeightMm
    );
  };

  const handlePrint = () => {
    const prefs = getSavedPrintPreferences();
    applyDynamicPrintPageRule(
      quickPaperSize,
      prefs.orientation,
      prefs.marginMm,
      prefs.customWidthMm,
      prefs.customHeightMm
    );
    window.print();
  };

  const companyName = company?.name || 'DIP BHOLA NETWORK';
  const ownerName = company?.ownerName || 'জাহিদুল ইসলাম';
  const phone = company?.phone || '01721200049';
  const address = company?.address || '৩নং পশ্চিম ইলিশা।ভোলা সদর ভোলা';

  return (
    <div className="space-y-6">
      {/* Top Header & Flexible Period Selector Card (Hidden when printing) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span>AI মনিটরিং ও মাসিক / তাৎক্ষণিক আর্থিক প্রতিবেদন</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              মাস শেষে অথবা ইচ্ছেমতো যেকোনো সময় বের করুন — AI Auto System সাইন, সবার সিল ও স্বাক্ষরসহ
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Live Gemini AI Audit Button */}
            <button
              type="button"
              onClick={handleGenerateLiveAiReport}
              disabled={isGeneratingAi}
              className="px-3.5 py-2 text-xs font-black text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 rounded-xl transition-all shadow-md flex items-center gap-1.5"
              title="AI দ্বারা এই সময়সীমার সম্পূর্ণ মনিটরিং ও অডিট রিপোর্ট তৈরি করুন"
            >
              {isGeneratingAi ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-amber-300" />
              )}
              <span>{isGeneratingAi ? 'AI বিশ্লেষণ চলছে...' : 'AI মনিটরিং রিপোর্ট তৈরি'}</span>
            </button>

            {/* Toggle Signatories Edit Panel */}
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition-all border flex items-center gap-1.5 ${
                isSettingsOpen
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
              title="রিপোর্টে প্রদর্শিত পরিচালক, অডিটর, ম্যানেজার ও স্বাক্ষরের তথ্য পরিবর্তন করুন"
            >
              <PenLine className="w-3.5 h-3.5 text-emerald-600" />
              <span>সিল ও স্বাক্ষর এডিট</span>
            </button>

            {canExportOrPrint ? (
              <>
                {/* CSV Export Button */}
                <button
                  onClick={() => onExportCsv(periodMeta.key, monthTransactions)}
                  className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors border border-slate-300 flex items-center gap-1.5"
                  title="CSV ফাইল ডাউনলোড করুন"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </button>

                {/* Google Drive A4 Backup Button */}
                <button
                  onClick={handleUploadA4ToDrive}
                  disabled={isDriveUploading}
                  className="px-3 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
                  title="হিসাব স্টেটমেন্ট সরাসরি Google Drive ফোল্ডারে সেভ করুন"
                >
                  <Cloud className={`w-3.5 h-3.5 ${isDriveUploading ? 'animate-bounce' : ''}`} />
                  <span>{isDriveUploading ? 'সেভ হচ্ছে...' : driveUploadSuccess ? 'সংরক্ষিত!' : 'Drive সেভ'}</span>
                </button>

                {/* Inline Paper Size Switcher (Default A4) */}
                <div className="flex items-center gap-1 bg-slate-100 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800">
                  <span className="text-[11px] text-slate-500">সাইজ:</span>
                  <select
                    value={quickPaperSize}
                    onChange={(e) => handleChangeQuickPaperSize(e.target.value as PaperSize)}
                    className="bg-transparent border-none text-emerald-800 font-black focus:ring-0 cursor-pointer text-xs p-0 pr-5"
                    title="প্রিন্ট ও PDF পেপার সাইজ পরিবর্তন করুন (ডিফল্ট A4)"
                  >
                    <option value="A4">A4 (ডিফল্ট)</option>
                    <option value="Legal">Legal</option>
                    <option value="Letter">Letter</option>
                    <option value="A5">A5 মিনি</option>
                    <option value="Custom">কাস্টম</option>
                  </select>
                </div>

                {/* Primary Print, Color & PDF Publication Studio Button */}
                <button
                  onClick={() => setIsPrintStudioOpen(true)}
                  className="px-4 py-2 text-xs sm:text-sm font-black text-white bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 active:scale-95 rounded-xl transition-all shadow-md flex items-center gap-1.5"
                  title="মন মতন সাইজ ও কালার পরিবর্তন, পরে প্রিন্টের জন্য সেভ, PDF ডাউনলোড ও WhatsApp/Gmail শেয়ার"
                >
                  <Share2 className="w-4 h-4 text-amber-300" />
                  <span>সাইজ·কালার·সেভ PDF ({quickPaperSize})</span>
                </button>

                {/* Direct Print Button */}
                <button
                  onClick={handlePrint}
                  className="px-3.5 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-xl transition-all border border-slate-300 flex items-center gap-1.5"
                  title="সরাসরি প্রিন্ট করুন"
                >
                  <Printer className="w-4 h-4 text-emerald-700" />
                  <span>প্রিন্ট</span>
                </button>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                <Lock className="w-3.5 h-3.5" />
                প্রিন্ট/PDF এক্সপোর্ট সীমিত
              </span>
            )}
          </div>
        </div>

        {/* Flexible On-Demand Period Controls (মাস বা যখন তখন তারিখ রেঞ্জ) */}
        <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mr-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              সময় নির্বাচন:
            </span>
            <button
              type="button"
              onClick={() => setPeriodMode('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodMode === 'monthly'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              মাসিক (Monthly)
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('yearly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodMode === 'yearly'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              বাৎসরিক (Yearly)
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('custom_range')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodMode === 'custom_range'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              যখন তখন (তারিখ রেঞ্জ)
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodMode === 'today'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              আজকের রিপোর্ট
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('last_7_days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodMode === 'last_7_days'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              গত ৭ দিন
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodMode === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              সর্বমোট (All Time)
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {periodMode === 'monthly' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold">
                <span className="text-slate-500">মাস:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent border-none text-slate-900 focus:ring-0 cursor-pointer font-bold p-0 pr-5"
                >
                  {availableMonths.length === 0 && (
                    <option value={currentMonthStr}>{toBengaliNumber(currentMonthStr)}</option>
                  )}
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {toBengaliNumber(m)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {periodMode === 'yearly' && (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 rounded-xl px-3 py-1.5 text-xs font-bold">
                <span className="text-amber-900">সাল:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-transparent border-none text-amber-950 focus:ring-0 cursor-pointer font-black p-0 pr-5"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {toBengaliNumber(yr)} সাল
                    </option>
                  ))}
                </select>
              </div>
            )}

            {periodMode === 'custom_range' && (
              <div className="flex flex-wrap items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-xl px-2.5 py-1 text-xs">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
                />
                <span className="font-bold text-indigo-800">থেকে</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => setForceAutoSignNow((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors ${
                isAiAutoSigned
                  ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}
              title="মাস শেষে স্বয়ংক্রিয় AI সাইন অথবা যেকোনো সময় তাৎক্ষণিক AI সিল ও সাইন যুক্ত করুন"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>
                {isAiAutoSigned ? 'AI অটো সাইন সক্রিয় ✅' : 'তাৎক্ষণিক AI সাইন যুক্ত করুন'}
              </span>
            </button>
          </div>
        </div>

        {aiErrorMsg && (
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{aiErrorMsg} (অটো-সিস্টেম মনিটরিং রিপোর্ট চালু রয়েছে)</span>
          </div>
        )}
        {driveErrorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{driveErrorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setDriveErrorMsg(null)}
              className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-100 hover:bg-rose-200"
            >
              বন্ধ করুন
            </button>
          </div>
        )}
      </div>

      {/* Interactive Signatory Customization Drawer (Hidden when printing) */}
      {isSettingsOpen && (
        <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-700 shadow-xl space-y-4 print:hidden animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <PenLine className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">
                রিপোর্টে স্বাক্ষরকারী কর্মকর্তাদের নাম ও অনুমোদন তথ্য কাস্টমাইজ করুন
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={resetSignatoriesToDefault}
                className="px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1 transition-colors"
                title="ডিফল্ট নামে রিসেট করুন"
              >
                <RotateCcw className="w-3 h-3" />
                রিসেট
              </button>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded-lg"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* 1. পরিচালক */}
            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 space-y-2">
              <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                <BadgeCheck className="w-4 h-4" />
                <span>১. পরিচালক (Director)</span>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">পরিচালকের নাম:</label>
                <input
                  type="text"
                  value={signatories.directorName}
                  onChange={(e) => updateSignatory('directorName', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:ring-1 focus:ring-emerald-500"
                  placeholder="পরিচালকের নাম"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">পদবী:</label>
                <input
                  type="text"
                  value={signatories.directorTitle}
                  onChange={(e) => updateSignatory('directorTitle', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-emerald-500"
                  placeholder="পদবী"
                />
              </div>
            </div>

            {/* 2. অডিট */}
            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 space-y-2">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>২. অডিট কর্মকর্তা (Auditor)</span>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">অডিটর এর নাম:</label>
                <input
                  type="text"
                  value={signatories.auditorName}
                  onChange={(e) => updateSignatory('auditorName', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:ring-1 focus:ring-amber-500"
                  placeholder="অডিটর এর নাম"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">পদবী:</label>
                <input
                  type="text"
                  value={signatories.auditorTitle}
                  onChange={(e) => updateSignatory('auditorTitle', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-amber-500"
                  placeholder="পদবী"
                />
              </div>
            </div>

            {/* 3. ম্যানেজার */}
            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 space-y-2">
              <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4" />
                <span>৩. ম্যানেজার (Manager)</span>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">ম্যানেজার এর নাম:</label>
                <input
                  type="text"
                  value={signatories.managerName}
                  onChange={(e) => updateSignatory('managerName', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:ring-1 focus:ring-cyan-500"
                  placeholder="ম্যানেজার এর নাম"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">পদবী:</label>
                <input
                  type="text"
                  value={signatories.managerTitle}
                  onChange={(e) => updateSignatory('managerTitle', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-cyan-500"
                  placeholder="পদবী"
                />
              </div>
            </div>
          </div>

          {/* Audit Note & Display Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2 border-t border-slate-800">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">অডিট নিরীক্ষণ মন্তব্য / নোট:</label>
              <textarea
                value={signatories.auditorRemarks}
                onChange={(e) => updateSignatory('auditorRemarks', e.target.value)}
                rows={2}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-emerald-500 resize-none"
              />
            </div>
            <div className="flex flex-col justify-center space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
                <input
                  type="checkbox"
                  checked={signatories.showPartnerShares}
                  onChange={(e) => updateSignatory('showPartnerShares', e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded bg-slate-900 border-slate-700 focus:ring-emerald-500"
                />
                <span>অংশীদারদের লাভ-লোকসান বণ্টন হিসাব স্বাক্ষর বক্সে প্রদর্শন করুন</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
                <input
                  type="checkbox"
                  checked={signatories.showSealStamp}
                  onChange={(e) => updateSignatory('showSealStamp', e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded bg-slate-900 border-slate-700 focus:ring-emerald-500"
                />
                <span>অফিসিয়াল গোল সিলমোহর ও ভেরিফিকেশন স্ট্যাম্প প্রদর্শন করুন</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Separate Daily / Monthly / Total Cards + Monthly Profit-Loss Button (Screen Only) */}
      <div className="print:hidden space-y-5">
        <FinancialSummaryCards
          transactions={transactions}
          onOpenMonthlyPnL={() => setIsMonthlyPnLOpen(true)}
          titleBadge="রিপোর্ট ওভারভিউ"
        />

        {/* Recharts Daily, Monthly & Total Income vs Expenses Bar Chart for Current Year */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  আয় বনাম ব্যয় গ্রাফিক্যাল তুলনা ({toBengaliNumber(todayStr.substring(0, 4))} সাল)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  দৈনিক, মাসিক ও সর্বমোট আয় এবং খরচের ভিজ্যুয়াল ট্রেন্ড (Recharts Bar Chart)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setBarChartMode('monthly_year')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  barChartMode === 'monthly_year'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                চলতি বছরের ১২ মাস
              </button>
              <button
                type="button"
                onClick={() => setBarChartMode('period_compare')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  barChartMode === 'period_compare'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                দৈনিক vs মাসিক vs মোট
              </button>
              <button
                type="button"
                onClick={() => setBarChartMode('daily_month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  barChartMode === 'daily_month'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                মাসের দৈনিক হিসাব
              </button>
            </div>
          </div>

          <div className="h-72 w-full pt-1">
            {rechartsBarData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                নির্বাচিত সময়সীমায় কোনো লেনদেন পাওয়া যায়নি।
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rechartsBarData} margin={{ top: 10, right: 12, left: -10, bottom: 0 }} barGap={6}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v) => `৳${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      formatCurrency(Number(value ?? 0)),
                      String(name) === 'income' ? 'আয় / জমা' : 'ব্যয় / খরচ'
                    ]}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    formatter={(val) => (
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {val === 'income' ? 'আয় / জমা (Income)' : 'ব্যয় / খরচ (Expense)'}
                      </span>
                    )}
                  />
                  <Bar dataKey="income" name="income" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={38} />
                  <Bar dataKey="expense" name="expense" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Profit & Loss Modal */}
      <MonthlyProfitLossModal
        isOpen={isMonthlyPnLOpen}
        onClose={() => setIsMonthlyPnLOpen(false)}
        transactions={transactions}
        company={company}
      />

      {/* Official Financial Statement Document (Optimized for Screen & Larger Vivid Print) */}
      <div id="printable-financial-statement" className="bg-white rounded-2xl border border-slate-300 shadow-sm p-6 sm:p-8 space-y-6 text-slate-950 print:text-black print:border-none print:shadow-none print:p-0 print:space-y-4 print-container">
        {/* Printable Letterhead Header + Scannable PDF QR Badge */}
        <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-16 h-16 rounded-2xl bg-white border-2 border-slate-300 p-1 flex items-center justify-center shadow-xs overflow-hidden shrink-0 print:border-slate-700">
              <img
                src={company?.logoUrl || '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg'}
                alt={companyName}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-950 print:text-black tracking-tight">
                {companyName}
              </h1>
              <p className="text-xs sm:text-sm text-slate-800 print:text-black font-bold">{company?.subTitle || 'ডিজিটাল নেটওয়ার্ক ও ইন্টারনেট ব্রডব্যান্ড সেবা'}</p>
              <p className="text-xs text-slate-700 print:text-black font-semibold mt-0.5">
                ঠিকানা: {address} | মোবাইল: {phone}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 print:bg-white p-3 rounded-xl border-2 border-slate-300 print:border-slate-700">
            <div className="text-left sm:text-right text-xs text-slate-800 print:text-black space-y-0.5">
              <div className="font-black text-slate-950 print:text-black text-sm uppercase tracking-wider">
                AI মনিটরিং ও আর্থিক অডিট বিবরণী
              </div>
              <div>সময়সীমা: <span className="font-black text-black">{periodMeta.label}</span></div>
              <div>প্রিন্ট তারিখ: <span className="font-bold text-black">{formatBengaliDate(todayStr)}</span></div>
              <div>AI কোড: <span className="font-mono font-black text-indigo-800 print:text-indigo-800">{activeAiReport.verificationCode}</span></div>
            </div>
            {statementQr?.qrDataUrl && (
              <div className="flex flex-col items-center shrink-0 pl-2 border-l border-slate-300 print:border-slate-600">
                <div className="w-20 h-20 bg-white p-1 rounded-lg border-2 border-slate-900">
                  <img
                    src={statementQr.qrDataUrl}
                    alt="Statement Verification QR"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="text-[9px] font-black text-emerald-900 print:text-emerald-900 mt-0.5 text-center leading-tight">
                  স্ক্যান করে PDF দেখুন
                </span>
              </div>
            )}
          </div>
        </div>

        {/* AI Monitoring & Audit Intelligence Box */}
        <div className="p-4 rounded-xl bg-indigo-50/70 print:bg-white border-2 border-indigo-200 print:border-slate-700 space-y-3 page-break-avoid">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-200 print:border-slate-300 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 print:bg-slate-900 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <span>AI মনিটরিং ও অডিট পর্যবেক্ষণ প্রতিবেদন</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 print:bg-slate-100 text-indigo-800 print:text-black border border-indigo-300">
                    {activeAiReport.source === 'gemini-ai' ? 'Gemini AI বিশ্লেষিত' : 'AI Auto System'}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-600">
                  স্বয়ংক্রিয় লেনদেন যাচাই, ব্যয় নিয়ন্ত্রণ ও পারফরম্যান্স স্কোর
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-300 print:border-slate-500 text-xs font-black text-indigo-900 print:text-black">
                অডিট স্কোর: {toBengaliNumber(activeAiReport.auditScore)} / ১০০
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 print:bg-slate-100 border border-emerald-300 print:border-slate-500 text-xs font-extrabold text-emerald-900 print:text-black">
                {activeAiReport.healthStatus}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-800 leading-relaxed font-medium">
            {activeAiReport.executiveSummary}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
            <div className="bg-white/90 print:bg-white p-2.5 rounded-lg border border-indigo-200/80 print:border-slate-300 space-y-1">
              <div className="font-extrabold text-indigo-950 print:text-black flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 print:text-black" />
                <span>AI মূল পর্যবেক্ষণ (Key Findings):</span>
              </div>
              <ul className="space-y-1 text-slate-700 list-disc pl-4">
                {activeAiReport.keyFindings.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="bg-white/90 print:bg-white p-2.5 rounded-lg border border-indigo-200/80 print:border-slate-300 space-y-1.5">
              <div className="font-extrabold text-indigo-950 print:text-black flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 print:text-black" />
                <span>ঝুঁকি ও পরামর্শ (Alerts & Advice):</span>
              </div>
              <ul className="space-y-1 text-slate-700 list-disc pl-4">
                {activeAiReport.riskAlerts.map((alertItem, i) => (
                  <li key={i}>{alertItem}</li>
                ))}
              </ul>
              <div className="pt-1 border-t border-slate-200 text-slate-800 font-semibold">
                পরামর্শ: {activeAiReport.aiRecommendation}
              </div>
            </div>
          </div>
        </div>

        {/* Financial Summary KPI Block */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 print:bg-white p-4 rounded-xl border-2 border-slate-300 print:border-slate-800 print:p-3">
          <div className="p-3 bg-white print:bg-white rounded-lg border-2 border-slate-300 shadow-2xs print:border-slate-700">
            <div className="text-xs font-extrabold text-slate-700 print:text-black">মোট লেনদেন সংখ্যা</div>
            <div className="text-2xl font-black text-black mt-1">
              {toBengaliNumber(summary.totalRecords)} টি
            </div>
          </div>

          <div className="p-3 bg-emerald-50/70 print:bg-emerald-50 rounded-lg border-2 border-emerald-400 shadow-2xs print:border-emerald-700">
            <div className="text-xs font-extrabold text-emerald-900 print:text-emerald-900">মোট আয় / জমা</div>
            <div className="text-2xl font-black text-emerald-700 print:text-emerald-800 mt-1">
              +{formatCurrency(summary.totalIncome)}
            </div>
          </div>

          <div className="p-3 bg-rose-50/70 print:bg-rose-50 rounded-lg border-2 border-rose-400 shadow-2xs print:border-rose-700">
            <div className="text-xs font-extrabold text-rose-900 print:text-rose-900">মোট ব্যয় / খরচ</div>
            <div className="text-2xl font-black text-rose-700 print:text-rose-800 mt-1">
              -{formatCurrency(summary.totalExpense)}
            </div>
          </div>

          <div className="p-3 bg-indigo-50/70 print:bg-indigo-50 rounded-lg border-2 border-indigo-400 shadow-2xs print:border-indigo-700">
            <div className="text-xs font-extrabold text-indigo-950 print:text-indigo-950">নিট ব্যালেন্স / ক্যাশ</div>
            <div className={`text-2xl font-black mt-1 ${
              summary.netBalance >= 0 ? 'text-emerald-800 print:text-emerald-800' : 'text-rose-800 print:text-rose-800'
            }`}>
              {formatCurrency(summary.netBalance)}
            </div>
          </div>
        </div>

        {/* Category Breakdown (Printable & Screen) */}
        {Object.keys(summary.catBreakdown).length > 0 && (
          <div className="p-4 bg-slate-50/60 print:bg-white rounded-xl border border-slate-200 print:border-slate-800">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5 text-slate-500 print:hidden" />
              <span>ক্যাটাগরিভিত্তিক আয় ও ব্যয় সারসংক্ষেপ (Category Summary)</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {Object.entries(summary.catBreakdown).map(([catName, amounts]) => (
                <div key={catName} className="p-2 bg-white rounded-lg border border-slate-200/80 print:border-slate-300">
                  <div className="font-semibold text-slate-800 truncate" title={catName}>
                    {catName}
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[11px]">
                    {amounts.income > 0 && (
                      <span className="text-emerald-600 font-bold">
                        আয়: {formatCurrency(amounts.income)}
                      </span>
                    )}
                    {amounts.expense > 0 && (
                      <span className="text-rose-600 font-bold">
                        ব্যয়: {formatCurrency(amounts.expense)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Multi-Month Financial Trend Aggregation (Shown when selected range spans >1 month) */}
        {multiMonthBreakdown.length > 1 && (
          <div className="p-4 bg-indigo-50/40 print:bg-white rounded-xl border border-indigo-200 print:border-slate-800 space-y-2 page-break-avoid">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-indigo-950 print:text-black uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-600 print:hidden" />
                <span>একাধিক মাসের তুলনামূলক সারসংক্ষেপ (Multi-Month Trend • {toBengaliNumber(multiMonthBreakdown.length)} মাস)</span>
              </h3>
            </div>
            <div className="overflow-x-auto border border-indigo-200/80 print:border-slate-400 rounded-lg">
              <table className="w-full text-left text-xs border-collapse bg-white table-auto">
                <thead>
                  <tr className="bg-indigo-100/80 print:bg-slate-200 text-slate-900 font-bold border-b border-indigo-200 print:border-slate-400">
                    <th className="py-2 px-3 whitespace-nowrap">মাস (Month)</th>
                    <th className="py-2 px-3 text-center whitespace-nowrap">লেনদেন</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">মোট জমা (+)</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">মোট ব্যয় (-)</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">নিট ব্যালেন্স</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {multiMonthBreakdown.map((row) => (
                    <tr key={row.month} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">{toBengaliNumber(row.month)}</td>
                      <td className="py-2 px-3 text-center font-semibold text-slate-600 whitespace-nowrap">{toBengaliNumber(row.count)} টি</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700 print:text-black whitespace-nowrap">+{formatCurrency(row.income)}</td>
                      <td className="py-2 px-3 text-right font-bold text-rose-700 print:text-black whitespace-nowrap">-{formatCurrency(row.expense)}</td>
                      <td className={`py-2 px-3 text-right font-black whitespace-nowrap ${row.net >= 0 ? 'text-emerald-800 print:text-black' : 'text-rose-800 print:text-black'}`}>
                        {formatCurrency(row.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detailed Transactions Breakdown for the Selected Month */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              বিস্তারিত আইটেমাইজড লেনদেনের খাতা (Detailed Itemized Ledger)
            </h3>
            <span className="text-[11px] text-slate-500 font-mono print:hidden">
              মুদ্রণ কপি প্রস্তুত
            </span>
          </div>

          <div className="overflow-x-auto print:overflow-visible border-2 border-slate-400 rounded-xl print:border-slate-800 print:rounded-none">
            <table className="w-full text-left text-xs sm:text-sm print:text-[11pt] border-collapse table-auto">
              <thead>
                <tr className="bg-slate-200 print:bg-slate-200 text-black font-black border-b-2 border-slate-500 print:border-slate-900">
                  <th className="py-2.5 px-2.5 print:px-2 border-r border-slate-300 print:border-slate-600 text-center whitespace-nowrap">ক্রমিক</th>
                  <th className="py-2.5 px-2.5 print:px-2 border-r border-slate-300 print:border-slate-600 whitespace-nowrap">তারিখ</th>
                  <th className="py-2.5 px-2.5 print:px-2 border-r border-slate-300 print:border-slate-600 text-center whitespace-nowrap">ধরন</th>
                  <th className="py-2.5 px-2.5 print:px-2 border-r border-slate-300 print:border-slate-600 min-w-[180px]">কাজের বিবরণ / খাত</th>
                  <th className="py-2.5 px-2.5 print:px-2 border-r border-slate-300 print:border-slate-600 whitespace-nowrap">ক্যাটাগরি</th>
                  <th className="py-2.5 px-2.5 print:px-2 text-right border-r border-slate-300 print:border-slate-600 whitespace-nowrap">টাকার পরিমাণ</th>
                  <th className="py-2.5 px-2.5 print:px-2 border-r border-slate-300 print:border-slate-600 whitespace-nowrap">পেমেন্ট</th>
                  <th className="py-2.5 px-2.5 print:px-2 border-r border-slate-300 print:border-slate-600 whitespace-nowrap">এন্ট্রিদাতা</th>
                  <th className="py-2.5 px-2.5 print:px-2 min-w-[120px]">মন্তব্য</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 print:divide-slate-500">
                {monthTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-600 font-semibold">
                      এই নির্বাচিত সময়সীমায় কোনো লেনদেন রেকর্ড পাওয়া যায়নি।
                    </td>
                  </tr>
                ) : (
                  monthTransactions.map((tx, idx) => {
                    const isIncome = tx.type === 'income';
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/50 print:hover:bg-white page-break-avoid align-top">
                        <td className="py-2 px-2.5 print:px-2 text-black font-bold border-r border-slate-300 print:border-slate-500 text-center whitespace-nowrap">
                          {toBengaliNumber(idx + 1)}
                        </td>
                        <td className="py-2 px-2.5 print:px-2 text-black font-bold border-r border-slate-300 print:border-slate-500 whitespace-nowrap">
                          {formatBengaliDate(tx.date)}
                        </td>
                        <td className="py-2 px-2.5 print:px-2 border-r border-slate-300 print:border-slate-500 text-center whitespace-nowrap">
                          <span className={`font-black ${isIncome ? 'text-emerald-700 print:text-emerald-800' : 'text-rose-700 print:text-rose-800'}`}>
                            {isIncome ? 'আয়' : 'ব্যয়'}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 print:px-2 text-black font-bold border-r border-slate-300 print:border-slate-500 break-words">
                          {tx.title}
                        </td>
                        <td className="py-2 px-2.5 print:px-2 text-slate-900 font-semibold border-r border-slate-300 print:border-slate-500 break-words">
                          {tx.category}
                        </td>
                        <td className={`py-2 px-2.5 print:px-2 text-right font-black whitespace-nowrap border-r border-slate-300 print:border-slate-500 ${
                          isIncome ? 'text-emerald-700 print:text-emerald-800' : 'text-rose-700 print:text-rose-800'
                        }`}>
                          {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                        </td>
                        <td className="py-2 px-2.5 print:px-1.5 text-slate-700 border-r border-slate-200 print:border-slate-300 whitespace-nowrap">
                          {tx.paymentMethod === 'bkash' ? 'বিকাশ' : tx.paymentMethod === 'nagad' ? 'নগদ' : tx.paymentMethod === 'bank' ? 'ব্যাংক' : 'নগদ'}
                        </td>
                        <td className="py-2 px-2.5 print:px-1.5 text-slate-700 border-r border-slate-200 print:border-slate-300 break-words">
                          {tx.addedBy}
                        </td>
                        <td className="py-2 px-2.5 print:px-1.5 text-slate-600 italic break-words">
                          {tx.note || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {/* Table Footer with Totals */}
              <tfoot>
                <tr className="bg-slate-100 print:bg-slate-200 font-extrabold text-slate-900 border-t-2 border-slate-400">
                  <td colSpan={5} className="py-2.5 px-3 text-right border-r border-slate-300">
                    সর্বমোট হিসাব (Net Total):
                  </td>
                  <td className="py-2.5 px-3 text-right border-r border-slate-300">
                    <div className="text-emerald-700 print:text-black text-xs font-bold">
                      আয়: +{formatCurrency(summary.totalIncome)}
                    </div>
                    <div className="text-rose-700 print:text-black text-xs font-bold">
                      ব্যয়: -{formatCurrency(summary.totalExpense)}
                    </div>
                    <div className="text-slate-900 font-black text-sm border-t border-slate-300 pt-0.5 mt-0.5">
                      নিট: {formatCurrency(summary.netBalance)}
                    </div>
                  </td>
                  <td colSpan={3} className="py-2.5 px-3 text-slate-500 italic text-[11px]">
                    স্বয়ংক্রিয় ক্লাউড হিসাব থেকে গণনাকৃত
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SECTION A: অংশীদারদের অনুমোদন ও স্বাক্ষর (Share Partners' Signatures) */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="pt-4 page-break-avoid border-t-2 border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              <Users className="w-4 h-4 text-emerald-700 print:text-black" />
              <span>অংশীদারগণের অনুমোদন ও লাভ-লোকসান সম্মতি স্বাক্ষর (Share Partners' Signatures)</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              অনুপাত ভিত্তিতে লাভ-লোকসান বণ্টন গৃহীত ও স্বাক্ষরিত
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {effectivePartners.map((partner, pIdx) => {
              const partnerShare = (summary.netBalance * (partner.sharePercentage || 0)) / 100;
              return (
                <div
                  key={partner.id || pIdx}
                  className="bg-slate-50/70 print:bg-white border border-slate-300 print:border-slate-400 rounded-xl p-3 flex flex-col justify-between space-y-2 relative"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-extrabold text-slate-900 text-xs truncate" title={partner.name}>
                        {partner.name}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 print:bg-slate-100 text-emerald-800 print:text-black rounded shrink-0">
                        {toBengaliNumber(partner.sharePercentage)}% অংশ
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      {partner.role || 'শেয়ার অংশীদার'} {partner.phone ? `• ${partner.phone}` : ''}
                    </div>

                    {signatories.showPartnerShares && (
                      <div className="mt-2 pt-2 border-t border-slate-200 print:border-slate-300 text-[10px] space-y-0.5">
                        <div className="flex justify-between text-slate-600">
                          <span>বিনিয়োগ মূলধন:</span>
                          <span className="font-semibold text-slate-800">{formatCurrency(partner.investment || 0)}</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span>সময়সীমার অংশ:</span>
                          <span className={partnerShare >= 0 ? 'text-emerald-700 print:text-black' : 'text-rose-700 print:text-black'}>
                            {formatCurrency(partnerShare)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Official Partner Seal & Signature Block */}
                  <div className="pt-2 flex items-end justify-between gap-2">
                    {signatories.showSealStamp && (
                      <OfficialRoundSeal
                        topText="PARTNER SEAL"
                        centerTop={`${toBengaliNumber(partner.sharePercentage)}% SHARE`}
                        centerBottom="অনুমোদিত"
                        bottomText="DIP BHOLA"
                        colorScheme="purple"
                        size="sm"
                      />
                    )}
                    <div className="flex-1 text-center pt-5">
                      <div className="w-full border-b border-dashed border-slate-700 mb-1"></div>
                      <div className="text-[10px] font-bold text-slate-800">অংশীদারের স্বাক্ষর ও সিল</div>
                      <div className="text-[9px] text-slate-500">তারিখ: ................</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SECTION B: AI অটো সিস্টেম সাইন, ম্যানেজার, অডিটর ও পরিচালকের সিল ও স্বাক্ষর */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="pt-6 page-break-avoid border-t border-slate-300 space-y-4">
          {/* AI + Audit Declaration Note */}
          <div className="bg-slate-50 print:bg-slate-100/60 border border-slate-200 print:border-slate-400 rounded-xl p-2.5 text-[11px] text-slate-700 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700 print:text-black shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900">AI ও অডিট পর্যবেক্ষণ প্রত্যয়ন: </span>
              <span>{activeAiReport.aiVerificationStatement} ({signatories.auditorRemarks})</span>
            </div>
          </div>

          {/* 4-Column Executive Seal & Signature Grid: AI Auto System, Manager, Auditor, Director */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 text-xs text-slate-700">
            {/* 1. AI Auto System Sign & Seal */}
            <div className="flex flex-col items-center text-center p-3 rounded-xl border border-indigo-300 bg-indigo-50/50 print:bg-white print:border-slate-400">
              <div className="mb-1.5">
                {signatories.showSealStamp && (
                  <OfficialRoundSeal
                    topText="AI AUTO AUDIT"
                    centerTop={isAiAutoSigned ? 'AUTO-SIGNED' : 'MONITORED'}
                    centerBottom={activeAiReport.source === 'gemini-ai' ? 'GEMINI AI' : 'SYSTEM SEAL'}
                    bottomText={periodMeta.key}
                    colorScheme="indigo"
                  />
                )}
              </div>
              <div className="mt-1 px-2.5 py-0.5 rounded-md bg-indigo-700 print:bg-slate-900 text-white text-[10px] font-mono font-bold tracking-wide">
                {isAiAutoSigned ? '✔ AI-AUTO-SIGNED' : 'AI-MONITOR-ACTIVE'}
              </div>
              <div className="w-36 border-b-2 border-indigo-900 print:border-slate-800 my-1.5"></div>
              <div className="font-extrabold text-indigo-950 print:text-slate-900 text-xs">
                AI Auto System সাইন
              </div>
              <div className="text-[10px] font-semibold text-indigo-700 print:text-slate-700">
                {periodMeta.isMonthEnded ? 'মাস শেষে স্বয়ংক্রিয় সাইন সম্পন্ন' : 'স্বয়ংক্রিয় মনিটরিং সিস্টেম'}
              </div>
              <div className="text-[9px] font-mono text-slate-500 mt-1">
                ID: {activeAiReport.verificationCode}
              </div>
            </div>

            {/* 2. ম্যানেজার (Manager) */}
            <div className="flex flex-col items-center text-center p-3 rounded-xl border border-slate-200 print:border-slate-400 bg-slate-50/40 print:bg-white">
              <div className="mb-1.5">
                {signatories.showSealStamp && (
                  <OfficialRoundSeal
                    topText="MANAGER SEAL"
                    centerTop="যাচাইকৃত"
                    centerBottom="VERIFIED"
                    bottomText="DIP BHOLA"
                    colorScheme="emerald"
                  />
                )}
              </div>
              <div className="h-5 flex items-end justify-center w-full">
                <span className="text-[10px] text-slate-400 italic print:hidden">সিল ও স্বাক্ষর</span>
              </div>
              <div className="w-36 border-b-2 border-slate-800 my-1.5"></div>
              <div className="font-extrabold text-slate-900 text-xs">{signatories.managerName}</div>
              <div className="text-slate-700 font-semibold text-[11px]">{signatories.managerTitle}</div>
              <div className="text-[10px] text-slate-500 mt-1">
                তারিখ: <span className="font-mono">.......................</span>
              </div>
            </div>

            {/* 3. অডিট কর্মকর্তা (Auditor) */}
            <div className="flex flex-col items-center text-center p-3 rounded-xl border border-slate-200 print:border-slate-400 bg-slate-50/40 print:bg-white">
              <div className="mb-1.5">
                {signatories.showSealStamp && (
                  <OfficialRoundSeal
                    topText="AUDIT OFFICER"
                    centerTop="নিরীক্ষিত"
                    centerBottom="AUDITED"
                    bottomText="DIP BHOLA"
                    colorScheme="amber"
                  />
                )}
              </div>
              <div className="h-5 flex items-end justify-center w-full">
                <span className="text-[10px] font-bold text-amber-800 print:text-black flex items-center gap-1">
                  <BadgeCheck className="w-3 h-3 text-amber-600 print:text-black" />
                  ভাউচার নিরীক্ষিত
                </span>
              </div>
              <div className="w-36 border-b-2 border-slate-800 my-1.5"></div>
              <div className="font-extrabold text-slate-900 text-xs">{signatories.auditorName}</div>
              <div className="text-slate-700 font-semibold text-[11px]">{signatories.auditorTitle}</div>
              <div className="text-[10px] text-slate-500 mt-1">
                তারিখ: <span className="font-mono">.......................</span>
              </div>
            </div>

            {/* 4. পরিচালক (Director) */}
            <div className="flex flex-col items-center text-center p-3 rounded-xl border border-emerald-300 print:border-slate-400 bg-emerald-50/30 print:bg-white">
              <div className="mb-1.5">
                {signatories.showSealStamp && (
                  <OfficialRoundSeal
                    topText="MANAGING DIRECTOR"
                    centerTop="অনুমোদিত"
                    centerBottom="APPROVED"
                    bottomText="DIP BHOLA"
                    colorScheme="slate"
                  />
                )}
              </div>
              <div className="h-5 flex items-end justify-center w-full">
                <span className="text-[10px] text-slate-400 italic print:hidden">পরিচালকের সিল ও স্বাক্ষর</span>
              </div>
              <div className="w-36 border-b-2 border-slate-900 my-1.5"></div>
              <div className="font-extrabold text-slate-900 text-xs">{signatories.directorName}</div>
              <div className="text-slate-700 font-semibold text-[11px]">{signatories.directorTitle}</div>
              <div className="text-[10px] text-slate-500 mt-1">
                তারিখ: <span className="font-mono">.......................</span>
              </div>
            </div>
          </div>
        </div>

        {/* Print Footer Note */}
        <div className="text-center text-[10px] text-slate-500 pt-3 border-t border-slate-200 print:border-slate-400 flex flex-wrap items-center justify-center gap-2">
          <Lock className="w-3 h-3 text-indigo-600 print:text-black" />
          <span>
            এই প্রতিবেদনটি {companyName}-এর AI অটো মনিটরিং সিস্টেম দ্বারা যাচাইকৃত ({activeAiReport.verificationCode}) — AI সিস্টেম, শেয়ার অংশীদারবৃন্দ, ম্যানেজার ও পরিচালকের সিল ও স্বাক্ষরসহ অনুমোদিত।
          </span>
        </div>
      </div>

      {/* Global CSS for Direct Statement Printing (Does not override Print Studio) */}
      <style>{`
        @media print {
          body:not(.print-studio-active) .print-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            font-size: 11.5pt !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .page-break-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          table {
            page-break-inside: auto;
            width: 100% !important;
          }
          tr {
            page-break-inside: avoid !important;
            page-break-after: auto;
          }
        }
      `}</style>

      {/* Print & PDF Publication Studio Modal */}
      <PrintStudioModal
        isOpen={isPrintStudioOpen}
        onClose={() => {
          setIsPrintStudioOpen(false);
          setQuickPaperSize(getSavedPrintPreferences().size);
        }}
        documentTitle={`AI মনিটরিং ও অডিট বিবরণী (${periodMeta.label})`}
        fileNamePrefix={`DIP-BHOLA-AI-Report-${periodMeta.key}`}
        summaryText={[
          `🤖 *${companyName} — AI মনিটরিং ও আর্থিক প্রতিবেদন*`,
          `📅 সময়সীমা: ${periodMeta.label}`,
          `📊 অডিট স্কোর: ${activeAiReport.auditScore}/100 (${activeAiReport.healthStatus})`,
          `📝 মোট লেনদেন: ${summary.totalRecords} টি`,
          `➕ মোট আয় / জমা: ৳ ${summary.totalIncome.toLocaleString()}`,
          `➖ মোট ব্যয় / খরচ: ৳ ${summary.totalExpense.toLocaleString()}`,
          `💰 নিট ব্যালেন্স: ৳ ${summary.netBalance.toLocaleString()}`,
          `🔐 AI কোড: ${activeAiReport.verificationCode}`,
          `✍️ অনুমোদন: AI Auto System, শেয়ার অংশীদারবৃন্দ, ম্যানেজার (${signatories.managerName}), পরিচালক (${signatories.directorName})`
        ].join('\n')}
        whatsappGroupConfig={whatsappGroupConfig}
      >
        {/* Dedicated Clean Paper Layout for Exact A4/Legal/Letter/A5 PDF & Print (Larger & Vivid) */}
        <div className="space-y-4 text-black bg-white">
          <div data-print-section="header" className="border-b-2 border-slate-900 pb-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div data-print-section="logo" className="w-14 h-14 rounded-xl bg-white border-2 border-slate-400 p-1 flex items-center justify-center shrink-0">
                <img
                  src={company?.logoUrl || '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg'}
                  alt={companyName}
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-2xl font-black text-black">{companyName}</h1>
                <p className="text-xs text-slate-900 font-bold">{company?.subTitle || 'ডিজিটাল নেটওয়ার্ক ও ইন্টারনেট ব্রডব্যান্ড সেবা'}</p>
                <p className="text-[11px] text-slate-800 font-semibold">ঠিকানা: {address} | মোবাইল: {phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right text-[11px] text-black space-y-0.5">
                <div className="font-black text-black text-xs uppercase">AI মনিটরিং ও আর্থিক অডিট বিবরণী</div>
                <div>সময়সীমা: <strong>{periodMeta.label}</strong></div>
                <div>প্রিন্ট তারিখ: <strong>{formatBengaliDate(todayStr)}</strong></div>
                <div>AI কোড: <strong className="font-mono text-indigo-800">{activeAiReport.verificationCode}</strong></div>
              </div>
              {statementQr?.qrDataUrl && (
                <div className="flex flex-col items-center shrink-0 pl-2 border-l border-slate-400">
                  <div className="w-18 h-18 bg-white p-0.5 rounded-lg border-2 border-slate-900">
                    <img
                      src={statementQr.qrDataUrl}
                      alt="QR PDF Verification"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-[8.5px] font-black text-emerald-900 mt-0.5 text-center leading-tight">
                    স্ক্যান করে PDF দেখুন
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* AI Monitoring Box in PDF/Print */}
          <div data-print-section="summary" className="p-3 rounded-lg border-2 border-indigo-400 bg-indigo-50/50 space-y-1.5">
            <div className="flex items-center justify-between border-b border-indigo-300 pb-1 text-xs">
              <span className="font-black text-indigo-950">
                AI মনিটরিং রিপোর্ট ({activeAiReport.source === 'gemini-ai' ? 'Gemini AI বিশ্লেষিত' : 'AI Auto System'})
              </span>
              <span className="font-black text-indigo-900">
                স্কোর: {toBengaliNumber(activeAiReport.auditScore)}/১০০ • {activeAiReport.healthStatus}
              </span>
            </div>
            <p className="text-[11px] text-black leading-snug font-semibold">
              {activeAiReport.executiveSummary}
            </p>
            <div className="grid grid-cols-2 gap-2.5 text-[10.5px] text-slate-900 pt-0.5">
              <div>
                <strong className="text-black">মূল পর্যবেক্ষণ:</strong>
                <ul className="list-disc pl-3.5 mt-0.5 space-y-0.5 font-medium">
                  {activeAiReport.keyFindings.slice(0, 3).map((k, idx) => (
                    <li key={idx}>{k}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong className="text-black">সতর্কতা ও পরামর্শ:</strong>
                <div className="mt-0.5 font-medium">{activeAiReport.riskAlerts[0]}</div>
                <div className="mt-0.5 font-bold text-indigo-950">{activeAiReport.aiRecommendation}</div>
              </div>
            </div>
          </div>

          <div data-print-section="summary" className="grid grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-lg border-2 border-slate-400 text-center">
            <div className="p-2 bg-white rounded border-2 border-slate-300">
              <div className="text-[10.5px] font-extrabold text-slate-800">মোট লেনদেন</div>
              <div className="text-base font-black text-black">{toBengaliNumber(summary.totalRecords)} টি</div>
            </div>
            <div className="p-2 bg-emerald-50 rounded border-2 border-emerald-400">
              <div className="text-[10.5px] font-extrabold text-emerald-950">মোট আয় / জমা</div>
              <div className="text-base font-black text-emerald-800">+{formatCurrency(summary.totalIncome)}</div>
            </div>
            <div className="p-2 bg-rose-50 rounded border-2 border-rose-400">
              <div className="text-[10.5px] font-extrabold text-rose-950">মোট ব্যয় / খরচ</div>
              <div className="text-base font-black text-rose-800">-{formatCurrency(summary.totalExpense)}</div>
            </div>
            <div className="p-2 bg-indigo-50 rounded border-2 border-indigo-400">
              <div className="text-[10.5px] font-extrabold text-indigo-950">নিট ব্যালেন্স</div>
              <div className="text-base font-black text-indigo-950">{formatCurrency(summary.netBalance)}</div>
            </div>
          </div>

          {multiMonthBreakdown.length > 1 && (
            <div data-print-section="summary" className="border-2 border-slate-400 rounded-lg p-2.5 bg-slate-50/70">
              <div className="text-xs font-black text-black mb-1.5">
                মাসভিত্তিক সারসংক্ষেপ ({toBengaliNumber(multiMonthBreakdown.length)} মাস):
              </div>
              <table className="w-full text-left text-[11px] border-collapse border border-slate-400 bg-white table-auto">
                <thead>
                  <tr className="bg-slate-200 font-black text-black">
                    <th className="py-1.5 px-2 border border-slate-400 whitespace-nowrap">মাস</th>
                    <th className="py-1.5 px-2 border border-slate-400 text-center whitespace-nowrap">সংখ্যা</th>
                    <th className="py-1.5 px-2 border border-slate-400 text-right whitespace-nowrap">আয় (+)</th>
                    <th className="py-1.5 px-2 border border-slate-400 text-right whitespace-nowrap">ব্যয় (-)</th>
                    <th className="py-1.5 px-2 border border-slate-400 text-right whitespace-nowrap">নিট ব্যালেন্স</th>
                  </tr>
                </thead>
                <tbody>
                  {multiMonthBreakdown.map((m) => (
                    <tr key={m.month}>
                      <td className="py-1.5 px-2 border border-slate-400 font-bold text-black whitespace-nowrap">{toBengaliNumber(m.month)}</td>
                      <td className="py-1.5 px-2 border border-slate-400 text-center font-bold whitespace-nowrap">{toBengaliNumber(m.count)}</td>
                      <td className="py-1.5 px-2 border border-slate-400 text-right text-emerald-800 font-black whitespace-nowrap">+{formatCurrency(m.income)}</td>
                      <td className="py-1.5 px-2 border border-slate-400 text-right text-rose-800 font-black whitespace-nowrap">-{formatCurrency(m.expense)}</td>
                      <td className="py-1.5 px-2 border border-slate-400 text-right font-black text-black whitespace-nowrap">{formatCurrency(m.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <h3 className="text-xs font-black text-black uppercase mb-1.5">
              বিস্তারিত আইটেমাইজড লেনদেনের খাতা ({toBengaliNumber(monthTransactions.length)} টি)
            </h3>
            <table className="w-full text-left text-[11px] border-collapse border-2 border-slate-500 table-auto">
              <thead>
                <tr className="bg-slate-200 text-black font-black">
                  <th className="py-2 px-1.5 border border-slate-400 text-center whitespace-nowrap">নং</th>
                  <th className="py-2 px-1.5 border border-slate-400 whitespace-nowrap">তারিখ</th>
                  <th className="py-2 px-1.5 border border-slate-400 text-center whitespace-nowrap">ধরন</th>
                  <th className="py-2 px-2 border border-slate-400">বিবরণ / খাত</th>
                  <th className="py-2 px-1.5 border border-slate-400 whitespace-nowrap">ক্যাটাগরি</th>
                  <th className="py-2 px-1.5 border border-slate-400 text-right whitespace-nowrap">পরিমাণ</th>
                  <th className="py-2 px-1.5 border border-slate-400 whitespace-nowrap">পেমেন্ট</th>
                  <th data-print-section="added-by" className="py-2 px-1.5 border border-slate-400 whitespace-nowrap">এন্ট্রিদাতা</th>
                  <th className="py-2 px-1.5 border border-slate-400">মন্তব্য</th>
                </tr>
              </thead>
              <tbody>
                {monthTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-4 text-center text-slate-600 font-semibold">নির্বাচিত সময়সীমায় কোনো লেনদেন নেই।</td>
                  </tr>
                ) : (
                  monthTransactions.map((tx, idx) => {
                    const isIncome = tx.type === 'income';
                    return (
                      <tr key={tx.id} className="align-top">
                        <td className="py-1.5 px-1.5 border border-slate-400 text-center font-bold text-black whitespace-nowrap">{toBengaliNumber(idx + 1)}</td>
                        <td className="py-1.5 px-1.5 border border-slate-400 font-bold text-black whitespace-nowrap">{formatBengaliDate(tx.date)}</td>
                        <td className={`py-1.5 px-1.5 border border-slate-400 text-center font-black whitespace-nowrap ${isIncome ? 'text-emerald-800' : 'text-rose-800'}`}>
                          {isIncome ? 'আয়' : 'ব্যয়'}
                        </td>
                        <td className="py-1.5 px-2 border border-slate-400 font-bold text-black break-words">{tx.title}</td>
                        <td className="py-1.5 px-1.5 border border-slate-400 font-semibold text-slate-900 break-words">{tx.category}</td>
                        <td className={`py-1.5 px-1.5 border border-slate-400 text-right font-black whitespace-nowrap ${isIncome ? 'text-emerald-800' : 'text-rose-800'}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                        </td>
                        <td className="py-1.5 px-1.5 border border-slate-400 font-semibold text-slate-900 whitespace-nowrap">
                          {tx.paymentMethod === 'bkash' ? 'বিকাশ' : tx.paymentMethod === 'nagad' ? 'নগদ' : tx.paymentMethod === 'bank' ? 'ব্যাংক' : 'নগদ'}
                        </td>
                        <td data-print-section="added-by" className="py-1.5 px-1.5 border border-slate-400 font-semibold text-slate-900 break-words">{tx.addedBy}</td>
                        <td className="py-1.5 px-1.5 border border-slate-400 text-slate-800 break-words">{tx.note || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot data-print-section="totals">
                <tr className="bg-slate-200 font-black text-black">
                  <td colSpan={5} className="py-2 px-2 border border-slate-400 text-right">সর্বমোট হিসাব:</td>
                  <td colSpan={4} className="py-2 px-2 border border-slate-400">
                    আয়: +{formatCurrency(summary.totalIncome)} | ব্যয়: -{formatCurrency(summary.totalExpense)} | নিট: {formatCurrency(summary.netBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div data-print-section="audit" className="text-[10px] font-bold text-slate-800 border-t border-slate-400 pt-1.5 flex items-center justify-between">
            <span>AI কোড: {activeAiReport.verificationCode} | অডিট স্কোর: {toBengaliNumber(activeAiReport.auditScore)}/১০০</span>
            <span>প্রিন্ট সময়: {new Date().toLocaleString('bn-BD')}</span>
          </div>

          {/* Share Partners' Seals & Signatures in PDF/Print */}
          {effectivePartners.length > 0 && (
            <div data-print-section="signatures" className="pt-2 border-t border-slate-300">
              <div className="text-[10px] font-extrabold text-slate-800 mb-1.5">শেয়ার অংশীদারগণের সিল ও স্বাক্ষর:</div>
              <div className="grid grid-cols-3 gap-2">
                {effectivePartners.map((partner, pIdx) => {
                  const partnerShare = (summary.netBalance * (partner.sharePercentage || 0)) / 100;
                  return (
                    <div key={partner.id || pIdx} className="border border-slate-300 rounded p-2 text-[9.5px] flex flex-col justify-between">
                      <div>
                        <div className="font-bold text-slate-900">{partner.name} ({toBengaliNumber(partner.sharePercentage)}%)</div>
                        {signatories.showPartnerShares && (
                          <div className="text-slate-600">অংশ: <strong>{formatCurrency(partnerShare)}</strong></div>
                        )}
                      </div>
                      <div className="mt-2 flex items-end justify-between gap-1.5">
                        {signatories.showSealStamp && (
                          <OfficialRoundSeal
                            topText="PARTNER SEAL"
                            centerTop={`${toBengaliNumber(partner.sharePercentage)}%`}
                            centerBottom="অনুমোদিত"
                            bottomText="DIP BHOLA"
                            colorScheme="purple"
                            size="sm"
                          />
                        )}
                        <div className="flex-1 border-t border-dashed border-slate-500 pt-0.5 text-center text-[8.5px] text-slate-600">
                          অংশীদারের স্বাক্ষর
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4-Column Executive Seals & Signatures in PDF/Print: AI Auto System, Manager, Auditor, Director */}
          <div data-print-section="signatures" className="pt-3 border-t border-slate-300 grid grid-cols-4 gap-2.5 text-center text-[9.5px] text-slate-800">
            <div className="border border-indigo-200 rounded p-2 flex flex-col items-center">
              {signatories.showSealStamp && (
                <OfficialRoundSeal
                  topText="AI AUTO AUDIT"
                  centerTop={isAiAutoSigned ? 'AUTO-SIGNED' : 'MONITORED'}
                  centerBottom="SYSTEM SEAL"
                  bottomText={periodMeta.key}
                  colorScheme="indigo"
                  size="sm"
                />
              )}
              <div className="mt-1 font-mono text-[8px] font-bold text-indigo-800">
                {isAiAutoSigned ? '✔ AI-AUTO-SIGNED' : 'AI-VERIFIED'}
              </div>
              <div className="w-full border-t border-indigo-900 mt-1 pt-0.5 font-bold">AI Auto System সাইন</div>
              <div className="text-[8px] text-slate-500">{activeAiReport.verificationCode}</div>
            </div>

            <div className="border border-slate-200 rounded p-2 flex flex-col items-center justify-between">
              {signatories.showSealStamp && (
                <OfficialRoundSeal
                  topText="MANAGER SEAL"
                  centerTop="যাচাইকৃত"
                  centerBottom="VERIFIED"
                  bottomText="DIP BHOLA"
                  colorScheme="emerald"
                  size="sm"
                />
              )}
              <div className="w-full border-t border-slate-800 mt-2 pt-0.5 font-bold">{signatories.managerName}</div>
              <div className="text-[8px] text-slate-600">{signatories.managerTitle}</div>
            </div>

            <div className="border border-slate-200 rounded p-2 flex flex-col items-center justify-between">
              {signatories.showSealStamp && (
                <OfficialRoundSeal
                  topText="AUDIT OFFICER"
                  centerTop="নিরীক্ষিত"
                  centerBottom="AUDITED"
                  bottomText="DIP BHOLA"
                  colorScheme="amber"
                  size="sm"
                />
              )}
              <div className="w-full border-t border-slate-800 mt-2 pt-0.5 font-bold">{signatories.auditorName}</div>
              <div className="text-[8px] text-slate-600">{signatories.auditorTitle}</div>
            </div>

            <div className="border border-slate-300 rounded p-2 flex flex-col items-center justify-between">
              {signatories.showSealStamp && (
                <OfficialRoundSeal
                  topText="MANAGING DIRECTOR"
                  centerTop="অনুমোদিত"
                  centerBottom="APPROVED"
                  bottomText="DIP BHOLA"
                  colorScheme="slate"
                  size="sm"
                />
              )}
              <div className="w-full border-t border-slate-900 mt-2 pt-0.5 font-bold">{signatories.directorName}</div>
              <div className="text-[8px] text-slate-600">{signatories.directorTitle}</div>
            </div>
          </div>
        </div>
      </PrintStudioModal>
    </div>
  );
};
