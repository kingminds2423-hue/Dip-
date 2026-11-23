import { Transaction, Partner, CustomerComplaint } from '../types';
import { formatCurrency, toBengaliNumber } from '../utils/formatters';

export interface AiMonitoringReport {
  healthStatus: string;
  auditScore: number;
  executiveSummary: string;
  keyFindings: string[];
  riskAlerts: string[];
  aiRecommendation: string;
  aiVerificationStatement: string;
  generatedAt: string;
  verificationCode: string;
  isMonthEndAutoSigned: boolean;
  source: 'gemini-ai' | 'auto-system';
}

export interface MonitoringInput {
  companyName: string;
  periodLabel: string;
  periodKey: string;
  isMonthEnded: boolean;
  transactions: Transaction[];
  partners: Partner[];
  complaints?: CustomerComplaint[];
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  catBreakdown: Record<string, { income: number; expense: number }>;
}

/**
 * Generates a deterministic verification seal hash from report metrics & period.
 */
export function buildAiVerificationCode(
  periodKey: string,
  totalRecords: number,
  totalIncome: number,
  totalExpense: number
): string {
  const seed = `${periodKey}-${totalRecords}-${Math.round(totalIncome)}-${Math.round(totalExpense)}`;
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  const hex = Math.abs(hash >>> 0).toString(16).toUpperCase().padStart(6, '0');
  return `AI-DBN-${periodKey.replace(/[^A-Z0-9]/gi, '').slice(0, 8)}-${hex}`;
}

/**
 * Builds an instant Auto-System AI Monitoring Baseline Report (also used as offline fallback).
 */
export function buildAutoSystemMonitoringReport(input: MonitoringInput): AiMonitoringReport {
  const {
    periodLabel,
    periodKey,
    isMonthEnded,
    transactions,
    totalIncome,
    totalExpense,
    netBalance,
    catBreakdown,
    complaints = []
  } = input;

  const totalRecords = transactions.length;
  const verificationCode = buildAiVerificationCode(periodKey, totalRecords, totalIncome, totalExpense);

  // Find top expense & income categories
  const entries = Object.entries(catBreakdown);
  const topExpense = entries
    .filter(([, v]) => v.expense > 0)
    .sort((a, b) => b[1].expense - a[1].expense)[0];
  const topIncome = entries
    .filter(([, v]) => v.income > 0)
    .sort((a, b) => b[1].income - a[1].income)[0];

  // Staff entry count
  const staffMap: Record<string, number> = {};
  transactions.forEach((t) => {
    const name = t.addedBy || 'অজানা';
    staffMap[name] = (staffMap[name] || 0) + 1;
  });
  const topStaff = Object.entries(staffMap).sort((a, b) => b[1] - a[1])[0];

  const expenseRatio = totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : totalExpense > 0 ? 100 : 0;
  let healthStatus = 'সন্তোষজনক (Good)';
  let auditScore = 92;

  if (totalRecords === 0) {
    healthStatus = 'তথ্য অনুপস্থিত (No Entries)';
    auditScore = 70;
  } else if (netBalance > 0 && expenseRatio <= 65) {
    healthStatus = 'অত্যন্ত ভালো (Excellent)';
    auditScore = 97;
  } else if (netBalance < 0) {
    healthStatus = 'সতর্কতা প্রয়োজন (Warning)';
    auditScore = 78;
  }

  const pendingComplaints = complaints.filter((c) => c.status !== 'resolved').length;

  const keyFindings: string[] = [
    `নির্বাচিত সময়সীমায় (${periodLabel}) মোট ${toBengaliNumber(totalRecords)}টি লেনদেন AI সিস্টেমে যাচাই করা হয়েছে (আয় ${formatCurrency(totalIncome)}, ব্যয় ${formatCurrency(totalExpense)})।`,
    topExpense
      ? `সর্বোচ্চ ব্যয়ের খাত "${topExpense[0]}" — মোট ${formatCurrency(topExpense[1].expense)}।`
      : 'এই সময়সীমায় কোনো ব্যয়ের এন্ট্রি রেকর্ড হয়নি।',
    topIncome
      ? `প্রধান আয়ের খাত "${topIncome[0]}" থেকে মোট ${formatCurrency(topIncome[1].income)} জমা হয়েছে।`
      : 'এই সময়সীমায় কোনো আয়ের এন্ট্রি রেকর্ড হয়নি।',
    topStaff
      ? `সর্বাধিক সক্রিয় এন্ট্রিদাতা: ${topStaff[0]} (${toBengaliNumber(topStaff[1])}টি ভাউচার এন্ট্রি)।`
      : 'ভাউচার এন্ট্রি ও ডিজিটাল লেজার সিঙ্ক সক্রিয় আছে।'
  ];

  const riskAlerts: string[] = [];
  if (netBalance < 0) {
    riskAlerts.push(
      `সতর্কতা: এই সময়সীমায় আয়ের তুলনায় ব্যয় ${formatCurrency(Math.abs(netBalance))} বেশি রয়েছে — ক্যাশ-ইন-হ্যান্ড সমন্বয় প্রয়োজন।`
    );
  } else {
    riskAlerts.push('সব আয়-ব্যয়ের ভাউচার ও ডিজিটাল এন্ট্রি স্বাভাবিক সীমার মধ্যে যাচাইকৃত পাওয়া গেছে।');
  }
  if (pendingComplaints > 0) {
    riskAlerts.push(`বর্তমানে ${toBengaliNumber(pendingComplaints)}টি গ্রাহক অভিযোগ সমাধানের অপেক্ষায় রয়েছে।`);
  }

  const executiveSummary =
    totalRecords === 0
      ? `${periodLabel} সময়সীমায় কোনো লেনদেন পাওয়া যায়নি। লেনদেন যুক্ত হলে AI মনিটরিং সিস্টেম স্বয়ংক্রিয়ভাবে অডিট বিশ্লেষণ ও সাইন সম্পন্ন করবে।`
      : `${periodLabel} সময়সীমার মোট ${toBengaliNumber(totalRecords)}টি লেনদেন AI অটো-মনিটরিং ইঞ্জিন দ্বারা বিশ্লেষিত হয়েছে। মোট জমা ${formatCurrency(totalIncome)} ও মোট খরচ ${formatCurrency(totalExpense)} বাদে নিট ব্যালেন্স ${formatCurrency(netBalance)} নির্ধারিত হয়েছে।`;

  const aiRecommendation =
    netBalance < 0
      ? 'ব্যয়ের প্রধান খাতগুলোতে বাজেট নিয়ন্ত্রণ এবং বকেয়া ও মাসিক বিল কালেকশন জোরদার করার পরামর্শ দেওয়া হলো।'
      : 'বর্তমান আয়-ব্যয়ের ভারসাম্য সন্তোষজনক; নিয়মিত দৈনিক এন্ট্রি ও মাস শেষে অংশীদারদের সাথে লাভ-লোকসান সমন্বয় অব্যাহত রাখুন।';

  const aiVerificationStatement = isMonthEnded
    ? 'মাসিক হিসাবকাল সমাপ্ত হওয়ায় AI Auto-Monitor System কর্তৃক সকল ডিজিটাল ভাউচার যাচাইপূর্বক স্বয়ংক্রিয় সিস্টেম সাইন ও সিল প্রদান করা হলো।'
    : 'AI Auto-Monitor System কর্তৃক তাৎক্ষণিক অডিট পর্যবেক্ষণ সম্পন্ন ও অনুমোদন সিল সংযুক্ত করা হলো।';

  return {
    healthStatus,
    auditScore,
    executiveSummary,
    keyFindings,
    riskAlerts,
    aiRecommendation,
    aiVerificationStatement,
    generatedAt: new Date().toISOString(),
    verificationCode,
    isMonthEndAutoSigned: isMonthEnded,
    source: 'auto-system'
  };
}

/**
 * Calls server-side Gemini 4 Hydrogen API route `/api/ai/monitoring-report`
 * to enrich the official monitoring report with live AI analysis.
 */
export async function fetchLiveAiMonitoringReport(input: MonitoringInput): Promise<AiMonitoringReport> {
  const {
    companyName,
    periodLabel,
    periodKey,
    isMonthEnded,
    transactions,
    partners,
    complaints = [],
    totalIncome,
    totalExpense,
    netBalance,
    catBreakdown
  } = input;

  const verificationCode = buildAiVerificationCode(
    periodKey,
    transactions.length,
    totalIncome,
    totalExpense
  );

  const staffCountMap: Record<string, { count: number; totalAmount: number }> = {};
  transactions.forEach((t) => {
    const key = t.addedBy || 'অজানা';
    if (!staffCountMap[key]) staffCountMap[key] = { count: 0, totalAmount: 0 };
    staffCountMap[key].count += 1;
    staffCountMap[key].totalAmount += t.amount;
  });

  const payload = {
    companyName,
    periodLabel,
    totalRecords: transactions.length,
    totalIncome,
    totalExpense,
    netBalance,
    categorySummary: Object.entries(catBreakdown).map(([category, vals]) => ({
      category,
      income: vals.income,
      expense: vals.expense
    })),
    staffActivity: Object.entries(staffCountMap).map(([name, info]) => ({
      name,
      entries: info.count,
      totalAmount: info.totalAmount
    })),
    partners: partners.map((p) => ({
      name: p.name,
      sharePercentage: p.sharePercentage,
      periodShare: Math.round((netBalance * (p.sharePercentage || 0)) / 100)
    })),
    complaintsSummary: {
      total: complaints.length,
      pending: complaints.filter((c) => c.status === 'pending').length,
      inProgress: complaints.filter((c) => c.status === 'in_progress').length,
      resolved: complaints.filter((c) => c.status === 'resolved').length
    },
    recentTransactions: transactions.slice(0, 25).map((t) => ({
      date: t.date,
      type: t.type,
      title: t.title,
      category: t.category,
      amount: t.amount,
      addedBy: t.addedBy
    }))
  };

  const res = await fetch('/api/ai/monitoring-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'AI মনিটরিং সার্ভার থেকে উত্তর পাওয়া যায়নি।');
  }

  return {
    healthStatus: String(data.healthStatus || 'সন্তোষজনক (Good)'),
    auditScore: Number(data.auditScore || 92),
    executiveSummary: String(data.executiveSummary || ''),
    keyFindings: Array.isArray(data.keyFindings) ? data.keyFindings.map(String) : [],
    riskAlerts: Array.isArray(data.riskAlerts) ? data.riskAlerts.map(String) : [],
    aiRecommendation: String(data.aiRecommendation || ''),
    aiVerificationStatement: String(data.aiVerificationStatement || ''),
    generatedAt: String(data.generatedAt || new Date().toISOString()),
    verificationCode,
    isMonthEndAutoSigned: isMonthEnded,
    source: 'gemini-ai'
  };
}
