import React, { useState, useEffect, useRef } from 'react';
import { X, Building2, Check, RefreshCw, Globe, Type, Database, Trash2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Company, UserSession } from '../types';
import {
  DEFAULT_TROUBLESHOOT_PORTAL_URL,
  PUBLISHED_SHARED_URL,
  getEffectiveTroubleshootPortalUrl,
  isLegacyTroubleshootPortalUrl
} from '../utils/appUrls';
import {
  AppFontSize,
  getSavedAppFontSize,
  setAppFontSize,
  subscribeAppFontSize
} from '../utils/fontScale';
import { CACHE_KEYS, clearAllLocalCache } from '../services/localCache';
import { refreshLiveCloudConnection } from '../services/dataService';
import { isDirector } from '../services/authService';
import { toBengaliNumber } from '../utils/formatters';

interface CompanySetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company | null;
  onSaveCompany: (company: Company) => Promise<void>;
  currentUser: UserSession;
  customersCount?: number;
  customerDuesCount?: number;
  complaintsCount?: number;
  joinRequestsCount?: number;
  onPurgeLegacyPortalData?: (options: {
    wipeCustomers: boolean;
    wipeCustomerDues: boolean;
    wipeComplaints: boolean;
    wipeJoinRequests: boolean;
  }) => Promise<{
    deletedCustomers: number;
    deletedDues: number;
    deletedComplaints: number;
    deletedJoinRequests: number;
  }>;
  initialScrollToDataManagement?: boolean;
}

export const CompanySetupModal: React.FC<CompanySetupModalProps> = ({
  isOpen,
  onClose,
  company,
  onSaveCompany,
  currentUser,
  customersCount = 0,
  customerDuesCount = 0,
  complaintsCount = 0,
  joinRequestsCount = 0,
  onPurgeLegacyPortalData,
  initialScrollToDataManagement = false
}) => {
  const [name, setName] = useState('');
  const [subTitle, setSubTitle] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [dailyExpenseThreshold, setDailyExpenseThreshold] = useState<number | ''>(5000);
  const [troubleshootPortalUrl, setTroubleshootPortalUrl] = useState(DEFAULT_TROUBLESHOOT_PORTAL_URL);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [appFontSize, setAppFontSizeState] = useState<AppFontSize>(() => getSavedAppFontSize());
  const [cacheClearMsg, setCacheClearMsg] = useState<string | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Full Legacy Portal & Subscriber Purge state
  const [wipeCustomers, setWipeCustomers] = useState(true);
  const [wipeCustomerDues, setWipeCustomerDues] = useState(true);
  const [wipeComplaints, setWipeComplaints] = useState(false);
  const [wipeJoinRequests, setWipeJoinRequests] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeResultMsg, setPurgeResultMsg] = useState<string | null>(null);

  const dataManagementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = subscribeAppFontSize((sz) => setAppFontSizeState(sz));
    return unsub;
  }, []);

  useEffect(() => {
    if (company) {
      setName(company.name || 'DIP BHOLA NETWORK');
      setSubTitle(company.subTitle || 'দৈনিক আয়-ব্যয় ও কেন্দ্রীয় স্টাফ মনিটরিং সিস্টেম');
      setOwnerName(company.ownerName || 'জাহিদুল ইসলাম');
      setPhone(company.phone || '01721200049');
      setEmail(company.email || 'zahidulislam53330@gmail.com');
      setAddress(company.address || '৩নং পশ্চিম ইলিশা।ভোলা সদর ভোলা');
      setLogoUrl(company.logoUrl || '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg');
      setDailyExpenseThreshold(company.dailyExpenseThreshold !== undefined ? company.dailyExpenseThreshold : 5000);
      setTroubleshootPortalUrl(getEffectiveTroubleshootPortalUrl(company));
    } else if (isOpen) {
      setTroubleshootPortalUrl(DEFAULT_TROUBLESHOOT_PORTAL_URL);
    }
    setCacheClearMsg(null);
    setShowPurgeConfirm(false);
    setPurgeResultMsg(null);
  }, [company, isOpen]);

  useEffect(() => {
    if (!isOpen || !initialScrollToDataManagement) return;
    const timer = window.setTimeout(() => {
      dataManagementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 140);
    return () => window.clearTimeout(timer);
  }, [isOpen, initialScrollToDataManagement]);

  const handleSelectFontSize = (sz: AppFontSize) => {
    setAppFontSize(sz);
    setAppFontSizeState(sz);
  };

  const handleClearModuleCache = async (
    label: string,
    cacheKey?: string
  ) => {
    setIsClearingCache(true);
    setCacheClearMsg(null);
    try {
      if (cacheKey) {
        window.localStorage.removeItem(cacheKey);
      }
      await refreshLiveCloudConnection();
      setCacheClearMsg(`${label} ক্যাশ মুছে লাইভ ডেটা রিফ্রেশ করা হয়েছে!`);
    } catch {
      setCacheClearMsg('ক্যাশ রিসেট করতে সমস্যা হয়েছে।');
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleClearAllCaches = async () => {
    setIsClearingCache(true);
    setCacheClearMsg(null);
    try {
      clearAllLocalCache();
      await refreshLiveCloudConnection();
      setCacheClearMsg('সকল মডিউলের লোকাল ক্যাশ মুছে ফ্রেশ সিঙ্ক শুরু হয়েছে!');
    } catch {
      setCacheClearMsg('সব ক্যাশ রিসেট করতে সমস্যা হয়েছে।');
    } finally {
      setIsClearingCache(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      const normalizeUrlInput = (raw: string) => {
        const t = raw.trim();
        if (!t) return '';
        if (t.startsWith('://')) return `http${t}`;
        if (/^https?:\/\//i.test(t)) return t;
        return `https://${t}`;
      };

      const rawPortalUrl = normalizeUrlInput(troubleshootPortalUrl);
      const safePortalUrl =
        !rawPortalUrl || isLegacyTroubleshootPortalUrl(rawPortalUrl)
          ? DEFAULT_TROUBLESHOOT_PORTAL_URL
          : rawPortalUrl;

      const updatedCompany: Company = {
        name: name.trim(),
        subTitle: subTitle.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        logoUrl: logoUrl.trim() || '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg',
        currencySymbol: company?.currencySymbol || '৳',
        dailyExpenseThreshold: Number(dailyExpenseThreshold) || 5000,
        troubleshootPortalUrl: safePortalUrl,
        partners: company?.partners || []
      };
      await onSaveCompany(updatedCompany);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 900);
    } catch (err) {
      console.error('Failed to update company:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#064e3b] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-800/80 border border-emerald-600 flex items-center justify-center text-emerald-200">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">কোম্পানি সেটআপ ও তথ্য</h2>
              <p className="text-xs text-emerald-200">টপবার ও অফিসিয়াল ডকুমেন্টের তথ্য পরিবর্তন করুন</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl flex items-center gap-2 text-sm font-semibold">
              <Check className="w-4 h-4 text-emerald-600" />
              কোম্পানি তথ্য সফলভাবে ফায়ারবেসে সংরক্ষিত হয়েছে!
            </div>
          )}

          {/* Logo Preview and Path */}
          <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="w-16 h-16 rounded-xl bg-white border border-slate-300 flex items-center justify-center overflow-hidden shrink-0 p-1">
              <img
                src={logoUrl || '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg'}
                alt="Logo Preview"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg';
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-bold text-slate-700 mb-1">লোগো ইমেজ লিঙ্ক বা পাথ</label>
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg"
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">ডিফল্ট লোগো: FB_IMG_1793200670972.jpg</p>
            </div>
          </div>

          {/* Company Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              প্রতিষ্ঠানের নাম <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="DIP BHOLA NETWORK"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-semibold text-slate-900"
            />
          </div>

          {/* Subtitle / Slogan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              স্লোগান / সাবটাইটেল
            </label>
            <input
              type="text"
              value={subTitle}
              onChange={(e) => setSubTitle(e.target.value)}
              placeholder="দৈনিক আয়-ব্যয় ও কেন্দ্রীয় স্টাফ মনিটরিং সিস্টেম"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          {/* Owner & Phone Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                পরিচালকের নাম
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="জাহিদুল ইসলাম"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                মোবাইল নম্বর
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01721200049"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ইমেইল অ্যাড্রেস
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="zahidulislam53330@gmail.com"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              অফিস ঠিকানা
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="৩নং পশ্চিম ইলিশা।ভোলা সদর ভোলা"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          {/* Daily Expense Alert Threshold Field */}
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-1.5">
            <label className="block text-xs font-bold text-amber-900 dark:text-amber-200">
              দৈনিক ব্যয়ের সর্বোচ্চ সতর্কতা সীমা (Daily Expense Alert Threshold BDT)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="500"
                value={dailyExpenseThreshold}
                onChange={(e) => setDailyExpenseThreshold(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="5000"
                className="w-full px-3 py-2 text-sm font-bold bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
              <span className="absolute right-3 top-2 text-xs font-bold text-slate-500">টাকা (BDT)</span>
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              আজকের মোট খরচ এই সীমা অতিক্রম করলে ম্যানেজার ও পরিচালকের ড্যাশবোর্ডে স্বয়ংক্রিয় সতর্কবার্তা দেখাবে।
            </p>
          </div>

          {/* Troubleshooting & Problem-Solution Web App Link */}
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2.5">
            <div>
              <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-200 mb-1 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-600" />
                <span>সমস্যা সমাধান ওয়েব পোর্টাল লিংক (Troubleshooting Portal URL)</span>
              </label>
              <input
                type="text"
                value={troubleshootPortalUrl}
                onChange={(e) => setTroubleshootPortalUrl(e.target.value)}
                placeholder={DEFAULT_TROUBLESHOOT_PORTAL_URL}
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-slate-900 dark:text-slate-100"
              />
              {isLegacyTroubleshootPortalUrl(troubleshootPortalUrl) && (
                <p className="mt-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                  পুরাতন লিংক (t4povhqa...) বাতিল করা হয়েছে — সংরক্ষণ করলে স্বয়ংক্রিয়ভাবে নতুন লিংক (fyeuetew...) সেট হবে।
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTroubleshootPortalUrl(PUBLISHED_SHARED_URL)}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-emerald-100 border border-emerald-300 dark:border-emerald-700 text-[11px] font-bold text-emerald-900 dark:text-emerald-200 cursor-pointer"
              >
                ডিফল্ট ERP সমাধান লিংক (fyeuetew...)
              </button>
            </div>
            <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
              সেভ করার পর ERP কমান্ড হাব ও মেনু থেকে <strong>সমস্যা সমাধান পোর্টাল</strong>-এ প্রবেশ করে দ্রুত সমস্যা খুঁজে সমাধান করতে পারবেন।
            </p>
          </div>

          {/* Global Font Size Setting (Small / Medium / Large) */}
          <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-sky-950 dark:text-sky-200">
              <Type className="w-4 h-4 text-sky-600" />
              <span>অ্যাপ ফন্ট সাইজ (App Font Size)</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'small', label: 'ছোট (Small)' },
                  { id: 'medium', label: 'মাঝারি (Medium)' },
                  { id: 'large', label: 'বড় (Large)' }
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectFontSize(opt.id)}
                  className={`py-2 px-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                    appFontSize === opt.id
                      ? 'bg-sky-600 text-white border-sky-500 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-sky-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-sky-800 dark:text-sky-300">
              সব লেখা ও সংখ্যা দূর থেকে স্পষ্ট দেখার জন্য "বড় (Large)" বেছে নিন।
            </p>
          </div>

          {/* Director Data Management Section (Module Cache Clear & Full Portal Purge) */}
          {isDirector(currentUser) && (
            <div
              ref={dataManagementRef}
              className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  <Database className="w-4 h-4 text-rose-600" />
                  <span>ডেটা ম্যানেজমেন্ট (Data Management · ক্যাশ রিসেট)</span>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                অ্যাপ পুনরায় ইনস্টল না করেই নির্দিষ্ট মডিউলের লোকাল ক্যাশ পরিষ্কার করে ক্লাউড থেকে ফ্রেশ ডেটা আনুন:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={isClearingCache || isPurging}
                  onClick={() => void handleClearModuleCache('Transactions (লেনদেন)', CACHE_KEYS.TRANSACTIONS)}
                  className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-rose-50 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span>Transactions ক্যাশ</span>
                </button>
                <button
                  type="button"
                  disabled={isClearingCache || isPurging}
                  onClick={() => void handleClearModuleCache('Customers (গ্রাহক)', CACHE_KEYS.CUSTOMERS)}
                  className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-rose-50 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span>Customers ক্যাশ</span>
                </button>
                <button
                  type="button"
                  disabled={isClearingCache || isPurging}
                  onClick={() => void handleClearModuleCache('Complaints & Dues', CACHE_KEYS.COMPLAINTS)}
                  className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-rose-50 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span>অভিযোগ ক্যাশ</span>
                </button>
                <button
                  type="button"
                  disabled={isClearingCache || isPurging}
                  onClick={() => void handleClearAllCaches()}
                  className="col-span-2 sm:col-span-3 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isClearingCache ? 'animate-spin' : ''}`} />
                  <span>সব লোকাল ক্যাশ মুছে ফ্রেশ রিফ্রেশ করুন</span>
                </button>
              </div>
              {cacheClearMsg && (
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 text-xs font-bold">
                  {cacheClearMsg}
                </div>
              )}

              {/* Permanent Legacy Portal & Cloud Data Purge */}
              {onPurgeLegacyPortalData && (
                <div className="mt-3 pt-3 border-t border-rose-200 dark:border-rose-900/60 space-y-2.5">
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/35 border border-rose-300 dark:border-rose-800/70 space-y-2">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="text-xs sm:text-sm font-black text-rose-900 dark:text-rose-200">
                          পুরাতন পোর্টাল (t4povhqa...) ও সকল অপ্রয়োজনীয় তথ্য স্থায়ীভাবে ডিলিট
                        </div>
                        <p className="text-[11px] leading-relaxed text-rose-800 dark:text-rose-300">
                          এই অ্যাপের ক্লাউড ডেটাবেস থেকে পুরাতন পোর্টাল থেকে আসা সকল তথ্য (গ্রাহক, বকেয়া, পুরাতন পোর্টাল সেটিংস ও ক্যাশ) একবারেই স্থায়ীভাবে মুছে ফেলুন।{' '}
                          <strong className="text-emerald-800 dark:text-emerald-300">
                            আপনার মূল হিসাব-খাতা (আয়-ব্যয় লেনদেন), স্টাফ এবং পার্টনার হিসাব সম্পূর্ণ নিরাপদ থাকবে।
                          </strong>
                        </p>
                        <p className="text-[10px] leading-relaxed text-rose-700 dark:text-rose-300/90">
                          বিঃদ্রঃ <span className="font-mono">t4povhqa45dibisqbvp3db...</span> লিংকটি একটি আলাদা প্রজেক্ট — এই বাটনে ক্লিক করলে এই অ্যাপ থেকে তার সকল সংযুক্ত তথ্য মুছে যাবে; আর ওই আলাদা লিংকটি বন্ধ করতে চাইলে AI Studio ড্যাশবোর্ড থেকে সেই প্রজেক্টটি আনপাবলিশ/ডিলিট করতে হবে।
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800/60 text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={wipeCustomers}
                          onChange={(e) => setWipeCustomers(e.target.checked)}
                          disabled={isPurging}
                          className="accent-rose-600 w-4 h-4 rounded"
                        />
                        <span>সকল গ্রাহক তালিকা ({toBengaliNumber(customersCount)} জন)</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800/60 text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={wipeCustomerDues}
                          onChange={(e) => setWipeCustomerDues(e.target.checked)}
                          disabled={isPurging}
                          className="accent-rose-600 w-4 h-4 rounded"
                        />
                        <span>সকল গ্রাহক বকেয়া ({toBengaliNumber(customerDuesCount)} টি)</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800/60 text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={wipeComplaints}
                          onChange={(e) => setWipeComplaints(e.target.checked)}
                          disabled={isPurging}
                          className="accent-rose-600 w-4 h-4 rounded"
                        />
                        <span>সকল অভিযোগ ({toBengaliNumber(complaintsCount)} টি)</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800/60 text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={wipeJoinRequests}
                          onChange={(e) => setWipeJoinRequests(e.target.checked)}
                          disabled={isPurging}
                          className="accent-rose-600 w-4 h-4 rounded"
                        />
                        <span>জয়েনিং আবেদনসমূহ ({toBengaliNumber(joinRequestsCount)} টি)</span>
                      </label>

                      <div className="sm:col-span-2 flex items-center gap-2 p-2 rounded-lg bg-rose-100/80 dark:bg-rose-900/30 border border-rose-300 dark:border-rose-700/60 text-[11px] font-bold text-rose-900 dark:text-rose-200">
                        <Check className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>পুরাতন পোর্টাল সেটিংস, অব্যবহৃত লিংক (t4povhqa...) ও লোকাল ক্যাশ (সবসময় পরিষ্কার হবে)</span>
                      </div>
                    </div>

                    {!showPurgeConfirm ? (
                      <button
                        type="button"
                        disabled={isPurging}
                        onClick={() => {
                          setPurgeResultMsg(null);
                          setShowPurgeConfirm(true);
                        }}
                        className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>সকল নির্বাচিত পুরাতন তথ্য স্থায়ীভাবে মুছুন</span>
                      </button>
                    ) : (
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border-2 border-rose-500 space-y-2.5">
                        <div className="flex items-start gap-2 text-xs font-bold text-rose-800 dark:text-rose-200">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <span>
                            সতর্কতা: একবার ডিলিট করলে নির্বাচিত ক্লাউড ডেটা পুনরুদ্ধার করা যাবে না! আপনি কি নিশ্চিত?
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={isPurging}
                            onClick={async () => {
                              setIsPurging(true);
                              setPurgeResultMsg(null);
                              try {
                                const res = await onPurgeLegacyPortalData({
                                  wipeCustomers,
                                  wipeCustomerDues,
                                  wipeComplaints,
                                  wipeJoinRequests
                                });
                                setShowPurgeConfirm(false);
                                setPurgeResultMsg(
                                  `সফলভাবে ডিলিট সম্পন্ন: গ্রাহক ${toBengaliNumber(res.deletedCustomers)} জন, বকেয়া ${toBengaliNumber(res.deletedDues)} টি, অভিযোগ ${toBengaliNumber(res.deletedComplaints)} টি, জয়েনিং আবেদন ${toBengaliNumber(res.deletedJoinRequests)} টি ও পুরাতন পোর্টাল সেটিংস স্থায়ীভাবে মুছে ফেলা হয়েছে!`
                                );
                              } catch {
                                setPurgeResultMsg('তথ্য ডিলিট করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
                              } finally {
                                setIsPurging(false);
                              }
                            }}
                            className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            {isPurging ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>স্থায়ীভাবে ডিলিট হচ্ছে...</span>
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>হ্যাঁ, স্থায়ীভাবে ডিলিট করুন</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={isPurging}
                            onClick={() => setShowPurgeConfirm(false)}
                            className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-100 text-xs font-bold cursor-pointer"
                          >
                            বাতিল
                          </button>
                        </div>
                      </div>
                    )}

                    {purgeResultMsg && (
                      <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-400 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200 text-xs font-bold">
                        {purgeResultMsg}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors shadow-sm flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  সংরক্ষণ হচ্ছে...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  সংরক্ষণ করুন
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
