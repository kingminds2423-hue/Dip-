import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Printer,
  ShieldCheck,
  Loader2,
  ArrowLeft,
  AlertTriangle,
  QrCode,
  FileText,
  TrendingUp,
  TrendingDown,
  Wallet
} from 'lucide-react';
import { SharedReportSnapshot } from '../types';
import { fetchSharedReportByIdOrFallback } from '../services/sharedReportService';
import { formatBengaliDate, formatCurrency, toBengaliNumber } from '../utils/formatters';
import { generatePdfFromElement, triggerPdfDownload } from '../services/pdfPrintService';

interface StatementQrViewerProps {
  reportId: string;
  fallbackPayload?: string | null;
  onCloseToLogin?: () => void;
}

const PERIOD_BADGE_MAP: Record<SharedReportSnapshot['periodType'], string> = {
  daily: 'দৈনিক হিসাব বিবরণী',
  monthly: 'মাসিক হিসাব বিবরণী',
  yearly: 'বাৎসরিক হিসাব বিবরণী',
  custom: 'কাস্টম হিসাব বিবরণী',
  all: 'সর্বমোট হিসাব বিবরণী'
};

export const StatementQrViewer: React.FC<StatementQrViewerProps> = ({
  reportId,
  fallbackPayload,
  onCloseToLogin
}) => {
  const [snapshot, setSnapshot] = useState<SharedReportSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const statementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMsg(null);
    fetchSharedReportByIdOrFallback(reportId, fallbackPayload)
      .then((res) => {
        if (!active) return;
        if (!res) {
          setErrorMsg('এই QR কোডের আর্থিক বিবরণীটি খুঁজে পাওয়া যায়নি বা মেয়াদোত্তীর্ণ হয়েছে।');
        } else {
          setSnapshot(res);
        }
      })
      .catch(() => {
        if (active) setErrorMsg('রিপোর্ট লোড করতে সমস্যা হয়েছে। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reportId, fallbackPayload]);

  const handleDownloadPdf = async () => {
    if (!statementRef.current || !snapshot) return;
    setIsDownloadingPdf(true);
    try {
      const safeLabel = snapshot.periodLabel.replace(/[^a-zA-Z0-9\u0980-\u09FF-_]+/g, '-').slice(0, 40);
      const pdf = await generatePdfFromElement(statementRef.current, {
        fileName: `${snapshot.companyName.replace(/\s+/g, '-')}-${safeLabel || snapshot.id}.pdf`,
        size: 'A4',
        orientation: 'portrait',
        marginMm: 8,
        scalePercent: 100,
        colorMode: 'color'
      });
      triggerPdfDownload(pdf.blob, pdf.fileName);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 text-center space-y-3 max-w-sm w-full">
          <Loader2 className="w-9 h-9 text-emerald-700 animate-spin mx-auto" />
          <h2 className="text-base font-black text-slate-900">QR বিবরণী ও PDF প্রস্তুত হচ্ছে...</h2>
          <p className="text-xs text-slate-600">ক্লাউড সার্ভার থেকে যাচাইকৃত হিসাব লোড করা হচ্ছে</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !snapshot) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-rose-200 shadow-lg p-7 text-center space-y-4 max-w-md w-full">
          <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
          <h2 className="text-lg font-black text-slate-900">বিবরণী পাওয়া যায়নি</h2>
          <p className="text-xs text-slate-600 leading-relaxed">{errorMsg}</p>
          {onCloseToLogin && (
            <button
              type="button"
              onClick={onCloseToLogin}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black inline-flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>মূল অ্যাপে ফিরে যান</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-5 px-3 sm:px-6 print:bg-white print:p-0">
      {/* Top Action Bar (Screen Only) */}
      <div className="max-w-4xl mx-auto mb-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
              <span>{snapshot.companyName} — যাচাইকৃত হিসাব বিবরণী</span>
            </div>
            <div className="text-xs text-slate-600">
              {PERIOD_BADGE_MAP[snapshot.periodType]} · কোড:{' '}
              <span className="font-mono font-bold text-indigo-800">{snapshot.verificationCode}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {onCloseToLogin && (
            <button
              type="button"
              onClick={onCloseToLogin}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 border border-slate-300 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>মূল অ্যাপ</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-emerald-300" />
            <span>প্রিন্ট করুন</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs sm:text-sm font-black inline-flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            {isDownloadingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{isDownloadingPdf ? 'PDF তৈরি হচ্ছে...' : 'সম্পূর্ণ PDF ডাউনলোড করুন'}</span>
          </button>
        </div>
      </div>

      {/* Printable Financial Statement Container */}
      <div
        id="printable-financial-statement"
        ref={statementRef}
        className="max-w-4xl mx-auto bg-white rounded-2xl border-2 border-slate-300 shadow-lg p-5 sm:p-8 space-y-5 text-black print:border-none print:shadow-none print:p-0"
      >
        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-16 h-16 rounded-2xl bg-white border-2 border-slate-300 p-1 flex items-center justify-center shrink-0">
              <img
                src={snapshot.companyLogoUrl || '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg'}
                alt={snapshot.companyName}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                {snapshot.companyName}
              </h1>
              <p className="text-xs sm:text-sm font-bold text-slate-800">
                {snapshot.companySubTitle || 'দৈনিক, মাসিক ও বাৎসরিক আয়-ব্যয় বিবরণী'}
              </p>
              <p className="text-xs font-semibold text-slate-700 mt-0.5">
                ঠিকানা: {snapshot.companyAddress || '৩নং পশ্চিম ইলিশা, ভোলা সদর'} | মোবাইল: {snapshot.companyPhone || '01721200049'}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right text-xs space-y-1 bg-slate-50 print:bg-white p-3 rounded-xl border border-slate-300">
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-800 text-white font-black text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{PERIOD_BADGE_MAP[snapshot.periodType]}</span>
            </div>
            <div className="text-slate-900 font-bold">সময়সীমা: {snapshot.periodLabel}</div>
            <div className="text-slate-800 font-semibold">
              তৈরির তারিখ: {formatBengaliDate(snapshot.generatedAt.slice(0, 10))}
            </div>
            <div className="font-mono font-black text-indigo-800">
              কোড: {snapshot.verificationCode}
              {snapshot.auditScore !== undefined ? ` • অডিট: ${toBengaliNumber(snapshot.auditScore)}/১০০` : ''}
            </div>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 print:bg-white p-3.5 rounded-xl border-2 border-slate-300">
          <div className="p-3 bg-white rounded-xl border border-slate-300">
            <div className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-700" />
              মোট লেনদেন
            </div>
            <div className="text-2xl font-black text-black mt-1">
              {toBengaliNumber(snapshot.summary.txCount)} টি
            </div>
          </div>
          <div className="p-3 bg-emerald-50/70 print:bg-emerald-50 rounded-xl border-2 border-emerald-400">
            <div className="text-xs font-extrabold text-emerald-900 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
              মোট আয় / জমা
            </div>
            <div className="text-2xl font-black text-emerald-800 mt-1">
              +{formatCurrency(snapshot.summary.totalIncome)}
            </div>
          </div>
          <div className="p-3 bg-rose-50/70 print:bg-rose-50 rounded-xl border-2 border-rose-400">
            <div className="text-xs font-extrabold text-rose-900 flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-700" />
              মোট ব্যয় / খরচ
            </div>
            <div className="text-2xl font-black text-rose-800 mt-1">
              -{formatCurrency(snapshot.summary.totalExpense)}
            </div>
          </div>
          <div className="p-3 bg-indigo-50/70 print:bg-indigo-50 rounded-xl border-2 border-indigo-400">
            <div className="text-xs font-extrabold text-indigo-950 flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-indigo-700" />
              নিট ব্যালেন্স
            </div>
            <div
              className={`text-2xl font-black mt-1 ${
                snapshot.summary.netBalance >= 0 ? 'text-emerald-900' : 'text-rose-800'
              }`}
            >
              {formatCurrency(snapshot.summary.netBalance)}
            </div>
          </div>
        </div>

        {/* Multi-Month Summary (Yearly / Multi-Month) */}
        {snapshot.multiMonthSummary && snapshot.multiMonthSummary.length > 1 && (
          <div className="border-2 border-slate-300 rounded-xl p-3.5 space-y-2 page-break-avoid">
            <h3 className="text-sm font-black text-indigo-950">
              মাসভিত্তিক তুলনামূলক সারসংক্ষেপ ({toBengaliNumber(snapshot.multiMonthSummary.length)} মাস)
            </h3>
            <table className="w-full text-left text-xs border-collapse border border-slate-400">
              <thead>
                <tr className="bg-indigo-100 text-black font-black">
                  <th className="py-2 px-3 border border-slate-400">মাস</th>
                  <th className="py-2 px-3 border border-slate-400 text-center">লেনদেন</th>
                  <th className="py-2 px-3 border border-slate-400 text-right">মোট জমা (+)</th>
                  <th className="py-2 px-3 border border-slate-400 text-right">মোট ব্যয় (-)</th>
                  <th className="py-2 px-3 border border-slate-400 text-right">নিট ব্যালেন্স</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.multiMonthSummary.map((m) => (
                  <tr key={m.month} className="border-b border-slate-300">
                    <td className="py-2 px-3 border border-slate-300 font-bold text-black">
                      {m.label || toBengaliNumber(m.month)}
                    </td>
                    <td className="py-2 px-3 border border-slate-300 text-center font-bold">
                      {toBengaliNumber(m.count)} টি
                    </td>
                    <td className="py-2 px-3 border border-slate-300 text-right font-black text-emerald-800">
                      +{formatCurrency(m.income)}
                    </td>
                    <td className="py-2 px-3 border border-slate-300 text-right font-black text-rose-800">
                      -{formatCurrency(m.expense)}
                    </td>
                    <td className="py-2 px-3 border border-slate-300 text-right font-black text-black">
                      {formatCurrency(m.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Category Breakdown */}
        {snapshot.categorySummary && snapshot.categorySummary.length > 0 && (
          <div className="border-2 border-slate-300 rounded-xl p-3.5 space-y-2 page-break-avoid">
            <h3 className="text-sm font-black text-black">ক্যাটাগরিভিত্তিক আয়-ব্যয় সারসংক্ষেপ</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {snapshot.categorySummary.map((cat) => (
                <div key={cat.name} className="p-2.5 rounded-lg bg-slate-50 border border-slate-300">
                  <div className="font-black text-black">{cat.name}</div>
                  <div className="flex items-center justify-between mt-1 font-bold">
                    {cat.income > 0 && <span className="text-emerald-800">আয়: {formatCurrency(cat.income)}</span>}
                    {cat.expense > 0 && <span className="text-rose-800">ব্যয়: {formatCurrency(cat.expense)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Transactions Table */}
        <div className="space-y-2">
          <h3 className="text-sm font-black text-black">
            বিস্তারিত লেনদেনের খাতা ({toBengaliNumber(snapshot.transactions.length)} টি রেকর্ড)
          </h3>
          <div className="overflow-x-auto print:overflow-visible border-2 border-slate-400 rounded-xl print:rounded-none">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-200 text-black font-black border-b-2 border-slate-500">
                  <th className="py-2 px-2.5 border-r border-slate-400 text-center whitespace-nowrap">ক্রমিক</th>
                  <th className="py-2 px-2.5 border-r border-slate-400 whitespace-nowrap">তারিখ</th>
                  <th className="py-2 px-2.5 border-r border-slate-400 text-center whitespace-nowrap">ধরন</th>
                  <th className="py-2 px-2.5 border-r border-slate-400">বিবরণ / খাত</th>
                  <th className="py-2 px-2.5 border-r border-slate-400">ক্যাটাগরি</th>
                  <th className="py-2 px-2.5 border-r border-slate-400 text-right whitespace-nowrap">টাকার পরিমাণ</th>
                  <th className="py-2 px-2.5 border-r border-slate-400 whitespace-nowrap">পেমেন্ট</th>
                  <th className="py-2 px-2.5 whitespace-nowrap">এন্ট্রিদাতা</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {snapshot.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-600 font-semibold">
                      কোনো লেনদেন পাওয়া যায়নি।
                    </td>
                  </tr>
                ) : (
                  snapshot.transactions.map((tx, idx) => {
                    const isIncome = tx.type === 'income';
                    return (
                      <tr key={tx.id || idx} className="align-top">
                        <td className="py-2 px-2.5 border-r border-slate-300 text-center font-bold text-black whitespace-nowrap">
                          {toBengaliNumber(idx + 1)}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-300 font-bold text-black whitespace-nowrap">
                          {formatBengaliDate(tx.date)}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-300 text-center font-black whitespace-nowrap">
                          <span className={isIncome ? 'text-emerald-800' : 'text-rose-800'}>
                            {isIncome ? 'আয়' : 'ব্যয়'}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-300 font-bold text-black">
                          {tx.title}
                          {tx.note && <div className="text-[11px] font-medium text-slate-700 mt-0.5">{tx.note}</div>}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-300 font-semibold text-slate-900">
                          {tx.category}
                        </td>
                        <td
                          className={`py-2 px-2.5 border-r border-slate-300 text-right font-black whitespace-nowrap ${
                            isIncome ? 'text-emerald-800' : 'text-rose-800'
                          }`}
                        >
                          {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-300 font-semibold text-slate-900 whitespace-nowrap">
                          {tx.paymentMethod === 'bkash'
                            ? 'বিকাশ'
                            : tx.paymentMethod === 'nagad'
                            ? 'নগদ'
                            : tx.paymentMethod === 'bank'
                            ? 'ব্যাংক'
                            : 'নগদ'}
                        </td>
                        <td className="py-2 px-2.5 font-semibold text-slate-900">{tx.addedBy || '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Official Signatories */}
        {snapshot.signatories && (
          <div className="pt-6 border-t-2 border-slate-400 grid grid-cols-3 gap-4 text-center text-xs page-break-avoid">
            <div>
              <div className="border-t-2 border-slate-800 pt-1.5 font-black text-black">
                {snapshot.signatories.managerName || 'ম্যানেজার'}
              </div>
              <div className="text-[11px] font-bold text-slate-700">ম্যানেজার অনুমোদন</div>
            </div>
            <div>
              <div className="border-t-2 border-slate-800 pt-1.5 font-black text-black">
                {snapshot.signatories.auditorName || 'অডিট কর্মকর্তা'}
              </div>
              <div className="text-[11px] font-bold text-slate-700">অডিট নিরীক্ষণ</div>
            </div>
            <div>
              <div className="border-t-2 border-slate-800 pt-1.5 font-black text-black">
                {snapshot.signatories.directorName || 'পরিচালক'}
              </div>
              <div className="text-[11px] font-bold text-slate-700">প্রধান পরিচালক</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
