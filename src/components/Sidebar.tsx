import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  Users,
  UserPlus,
  Coins,
  PieChart,
  Monitor,
  FileSpreadsheet,
  Maximize2,
  Minimize2,
  QrCode,
  Download,
  Database,
  Building2,
  LogOut,
  X,
  Sparkles,
  Zap,
  Smartphone,
  UserCheck,
  Moon,
  Sun,
  Share2,
  Shield,
  Wrench,
  MessageCircle,
  Globe,
  Cpu,
  Lock,
  Settings,
  Type,
  ExternalLink,
  Trash2,
  Sliders
} from 'lucide-react';
import { Company, PortalControlConfig, Staff, UserSession } from '../types';
import type { OfflineSyncState } from '../services/offlineSync';
import { CloudSyncStatusIndicator } from './CloudSyncStatusIndicator';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  canUserAccessCustomPortal,
  canUserAccessPortal,
  isPortalDeletedByAdmin
} from '../utils/portalPermissions';
import { prefetchPortalModule } from '../utils/modulePrefetch';
import { getEffectiveTroubleshootPortalUrl } from '../utils/appUrls';
import { AppFontSize, getSavedAppFontSize, subscribeAppFontSize } from '../utils/fontScale';
import { renderCustomPortalIcon } from './PortalControlModal';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: UserSession;
  company?: Company | null;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  onOpenStaffQr: () => void;
  onOpenMonthlyPdf: () => void;
  onOpenBackup: () => void;
  onOpenCompanySetup: () => void;
  onOpenAddStaff: () => void;
  onOpenAppLinks: () => void;
  onOpenWhatsAppGroups?: () => void;
  pendingJoinRequestsCount?: number;
  onOpenAuditLog: () => void;
  onOpenSecurityDashboard?: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onLogout: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  hideDesktopPersistent?: boolean;
  offlineSyncState?: OfflineSyncState;
  onManualSync?: () => Promise<void> | void;
  staffs?: Staff[];
  onLockedNav?: (msg: string, portalId?: string, portalTitle?: string) => void;
  onOpenSettings?: () => void;
  onOpenDataPurge?: () => void;
  portalControl?: PortalControlConfig | null;
  onOpenPortalControl?: () => void;
  stats?: {
    txCount: number;
    staffCount: number;
    duesCount: number;
    netBalance: number;
    complaintsCount?: number;
    pendingComplaintsCount?: number;
    customersCount?: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  company,
  isFullScreen,
  onToggleFullScreen,
  onOpenStaffQr,
  onOpenMonthlyPdf,
  onOpenBackup,
  onOpenCompanySetup,
  onOpenAddStaff,
  onOpenAppLinks,
  onOpenWhatsAppGroups,
  pendingJoinRequestsCount = 0,
  onOpenAuditLog,
  onOpenSecurityDashboard,
  isDarkMode,
  onToggleDarkMode,
  onLogout,
  isOpenMobile,
  onCloseMobile,
  hideDesktopPersistent = false,
  offlineSyncState,
  onManualSync,
  staffs = [],
  onLockedNav,
  onOpenSettings,
  onOpenDataPurge,
  portalControl,
  onOpenPortalControl,
  stats
}) => {
  const { isInstalled, isInstallable, install } = usePWAInstall();
  const [appFontSize, setAppFontSizeState] = React.useState<AppFontSize>(() => getSavedAppFontSize());
  React.useEffect(() => subscribeAppFontSize((sz) => setAppFontSizeState(sz)), []);
  const fontSizeLabel = appFontSize === 'small' ? 'ছোট' : appFontSize === 'large' ? 'বড়' : 'মাঝারি';
  const troubleshootPortalUrl = getEffectiveTroubleshootPortalUrl(company);

  const isStaffRole = currentUser.role === 'staff';
  const isPartnerRole = currentUser.role === 'partner';
  const isDirectorRole = currentUser.role === 'director' || currentUser.role === 'admin';

  // Each option has its own distinct digital app logo gradient, icon, Bengali title, and subtitle
  const allNavBars = [
    {
      id: 'erp_hub',
      label: 'ERP কমান্ড হাব',
      subtitle: 'রেডিয়াল এন্টারপ্রাইজ সিস্টেম',
      icon: Cpu,
      badge: 'ERP',
      badgeColor: 'bg-cyan-300 text-slate-950 font-black',
      logoBg: 'from-cyan-400 via-sky-500 to-blue-700',
      activeGradient: 'from-cyan-600 via-blue-700 to-slate-900 border-cyan-300 shadow-cyan-950/60'
    },
    {
      id: 'dashboard',
      label: 'ডৈনিক ড্যাশবোর্ড',
      subtitle: 'লাইভ হিসাব ও সংক্ষিপ্ত চিত্র',
      icon: LayoutDashboard,
      badge: 'লাইভ',
      badgeColor: 'bg-emerald-400 text-slate-950',
      logoBg: 'from-emerald-400 via-teal-500 to-green-600',
      activeGradient: 'from-emerald-600 via-teal-600 to-emerald-800 border-emerald-300 shadow-emerald-950/60',
      hideForStaff: true,
      hideForPartner: true
    },
    {
      id: 'transactions',
      label: isStaffRole ? 'দৈনিক আয়-ব্যয় খাতা' : 'দৈনিক হিসাব খাতা',
      subtitle: 'দৈনিক এন্ট্রি ও তারিখ অনুযায়ী খাতা',
      icon: Receipt,
      badge: stats?.txCount !== undefined ? `${stats.txCount}টি` : isStaffRole ? 'দৈনিক' : undefined,
      badgeColor: 'bg-cyan-400 text-slate-950',
      logoBg: 'from-cyan-400 via-sky-500 to-blue-600',
      activeGradient: 'from-cyan-600 via-sky-700 to-blue-800 border-cyan-300 shadow-cyan-950/60'
    },
    {
      id: 'complaints',
      label: 'গ্রাহক অভিযোগ কেন্দ্র',
      subtitle: 'লাইন সমস্যা ও WhatsApp SMS',
      icon: Wrench,
      badge:
        stats?.pendingComplaintsCount !== undefined && stats.pendingComplaintsCount > 0
          ? `${stats.pendingComplaintsCount} বাকি`
          : stats?.complaintsCount !== undefined && stats.complaintsCount > 0
          ? `${stats.complaintsCount}টি`
          : undefined,
      badgeColor: 'bg-rose-500 text-white font-bold',
      logoBg: 'from-rose-400 via-red-500 to-orange-600',
      activeGradient: 'from-rose-600 via-red-700 to-orange-800 border-rose-300 shadow-rose-950/60',
      hideForPartner: true
    },
    {
      id: 'customers',
      label: 'গ্রাহক ও সদস্য তালিকা',
      subtitle: 'সদস্য সার্চ ও অটো-ফিল',
      icon: UserCheck,
      badge: stats?.customersCount !== undefined && stats.customersCount > 0 ? `${stats.customersCount}জন` : 'সদস্য',
      badgeColor: 'bg-teal-300 text-slate-950 font-black',
      logoBg: 'from-teal-400 via-emerald-500 to-cyan-600',
      activeGradient: 'from-teal-600 via-emerald-700 to-cyan-800 border-teal-300 shadow-teal-950/60',
      hideForPartner: true
    },
    {
      id: 'staff',
      label: 'স্টাফ তালিকা ও বেতন',
      subtitle: 'কর্মী ব্যবস্থাপনা ও জয়েনিং',
      icon: Users,
      badge: stats?.staffCount !== undefined ? `${stats.staffCount}জন` : undefined,
      badgeColor: 'bg-indigo-300 text-slate-950',
      logoBg: 'from-blue-400 via-indigo-500 to-violet-600',
      activeGradient: 'from-blue-600 via-indigo-700 to-violet-800 border-indigo-300 shadow-indigo-950/60',
      hideForStaff: true,
      hideForPartner: true
    },
    {
      id: 'quick_add_staff',
      label: 'নতুন স্টাফ নিয়োগ',
      subtitle: '১-ক্লিক নিয়োগ ও সিভি ফরম',
      icon: UserPlus,
      isAction: true,
      action: onOpenAddStaff,
      badge: '+ ফরম',
      badgeColor: 'bg-teal-300 text-slate-950 font-black',
      logoBg: 'from-teal-400 via-emerald-500 to-cyan-600',
      hideForStaff: true,
      hideForPartner: true
    },
    {
      id: 'dues',
      label: 'বাকি খাতা (লেজার)',
      subtitle: 'গ্রাহক বকেয়া ও বিল আদায়',
      icon: Coins,
      badge: stats?.duesCount !== undefined && stats.duesCount > 0 ? `${stats.duesCount} বাকি` : undefined,
      badgeColor: 'bg-amber-400 text-slate-950 font-bold',
      logoBg: 'from-amber-400 via-orange-500 to-yellow-600',
      activeGradient: 'from-amber-600 via-orange-700 to-red-800 border-amber-300 shadow-amber-950/60',
      hideForStaff: true,
      hideForPartner: true
    },
    {
      id: 'partners',
      label: isPartnerRole ? 'আমার শেয়ার পোর্টাল' : 'অংশীদার ও মূলধন',
      subtitle: 'বিনিয়োগ ও লাভ-লোকসান বণ্টন',
      icon: PieChart,
      badge: isPartnerRole ? 'শেয়ার' : undefined,
      badgeColor: 'bg-fuchsia-300 text-slate-950 font-bold',
      logoBg: 'from-purple-400 via-fuchsia-500 to-pink-600',
      activeGradient: 'from-purple-600 via-fuchsia-700 to-pink-800 border-purple-300 shadow-purple-950/60',
      directorOrPartnerOnly: true
    },
    {
      id: 'officers',
      label: 'ম্যানেজার ও অডিটর',
      subtitle: 'দায়িত্বপ্রাপ্ত কর্মকর্তা ও সিল',
      icon: UserCheck,
      badge: 'কর্মকর্তা',
      badgeColor: 'bg-yellow-300 text-slate-950 font-bold',
      logoBg: 'from-yellow-400 via-amber-500 to-orange-600',
      activeGradient: 'from-amber-700 via-yellow-700 to-orange-800 border-yellow-300 shadow-amber-950/60',
      hideForStaff: true,
      hideForPartner: true
    },
    {
      id: 'display',
      label: 'ডিজিটাল ডিসপ্লে বোর্ড',
      subtitle: isDirectorRole ? 'LED নোটিশ ও লাইভ স্ক্রিন' : 'লাইভ LED ডিসপ্লে (শুধু দেখুন)',
      icon: Monitor,
      badge: 'LED',
      badgeColor: 'bg-lime-400 text-slate-950 font-mono',
      logoBg: 'from-lime-400 via-green-500 to-emerald-600',
      activeGradient: 'from-lime-700 via-emerald-700 to-green-900 border-lime-300 shadow-emerald-950/60',
      hideForPartner: true
    },
    {
      id: 'reports',
      label: 'লাভ-ক্ষতি ও রিপোর্ট',
      subtitle: 'দৈনিক-মাসিক-মোট বার চার্ট ও PDF',
      icon: FileSpreadsheet,
      badge: 'চার্ট+PDF',
      badgeColor: 'bg-sky-300 text-slate-950 font-black',
      logoBg: 'from-sky-400 via-blue-500 to-indigo-600',
      activeGradient: 'from-sky-600 via-blue-700 to-indigo-800 border-sky-300 shadow-sky-950/60'
    },
    {
      id: 'playstore',
      label: 'প্লে স্টোর অ্যাপ সেন্টার',
      subtitle: 'অ্যাপ ইনস্টল, আপডেট ও লিঙ্ক',
      icon: Smartphone,
      badge: 'Store',
      badgeColor: 'bg-emerald-300 text-slate-950 font-black',
      logoBg: 'from-emerald-400 via-cyan-500 to-blue-500',
      activeGradient: 'from-emerald-700 via-teal-700 to-cyan-800 border-emerald-300 shadow-emerald-950/60',
      hideForStaff: true,
      isPlayStore: true
    }
  ];

  const navBars = allNavBars.filter((item) => {
    if (isPortalDeletedByAdmin(item.id, portalControl)) return false;
    if (item.directorOrPartnerOnly && !isDirectorRole && !isPartnerRole && !isStaffRole) return false;
    if (item.isAction && isStaffRole) return false;
    if (item.isAction && isPartnerRole) return false;
    if (isPartnerRole && item.hideForPartner) return false;
    return true;
  });

  const activeCustomPortals = (portalControl?.customPortals || []).filter((cp) =>
    canUserAccessCustomPortal(cp, currentUser)
  );

  const handleNavClick = (item: typeof navBars[0]) => {
    const isLocked =
      !item.isAction && !canUserAccessPortal(item.id, currentUser, staffs, { portalControl });
    if (isLocked) {
      onLockedNav?.(
        `🔒 "${item.label}" পোর্টালটি লক করা আছে — অনুমতির জন্য পরিচালকের সাথে যোগাযোগ করুন।`,
        item.id,
        item.label
      );
      if (isOpenMobile) onCloseMobile();
      return;
    }
    if (item.isAction && item.action) {
      item.action();
    } else {
      setActiveTab(item.id);
    }
    if (isOpenMobile) {
      onCloseMobile();
    }
  };

  const userInitial = currentUser.name ? currentUser.name.trim().charAt(0) : 'জ';

  const sidebarContent = (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#020a18] via-[#041b3d] to-[#020e21] text-cyan-50 select-none shadow-2xl">
      {/* Top Brand Header */}
      <div className="p-3.5 border-b border-cyan-400/25 flex items-center justify-between bg-gradient-to-r from-[#020e21] via-[#05234d] to-[#031630]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-white border-2 border-cyan-300/80 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-[0_0_16px_rgba(56,189,248,0.45)]">
            <img
              src={company?.logoUrl || '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg'}
              alt={company?.name || 'DIP BHOLA NETWORK'}
              className="w-full h-full object-contain rounded-lg"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (!img.dataset.fallback) {
                  img.dataset.fallback = '1';
                  img.src = '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg';
                }
              }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black tracking-wide text-white truncate uppercase">
                {company?.name || 'DIP BHOLA NETWORK'}
              </h2>
              <span className="inline-flex items-center px-1.5 py-0.2 rounded-md text-[10px] font-black bg-cyan-400 text-[#020a18] shadow-2xs">
                ERP
              </span>
            </div>
            <p className="text-xs text-cyan-200 font-semibold truncate">
              ডিজিটাল ERP মেন্যু ও কন্ট্রোল
            </p>
          </div>
        </div>

        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg text-cyan-200 hover:text-white hover:bg-cyan-500/20 transition-colors"
          title="মেন্যু বন্ধ করুন"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 no-scrollbar">
        {/* SECTION 1: প্রধান ডিজিটাল মডিউল (প্রতিটি অপশনের নিজস্ব লোগো ও নাম) */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-xs font-extrabold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              ERP মডিউল ও রেজিস্টার
            </span>
            <span className="text-[11px] text-cyan-300/80 font-bold">{navBars.length} অপশন</span>
          </div>

          <div className="space-y-1.5">
            {navBars.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isLocked =
                !item.isAction && !canUserAccessPortal(item.id, currentUser, staffs, { portalControl });

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item)}
                  onMouseEnter={() => {
                    if (!isLocked && !item.isAction) prefetchPortalModule(item.id);
                  }}
                  onTouchStart={() => {
                    if (!isLocked && !item.isAction) prefetchPortalModule(item.id);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2.5 rounded-2xl text-left transition-all ${
                    isLocked
                      ? 'bg-[#031227]/65 text-slate-400 border border-rose-400/30 opacity-75'
                      : isActive
                      ? `bg-gradient-to-r ${item.activeGradient || 'from-cyan-600 to-blue-700'} text-white shadow-lg border-2 border-cyan-300`
                      : 'bg-[#031632]/75 hover:bg-[#05234d] text-cyan-50 border border-cyan-400/20 hover:border-cyan-300/55'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Dedicated Colorful App Logo Icon per Option */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                        isLocked
                          ? 'bg-slate-800 text-rose-300 border border-rose-400/40'
                          : item.isPlayStore
                          ? 'bg-white border border-cyan-300'
                          : `bg-gradient-to-br ${item.logoBg} text-white`
                      }`}
                    >
                      {isLocked ? (
                        <Lock className="w-4 h-4 stroke-[2.3]" />
                      ) : item.isPlayStore ? (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                          <path d="M4 3.5V20.5L16.5 12L4 3.5Z" fill="#00C1A4" />
                          <path d="M4 3.5L13.5 12.8L16.5 12L4 3.5Z" fill="#00A0FF" />
                          <path d="M16.5 12L13.5 11.2L4 20.5L16.5 12Z" fill="#FF3333" />
                          <path d="M16.5 12L13.5 11.2L13.5 12.8L16.5 12Z" fill="#FFBA00" />
                        </svg>
                      ) : (
                        <Icon className="w-4 h-4 stroke-[2.3]" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-white truncate">{item.label}</div>
                      <div className="text-[11px] text-cyan-200/80 truncate">{item.subtitle}</div>
                    </div>
                  </div>

                  {isLocked ? (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-rose-500/25 border border-rose-400/50 text-rose-200 shrink-0 ml-1">
                      🔒 লক
                    </span>
                  ) : (
                    item.badge && (
                      <span
                        className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 ml-1 ${
                          isActive ? 'bg-white text-slate-950' : item.badgeColor || 'bg-emerald-500 text-slate-950'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 1.4: ডিরেক্টর-সংযুক্ত কাস্টম ওয়েব পোর্টাল (Add/Link Portals) */}
        {activeCustomPortals.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-emerald-300" />
                সংযুক্ত কাস্টম পোর্টাল ({activeCustomPortals.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {activeCustomPortals.map((cp) => {
                const customTabId = `custom:${cp.id}`;
                const isActive = activeTab === customTabId;
                if (cp.openMode === 'new_tab') {
                  return (
                    <a
                      key={cp.id}
                      href={cp.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        if (isOpenMobile) onCloseMobile();
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2.5 rounded-2xl text-left transition-all bg-[#031632]/75 hover:bg-[#05234d] text-cyan-50 border border-emerald-400/30 hover:border-emerald-300"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
                          {renderCustomPortalIcon(cp.iconName, 'w-4 h-4')}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-white truncate">{cp.shortLabel}</div>
                          <div className="text-[11px] text-emerald-200/80 truncate">{cp.title}</div>
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-300 shrink-0 ml-1" />
                    </a>
                  );
                }
                return (
                  <button
                    key={cp.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(customTabId);
                      if (isOpenMobile) onCloseMobile();
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2.5 rounded-2xl text-left transition-all cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg border-2 border-emerald-300'
                        : 'bg-[#031632]/75 hover:bg-[#05234d] text-cyan-50 border border-emerald-400/25 hover:border-emerald-300/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
                        {renderCustomPortalIcon(cp.iconName, 'w-4 h-4')}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-white truncate">{cp.shortLabel}</div>
                        <div className="text-[11px] text-cyan-200/80 truncate">{cp.title}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-400 text-slate-950 shrink-0 ml-1">
                      খুলুন
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 1.5: সংযুক্ত সমস্যা সমাধান ওয়েব পোর্টাল (ERP ডিসপ্লে থেকে সরিয়ে সাইডবারে) */}
        {!isPartnerRole && !isPortalDeletedByAdmin('troubleshoot_portal', portalControl) && (
          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-xs font-extrabold text-cyan-300 uppercase tracking-wider flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                সংযুক্ত সমস্যা সমাধান পোর্টাল
              </span>
            </div>
            <div className="space-y-2">
              {(() => {
                const locked = !canUserAccessPortal('troubleshoot_portal', currentUser, staffs, { portalControl });
                return (
                  <div
                    className={`rounded-2xl p-2.5 border transition-all space-y-2 ${
                      locked
                        ? 'bg-[#031227]/65 text-slate-400 border-rose-400/30 opacity-75'
                        : activeTab === 'troubleshoot_portal'
                        ? 'bg-gradient-to-br from-cyan-900/70 to-blue-950 text-white border-2 border-cyan-300 shadow-lg'
                        : 'bg-[#031632]/90 text-white border-cyan-400/35'
                    }`}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => {
                        if (!locked) prefetchPortalModule('troubleshoot_portal');
                      }}
                      onTouchStart={() => {
                        if (!locked) prefetchPortalModule('troubleshoot_portal');
                      }}
                      onClick={() => {
                        if (locked) {
                          onLockedNav?.(
                            '🔒 "সমস্যা অনুসন্ধান ও সমাধান পোর্টাল" লক করা আছে।',
                            'troubleshoot_portal',
                            'সমস্যা অনুসন্ধান ও সমাধান পোর্টাল'
                          );
                          if (isOpenMobile) onCloseMobile();
                          return;
                        }
                        setActiveTab('troubleshoot_portal');
                        if (isOpenMobile) onCloseMobile();
                      }}
                      className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md ${locked ? 'bg-slate-800 text-rose-300 border border-rose-400/40' : 'bg-gradient-to-br from-cyan-400 to-blue-600'}`}>
                          {locked ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4 text-white" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold truncate">সমস্যা সমাধান ও OLT</div>
                          <div className="text-[11px] text-cyan-200/85 truncate">OLT + Billing অটো-আপডেট মিক্সিং</div>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${locked ? 'bg-rose-500/25 border border-rose-400/50 text-rose-200' : 'bg-cyan-400 text-slate-950'}`}>
                        {locked ? '🔒 লক' : 'খুলুন'}
                      </span>
                    </button>

                    {!locked && (
                      <>
                        <a
                          href={troubleshootPortalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={troubleshootPortalUrl}
                          className="block text-[10px] font-mono text-cyan-300 hover:text-white underline truncate px-1"
                        >
                          {troubleshootPortalUrl}
                        </a>
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <a
                            href={troubleshootPortalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 min-w-[78px] px-2 py-1 rounded-lg bg-emerald-400/15 hover:bg-emerald-400/25 border border-emerald-400/45 text-emerald-200 text-[11px] font-bold flex items-center justify-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>নতুন ট্যাব</span>
                          </a>
                          {isDirectorRole && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenCompanySetup();
                                if (isOpenMobile) onCloseMobile();
                              }}
                              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-cyan-400/35 text-cyan-100 text-[11px] font-bold cursor-pointer"
                            >
                              বদলান
                            </button>
                          )}
                          {isDirectorRole && (
                            <button
                              type="button"
                              onClick={() => {
                                (onOpenDataPurge || onOpenCompanySetup)();
                                if (isOpenMobile) onCloseMobile();
                              }}
                              className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/50 text-rose-100 text-[11px] font-black flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>তথ্য মুছুন</span>
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* SECTION 1.8: সবার জন্য অ্যাপ সেটিংস (ফন্ট সাইজ Small/Medium/Large ও ডিসপ্লে) */}
        {onOpenSettings && (
          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[11px] font-extrabold text-sky-300 uppercase tracking-wider flex items-center gap-1">
                <Settings className="w-3.5 h-3.5 text-sky-400" />
                ব্যক্তিগত সেটিংস (সবার জন্য)
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                onOpenSettings();
                if (isOpenMobile) onCloseMobile();
              }}
              className="w-full flex items-center justify-between gap-2.5 px-2.5 py-2.5 rounded-2xl text-left transition-all bg-[#031632]/85 hover:bg-[#05234d] text-white border border-sky-400/40 shadow-sm cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center shrink-0 shadow-md">
                  <Type className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold truncate">অ্যাপ সেটিংস ও ফন্ট সাইজ</div>
                  <div className="text-[11px] text-cyan-200/85 truncate">ফন্ট (Small/Medium/Large) ও থিম</div>
                </div>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-cyan-400 text-slate-950 shrink-0">
                {fontSizeLabel}
              </span>
            </button>
          </div>
        )}

        {/* SECTION 2: কুইক ডিজিটাল টুলস ও অ্যাপ কন্ট্রোল (স্টাফের জন্য গোপন, অ্যাপ কন্ট্রোল শুধু এডমিন) */}
        {!isStaffRole && (
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-[11px] font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              {isDirectorRole ? 'অ্যাডমিন অ্যাপ কন্ট্রোল ও টুলস' : 'ডিজিটাল টুলস'}
            </span>
          </div>

          <div className="space-y-1.5">
            {isDirectorRole && !isInstalled && (
              <button
                onClick={async () => {
                  if (isInstallable) {
                    await install();
                  } else if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {});
                  }
                  if (isOpenMobile) onCloseMobile();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-2xl text-left transition-all bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 text-white border border-emerald-400/50"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0 shadow-md">
                  <Smartphone className="w-4 h-4 text-slate-950" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold truncate">অ্যাপ ইনস্টল (WebAPK)</div>
                  <div className="text-[10px] text-emerald-200/80 truncate">মোবাইল হোম স্ক্রিনে রাখুন</div>
                </div>
              </button>
            )}

            <button
              onClick={onToggleFullScreen}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-2xl text-left transition-all bg-white/5 hover:bg-white/10 text-emerald-50 border border-white/10"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-lime-400 to-emerald-500 flex items-center justify-center shrink-0 shadow-md">
                {isFullScreen ? (
                  <Maximize2 className="w-4 h-4 text-slate-950" />
                ) : (
                  <Minimize2 className="w-4 h-4 text-slate-950" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate">
                  {isFullScreen ? 'প্যাড হেডার দেখান' : 'ফুল স্ক্রিন ভিউ'}
                </div>
                <div className="text-[10px] text-emerald-200/75 truncate">টপবার লুকান বা দেখান</div>
              </div>
            </button>

            <button
              onClick={onToggleDarkMode}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-2xl text-left transition-all bg-white/5 hover:bg-white/10 text-emerald-50 border border-white/10"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 flex items-center justify-center shrink-0 shadow-md">
                {isDarkMode ? (
                  <Sun className="w-4 h-4 text-slate-950" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-950" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate">
                  {isDarkMode ? 'লাইট মোড চালু করুন' : 'নাইট ভিউ (ডার্ক মোড)'}
                </div>
                <div className="text-[10px] text-emerald-200/75 truncate">স্ক্রিন থিম পরিবর্তন</div>
              </div>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-white/15 text-amber-200">
                {isDarkMode ? 'ON' : 'OFF'}
              </span>
            </button>

            {currentUser.role !== 'partner' && (
              <button
                onClick={() => {
                  onOpenMonthlyPdf();
                  if (isOpenMobile) onCloseMobile();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-2xl text-left transition-all bg-white/5 hover:bg-white/10 text-emerald-50 border border-amber-400/40"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shrink-0 shadow-md">
                  <Download className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold truncate">PDF প্রিন্ট ও কালার স্টুডিও</div>
                  <div className="text-[10px] text-emerald-200/80 truncate">সাইজ, কালার পরিবর্তন ও সেভ</div>
                </div>
              </button>
            )}

            {isDirectorRole && (
              <>
                {onOpenPortalControl && (
                  <button
                    onClick={() => {
                      onOpenPortalControl();
                      if (isOpenMobile) onCloseMobile();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-2xl text-left transition-all bg-indigo-500/20 hover:bg-indigo-500/35 text-white border border-indigo-400/60 cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-cyan-500 flex items-center justify-center shrink-0 shadow-md">
                      <Sliders className="w-4 h-4 text-slate-950" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black truncate">অ্যাপ ও পোর্টাল ফুল কন্ট্রোল</div>
                      <div className="text-[10px] text-cyan-200/85 truncate">পোর্টাল ডিলিট, নতুন লিংক এড ও রিমোট আপডেট</div>
                    </div>
                  </button>
                )}

                {onOpenWhatsAppGroups && (
                  <button
                    onClick={() => {
                      onOpenWhatsAppGroups();
                      if (isOpenMobile) onCloseMobile();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-2xl text-left transition-all bg-white/5 hover:bg-white/10 text-emerald-50 border border-[#25D366]/40"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#25D366] flex items-center justify-center shrink-0 shadow-md">
                      <MessageCircle className="w-4 h-4 text-slate-950" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-extrabold truncate">WhatsApp গ্রুপ ও ইনভাইট</div>
                      <div className="text-[10px] text-emerald-200/80 truncate">স্টাফ ও পার্টনার জয়েনিং</div>
                    </div>
                    {pendingJoinRequestsCount > 0 && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-rose-600 text-white">
                        {pendingJoinRequestsCount}
                      </span>
                    )}
                  </button>
                )}

                <button
                  onClick={() => {
                    onOpenAppLinks();
                    if (isOpenMobile) onCloseMobile();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-2xl text-left transition-all bg-white/5 hover:bg-white/10 text-emerald-50 border border-white/10"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shrink-0 shadow-md">
                    <Share2 className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate">অ্যাপ লিঙ্ক শেয়ার</div>
                    <div className="text-[10px] text-emerald-200/75 truncate">Play Store ও পোর্টাল লিঙ্ক</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onOpenStaffQr();
                    if (isOpenMobile) onCloseMobile();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-2xl text-left transition-all bg-white/5 hover:bg-white/10 text-emerald-50 border border-white/10"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-600 flex items-center justify-center shrink-0 shadow-md">
                    <QrCode className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate">স্টাফ QR ও ID কার্ড</div>
                    <div className="text-[10px] text-emerald-200/75 truncate">ভেরিফিকেশন কার্ড প্রিন্ট</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    if (onOpenSecurityDashboard) onOpenSecurityDashboard();
                    else onOpenAuditLog();
                    if (isOpenMobile) onCloseMobile();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-2xl text-left transition-all bg-white/5 hover:bg-white/10 text-emerald-50 border border-white/10"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate">নিরাপত্তা ও অডিট লগ</div>
                    <div className="text-[10px] text-emerald-200/75 truncate">অ্যাক্টিভিটি ও পিন সুরক্ষা</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onOpenBackup();
                    if (isOpenMobile) onCloseMobile();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-2xl text-left transition-all bg-white/5 hover:bg-white/10 text-emerald-50 border border-white/10"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
                    <Database className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate">ক্লাউড ব্যাকআপ ও ড্রাইভ</div>
                    <div className="text-[10px] text-emerald-200/75 truncate">তথ্য সংরক্ষণ ও রিস্টোর</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onOpenCompanySetup();
                    if (isOpenMobile) onCloseMobile();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-2xl text-left transition-all bg-white/5 hover:bg-white/10 text-emerald-50 border border-white/10"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shrink-0 shadow-md">
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate">কোম্পানি ও প্যাড সেটআপ</div>
                    <div className="text-[10px] text-emerald-200/75 truncate">নাম, লোগো ও ঠিকানা</div>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>
        )}
      </div>

      {/* SECTION 3 (Bottom): পারসিসটেন্ট ক্লাউড সিঙ্ক স্ট্যাটাস, ইউজার প্রোফাইল ও লগআউট */}
      <div className="p-3 border-t border-cyan-400/25 bg-[#020c1e] space-y-2 shrink-0">
        <CloudSyncStatusIndicator
          offlineSyncState={offlineSyncState}
          onManualSync={onManualSync}
        />

        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-gradient-to-r from-[#031632] to-[#05234d] border border-cyan-400/40 shadow-xs">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-sky-500 text-slate-950 font-black flex items-center justify-center text-xs shrink-0 border border-white/70 shadow-2xs">
            {userInitial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-white truncate leading-tight">{currentUser.name}</div>
            <div className="text-[11px] text-cyan-300 font-semibold truncate leading-tight">
              {currentUser.role === 'admin' ? 'পরিচালক / এডমিন' : currentUser.designation}
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white shadow-sm"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>লগআউট / অ্যাকাউন্ট বদলান</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Left Sidebar (Hidden when ERP System is active to avoid duplicate menu) */}
      {!hideDesktopPersistent && (
        <aside className="hidden lg:flex w-72 lg:w-76 xl:w-80 shrink-0 h-screen sticky top-0 border-r border-cyan-400/25 z-30 shadow-xl">
          {sidebarContent}
        </aside>
      )}

      {/* Mobile / Quick Menu Drawer Overlay (Works on ALL screens when triggered!) */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-80 max-w-[86vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
