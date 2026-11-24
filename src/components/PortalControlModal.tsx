import React, { useState, useMemo } from 'react';
import {
  X,
  Sliders,
  Trash2,
  RotateCcw,
  Plus,
  ExternalLink,
  Link2,
  Lock,
  Unlock,
  Globe,
  Router,
  CreditCard,
  Wrench,
  Shield,
  Smartphone,
  Server,
  Edit3,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Moon,
  Sun,
  Maximize,
  Minimize,
  Send,
  Database,
  LayoutGrid
} from 'lucide-react';
import {
  CustomPortalIconName,
  CustomPortalLink,
  PortalControlConfig,
  UserSession
} from '../types';
import { useAppUpdate } from '../context/AppUpdateContext';
import { addAuditLog } from '../services/dataService';
import { toBengaliNumber } from '../utils/formatters';

interface BuiltInPortalMeta {
  id: string;
  shortLabel: string;
  title: string;
  description: string;
}

export const BUILTIN_CONTROL_PORTALS: BuiltInPortalMeta[] = [
  {
    id: 'dashboard',
    shortLabel: 'ড্যাশবোর্ড',
    title: 'দৈনিক নির্বাহী ড্যাশবোর্ড',
    description: 'মূল আয়-ব্যয় সামারি, গ্রাফ ও লাইভ আর্থিক চিত্র'
  },
  {
    id: 'transactions',
    shortLabel: 'হিসাব খাতা',
    title: 'আয়-ব্যয় হিসাব খাতা ও লেনদেন',
    description: 'দৈনিক ভাউচার এন্ট্রি, নগদ ও মোবাইল ব্যাংকিং লেজার'
  },
  {
    id: 'complaints',
    shortLabel: 'অভিযোগ ও সাপোর্ট',
    title: 'অভিযোগ ও টেকনিশিয়ান সাপোর্ট ডেস্ক',
    description: 'গ্রাহক অভিযোগ, PON/এরিয়া অ্যাসাইন ও লাইভ সমাধান'
  },
  {
    id: 'customers',
    shortLabel: 'গ্রাহক তালিকা',
    title: 'গ্রাহক ও মেম্বার ডিরেক্টরি',
    description: 'গ্রাহকের প্যাকেজ, ONU ও OLT তথ্য'
  },
  {
    id: 'staff',
    shortLabel: 'স্টাফ ও বেতন',
    title: 'স্টাফ প্রোফাইল ও বেতন ম্যানেজমেন্ট',
    description: 'স্টাফ তথ্য, রোল অনুমোদন ও ছবি সহ QR ID কার্ড'
  },
  {
    id: 'dues',
    shortLabel: 'বাকি ও আদায়',
    title: 'বকেয়া বিল ও কালেকশন লেজার',
    description: 'বকেয়া গ্রাহকদের তালিকা ও আদায় ট্র্যাকিং'
  },
  {
    id: 'partners',
    shortLabel: 'শেয়ার পার্টনার',
    title: 'অংশীদার ও বিনিয়োগ পোর্টাল',
    description: 'বিনিয়োগ ও শেয়ার অনুপাতে হিসাব'
  },
  {
    id: 'officers',
    shortLabel: 'কর্মকর্তা ও নথি',
    title: 'ম্যানেজার ও অডিটর নিয়োগ প্যানেল',
    description: 'ম্যানেজার ও অভ্যন্তরীণ অডিটরের তথ্য ও দায়িত্ব'
  },
  {
    id: 'reports',
    shortLabel: 'রিপোর্ট ও PDF',
    title: 'আর্থিক রিপোর্ট ও QR PDF প্রিন্ট',
    description: 'দৈনিক, মাসিক ও বাৎসরিক স্টেটমেন্ট ও QR PDF'
  },
  {
    id: 'display',
    shortLabel: 'নোটিশ বোর্ড',
    title: 'ডিজিটাল ডিসপ্লে ও নোটিশ বোর্ড',
    description: 'চলমান ঘোষণা ও লাইভ নোটিশ স্ক্রল সেটিংস'
  },
  {
    id: 'troubleshoot_portal',
    shortLabel: 'সমস্যা সমাধান',
    title: 'সমস্যা অনুসন্ধান ও সমাধান পোর্টাল',
    description: 'বিলিং ও OLT সমস্যা অনুসন্ধানের ওয়েব পোর্টাল'
  },
  {
    id: 'backup',
    shortLabel: 'ব্যাকআপ ও ড্রাইভ',
    title: 'ডেটা ব্যাকআপ ও Google Drive সিঙ্ক',
    description: 'JSON, CSV ও মাসিক ব্যাকআপ সংরক্ষণ'
  }
];

import { CUSTOM_PORTAL_ICONS, renderCustomPortalIcon } from '../utils/portalIcons';
export { CUSTOM_PORTAL_ICONS, renderCustomPortalIcon };

interface PortalControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  portalControl: PortalControlConfig;
  onSavePortalControl: (next: PortalControlConfig) => Promise<void>;
  currentUser: UserSession;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
}

export const PortalControlModal: React.FC<PortalControlModalProps> = ({
  isOpen,
  onClose,
  portalControl,
  onSavePortalControl,
  currentUser,
  darkMode,
  onToggleDarkMode,
  isFullscreen,
  onToggleFullscreen,
  autoRefresh,
  onToggleAutoRefresh
}) => {
  const {
    currentVersion,
    autoUpdateEnabled,
    setAutoUpdateEnabled,
    isChecking,
    triggerManualCheck,
    isPushingRelease,
    pushLiveUpdateToDevices,
    checkStatusMessage
  } = useAppUpdate();

  const [activeTab, setActiveTab] = useState<'builtin' | 'custom' | 'device'>('builtin');
  const [saving, setSaving] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  // Add/Edit Custom Portal form state
  const [editingPortalId, setEditingPortalId] = useState<string | null>(null);
  const [shortLabel, setShortLabel] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [openMode, setOpenMode] = useState<'in_app' | 'new_tab'>('in_app');
  const [iconName, setIconName] = useState<CustomPortalIconName>('globe');
  const [allowedRoles, setAllowedRoles] = useState<Array<'director' | 'manager' | 'staff' | 'partner'>>([
    'director',
    'manager',
    'staff'
  ]);
  const [pushNote, setPushNote] = useState('');

  const isStandalone = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  }, []);

  if (!isOpen) return null;

  const deletedIds = new Set(portalControl.deletedPortalIds || []);
  const disabledIds = new Set(portalControl.disabledPortalIds || []);
  const customPortals = portalControl.customPortals || [];

  const persistControl = async (next: PortalControlConfig, auditDetail: string) => {
    setSaving(true);
    setStatusBanner(null);
    try {
      const payload: PortalControlConfig = {
        ...next,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name
      };
      await onSavePortalControl(payload);
      await addAuditLog({
        action: 'portal_control_update',
        actionBengali: 'অ্যাপ পোর্টাল কন্ট্রোল পরিবর্তন',
        performedBy: currentUser.name,
        performedById: currentUser.id,
        performedByUid: currentUser.uid,
        role: currentUser.role,
        details: auditDetail
      }).catch(() => {});
      setStatusBanner({ type: 'ok', text: `${auditDetail} — সকল ইনস্টল অ্যাপে সাথে সাথে সিঙ্ক হয়েছে।` });
    } catch (err: any) {
      setStatusBanner({
        type: 'err',
        text: err?.message || 'সেটিংস সংরক্ষণ করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBuiltIn = async (portal: BuiltInPortalMeta) => {
    const nextDeleted = Array.from(new Set([...(portalControl.deletedPortalIds || []), portal.id]));
    const nextDisabled = (portalControl.disabledPortalIds || []).filter((id) => id !== portal.id);
    await persistControl(
      { ...portalControl, deletedPortalIds: nextDeleted, disabledPortalIds: nextDisabled },
      `বিল্ট-ইন পোর্টাল "${portal.shortLabel}" ডিলিট করা হয়েছে`
    );
  };

  const handleRestoreBuiltIn = async (portal: BuiltInPortalMeta) => {
    const nextDeleted = (portalControl.deletedPortalIds || []).filter((id) => id !== portal.id);
    const nextDisabled = (portalControl.disabledPortalIds || []).filter((id) => id !== portal.id);
    await persistControl(
      { ...portalControl, deletedPortalIds: nextDeleted, disabledPortalIds: nextDisabled },
      `পোর্টাল "${portal.shortLabel}" পুনরায় চালু (Restore) করা হয়েছে`
    );
  };

  const handleToggleLockBuiltIn = async (portal: BuiltInPortalMeta) => {
    const isLocked = disabledIds.has(portal.id);
    const nextDisabled = isLocked
      ? (portalControl.disabledPortalIds || []).filter((id) => id !== portal.id)
      : Array.from(new Set([...(portalControl.disabledPortalIds || []), portal.id]));
    await persistControl(
      { ...portalControl, disabledPortalIds: nextDisabled },
      `পোর্টাল "${portal.shortLabel}" ${isLocked ? 'আনলক (সক্রিয়)' : 'সাময়িক লক (বন্ধ)'} করা হয়েছে`
    );
  };

  const handleRestoreAllBuiltIn = async () => {
    await persistControl(
      { ...portalControl, deletedPortalIds: [], disabledPortalIds: [] },
      'সকল বিল্ট-ইন পোর্টাল ডিলিট/লক থেকে পুনরুদ্ধার করা হয়েছে'
    );
    setConfirmResetAll(false);
  };

  const resetCustomForm = () => {
    setEditingPortalId(null);
    setShortLabel('');
    setTitle('');
    setUrl('');
    setDescription('');
    setOpenMode('in_app');
    setIconName('globe');
    setAllowedRoles(['director', 'manager', 'staff']);
  };

  const startEditCustomPortal = (cp: CustomPortalLink) => {
    setEditingPortalId(cp.id);
    setShortLabel(cp.shortLabel);
    setTitle(cp.title);
    setUrl(cp.url);
    setDescription(cp.description || '');
    setOpenMode(cp.openMode || 'in_app');
    setIconName(cp.iconName || 'globe');
    setAllowedRoles(
      cp.allowedRoles && cp.allowedRoles.length > 0 ? cp.allowedRoles : ['director', 'manager', 'staff']
    );
  };

  const toggleRoleInCustom = (role: 'director' | 'manager' | 'staff' | 'partner') => {
    if (role === 'director') return; // Director always keeps access
    setAllowedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSaveCustomPortal = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanShort = shortLabel.trim();
    const cleanTitle = title.trim() || cleanShort;
    let cleanUrl = url.trim();

    if (!cleanShort) {
      setStatusBanner({ type: 'err', text: 'পোর্টালের সংক্ষিপ্ত নাম লিখুন।' });
      return;
    }
    if (!cleanUrl) {
      setStatusBanner({ type: 'err', text: 'পোর্টালের সঠিক ওয়েব লিংক (URL) দিন।' });
      return;
    }
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = `https://${cleanUrl}`;
    }

    try {
      new URL(cleanUrl);
    } catch {
      setStatusBanner({ type: 'err', text: 'সঠিক URL দিন, যেমন: https://example.com' });
      return;
    }

    const nowIso = new Date().toISOString();
    const rolesClean = Array.from(new Set(['director', ...allowedRoles])) as Array<
      'director' | 'manager' | 'staff' | 'partner'
    >;

    let nextCustoms: CustomPortalLink[];
    let auditText: string;

    if (editingPortalId) {
      nextCustoms = customPortals.map((cp) =>
        cp.id === editingPortalId
          ? {
              ...cp,
              shortLabel: cleanShort.slice(0, 24),
              title: cleanTitle.slice(0, 70),
              url: cleanUrl,
              description: description.trim().slice(0, 180) || undefined,
              openMode,
              iconName,
              allowedRoles: rolesClean,
              updatedAt: nowIso
            }
          : cp
      );
      auditText = `কাস্টম পোর্টাল "${cleanShort}" আপডেট করা হয়েছে`;
    } else {
      const newPortal: CustomPortalLink = {
        id: `custom-${Date.now().toString(36)}`,
        shortLabel: cleanShort.slice(0, 24),
        title: cleanTitle.slice(0, 70),
        url: cleanUrl,
        description: description.trim().slice(0, 180) || undefined,
        openMode,
        iconName,
        allowedRoles: rolesClean,
        active: true,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: currentUser.name
      };
      nextCustoms = [...customPortals, newPortal];
      auditText = `নতুন পোর্টাল "${cleanShort}" (${cleanUrl}) যুক্ত ও লিংক করা হয়েছে`;
    }

    await persistControl({ ...portalControl, customPortals: nextCustoms }, auditText);
    resetCustomForm();
  };

  const handleToggleCustomActive = async (cp: CustomPortalLink) => {
    const nextCustoms = customPortals.map((item) =>
      item.id === cp.id ? { ...item, active: !item.active, updatedAt: new Date().toISOString() } : item
    );
    await persistControl(
      { ...portalControl, customPortals: nextCustoms },
      `কাস্টম পোর্টাল "${cp.shortLabel}" ${cp.active ? 'বন্ধ' : 'সক্রিয়'} করা হয়েছে`
    );
  };

  const handleDeleteCustomPortal = async (cp: CustomPortalLink) => {
    const nextCustoms = customPortals.filter((item) => item.id !== cp.id);
    if (editingPortalId === cp.id) resetCustomForm();
    await persistControl(
      { ...portalControl, customPortals: nextCustoms },
      `কাস্টম পোর্টাল "${cp.shortLabel}" সম্পূর্ণ ডিলিট করা হয়েছে`
    );
  };

  const handleClearAppCaches = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      setStatusBanner({
        type: 'ok',
        text: 'ইনস্টল অ্যাপের অফলাইন ব্রাউজার ক্যাশ পরিষ্কার হয়েছে। পোর্টাল সেটিংস অক্ষত আছে।'
      });
    } catch {
      setStatusBanner({ type: 'err', text: 'ক্যাশ পরিষ্কার করতে সমস্যা হয়েছে।' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between gap-3 border-b border-indigo-800/40 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white truncate">
                  অ্যাপস ফুল কন্ট্রোল ও পোর্টাল ম্যানেজার
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950 whitespace-nowrap">
                  {isStandalone ? 'ইনস্টলড অ্যাপ (Standalone)' : 'ওয়েব অ্যাপ মোড'}
                </span>
              </div>
              <p className="text-xs text-cyan-200/85 truncate">
                যেকোনো পোর্টাল ডিলিট/লক করুন, নতুন ওয়েব লিংক পোর্টাল এড করুন এবং ইনস্টল অ্যাপ কন্ট্রোল করুন
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="বন্ধ করুন"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('builtin')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'builtin'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>পোর্টাল ডিলিট / লক / রিস্টোর ({toBengaliNumber(BUILTIN_CONTROL_PORTALS.length - deletedIds.size)})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'custom'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>নতুন পোর্টাল এড ও লিংক ({toBengaliNumber(customPortals.length)})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('device')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'device'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>ইনস্টল অ্যাপ ও রিমোট কন্ট্রোল</span>
          </button>
        </div>

        {/* Status Alert */}
        {statusBanner && (
          <div
            className={`mx-5 mt-4 p-3 rounded-xl border text-xs font-bold flex items-center gap-2 shrink-0 ${
              statusBanner.type === 'ok'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200'
            }`}
          >
            {statusBanner.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="flex-1">{statusBanner.text}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: Built-in Portals Delete/Lock/Restore */}
          {activeTab === 'builtin' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    বিল্ট-ইন ERP পোর্টাল ডিলিট, লক ও পুনরুদ্ধার নিয়ন্ত্রণ
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    এখান থেকে কোনো পোর্টাল ডিলিট করলে তা সাইডবার ও মূল হাব থেকে সরে যাবে — প্রয়োজনে যেকোনো সময় আবার ফিরিয়ে আনতে পারবেন।
                  </p>
                </div>
                {(deletedIds.size > 0 || disabledIds.size > 0) && (
                  confirmResetAll ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleRestoreAllBuiltIn}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                      >
                        নিশ্চিত রিস্টোর
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmResetAll(false)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold cursor-pointer"
                      >
                        বাতিল
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmResetAll(true)}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>সব রিস্টোর করুন</span>
                    </button>
                  )
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {BUILTIN_CONTROL_PORTALS.map((portal) => {
                  const isDeleted = deletedIds.has(portal.id);
                  const isLocked = disabledIds.has(portal.id);
                  return (
                    <div
                      key={portal.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                        isDeleted
                          ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60'
                          : isLocked
                          ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
                          : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-slate-900 dark:text-white">
                            {portal.shortLabel}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isDeleted
                                ? 'bg-rose-600 text-white'
                                : isLocked
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {isDeleted ? 'ডিলিটেড' : isLocked ? 'লক করা' : 'সক্রিয়'}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                          {portal.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {portal.description}
                        </p>
                      </div>

                      <div className="flex flex-col gap-1.5 shrink-0">
                        {isDeleted ? (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleRestoreBuiltIn(portal)}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>ফিরিয়ে আনুন</span>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleToggleLockBuiltIn(portal)}
                              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                                isLocked
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 hover:bg-amber-200'
                              }`}
                            >
                              {isLocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                              <span>{isLocked ? 'আনলক' : 'লক'}</span>
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleDeleteBuiltIn(portal)}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-900/40 hover:bg-rose-600 text-rose-700 dark:text-rose-300 hover:text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>ডিলিট</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Add & Link Custom Portals */}
          {activeTab === 'custom' && (
            <div className="space-y-5">
              <form
                onSubmit={handleSaveCustomPortal}
                className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-600" />
                    <span>
                      {editingPortalId ? 'কাস্টম পোর্টাল এডিট করুন' : 'নতুন পোর্টাল এড ও লিংক করুন'}
                    </span>
                  </h3>
                  {editingPortalId && (
                    <button
                      type="button"
                      onClick={resetCustomForm}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      নতুন ফর্ম চালু করুন
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      সংক্ষিপ্ত নাম (Hub/Sidebar) *
                    </label>
                    <input
                      type="text"
                      required
                      value={shortLabel}
                      onChange={(e) => setShortLabel(e.target.value)}
                      placeholder="যেমন: মাইক্রোটিক / ISP বিলিং"
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      পূর্ণ পোর্টাল শিরোনাম
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="যেমন: কেন্দ্রীয় MikroTik ও OLT কন্ট্রোল"
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      পোর্টাল লিংক (URL) *
                    </label>
                    <input
                      type="text"
                      required
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://billing.example.com"
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ওপেনিং মোড
                    </label>
                    <select
                      value={openMode}
                      onChange={(e) => setOpenMode(e.target.value as 'in_app' | 'new_tab')}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                    >
                      <option value="in_app">অ্যাপের ভেতরে (In-App ভিউ)</option>
                      <option value="new_tab">নতুন ট্যাবে (External)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="এই পোর্টালের কাজ সম্পর্কে সংক্ষিপ্ত বর্ণনা লিখুন"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Icon Picker */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    আইকন নির্বাচন করুন
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {CUSTOM_PORTAL_ICONS.map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setIconName(id)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer ${
                          iconName === id
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Allowed Roles */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    কোন রোল এই পোর্টাল দেখতে পাবে
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'director', label: 'পরিচালক (সবসময়)' },
                        { id: 'manager', label: 'ম্যানেজার' },
                        { id: 'staff', label: 'স্টাফ / টেকনিশিয়ান' },
                        { id: 'partner', label: 'শেয়ার পার্টনার' }
                      ] as const
                    ).map((r) => {
                      const active = allowedRoles.includes(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => toggleRoleInCustom(r.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                            active
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {active ? '✓ ' : ''}
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-1 flex justify-end gap-2">
                  {editingPortalId && (
                    <button
                      type="button"
                      onClick={resetCustomForm}
                      className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold cursor-pointer"
                    >
                      বাতিল
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-60"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{editingPortalId ? 'পরিবর্তন সেভ করুন' : 'পোর্টাল এড ও লিংক করুন'}</span>
                  </button>
                </div>
              </form>

              {/* List of Custom Portals */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  সংযুক্ত কাস্টম পোর্টালসমূহ ({toBengaliNumber(customPortals.length)})
                </h4>

                {customPortals.length === 0 ? (
                  <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
                    এখনো কোনো কাস্টম পোর্টাল যুক্ত করা হয়নি। উপরের ফর্ম দিয়ে যেকোনো ওয়েবসাইট, OLT, বা বিলিং লিংক এড করুন।
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {customPortals.map((cp) => (
                      <div
                        key={cp.id}
                        className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
                            {renderCustomPortalIcon(cp.iconName, 'w-4 h-4')}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-slate-900 dark:text-white">
                                {cp.shortLabel}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  cp.active
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                                    : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {cp.active ? 'সক্রিয়' : 'বন্ধ'}
                              </span>
                              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                                {cp.openMode === 'new_tab' ? 'নতুন ট্যাব' : 'অ্যাপের ভেতরে'}
                              </span>
                            </div>
                            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate">
                              {cp.title}
                            </p>
                            <p className="text-[11px] font-mono text-cyan-700 dark:text-cyan-400 truncate">
                              {cp.url}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <a
                            href={cp.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>খুলুন</span>
                          </a>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleToggleCustomActive(cp)}
                            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer ${
                              cp.active
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {cp.active ? 'বন্ধ করুন' : 'চালু করুন'}
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditCustomPortal(cp)}
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>এডিট</span>
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleDeleteCustomPortal(cp)}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-900/40 hover:bg-rose-600 text-rose-700 dark:text-rose-300 hover:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>ডিলিট</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Installed App & Remote Control */}
          {activeTab === 'device' && (
            <div className="space-y-4">
              {/* Installed App Version & Push Release */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white border border-indigo-700/50 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-black">
                      ইনস্টল করা অ্যাপে লাইভ আপডেট পুশ করুন (v{currentVersion})
                    </div>
                    <p className="text-xs text-indigo-200 mt-0.5">
                      মোবাইল/ডেস্কটপে ইনস্টল করা সব অ্যাপে তাৎক্ষণিক আপডেট এবং নতুন পোর্টাল লেআউট পাঠান।
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isChecking}
                    onClick={() => void triggerManualCheck()}
                    className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                    <span>ভার্সন যাচাই</span>
                  </button>
                </div>

                {checkStatusMessage && (
                  <div className="p-2.5 rounded-xl bg-white/10 text-xs text-cyan-200 font-semibold">
                    {checkStatusMessage}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={pushNote}
                    onChange={(e) => setPushNote(e.target.value)}
                    placeholder="রিলিজ নোট (ঐচ্ছিক), যেমন: নতুন পোর্টাল যুক্ত হয়েছে"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900/70 border border-indigo-500/40 text-xs text-white placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    disabled={isPushingRelease}
                    onClick={() => void pushLiveUpdateToDevices(pushNote)}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-60"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isPushingRelease ? 'পাঠানো হচ্ছে...' : 'সকল ইনস্টল অ্যাপে পুশ করুন'}</span>
                  </button>
                </div>
              </div>

              {/* Device Interface & Behaviour Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onToggleDarkMode}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {darkMode ? (
                      <Moon className="w-5 h-5 text-indigo-400" />
                    ) : (
                      <Sun className="w-5 h-5 text-amber-500" />
                    )}
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white">ডার্ক / লাইট মোড</div>
                      <div className="text-[11px] text-slate-500">
                        বর্তমান: {darkMode ? 'ডার্ক থিম' : 'লাইট থিম'}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-indigo-600 text-white text-[11px] font-bold">
                    পরিবর্তন
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onToggleFullscreen}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {isFullscreen ? (
                      <Minimize className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Maximize className="w-5 h-5 text-emerald-600" />
                    )}
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white">ফুলস্ক্রিন কন্ট্রোল</div>
                      <div className="text-[11px] text-slate-500">
                        {isFullscreen ? 'স্বাভাবিক স্ক্রিন করুন' : 'সম্পূর্ণ স্ক্রিন জুড়ে দেখুন'}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-[11px] font-bold">
                    {isFullscreen ? 'Exit' : 'Full'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onToggleAutoRefresh}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <RefreshCw className={`w-5 h-5 ${autoRefresh ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white">লাইভ অটো-রিফ্রেশ</div>
                      <div className="text-[11px] text-slate-500">
                        {autoRefresh ? 'চালু আছে (রিয়েল-টাইম সিঙ্ক)' : 'বন্ধ আছে'}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold ${
                      autoRefresh ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {autoRefresh ? 'ON' : 'OFF'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAutoUpdateEnabled(!autoUpdateEnabled)}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className={`w-5 h-5 ${autoUpdateEnabled ? 'text-cyan-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white">
                        অটো-আপডেট ইনস্টল
                      </div>
                      <div className="text-[11px] text-slate-500">
                        নতুন আপডেট এলে নিজে থেকেই ইনস্টল হবে
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold ${
                      autoUpdateEnabled ? 'bg-cyan-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {autoUpdateEnabled ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Database className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white">
                      অফলাইন ক্যাশ পরিষ্কার করুন
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      পুরোনো UI বা স্ট্যাটিক অ্যাসেট ক্যাশ পরিষ্কার করে অ্যাপকে হালকা ও ফ্রেশ করুন।
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleClearAppCaches()}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 cursor-pointer"
                >
                  ক্যাশ ক্লিয়ার করুন
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>মোট কাস্টম পোর্টাল: {toBengaliNumber(customPortals.length)} · ডিলিটেড: {toBengaliNumber(deletedIds.size)}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
