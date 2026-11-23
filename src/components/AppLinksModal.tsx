import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  QrCode,
  Smartphone,
  Shield,
  UserCheck,
  Users,
  X,
  MessageCircle,
  Key,
  Download,
  ExternalLink,
  CheckCircle2,
  PieChart,
  UserPlus,
  Link2,
  Globe
} from 'lucide-react';
import { Staff, Partner, Company, UserSession, WhatsAppGroupConfig, JoinRequest } from '../types';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { formatCurrency, toBengaliNumber } from '../utils/formatters';
import {
  getGooglePlayStoreUrl,
  getJoiningPortalUrl,
  getEffectiveTroubleshootPortalUrl,
  normalizeWhatsAppGroupLink,
  buildWhatsAppUrl,
  shareOrCopyAppLink
} from '../utils/appUrls';
import { generateQrDataUrl } from '../services/sharedReportService';

export type AppLinksTab = 'download' | 'whatsapp_groups' | 'admin' | 'staff_list' | 'partner_list' | 'instructions';

interface AppLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffs: Staff[];
  partners?: Partner[];
  company: Company | null;
  currentUser: UserSession;
  initialTab?: AppLinksTab;
  onOpenPlayStore?: () => void;
  whatsappGroupConfig?: WhatsAppGroupConfig | null;
  onSaveWhatsAppGroupConfig?: (config: Partial<WhatsAppGroupConfig>) => Promise<void>;
  joinRequests?: JoinRequest[];
  onApproveJoinRequest?: (req: JoinRequest) => Promise<void>;
  onRejectJoinRequest?: (req: JoinRequest) => Promise<void>;
  onOpenCompanySetup?: () => void;
  onOpenTroubleshootPortal?: () => void;
}

export const AppLinksModal: React.FC<AppLinksModalProps> = ({
  isOpen,
  onClose,
  staffs,
  partners = [],
  company,
  currentUser,
  initialTab = 'download',
  onOpenPlayStore,
  whatsappGroupConfig,
  onSaveWhatsAppGroupConfig,
  joinRequests = [],
  onApproveJoinRequest,
  onRejectJoinRequest,
  onOpenCompanySetup,
  onOpenTroubleshootPortal,
}) => {
  const [activeTab, setActiveTab] = useState<AppLinksTab>(initialTab);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);
  const [qrTargetUrl, setQrTargetUrl] = useState<string | null>(null);
  const [installNotice, setInstallNotice] = useState<string | null>(null);
  const { isInstalled, isInstallable, isIOS, install } = usePWAInstall();

  // WhatsApp Group Link Editor State
  const [complainGroupName, setComplainGroupName] = useState('');
  const [complainGroupLink, setComplainGroupLink] = useState('');
  const [staffGroupName, setStaffGroupName] = useState('');
  const [staffGroupLink, setStaffGroupLink] = useState('');
  const [partnerGroupName, setPartnerGroupName] = useState('');
  const [partnerGroupLink, setPartnerGroupLink] = useState('');
  const [isSavingGroups, setIsSavingGroups] = useState(false);
  const [groupSavedToast, setGroupSavedToast] = useState('');
  const [processingReqId, setProcessingReqId] = useState<string | null>(null);
  const [localQrDataUrl, setLocalQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setComplainGroupName(whatsappGroupConfig?.groupName || 'DIP BHOLA NETWORK - Complain Group');
      setComplainGroupLink(whatsappGroupConfig?.groupInviteLink || '');
      setStaffGroupName(whatsappGroupConfig?.staffGroupName || 'DIP BHOLA NETWORK - Staff Team');
      setStaffGroupLink(whatsappGroupConfig?.staffGroupInviteLink || '');
      setPartnerGroupName(whatsappGroupConfig?.partnerGroupName || 'DIP BHOLA NETWORK - Share Partners');
      setPartnerGroupLink(whatsappGroupConfig?.partnerGroupInviteLink || '');
      setGroupSavedToast('');
    }
  }, [isOpen, initialTab, whatsappGroupConfig]);

  if (!isOpen) return null;

  const companyName = company?.name || 'DIP BHOLA NETWORK';
  const troubleshootPortalUrl = getEffectiveTroubleshootPortalUrl(company);

  // Single Unified Link: Download Link, Install App Link & Google Play Store Link (100% Same for Admin, Staff & Share Partner)
  const playStoreUrl = getGooglePlayStoreUrl();
  const adminPlayStoreUrl = playStoreUrl;
  const staffPlayStoreUrl = playStoreUrl;
  const partnerPlayStoreUrl = playStoreUrl;

  // Direct Portal URLs (Exact same Google Play Store App link across all roles)
  const adminUrl = playStoreUrl;
  const managerUrl = playStoreUrl;
  const generalStaffUrl = playStoreUrl;
  const generalPartnerUrl = playStoreUrl;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const getStaffDirectUrl = (_staffId: string) => playStoreUrl;
  const getStaffInstallUrl = (_staffId: string) => playStoreUrl;

  const getPartnerDirectUrl = (_partnerId: string) => playStoreUrl;
  const getPartnerInstallUrl = (_partnerId: string) => playStoreUrl;

  const handleOneClickInstall = async () => {
    setInstallNotice(null);
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        setInstallNotice('অ্যাপটি আপনার ডিভাইসে সফলভাবে ইনস্টল হয়েছে!');
        return;
      }
    }
    setActiveTab('instructions');
    setInstallNotice(
      isIOS
        ? 'আইফোনে ইনস্টল করতে Safari-র নিচে Share > Add to Home Screen চাপুন।'
        : 'ব্রাউজারের ডান কোণার ৩-ডট (⋮) মেন্যু থেকে "Install app" অথবা "Add to Home screen" চাপুন।'
    );
  };

  const handleDownloadLauncherFile = (targetUrl = playStoreUrl, fileSuffix = 'App_Installer') => {
    const htmlContent = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${companyName} - App Launcher</title>
  <meta http-equiv="refresh" content="0; url=${targetUrl}" />
  <style>
    body { font-family: system-ui, sans-serif; display: flex; min-height: 100vh; align-items: center; justify-content: center; background: #022c22; color: #fff; margin: 0; text-align: center; padding: 24px; }
    .box { max-width: 420px; background: #064e3b; padding: 28px; border-radius: 20px; border: 1px solid #10b981; }
    a { display: inline-block; margin-top: 16px; background: #01875f; color: #fff; padding: 12px 20px; border-radius: 12px; font-weight: 700; text-decoration: none; }
  </style>
</head>
<body>
  <div class="box">
    <h2>${companyName}</h2>
    <p>Google Play Store স্টাইল অ্যাপ ওপেন ও ইনস্টল হচ্ছে...</p>
    <a href="${targetUrl}">Download &amp; Install App</a>
  </div>
  <script>window.location.replace(${JSON.stringify(targetUrl)});</script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DIP_BHOLA_NETWORK_${fileSuffix}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openSafeExternalUrl = (targetUrl: string) => {
    const a = document.createElement('a');
    a.href = targetUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const staffJoinUrl = getJoiningPortalUrl('staff');
  const partnerJoinUrl = getJoiningPortalUrl('partner');
  const effectiveStaffGroupLink = normalizeWhatsAppGroupLink(
    staffGroupLink || whatsappGroupConfig?.staffGroupInviteLink || whatsappGroupConfig?.groupInviteLink
  );
  const effectivePartnerGroupLink = normalizeWhatsAppGroupLink(
    partnerGroupLink || whatsappGroupConfig?.partnerGroupInviteLink || whatsappGroupConfig?.groupInviteLink
  );
  const effectiveComplainGroupLink = normalizeWhatsAppGroupLink(
    complainGroupLink || whatsappGroupConfig?.groupInviteLink
  );
  const pendingRequests = joinRequests.filter((r) => r.status === 'pending');

  const handleSaveGroupLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveWhatsAppGroupConfig) return;
    setIsSavingGroups(true);
    setGroupSavedToast('');
    try {
      await onSaveWhatsAppGroupConfig({
        groupName: complainGroupName.trim() || `${companyName} - Complain Group`,
        groupInviteLink: normalizeWhatsAppGroupLink(complainGroupLink),
        staffGroupName: staffGroupName.trim() || `${companyName} - Staff Team`,
        staffGroupInviteLink: normalizeWhatsAppGroupLink(staffGroupLink),
        partnerGroupName: partnerGroupName.trim() || `${companyName} - Share Partners`,
        partnerGroupInviteLink: normalizeWhatsAppGroupLink(partnerGroupLink),
        updatedBy: currentUser.name
      });
      setGroupSavedToast('WhatsApp গ্রুপ লিংকগুলো সফলভাবে সেভ হয়েছে!');
      setTimeout(() => setGroupSavedToast(''), 3000);
    } finally {
      setIsSavingGroups(false);
    }
  };

  const buildStaffInviteMessage = (staffName?: string, phone?: string, pin?: string) => {
    return [
      `আসসালামু আলাইকুম ${staffName || 'সহকর্মী'},`,
      `আপনাকে *${companyName}* এর অফিসিয়াল ফিল্ড স্টাফ টিমে আমন্ত্রণ জানানো হচ্ছে।`,
      ``,
      `📲 *Google Play Store অ্যাপ ইনস্টল লিংক:*`,
      `${playStoreUrl}`,
      ``,
      phone && pin
        ? `🔐 *আপনার লগইন তথ্য:*\n📱 মোবাইল: ${phone}\n🔑 পিন কোড: ${pin}`
        : `📝 *নতুন স্টাফ জয়েনিং আবেদন লিংক:*\n${staffJoinUrl}`,
      effectiveStaffGroupLink ? `\n👥 *অফিসিয়াল Staff WhatsApp গ্রুপে জয়েন করুন:*\n${effectiveStaffGroupLink}` : '',
      `\nঅ্যাপ ইনস্টল করে আপনার মোবাইল নাম্বার ও পিন দিয়ে নিজস্ব পেজে প্রবেশ করুন।`
    ]
      .filter(Boolean)
      .join('\n');
  };

  const buildPartnerInviteMessage = (partnerName?: string, phone?: string, pin?: string) => {
    return [
      `আসসালামু আলাইকুম ${partnerName || 'সম্মানিত অংশীদার'},`,
      `আপনাকে *${companyName}* এর শেয়ার অংশীদার (Share Partner) পোর্টালে আমন্ত্রণ জানানো হচ্ছে।`,
      ``,
      `📲 *Google Play Store অ্যাপ ইনস্টল লিংক:*`,
      `${playStoreUrl}`,
      ``,
      phone && pin
        ? `🔐 *আপনার পার্টনার লগইন তথ্য:*\n📱 মোবাইল: ${phone}\n🔑 পিন কোড: ${pin}`
        : `📝 *নতুন Share Partner জয়েনিং লিংক:*\n${partnerJoinUrl}`,
      effectivePartnerGroupLink
        ? `\n👥 *Share Partner WhatsApp গ্রুপে জয়েন করুন:*\n${effectivePartnerGroupLink}`
        : '',
      `\nঅ্যাপ থেকে সরাসরি আপনার বিনিয়োগ, শেয়ার রেশিও ও লাভ-ক্ষতির হিসাব দেখতে পারবেন।`
    ]
      .filter(Boolean)
      .join('\n');
  };

  const openWhatsAppStaffShare = (phone: string, staffName: string, staffPin: string) => {
    openSafeExternalUrl(buildWhatsAppUrl(buildStaffInviteMessage(staffName, phone, staffPin), phone));
  };

  const handleNativeShareLink = async (label: string, urlToShare: string, copyKey: string) => {
    const res = await shareOrCopyAppLink(`${companyName} - ${label}`, `${companyName} অফিসিয়াল অ্যাপ লিঙ্ক`, urlToShare);
    if (res === 'copied') {
      setCopiedKey(copyKey);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  useEffect(() => {
    if (!isOpen || !showQrCode) return;
    let active = true;
    generateQrDataUrl(qrTargetUrl || playStoreUrl, { width: 260 }).then((dataUrl) => {
      if (active && dataUrl) setLocalQrDataUrl(dataUrl);
    });
    return () => {
      active = false;
    };
  }, [isOpen, showQrCode, qrTargetUrl, playStoreUrl]);

  const activeQrUrl = localQrDataUrl;

  const roleInstallCards = [
    {
      key: 'role_admin',
      title: 'Admin App Link (Google Play Store এর একই লিংক)',
      subtitle: 'Download, Install ও Admin অ্যাপ — একই Google Play Store লিংক, মোবাইল ও পিন দিয়ে প্রবেশ',
      url: adminPlayStoreUrl,
      directUrl: adminUrl,
      badge: 'Same Google Play Link',
      fileSuffix: 'Admin_PlayStore_App',
      borderClass: 'border-emerald-400/50 bg-emerald-950/60',
      badgeClass: 'bg-emerald-500 text-slate-950',
      icon: <Shield className="w-4 h-4 text-emerald-300 shrink-0" />,
    },
    {
      key: 'role_staff',
      title: 'Staff App Link (Google Play Store এর একই লিংক)',
      subtitle: 'ইনস্টল করে নিজের মোবাইল নাম্বার ও পিন দিলেই স্টাফ সরাসরি নিজস্ব পেজে ঢুকবে',
      url: staffPlayStoreUrl,
      directUrl: generalStaffUrl,
      badge: 'Same Google Play Link',
      fileSuffix: 'Staff_Installer',
      borderClass: 'border-indigo-400/50 bg-indigo-950/50',
      badgeClass: 'bg-indigo-400 text-slate-950',
      icon: <Users className="w-4 h-4 text-indigo-300 shrink-0" />,
    },
    {
      key: 'role_partner',
      title: 'Share Partner Link (Google Play Store এর একই লিংক)',
      subtitle: 'ডাউনলোড, ইনস্টল ও মূলধন/শেয়ার হিসাব পোর্টাল — সবার জন্য একই Google Play Store লিংক',
      url: partnerPlayStoreUrl,
      directUrl: generalPartnerUrl,
      badge: 'Same Google Play Link',
      fileSuffix: 'Share_Partner_Installer',
      borderClass: 'border-amber-400/50 bg-amber-950/40',
      badgeClass: 'bg-amber-400 text-slate-950',
      icon: <PieChart className="w-4 h-4 text-amber-300 shrink-0" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#022c20] via-[#054d37] to-[#022c20] px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700/80 border border-emerald-500/50 flex items-center justify-center text-emerald-200">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                অ্যাপ ডাউনলোড ও ইনস্টল লিঙ্ক (Admin · Staff · Share Partner)
              </h2>
              <p className="text-xs text-emerald-200">
                Google Play Store স্টাইল ডাউনলোড ও ইনস্টল লিঙ্ক, সরাসরি পোর্টাল এবং WhatsApp শেয়ার
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-800 transition-colors"
            aria-label="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab('download')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border whitespace-nowrap shrink-0 ${
              activeTab === 'download'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>ডাউনলোড ও ইনস্টল</span>
          </button>

          <button
            onClick={() => setActiveTab('whatsapp_groups')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border whitespace-nowrap shrink-0 relative ${
              activeTab === 'whatsapp_groups'
                ? 'bg-[#25D366] text-slate-950 border-emerald-600 shadow-xs font-black'
                : 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp গ্রুপ ও জয়েন</span>
            {pendingRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-black">
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border whitespace-nowrap shrink-0 ${
              activeTab === 'admin'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>পোর্টাল লিঙ্ক</span>
          </button>

          <button
            onClick={() => setActiveTab('staff_list')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border whitespace-nowrap shrink-0 ${
              activeTab === 'staff_list'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Staff ({staffs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('partner_list')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border whitespace-nowrap shrink-0 ${
              activeTab === 'partner_list'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Share Partner ({partners.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('instructions')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border whitespace-nowrap shrink-0 ${
              activeTab === 'instructions'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>মোবাইলে ইনস্টল নিয়ম</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Critical Warning against sharing browser aistudio.google.com URL */}
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 text-xs leading-relaxed">
            <strong>সতর্কতা (Page Not Found এড়াতে):</strong> স্টাফ বা পার্টনারকে কখনোই ব্রাউজারের উপরের <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 rounded">aistudio.google.com/...</code> বা <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 rounded">ais-dev-...</code> ঠিকানা শেয়ার করবেন না—তাহলে স্টাফের ফোনে <strong>&ldquo;Page not found&rdquo;</strong> দেখাবে। সবসময় নিচের <strong>WhatsApp / কপি / শেয়ার</strong> বাটনের অফিশিয়াল পাবলিক লিঙ্ক পাঠান।
          </div>

          {installNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{installNotice}</span>
            </div>
          )}

          {/* Connected Troubleshooting Web App Portal */}
          <div className="p-3.5 rounded-2xl bg-slate-900 text-white border border-cyan-500/40 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-black text-cyan-300 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 shrink-0" />
                <span>সমস্যা অনুসন্ধান ও সমাধান ওয়েব পোর্টাল</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 font-mono truncate" title={troubleshootPortalUrl}>
                {troubleshootPortalUrl}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onOpenTroubleshootPortal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenTroubleshootPortal();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>অ্যাপের ভেতরে খুলুন</span>
                </button>
              )}
              <a
                href={troubleshootPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 border border-white/20"
                title={troubleshootPortalUrl}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>নতুন ট্যাবে খুলুন</span>
              </a>
              {onOpenCompanySetup &&
                (currentUser.role === 'admin' || currentUser.role === 'director') && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCompanySetup();
                    }}
                    className="px-3 py-2 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>লিংক পরিবর্তন</span>
                  </button>
                )}
            </div>
          </div>

          {activeTab === 'download' && (
            <div className="space-y-4">
              {/* Primary Google Play Store Action Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-900 via-slate-900 to-teal-950 text-white border border-emerald-500/60 shadow-lg space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-white">
                      {companyName} · Google Play Store ডাউনলোড ও ইনস্টল
                    </h3>
                    <p className="text-xs text-emerald-200 mt-0.5">
                      একই লিঙ্ক থেকে সরাসরি Play Store স্টাইলে অ্যাপ ডাউনলোড ও ইনস্টল করা যাবে।
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {onOpenPlayStore && (
                      <button
                        onClick={onOpenPlayStore}
                        className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs flex items-center gap-1.5 shadow-md transition-colors whitespace-nowrap"
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
                          <path d="M4 3.5V20.5L16.5 12L4 3.5Z" fill="#00C1A4" />
                          <path d="M4 3.5L13.5 12.8L16.5 12L4 3.5Z" fill="#00A0FF" />
                          <path d="M16.5 12L13.5 11.2L4 20.5L16.5 12Z" fill="#FF3333" />
                          <path d="M16.5 12L13.5 11.2L13.5 12.8L16.5 12Z" fill="#FFBA00" />
                        </svg>
                        <span>Play Store পেজ খুলুন</span>
                      </button>
                    )}

                    <button
                      onClick={handleOneClickInstall}
                      className="px-4 py-2 rounded-xl bg-[#01875f] hover:bg-[#01a172] text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-colors whitespace-nowrap"
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>{isInstalled ? 'ইনস্টল সম্পন্ন' : 'অ্যাপ ইনস্টল (Install)'}</span>
                    </button>

                    <button
                      onClick={() => handleDownloadLauncherFile(playStoreUrl, 'App_Installer')}
                      className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md transition-colors whitespace-nowrap"
                    >
                      <Download className="w-4 h-4" />
                      <span>অ্যাপ ফাইল ডাউনলোড</span>
                    </button>
                  </div>
                </div>

                {/* Unified Google Play Store App Download & Install Link */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300">
                    <span>সবার জন্য Download &amp; Install App Link (Google Play Store):</span>
                    <button
                      onClick={() => (onOpenPlayStore ? onOpenPlayStore() : openSafeExternalUrl(playStoreUrl))}
                      className="inline-flex items-center gap-1 text-white hover:underline"
                    >
                      <span>Play Store পেজে যান</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 bg-black/40 p-2 rounded-xl border border-emerald-400/40">
                    <input
                      type="text"
                      readOnly
                      value={playStoreUrl}
                      className="w-full text-xs font-mono bg-transparent text-emerald-300 outline-none select-all"
                    />
                    <button
                      onClick={() => copyToClipboard(playStoreUrl, 'install_link')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shrink-0 flex items-center gap-1 whitespace-nowrap"
                    >
                      {copiedKey === 'install_link' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'install_link' ? 'কপি হয়েছে!' : 'কপি লিঙ্ক'}</span>
                    </button>
                  </div>
                </div>

                {/* Role-based Download & Install App Links (Admin, Staff, Share Partner) */}
                <div className="pt-2 space-y-2.5 border-t border-white/10">
                  <div className="text-xs font-bold text-white">
                    ভূমিকা অনুযায়ী আলাদা ডাউনলোড ও ইনস্টল লিঙ্ক (Admin · Staff · Share Partner):
                  </div>

                  <div className="space-y-2.5">
                    {roleInstallCards.map((item) => (
                      <div
                        key={item.key}
                        className={`p-3 rounded-xl border ${item.borderClass} space-y-2`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            {item.icon}
                            <div>
                              <div className="text-xs font-bold text-white">{item.title}</div>
                              <div className="text-[11px] text-slate-300">{item.subtitle}</div>
                            </div>
                          </div>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.badgeClass}`}>
                            {item.badge}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-lg border border-white/10">
                          <input
                            type="text"
                            readOnly
                            value={item.url}
                            className="w-full text-[11px] font-mono bg-transparent text-emerald-200 outline-none select-all"
                          />
                          <button
                            onClick={() => copyToClipboard(item.url, item.key)}
                            className="px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-bold shrink-0 flex items-center gap-1 whitespace-nowrap"
                          >
                            {copiedKey === item.key ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === item.key ? 'কপি!' : 'কপি'}</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => {
                              const msg =
                                item.key === 'role_staff'
                                  ? buildStaffInviteMessage()
                                  : item.key === 'role_partner'
                                  ? buildPartnerInviteMessage()
                                  : `আসসালামু আলাইকুম,\n${companyName}-এর (${item.badge}) Google Play Store অ্যাপ ডাউনলোড ও ইনস্টল লিঙ্ক:\n${item.url}`;
                              openSafeExternalUrl(buildWhatsAppUrl(msg));
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#25D366] hover:bg-[#20ba59] text-slate-950 font-bold text-[11px] flex items-center gap-1 whitespace-nowrap"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>WhatsApp শেয়ার</span>
                          </button>

                          <button
                            onClick={() => handleDownloadLauncherFile(item.url, item.fileSuffix)}
                            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] flex items-center gap-1 whitespace-nowrap"
                          >
                            <Download className="w-3 h-3 text-amber-300" />
                            <span>ডাউনলোড ফাইল</span>
                          </button>

                          <button
                            onClick={() => {
                              setQrTargetUrl(item.url);
                              setShowQrCode(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] flex items-center gap-1 whitespace-nowrap"
                          >
                            <QrCode className="w-3 h-3 text-emerald-300" />
                            <span>QR কোড</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Share + General QR Controls */}
                <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-white/10">
                  <button
                    onClick={() => {
                      const msg = `আসসালামু আলাইকুম,\n${companyName}-এর অফিসিয়াল Google Play Store অ্যাপ ডাউনলোড ও ইনস্টল লিঙ্ক:\n${playStoreUrl}`;
                      openSafeExternalUrl(buildWhatsAppUrl(msg));
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-slate-950 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp-এ সাধারণ ইনস্টল লিঙ্ক পাঠান</span>
                  </button>

                  <button
                    onClick={() => {
                      setQrTargetUrl(playStoreUrl);
                      setShowQrCode((prev) => !prev);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 border border-white/20 whitespace-nowrap"
                  >
                    <QrCode className="w-4 h-4 text-emerald-300" />
                    <span>{showQrCode ? 'QR কোড লুকান' : 'মোবাইলে স্ক্যান QR কোড'}</span>
                  </button>
                </div>

                {showQrCode && (
                  <div className="p-4 rounded-xl bg-white text-slate-900 flex flex-col sm:flex-row items-center gap-4">
                    <img
                      src={activeQrUrl}
                      alt="App Install QR Code"
                      referrerPolicy="no-referrer"
                      className="w-32 h-32 rounded-lg border border-slate-200 shrink-0"
                    />
                    <div className="text-xs space-y-1 text-center sm:text-left min-w-0">
                      <div className="font-bold text-sm text-slate-900">
                        ক্যামেরা দিয়ে স্ক্যান করে ইনস্টল করুন
                      </div>
                      <p className="text-slate-600">
                        অ্যান্ড্রয়েড বা আইফোনের ক্যামেরা দিয়ে স্ক্যান করলে নিচের Google Play Store ইনস্টল পেজ সরাসরি ওপেন হবে:
                      </p>
                      <div className="text-[10px] font-mono text-emerald-700 truncate">
                        {qrTargetUrl || playStoreUrl}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'whatsapp_groups' && (
            <div className="space-y-5">
              {/* 1. Save WhatsApp Group Links */}
              <form
                onSubmit={handleSaveGroupLinks}
                className="p-4 sm:p-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-4"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-[#25D366]" />
                      <span>WhatsApp গ্রুপ লিংক যোগ ও সংরক্ষণ করুন</span>
                    </h3>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                      আপনার WhatsApp গ্রুপের Invite Link (chat.whatsapp.com/...) এখানে সেভ করলে স্টাফ, পার্টনার ও অভিযোগ ইনভাইটেশনে অটো যুক্ত হয়ে যাবে।
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Staff WhatsApp গ্রুপের নাম
                    </label>
                    <input
                      type="text"
                      value={staffGroupName}
                      onChange={(e) => setStaffGroupName(e.target.value)}
                      placeholder="DIP BHOLA NETWORK - Staff Team"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#25D366]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Staff WhatsApp Group Invite Link
                    </label>
                    <input
                      type="text"
                      value={staffGroupLink}
                      onChange={(e) => setStaffGroupLink(e.target.value)}
                      placeholder="https://chat.whatsapp.com/..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-[#25D366]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Share Partner WhatsApp গ্রুপের নাম
                    </label>
                    <input
                      type="text"
                      value={partnerGroupName}
                      onChange={(e) => setPartnerGroupName(e.target.value)}
                      placeholder="DIP BHOLA NETWORK - Share Partners"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#25D366]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Share Partner WhatsApp Group Invite Link
                    </label>
                    <input
                      type="text"
                      value={partnerGroupLink}
                      onChange={(e) => setPartnerGroupLink(e.target.value)}
                      placeholder="https://chat.whatsapp.com/..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-[#25D366]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      অভিযোগ (Complain) WhatsApp গ্রুপের নাম
                    </label>
                    <input
                      type="text"
                      value={complainGroupName}
                      onChange={(e) => setComplainGroupName(e.target.value)}
                      placeholder="DIP BHOLA NETWORK - Complain Group"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#25D366]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      অভিযোগ WhatsApp Group Invite Link
                    </label>
                    <input
                      type="text"
                      value={complainGroupLink}
                      onChange={(e) => setComplainGroupLink(e.target.value)}
                      placeholder="https://chat.whatsapp.com/..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-[#25D366]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    {groupSavedToast}
                  </div>
                  {onSaveWhatsAppGroupConfig && (
                    <button
                      type="submit"
                      disabled={isSavingGroups}
                      className="px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-60"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isSavingGroups ? 'সংরক্ষণ হচ্ছে...' : 'WhatsApp গ্রুপ লিংক সেভ করুন'}</span>
                    </button>
                  )}
                </div>
              </form>

              {/* 2. Staff & Share Partner Invitation System */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Staff Invite Card */}
                <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-indigo-600 text-white">
                        <Users className="w-4 h-4" />
                      </span>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                          Staff জয়েনিং ও WhatsApp ইনভাইট
                        </h4>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          নতুন স্টাফ জয়েনিং লিংক + Play Store অ্যাপ + গ্রুপ লিংক
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-indigo-200 dark:border-indigo-700">
                    <input
                      type="text"
                      readOnly
                      value={staffJoinUrl}
                      className="w-full text-[11px] font-mono bg-transparent text-slate-800 dark:text-slate-200 outline-none select-all"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(staffJoinUrl, 'join_staff')}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-bold shrink-0"
                    >
                      {copiedKey === 'join_staff' ? 'কপি!' : 'কপি'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => openSafeExternalUrl(buildWhatsAppUrl(buildStaffInviteMessage()))}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-slate-950 font-black text-xs flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp-এ আমন্ত্রণ পাঠান</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(buildStaffInviteMessage(), 'invite_staff_msg')}
                      className="py-2 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs"
                    >
                      {copiedKey === 'invite_staff_msg' ? 'কপি হয়েছে!' : 'ইনভাইট কপি'}
                    </button>
                    {effectiveStaffGroupLink && (
                      <a
                        href={effectiveStaffGroupLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>গ্রুপ খুলুন</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Share Partner Invite Card */}
                <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-amber-600 text-white">
                        <PieChart className="w-4 h-4" />
                      </span>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                          Share Partner জয়েনিং ও ইনভাইট
                        </h4>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          পার্টনার জয়েনিং লিংক + Play Store অ্যাপ + গ্রুপ লিংক
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-amber-200 dark:border-amber-700">
                    <input
                      type="text"
                      readOnly
                      value={partnerJoinUrl}
                      className="w-full text-[11px] font-mono bg-transparent text-slate-800 dark:text-slate-200 outline-none select-all"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(partnerJoinUrl, 'join_partner')}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-[11px] font-bold shrink-0"
                    >
                      {copiedKey === 'join_partner' ? 'কপি!' : 'কপি'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => openSafeExternalUrl(buildWhatsAppUrl(buildPartnerInviteMessage()))}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-slate-950 font-black text-xs flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp-এ আমন্ত্রণ পাঠান</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(buildPartnerInviteMessage(), 'invite_partner_msg')}
                      className="py-2 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs"
                    >
                      {copiedKey === 'invite_partner_msg' ? 'কপি হয়েছে!' : 'ইনভাইট কপি'}
                    </button>
                    {effectivePartnerGroupLink && (
                      <a
                        href={effectivePartnerGroupLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>গ্রুপ খুলুন</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {effectiveComplainGroupLink && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
                    অভিযোগ গ্রুপ: {complainGroupName}
                  </span>
                  <a
                    href={effectiveComplainGroupLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 rounded-lg bg-[#25D366] text-slate-950 font-black text-[11px] flex items-center gap-1 shrink-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>ওপেন করুন</span>
                  </a>
                </div>
              )}

              {/* 3. Pending Staff & Share Partner Joining Requests */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-emerald-600" />
                    <span>নতুন জয়েনিং আবেদনসমূহ ({pendingRequests.length}টি পেন্ডিং)</span>
                  </h4>
                </div>

                {pendingRequests.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    বর্তমানে কোনো পেন্ডিং Staff বা Share Partner জয়েনিং আবেদন নেই। উপরের জয়েনিং লিংক শেয়ার করলে নতুন আবেদন এখানে দেখা যাবে।
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {pendingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <strong className="text-sm text-slate-900 dark:text-white">{req.name}</strong>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                req.role === 'staff'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {req.role === 'staff' ? 'Staff' : 'Share Partner'}
                            </span>
                          </div>
                          <div className="text-slate-600 dark:text-slate-300">
                            📱 {req.phone} · 🔑 পিন: <strong className="font-mono">{req.pin}</strong> · {req.designationOrRole}
                          </div>
                          {req.address && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">📍 {req.address}</div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {onApproveJoinRequest && (
                            <button
                              type="button"
                              disabled={processingReqId === req.id}
                              onClick={async () => {
                                setProcessingReqId(req.id);
                                try {
                                  await onApproveJoinRequest(req);
                                  const msg =
                                    req.role === 'staff'
                                      ? buildStaffInviteMessage(req.name, req.phone, req.pin)
                                      : buildPartnerInviteMessage(req.name, req.phone, req.pin);
                                  openSafeExternalUrl(buildWhatsAppUrl(msg, req.phone));
                                } finally {
                                  setProcessingReqId(null);
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>অনুমোদন ও WhatsApp</span>
                            </button>
                          )}
                          {onRejectJoinRequest && (
                            <button
                              type="button"
                              disabled={processingReqId === req.id}
                              onClick={() => onRejectJoinRequest(req)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-xs"
                            >
                              বাতিল
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'admin' && (
            <div className="space-y-4">
              {/* Director / Admin Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-emerald-600 text-white">
                      <Shield className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Admin App Link · Google Play Store (একই লিংক)
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Admin অ্যাপ লিংক এবং Google Play Store অ্যাপ লিংক — উভয় ক্ষেত্রেই একই লিংক কাজ করবে
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Same Link
                  </span>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-emerald-300 dark:border-emerald-700">
                  <input
                    type="text"
                    readOnly
                    value={adminUrl}
                    className="w-full text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 outline-none select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(adminUrl, 'admin')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 flex items-center gap-1 transition-colors whitespace-nowrap"
                  >
                    {copiedKey === 'admin' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'admin' ? 'কপি হয়েছে!' : 'কপি করুন'}</span>
                  </button>
                </div>
              </div>

              {/* Manager Portal Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-amber-600 text-white">
                      <UserCheck className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Manager পোর্টাল লিঙ্ক
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        দৈনিক হিসাব, কর্মী তদারকি, বাকি খাতা ও ডিসপ্লে পরিচালনার পোর্টাল
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    ম্যানেজার
                  </span>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-amber-300 dark:border-amber-700">
                  <input
                    type="text"
                    readOnly
                    value={managerUrl}
                    className="w-full text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 outline-none select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(managerUrl, 'manager')}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 flex items-center gap-1 transition-colors whitespace-nowrap"
                  >
                    {copiedKey === 'manager' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'manager' ? 'কপি হয়েছে!' : 'কপি করুন'}</span>
                  </button>
                </div>
              </div>

              {/* General Staff Portal Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/30 border border-indigo-200 dark:border-indigo-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-indigo-600 text-white">
                      <Users className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Staff পোর্টাল লিঙ্ক (General Staff Portal)
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        যেকোনো স্টাফ নিজ নিজ পিন দিয়ে প্রবেশ করে জমা ও খরচ এন্ট্রি দিতে পারবে
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                    ফিল্ড এন্ট্রি
                  </span>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-indigo-300 dark:border-indigo-700">
                  <input
                    type="text"
                    readOnly
                    value={generalStaffUrl}
                    className="w-full text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 outline-none select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(generalStaffUrl, 'staff_general')}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0 flex items-center gap-1 transition-colors whitespace-nowrap"
                  >
                    {copiedKey === 'staff_general' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'staff_general' ? 'কপি হয়েছে!' : 'কপি করুন'}</span>
                  </button>
                </div>
              </div>

              {/* Share Partner Portal Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50 dark:from-rose-950/30 dark:to-amber-950/30 border border-rose-200 dark:border-rose-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-rose-600 text-white">
                      <PieChart className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Share Partner পোর্টাল লিঙ্ক (অংশীদার শেয়ার ও লাভ-ক্ষতি)
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        শেয়ার পার্টনাররা সরাসরি বিনিয়োগ, শেয়ার % এবং ব্যবসার লাভ-ক্ষতি দেখতে পারবেন
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                    Share Partner
                  </span>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-rose-300 dark:border-rose-700">
                  <input
                    type="text"
                    readOnly
                    value={generalPartnerUrl}
                    className="w-full text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 outline-none select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(generalPartnerUrl, 'partner_general')}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shrink-0 flex items-center gap-1 transition-colors whitespace-nowrap"
                  >
                    {copiedKey === 'partner_general' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'partner_general' ? 'কপি হয়েছে!' : 'কপি করুন'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'staff_list' && (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
                প্রতিটি স্টাফকে তাদের নামের পাশের <strong>"হোয়াটসঅ্যাপে পাঠান"</strong> বাটনে ক্লিক করে সরাসরি তাদের ফোনে Google Play Store ইনস্টল লিঙ্ক ও পিন পাঠিয়ে দিতে পারেন।
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {staffs.map((st) => {
                  const directUrl = getStaffDirectUrl(st.id);
                  const installUrl = getStaffInstallUrl(st.id);
                  const isCopiedDirect = copiedKey === `staff-${st.id}`;
                  const isCopiedInstall = copiedKey === `staff-inst-${st.id}`;

                  return (
                    <div
                      key={st.id}
                      className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs hover:border-emerald-400 transition-all flex flex-col justify-between space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {st.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {st.designation} · মোবা: {st.phone}
                          </p>
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                          <Key className="w-3 h-3 text-amber-500" />
                          <span>পিন: {st.pin}</span>
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                          Google Play Install লিঙ্ক:
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900 p-1.5 rounded-lg text-[10px] font-mono text-slate-600 dark:text-slate-300 truncate border border-slate-200 dark:border-slate-800">
                          {installUrl}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-700 flex-wrap">
                        <button
                          onClick={() => openWhatsAppStaffShare(st.phone, st.name, st.pin)}
                          className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors shadow-2xs whitespace-nowrap"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp ইনভাইট</span>
                        </button>
                        <button
                          onClick={() => handleNativeShareLink(st.name, installUrl, `staff-inst-${st.id}`)}
                          className="py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 whitespace-nowrap"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>শেয়ার</span>
                        </button>
                        <button
                          onClick={() => copyToClipboard(installUrl, `staff-inst-${st.id}`)}
                          className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-lg text-[11px] font-bold flex items-center gap-1 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap"
                        >
                          {isCopiedInstall ? <Check className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                          <span>{isCopiedInstall ? 'কপি!' : 'ইনস্টল লিঙ্ক'}</span>
                        </button>
                        <button
                          onClick={() => copyToClipboard(directUrl, `staff-${st.id}`)}
                          className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-[11px] font-bold flex items-center gap-1 whitespace-nowrap"
                        >
                          {isCopiedDirect ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{isCopiedDirect ? 'কপি!' : 'সরাসরি'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'partner_list' && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-300">
                প্রতিটি <strong>Share Partner</strong>-কে তাদের ব্যক্তিগত Google Play Store ডাউনলোড/ইনস্টল লিঙ্ক এবং ডাইরেক্ট পোর্টাল লিঙ্ক WhatsApp বা কপি করে পাঠাতে পারেন।
              </div>

              {partners.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  এখনো কোনো শেয়ার পার্টনার যুক্ত করা হয়নি। পার্টনার ও শেয়ার ট্যাব থেকে যুক্ত করুন।
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {partners.map((p) => {
                    const directUrl = getPartnerDirectUrl(p.id);
                    const installUrl = getPartnerInstallUrl(p.id);
                    const isCopiedInstall = copiedKey === `partner-inst-${p.id}`;
                    const isCopiedDirect = copiedKey === `partner-${p.id}`;

                    return (
                      <div
                        key={p.id}
                        className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs hover:border-amber-400 transition-all flex flex-col justify-between space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {p.name}
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {p.role || 'অংশীদার'} · মোবা: {p.phone || 'নেই'}
                            </p>
                          </div>
                          <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 shrink-0 tabular-nums">
                            {toBengaliNumber(p.sharePercentage || 0)}% শেয়ার
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold tabular-nums">
                          বিনিয়োগ: <strong className="text-emerald-700 dark:text-emerald-400">{formatCurrency(p.investment || 0)}</strong>
                        </div>

                        <div className="space-y-1">
                          <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                            Google Play Install লিঙ্ক:
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900 p-1.5 rounded-lg text-[10px] font-mono text-slate-600 dark:text-slate-300 truncate border border-slate-200 dark:border-slate-800">
                            {installUrl}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-700 flex-wrap">
                          <button
                            onClick={() => {
                              const msg = buildPartnerInviteMessage(p.name, p.phone, p.pin);
                              openSafeExternalUrl(buildWhatsAppUrl(msg, p.phone));
                            }}
                            className="flex-1 py-1.5 px-2 bg-[#25D366] hover:bg-[#20ba59] text-slate-950 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp ইনভাইট</span>
                          </button>
                          <button
                            onClick={() => copyToClipboard(installUrl, `partner-inst-${p.id}`)}
                            className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-lg text-[11px] font-bold flex items-center gap-1 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap"
                          >
                            {isCopiedInstall ? <Check className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                            <span>{isCopiedInstall ? 'কপি!' : 'ইনস্টল লিঙ্ক'}</span>
                          </button>
                          <button
                            onClick={() => copyToClipboard(directUrl, `partner-${p.id}`)}
                            className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-[11px] font-bold flex items-center gap-1 whitespace-nowrap"
                          >
                            {isCopiedDirect ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>{isCopiedDirect ? 'কপি!' : 'সরাসরি'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'instructions' && (
            <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>অ্যান্ড্রয়েড মোবাইলে (Android Chrome) ইনস্টল করার নিয়ম:</span>
                </h4>
                <ol className="list-decimal list-inside space-y-2 pl-2">
                  <li>উপরে থাকা Admin / Staff / Share Partner ইনস্টল লিঙ্কটি <strong>Chrome Browser</strong>-এ ওপেন করুন।</li>
                  <li>ব্রাউজারের উপরে ডান পাশের <strong>৩টি ডট (Menu / ⋮)</strong>-এ চাপ দিন অথবা পেজের সবুজ <strong>"Install App"</strong> বাটনে চাপুন।</li>
                  <li><strong>"Install app"</strong> অথবা <strong>"Add to Home screen"</strong> নির্বাচন করুন।</li>
                  <li>এখন মোবাইলের হোম স্ক্রিনে DIP BHOLA NETWORK-এর কোম্পানির লোগোসহ আসল অ্যাপ আইকন তৈরি হয়ে যাবে।</li>
                </ol>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  <span>আইফোন বা আইপ্যাডে (iPhone Safari) ইনস্টল করার নিয়ম:</span>
                </h4>
                <ol className="list-decimal list-inside space-y-2 pl-2">
                  <li>Safari ব্রাউজারে লিঙ্কটি ওপেন করুন।</li>
                  <li>নিচের মাঝখানের <strong>Share আইকন</strong>-এ চাপুন।</li>
                  <li>স্ক্রল করে <strong>"Add to Home Screen"</strong> চাপুন।</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>DIP BHOLA NETWORK · Admin · Staff · Share Partner লিঙ্ক</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-lg transition-colors"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
