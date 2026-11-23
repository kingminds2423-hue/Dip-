import React, { useState } from 'react';
import {
  Download,
  Share2,
  Check,
  Copy,
  Star,
  ShieldCheck,
  Smartphone,
  ExternalLink,
  Info,
  ChevronRight,
  ArrowLeft,
  Search,
  HelpCircle,
  Sparkles,
  QrCode,
  Layers,
  CheckCircle2,
  MessageCircle,
  Globe,
  RefreshCw,
  FileDown,
  Sliders
} from 'lucide-react';
import { Company, Staff, Partner, UserSession } from '../types';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useAppUpdate } from '../hooks/useAppUpdate';
import { toBengaliNumber } from '../utils/formatters';
import { getGooglePlayStoreUrl, buildWhatsAppUrl, shareOrCopyAppLink } from '../utils/appUrls';
import { generateQrDataUrl } from '../services/sharedReportService';

interface PlayStoreAppViewProps {
  company: Company | null;
  staffs: Staff[];
  partners?: Partner[];
  currentUser?: UserSession | null;
  onOpenDashboard: () => void;
  onOpenLogin?: () => void;
  onOpenRoleTarget?: (target: 'dashboard' | 'transactions' | 'partners') => void;
  onOpenPortalControl?: () => void;
}

export const PlayStoreAppView: React.FC<PlayStoreAppViewProps> = ({
  company,
  staffs,
  partners = [],
  currentUser,
  onOpenDashboard,
  onOpenLogin,
  onOpenRoleTarget,
  onOpenPortalControl
}) => {
  const { isInstalled, isInstallable, isIOS, install } = usePWAInstall();
  const {
    currentVersion,
    currentBuildId,
    updateAvailable,
    isChecking,
    checkStatusMessage,
    autoUpdateEnabled,
    setAutoUpdateEnabled,
    openUpdateModal,
    triggerManualCheck
  } = useAppUpdate();

  // Detect URL role/partner/staff parameter
  const initialRoleFromUrl = (() => {
    if (typeof window === 'undefined') return 'all';
    const params = new URLSearchParams(window.location.search);
    const r = params.get('role');
    if (r === 'admin' || r === 'director') return 'admin';
    if (r === 'staff' || params.get('staff') || params.get('staffId')) return 'staff';
    if (r === 'partner' || params.get('partner') || params.get('partnerId')) return 'partner';
    return 'all';
  })();

  const [selectedLinkRole, setSelectedLinkRole] = useState<'all' | 'admin' | 'staff' | 'partner'>(initialRoleFromUrl);
  const [copiedLink, setCopiedLink] = useState<'playstore' | 'direct' | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installGuideMessage, setInstallGuideMessage] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string>('');

  // Single Unified Official Published Google Play Store Download & Install App URL (identical everywhere)
  const playStoreAppUrl = getGooglePlayStoreUrl();

  React.useEffect(() => {
    let active = true;
    generateQrDataUrl(playStoreAppUrl, { width: 300 }).then((dataUrl) => {
      if (active && dataUrl) setQrImageUrl(dataUrl);
    });
    return () => {
      active = false;
    };
  }, [playStoreAppUrl]);

  const roleBadgeLabel =
    selectedLinkRole === 'admin'
      ? 'Admin App (Google Play Store Same Link)'
      : selectedLinkRole === 'staff'
      ? 'Staff (স্টাফ / টেকনিশিয়ান)'
      : selectedLinkRole === 'partner'
      ? 'Share Partner (শেয়ার পার্টনার)'
      : 'Admin ও সবার জন্য (Google Play Store)';

  const isAdminOrManager = Boolean(
    currentUser && (currentUser.role === 'director' || currentUser.role === 'admin' || currentUser.role === 'manager')
  );

  const handleOpenWebApp = () => {
    if (!currentUser) {
      if (onOpenLogin) {
        onOpenLogin();
      } else {
        onOpenDashboard();
      }
      return;
    }
    if (currentUser.role === 'staff') {
      if (onOpenRoleTarget) {
        onOpenRoleTarget('transactions');
      } else {
        onOpenDashboard();
      }
      return;
    }
    if (currentUser.role === 'partner') {
      if (onOpenRoleTarget) {
        onOpenRoleTarget('partners');
      } else {
        onOpenDashboard();
      }
      return;
    }
    if (onOpenRoleTarget) {
      if (selectedLinkRole === 'partner') {
        onOpenRoleTarget('partners');
        return;
      }
      if (selectedLinkRole === 'staff') {
        onOpenRoleTarget('transactions');
        return;
      }
    }
    onOpenDashboard();
  };

  const companyName = company?.name || 'DIP BHOLA NETWORK';
  const ownerName = company?.ownerName || 'জাহিদুল ইসলাম';
  const logoUrl = company?.logoUrl || '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg';
  const appLauncherIcon = '/icon-192.png';

  const handleCopy = (urlToCopy: string, key: 'playstore' | 'direct') => {
    navigator.clipboard.writeText(urlToCopy);
    setCopiedLink(key);
    setTimeout(() => setCopiedLink(null), 3000);
  };

  const handleInstallClick = async () => {
    setInstallGuideMessage(null);
    setIsInstalling(true);
    try {
      if (isInstallable) {
        const accepted = await install();
        if (accepted) {
          setInstallGuideMessage('অভিনন্দন! অ্যাপটি সফলভাবে আপনার ডিভাইসে ইনস্টল হয়েছে।');
          return;
        }
      }
      if (isInstalled) {
        setInstallGuideMessage('এই অ্যাপটি ইতোমধ্যেই আপনার ডিভাইসে ইনস্টল করা আছে।');
      } else if (isIOS) {
        setInstallGuideMessage('আইফোনে ইনস্টল করতে Safari-র নিচের Share (↑) বাটনে চাপুন এবং "Add to Home Screen" নির্বাচন করুন।');
      } else {
        setInstallGuideMessage('অ্যাপ ইনস্টল করতে ব্রাউজারের ডানদিকের ৩-ডট (⋮) মেন্যু থেকে "Install app" বা "Add to Home screen" চাপুন অথবা নিচের "অ্যাপ ফাইল ডাউনলোড" ব্যবহার করুন।');
      }
    } finally {
      setIsInstalling(false);
    }
  };

  const shareViaWhatsApp = async () => {
    const msg = `আসসালামু আলাইকুম,\n${companyName}-এর (${roleBadgeLabel}) অফিসিয়াল Google Play Store অ্যাপ ডাউনলোড ও ইনস্টল লিঙ্ক:\n${playStoreAppUrl}\n\nলিংকটিতে ক্লিক করে সরাসরি "Install App" বাটনে চেপে মোবাইলের হোমস্ক্রিনে ইনস্টল করুন।`;
    const url = buildWhatsAppUrl(msg);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleNativeShare = async () => {
    const result = await shareOrCopyAppLink(
      `${companyName} - ${roleBadgeLabel}`,
      `${companyName} অফিসিয়াল অ্যাপ ডাউনলোড ও ইনস্টল লিঙ্ক`,
      playStoreAppUrl
    );
    if (result === 'copied') {
      setCopiedLink('playstore');
      setTimeout(() => setCopiedLink(null), 3000);
    }
  };

  const handleDownloadShortcutLauncher = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="refresh" content="0;url=${playStoreAppUrl}" />
  <title>${companyName} - App Launcher</title>
</head>
<body style="font-family:sans-serif;text-align:center;padding:40px;background:#022c22;color:#fff;">
  <h2>${companyName}</h2>
  <p>Google Play Store স্টাইল অ্যাপ ওপেন হচ্ছে... স্বয়ংক্রিয়ভাবে না খুললে নিচের বাটনে ক্লিক করুন:</p>
  <a href="${playStoreAppUrl}" style="display:inline-block;padding:12px 24px;background:#01875f;color:#fff;font-weight:bold;border-radius:10px;text-decoration:none;">Download & Install App</a>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${companyName.replace(/\s+/g, '_')}_App_Installer.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-16">
      {/* Google Play Store Top Bar */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenDashboard}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="ড্যাশবোর্ডে ফিরে যান"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Google Play Brand Mark */}
          <div className="flex items-center gap-2 select-none">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
              <path d="M4 3.5V20.5L16.5 12L4 3.5Z" fill="#00C1A4" />
              <path d="M4 3.5L13.5 12.8L16.5 12L4 3.5Z" fill="#00A0FF" />
              <path d="M16.5 12L13.5 11.2L4 20.5L16.5 12Z" fill="#FF3333" />
              <path d="M16.5 12L13.5 11.2L13.5 12.8L16.5 12Z" fill="#FFBA00" />
            </svg>
            <span className="text-base sm:text-lg font-black tracking-tight text-slate-800 dark:text-white flex items-center gap-1">
              Google <span className="text-emerald-600 font-bold">Play</span>
            </span>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleOpenWebApp}
            className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
          >
            <span>{!currentUser ? 'Google দিয়ে লগইন করুন' : currentUser.role === 'staff' || currentUser.role === 'partner' ? 'আমার পেজে যান' : 'ড্যাশবোর্ড খুলুন'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
            {(currentUser?.name || ownerName).substring(0, 1)}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* App Hero Section (Google Play Style) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
            {/* App Icon (Matches Installed Phone Home Screen DB Icon) */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#020c1b] p-0.5 shadow-xl border-2 border-cyan-400 dark:border-cyan-500 shrink-0 overflow-hidden flex items-center justify-center">
              <img
                src={appLauncherIcon}
                alt={companyName}
                className="w-full h-full object-cover rounded-[20px]"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = logoUrl;
                }}
              />
            </div>

            {/* App Metadata */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span>যাচাইকৃত অফিসিয়াল অ্যাপ • প্লে প্রটেক্ট ভেরিফাইড</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                {companyName}
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-300 mt-1">
                {company?.subTitle || 'কেন্দ্রীয় দৈনিক আয়-ব্যয় হিসাব ও স্টাফ মনিটরিং ব্যবস্থা'}
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                <span className="font-medium">ব্যবসা ও অর্থায়ন</span>
                <span>•</span>
                <span>বিজ্ঞাপনমুক্ত</span>
                <span>•</span>
                <span>ইন-অ্যাপ কেনাকাটা নেই</span>
              </div>
            </div>
          </div>

          {/* Play Store Rating & Download Badges */}
          <div className="grid grid-cols-4 divide-x divide-slate-200 dark:divide-slate-800 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <div className="px-1 sm:px-3">
              <div className="flex items-center justify-center gap-1 text-sm sm:text-base font-black text-slate-900 dark:text-white">
                <span>৪.৯</span>
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">১.২K পর্যালোচনা</p>
            </div>

            <div className="px-1 sm:px-3">
              <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white">৫K+</div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">ডাউনলোড</p>
            </div>

            <div className="px-1 sm:px-3">
              <div className="w-6 h-6 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs flex items-center justify-center mx-auto">
                ৩+
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">সকলের জন্য</p>
            </div>

            <div className="px-1 sm:px-3">
              <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white">৪.৮ MB</div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">সাইজ</p>
            </div>
          </div>

          {/* Action Buttons: Big Green Install Button */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={handleInstallClick}
              disabled={isInstalling}
              className="flex-1 py-3.5 px-6 rounded-2xl bg-[#01875f] hover:bg-[#01704f] active:scale-98 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20 transition-all cursor-pointer"
            >
              <Download className="w-5 h-5 stroke-[2.5]" />
              <span>{isInstalled ? 'ইতোমধ্যে ইনস্টল করা হয়েছে (পুনরায় ইনস্টল)' : 'ইনস্টল করুন (Install App)'}</span>
            </button>

            <button
              onClick={handleOpenWebApp}
              className="py-3.5 px-6 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm sm:text-base flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-700 transition-colors"
            >
              <span>{!currentUser ? 'Google দিয়ে লগইন' : currentUser.role === 'staff' || currentUser.role === 'partner' ? 'আমার পেজ খুলুন' : 'ওয়েব অ্যাপ খুলুন'}</span>
              <ExternalLink className="w-4 h-4" />
            </button>

            <button
              onClick={handleDownloadShortcutLauncher}
              className="py-3.5 px-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border border-emerald-300 dark:border-emerald-700 transition-colors cursor-pointer"
              title="কম্পিউটার বা মোবাইলের জন্য ডাউনলোডযোগ্য অ্যাপ শর্টকাট ফাইল (.html)"
            >
              <FileDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>অ্যাপ ফাইল ডাউনলোড</span>
            </button>

            <button
              onClick={() => setShowQr(!showQr)}
              className="py-3.5 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm flex items-center justify-center gap-1.5 border border-slate-300 dark:border-slate-700 transition-colors"
              title="মোবাইলে স্ক্যান করে ইনস্টল করার QR কোড"
            >
              <QrCode className="w-5 h-5 text-emerald-600" />
              <span className="hidden sm:inline">QR স্ক্যান</span>
            </button>
          </div>

          {installGuideMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{installGuideMessage}</span>
            </div>
          )}

          {typeof window !== 'undefined' &&
            (window.self !== window.top || window.location.origin.includes('ais-dev-')) && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-xs text-amber-950 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="leading-relaxed">
                  <strong>ইনস্টল সমস্যা সমাধান (Important):</strong> প্রিভিউ ফ্রেম (<code className="font-mono">iframe</code>) অথবা Publish-বিহীন লিংক থেকে Chrome-এর <em>&ldquo;Install app&rdquo;</em> কাজ না করে <strong>&ldquo;R - This app cannot be installed&rdquo;</strong> দেখাতে পারে। ডানপাশের বাটনে চেপে সরাসরি <strong>Chrome নতুন ট্যাবে</strong> ওপেন করে মেনু (⋮) থেকে <strong>&ldquo;Install app&rdquo;</strong> চাপুন।
                </div>
                <a
                  href={`${window.location.origin}/?portal=playstore`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs whitespace-nowrap text-center shrink-0 shadow-xs"
                >
                  Chrome-এ ওপেন ও ইনস্টল করুন ↗
                </a>
              </div>
            )}

          {/* QR Code Expansion */}
          {showQr && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-300 dark:border-emerald-800 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
              <div className="text-center sm:text-left">
                <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  মোবাইল ক্যামেরা দিয়ে স্ক্যান করে সরাসরি Google Play পেজ থেকে ইনস্টল করুন
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  যেকোনো অ্যান্ড্রয়েড বা আইফোনের ক্যামেরা অ্যাপ অন করে নিচের QR কোডটি স্ক্যান করলে Google Play Store স্টাইল ডাউনলোড ও ইনস্টল পেজ সরাসরি ওপেন হবে।
                </p>
              </div>
              <div className="w-36 h-36 bg-white p-2 rounded-xl shadow-md border border-slate-200 shrink-0">
                <img src={qrImageUrl} alt="QR Code" className="w-full h-full object-contain" />
              </div>
            </div>
          )}
        </div>

        {/* Unified Google Play Store Download & Install App Link Card */}
        <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-teal-950 rounded-3xl p-6 text-white shadow-md border border-emerald-700/60 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  Download App &amp; Install App Link · {roleBadgeLabel}
                </h3>
                <p className="text-xs text-emerald-200">
                  Admin, Staff বা Share Partner বেছে নিন—নিচের লিঙ্কটি ডাউনলোড এবং ইনস্টল লিঙ্ক হিসেবে কাজ করে।
                </p>
              </div>
            </div>
            {isAdminOrManager && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {staffs.length} স্টাফ · {partners.length} পার্টনার
              </span>
            )}
          </div>

          {/* Role Selector Pills (Visible ONLY to Director/Manager so Staff/Unauthenticated users don't see Admin/Partner links) */}
          {isAdminOrManager && (
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: 'all', label: 'Universal Play Store' },
                { id: 'admin', label: 'Admin' },
                { id: 'staff', label: 'Staff' },
                { id: 'partner', label: 'Share Partner' },
              ].map((roleBtn) => (
                <button
                  key={roleBtn.id}
                  type="button"
                  onClick={() => setSelectedLinkRole(roleBtn.id as 'all' | 'admin' | 'staff' | 'partner')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    selectedLinkRole === roleBtn.id
                      ? 'bg-emerald-400 text-slate-950 shadow-xs'
                      : 'bg-white/10 hover:bg-white/20 text-emerald-100 border border-white/15'
                  }`}
                >
                  {roleBtn.label}
                </button>
              ))}
            </div>
          )}

          {/* Primary Google Play URL Display and Copy */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 bg-black/40 rounded-2xl border border-white/10">
            <input
              type="text"
              readOnly
              value={playStoreAppUrl}
              className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm font-mono text-emerald-300 truncate focus:outline-hidden select-all"
            />
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleCopy(playStoreAppUrl, 'playstore')}
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-transform active:scale-95"
              >
                {copiedLink === 'playstore' ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink === 'playstore' ? 'কপি হয়েছে!' : 'লিঙ্ক কপি করুন'}</span>
              </button>

              <button
                onClick={shareViaWhatsApp}
                className="px-3.5 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-transform active:scale-95"
                title="হোয়াটসঅ্যাপে পাঠান"
              >
                <MessageCircle className="w-4 h-4 fill-slate-950 text-slate-950" />
                <span>WhatsApp</span>
              </button>

              <button
                onClick={handleNativeShare}
                className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/20 shadow-sm transition-transform active:scale-95"
                title="মেসেঞ্জার, ইমো বা অন্য অ্যাপে শেয়ার করুন"
              >
                <Share2 className="w-4 h-4" />
                <span>শেয়ার</span>
              </button>
            </div>
          </div>

          <p className="text-[11px] text-amber-200/95 bg-amber-950/50 border border-amber-400/30 rounded-xl px-3 py-2">
            <strong>টিপস:</strong> স্টাফদের কখনোই ব্রাউজারের উপরের <code className="font-mono">aistudio.google.com</code> বা <code className="font-mono">ais-dev-</code> লিঙ্ক শেয়ার করবেন না—তাহলে &ldquo;Page not found&rdquo; আসবে। সবসময় উপরের বাটন থেকে কপি/WhatsApp করে পাবলিক <code className="font-mono">ais-pre-...run.app</code> লিঙ্ক পাঠান।
          </p>

          {/* Unified Download & Install Confirmation Line (Same Link) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-emerald-200/90 pt-1">
            <span className="truncate font-mono">Download ও Install (একই Google Play লিংক): {playStoreAppUrl}</span>
            <button
              onClick={() => handleCopy(playStoreAppUrl, 'direct')}
              className="text-emerald-300 hover:text-white font-bold underline self-start sm:self-auto shrink-0"
            >
              {copiedLink === 'direct' ? 'লিংক কপি হয়েছে!' : 'Download & Install লিঙ্ক কপি'}
            </button>
          </div>
        </div>

        {/* Google Play Store Auto-Update System Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Google Play অটো-আপডেট সিস্টেম (Auto-Update Enabled)
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                    স্বক্রিয়
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  এখানে অ্যাপে কোনো নতুন ফিচার বা কোড আপডেট করা হলে, ইনস্টল করা অ্যাপ স্বয়ংক্রিয়ভাবে নোটিফিকেশন পাঠাবে।
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => triggerManualCheck()}
                disabled={isChecking}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isChecking ? 'animate-spin' : ''}`} />
                <span>{isChecking ? 'চেক হচ্ছে...' : 'আপডেট চেক করুন'}</span>
              </button>

              <button
                onClick={() => openUpdateModal()}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-transform active:scale-95"
              >
                <span>{updateAvailable ? 'আপডেট ইনস্টল করুন' : 'আপডেট ও ইনস্টল সেন্টার'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {checkStatusMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{checkStatusMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
              <span className="text-[11px] text-slate-400 block">ইনস্টল করা ভার্সন:</span>
              <strong className="text-slate-800 dark:text-slate-200 text-sm font-mono">
                v{currentVersion} ({updateAvailable ? 'আপডেট এসেছে' : 'লেটেস্ট'})
              </strong>
              <span className="block text-[10px] font-mono text-slate-400 truncate mt-0.5">{currentBuildId}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
              <div>
                <span className="text-[11px] text-slate-400 block">অটো-আপডেট পলিসি:</span>
                <strong className="text-slate-800 dark:text-slate-200 text-sm">
                  {autoUpdateEnabled ? 'স্বয়ংক্রিয় চালু' : 'ম্যানুয়াল'}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => setAutoUpdateEnabled(!autoUpdateEnabled)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                  autoUpdateEnabled
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {autoUpdateEnabled ? 'চালু' : 'বন্ধ'}
              </button>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
              <span className="text-[11px] text-slate-400 block">আপডেট মেকানিজম:</span>
              <strong className="text-emerald-600 dark:text-emerald-400 text-sm">রিয়েল-টাইম + ১-ক্লিক সিঙ্ক</strong>
            </div>
          </div>

          {isAdminOrManager && onOpenPortalControl && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4" />
                  <span>অ্যাপস ফুল কন্ট্রোল (পোর্টাল ডিলিট / নতুন লিংক এড)</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  ইনস্টল অ্যাপের ভেতর থেকেই যেকোনো পোর্টাল ডিলিট, লক, রিস্টোর বা নতুন কাস্টম পোর্টাল লিংক করুন।
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenPortalControl}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>অ্যাপ ও পোর্টাল কন্ট্রোল খুলুন</span>
              </button>
            </div>
          )}
        </div>

        {/* Screenshots Showcase Carousel */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>অ্যাপের স্ক্রিনশট ও কার্যক্রম (Preview)</span>
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">৪টি স্ক্রিনশট</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3 hover:border-emerald-400 transition-colors">
              <div className="h-44 rounded-xl bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-slate-900 p-3 flex flex-col justify-between text-white border border-emerald-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950">
                    ড্যাশবোর্ড
                  </span>
                  <span className="text-xs font-mono">লাইভ</span>
                </div>
                <div>
                  <div className="text-lg font-black">দৈনিক আয়-ব্যয়</div>
                  <p className="text-[11px] text-emerald-200 mt-0.5">
                    আজকের খরচ, মাসিক লাভ ও ক্যাশ ইন হ্যান্ড
                  </p>
                </div>
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                ১. কেন্দ্রীয় হিসাব ড্যাশবোর্ড
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3 hover:border-emerald-400 transition-colors">
              <div className="h-44 rounded-xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-slate-900 p-3 flex flex-col justify-between text-white border border-indigo-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500 text-white">
                    স্টাফ মোড
                  </span>
                  <span className="text-xs font-mono">৪-ডিজিট পিন</span>
                </div>
                <div>
                  <div className="text-lg font-black">ফিল্ড এন্ট্রি</div>
                  <p className="text-[11px] text-indigo-200 mt-0.5">
                    যাতায়াত ও লাইন মেরামতের ভাউচার
                  </p>
                </div>
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                ২. টেকনিশিয়ান দ্রুত খরচ এন্ট্রি
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3 hover:border-emerald-400 transition-colors">
              <div className="h-44 rounded-xl bg-gradient-to-br from-rose-500/20 via-orange-500/20 to-slate-900 p-3 flex flex-col justify-between text-white border border-rose-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">
                    সাপোর্ট টিকিট
                  </span>
                  <span className="text-xs font-mono">লাইভ</span>
                </div>
                <div>
                  <div className="text-lg font-black">গ্রাহক অভিযোগ</div>
                  <p className="text-[11px] text-rose-200 mt-0.5">
                    ফাইবার সমস্যা ও সমাধান ট্র্যাকিং
                  </p>
                </div>
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                ৩. গ্রাহক কমপ্লেইন মনিটরিং
              </div>
            </div>

            {/* Card 4 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3 hover:border-emerald-400 transition-colors">
              <div className="h-44 rounded-xl bg-gradient-to-br from-teal-500/20 via-cyan-500/20 to-slate-900 p-3 flex flex-col justify-between text-white border border-teal-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500 text-slate-950">
                    ডিজিটাল টিভি
                  </span>
                  <span className="text-xs font-mono">২৪/৭</span>
                </div>
                <div>
                  <div className="text-lg font-black">ডিজিটাল নোটিশ</div>
                  <p className="text-[11px] text-teal-200 mt-0.5">
                    ঘড়িসহ ফুলস্ক্রিন ডিসপ্লে বোর্ড
                  </p>
                </div>
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                ৪. সেন্ট্রাল ডিজিটাল ডিসপ্লে বোর্ড
              </div>
            </div>
          </div>
        </div>

        {/* About this app (Google Play standard section) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              এই অ্যাপ সম্পর্কে (About this app)
            </h3>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <strong>DIP BHOLA NETWORK</strong> এর অফিসিয়াল হিসাব খাতা ও স্টাফ মনিটরিং অ্যাপ্লিকেশন। এটি ইন্টারনেট সার্ভিস প্রভাইডার (ISP), ক্যাবল নেটওয়ার্ক এবং ফিল্ড টেকনিশিয়ানদের দৈনন্দিন যাতায়াত খরচ, গ্রাহক লাইন সমস্যা, পার্টনার মূলধন এবং কেন্দ্রীয় ক্যাশ ইন হ্যান্ড হিসাব নিখুঁতভাবে সংরক্ষণ ও পরিচালনা করার জন্য তৈরি।
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span className="text-xs text-slate-700 dark:text-slate-300">
                দৈনিক ও মাসিক আয়-ব্যয়ের রিয়েল-টাইম ক্লাউড সিঙ্ক
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span className="text-xs text-slate-700 dark:text-slate-300">
                যেকোনো নির্দিষ্ট তারিখ বা রেঞ্জ সার্চ করে মুহূর্তেই হিসাব বের করার সুবিধা
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span className="text-xs text-slate-700 dark:text-slate-300">
                স্টাফ ও টেকনিশিয়ানদের ৪-ডিজিট পিন দিয়ে সরাসরি দ্রুত এন্ট্রি
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span className="text-xs text-slate-700 dark:text-slate-300">
                দৈনিক আর্থিক ভাউচার ও স্টাফ নিয়োগপত্র ১ ক্লিকে প্রিন্ট
              </span>
            </div>
          </div>

          {/* App Info Table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">সংস্করণ (Version)</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{currentVersion}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">আপডেট তারিখ</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">নভেম্বর ২০২৬</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">ডাউনলোড সাইজ</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">৪.৮ মেগাবাইট</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">ডেভেলপার</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{companyName}</span>
            </div>
          </div>
        </div>

        {/* Data Safety (Google Play Standard) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              ডেটা নিরাপত্তা (Data safety)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Google Play Protect দ্বারা সম্পূর্ণ সুরক্ষিত। আপনার প্রতিষ্ঠানের আর্থিক হিসাব এনক্রিপ্ট করা ক্লাউডে সংরক্ষিত থাকে এবং তৃতীয় কোনো পক্ষের সাথে শেয়ার করা হয় না।
          </p>

          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>কোনো বিজ্ঞাপন বা বাণিজ্যিক ট্র্যাকিং কোড নেই</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>ফায়ারবেস এনক্রিপ্টেড ক্লাউড স্টোরেজ</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>যেকোনো সময় ১-ক্লিকে সম্পূর্ণ ডেটার অফলাইন ব্যাকআপ ডাউনলোড করা যায়</span>
            </div>
          </div>
        </div>

        {/* User Reviews */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              রেটিং ও পর্যালোচনা (Ratings and reviews)
            </h3>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">৪.৯ ★★★★★</span>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">{ownerName} (পরিচালক)</span>
                <span className="text-[10px] text-amber-500 font-bold">★★★★★</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                "আমাদের সেন্ট্রাল সার্ভার ও ফিল্ড টেকনিশিয়ানদের দৈনিক খরচ দ্রুত এন্ট্রি করার জন্য অসাধারণ অ্যাপ। তারিখ সার্চ করে পুরনো হিসাব মুহূর্তেই পাওয়া যায়।"
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">মোঃ হোসেন (ফিল্ড টেকনিশিয়ান)</span>
                <span className="text-[10px] text-amber-500 font-bold">★★★★★</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                "বিশ্বরোড বা দূরবর্তী লাইনে কাজ করার সময় মোবাইল থেকেই সাথে সাথে গাড়ি ভাড়া ও যাতায়াত খরচের ভাউচার এন্ট্রি দেওয়া যায়।"
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
