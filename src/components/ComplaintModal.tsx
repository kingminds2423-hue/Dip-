import React, { useState, useEffect, useMemo } from 'react';
import {
  CustomerComplaint,
  CustomerMember,
  Staff,
  UserSession,
  ComplaintPriority,
  ComplaintStatus,
  Company,
  WhatsAppGroupConfig
} from '../types';
import {
  X,
  AlertCircle,
  Phone,
  MapPin,
  Hash,
  User,
  FileText,
  Wrench,
  CheckCircle2,
  MessageCircle,
  Copy,
  Check,
  Send,
  ExternalLink,
  Calendar,
  Search,
  UserCheck,
  Wifi,
  Router
} from 'lucide-react';
import {
  formatComplaintGroupSms,
  buildWhatsAppShareUrl,
  buildDeviceSmsUrl,
  openAnchorLinkSafely,
  dispatchComplaintToWebhook
} from '../utils/complaintWhatsApp';
import {
  getTodayString,
  getComplaintDateKey,
  toEnglishDigits,
  formatCurrency
} from '../utils/formatters';

import { getEffectiveTroubleshootPortalUrl } from '../utils/appUrls';
import {
  autoAssignTechnicianByLocation,
  suggestBestTechnicianByLocationHistory
} from '../utils/complaintAutoAssign';

interface ComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (complaint: Omit<CustomerComplaint, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
  editingComplaint: CustomerComplaint | null;
  staffs: Staff[];
  complaints?: CustomerComplaint[];
  currentUser: UserSession;
  company?: Company | null;
  whatsappGroupConfig?: WhatsAppGroupConfig | null;
  customers?: CustomerMember[];
  prefillCustomer?: CustomerMember | null;
  prefillStaffId?: string | null;
  onSaveNewCustomer?: (customer: Omit<CustomerMember, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onOpenTroubleshootPortal?: () => void;
}

export const ComplaintModal: React.FC<ComplaintModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingComplaint,
  staffs,
  complaints = [],
  currentUser,
  company,
  whatsappGroupConfig,
  customers = [],
  prefillCustomer = null,
  prefillStaffId = null,
  onSaveNewCustomer,
  onOpenTroubleshootPortal
}) => {
  const [name, setName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [address, setAddress] = useState('');
  const [packageName, setPackageName] = useState('');
  const [oltInfo, setOltInfo] = useState('');
  const [oltPower, setOltPower] = useState('');
  const [statusLabel, setStatusLabel] = useState('');
  const [complainDetails, setComplainDetails] = useState('');
  const [priority, setPriority] = useState<ComplaintPriority>('normal');
  const [status, setStatus] = useState<ComplaintStatus>('pending');
  const [complaintDate, setComplaintDate] = useState<string>(() => getTodayString());
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [isManualStaffOverride, setIsManualStaffOverride] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [sendToWhatsAppGroup, setSendToWhatsAppGroup] = useState(true);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [matchedCustomer, setMatchedCustomer] = useState<CustomerMember | null>(null);
  const [searchNotFoundMsg, setSearchNotFoundMsg] = useState('');
  const [saveToCustomerDirectory, setSaveToCustomerDirectory] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedSmsText, setSavedSmsText] = useState<string | null>(null);
  const [copiedSms, setCopiedSms] = useState(false);
  const [webhookSent, setWebhookSent] = useState(false);

  const normalizeIdExact = (val: string) => toEnglishDigits((val || '').trim().toLowerCase());
  const normalizeIdCompact = (val: string) =>
    toEnglishDigits((val || '').trim().toLowerCase()).replace(/[\s\-_#]+/g, '');
  const normalizePhoneDigits = (val: string) => {
    const digits = toEnglishDigits(val || '').replace(/\D+/g, '');
    if (digits.startsWith('880') && digits.length >= 13) return `0${digits.slice(3)}`;
    if (digits.length === 10 && digits.startsWith('1')) return `0${digits}`;
    return digits;
  };

  const findCustomerByMemberOrPhone = (rawInput: string): CustomerMember | undefined => {
    const exactKey = normalizeIdExact(rawInput);
    if (!exactKey) return undefined;

    const exactId = customers.find((c) => normalizeIdExact(c.memberId) === exactKey);
    if (exactId) return exactId;

    const compactKey = normalizeIdCompact(rawInput);
    if (compactKey) {
      const compactMatches = customers.filter((c) => normalizeIdCompact(c.memberId) === compactKey);
      if (compactMatches.length === 1) return compactMatches[0];
    }

    const phoneKey = normalizePhoneDigits(rawInput);
    if (phoneKey.length >= 10) {
      const phoneMatches = customers.filter((c) => {
        const custPhone = normalizePhoneDigits(c.phone);
        return custPhone === phoneKey || (phoneKey.length >= 11 && custPhone.endsWith(phoneKey));
      });
      if (phoneMatches.length === 1) return phoneMatches[0];
    }

    return undefined;
  };

  const applyCustomerAutoFill = (cust: CustomerMember) => {
    setMatchedCustomer(cust);
    setIdNumber(cust.memberId || '');
    setName(cust.name || '');
    setMobileNumber(cust.phone || '');
    setAddress(cust.address || '');
    setPackageName(cust.packageName || '');
    setOltInfo(cust.oltInfo || '');
    const combinedOltPower =
      cust.oltPower ||
      [
        cust.rxPower ? `Rx: ${cust.rxPower}` : '',
        cust.txPower ? `Tx: ${cust.txPower}` : '',
        cust.fiberLength || ''
      ]
        .filter(Boolean)
        .join(' | ');
    setOltPower(combinedOltPower);
    setStatusLabel(cust.statusLabel || '');
    setMemberSearchQuery(`${cust.memberId} - ${cust.name}`);
    setSearchNotFoundMsg('');
  };

  useEffect(() => {
    setSavedSmsText(null);
    setCopiedSms(false);
    setWebhookSent(false);
    setMemberSearchQuery('');
    setMatchedCustomer(null);
    setSearchNotFoundMsg('');
    setIsManualStaffOverride(Boolean(prefillStaffId));
    if (editingComplaint) {
      setName(editingComplaint.name || '');
      setIdNumber(editingComplaint.idNumber || '');
      setMobileNumber(editingComplaint.mobileNumber || '');
      setAddress(editingComplaint.address || '');
      setComplainDetails(editingComplaint.complainDetails || '');
      setPriority(editingComplaint.priority || 'normal');
      setStatus(editingComplaint.status || 'pending');
      setComplaintDate(getComplaintDateKey(editingComplaint) || getTodayString());
      setAssignedStaffId(editingComplaint.assignedStaffId || '');
      setResolutionNote(editingComplaint.resolutionNote || '');
      setSendToWhatsAppGroup(false);
      setSaveToCustomerDirectory(false);
      const existingMatch = findCustomerByMemberOrPhone(
        editingComplaint.idNumber || editingComplaint.mobileNumber || ''
      );
      setPackageName(editingComplaint.packageName || existingMatch?.packageName || '');
      setOltInfo(editingComplaint.oltInfo || existingMatch?.oltInfo || '');
      setOltPower(editingComplaint.oltPower || existingMatch?.oltPower || '');
      setStatusLabel(existingMatch?.statusLabel || '');
      if (existingMatch) {
        setMatchedCustomer(existingMatch);
      }
    } else if (prefillCustomer) {
      applyCustomerAutoFill(prefillCustomer);
      const faultCues: string[] = [];
      if (prefillCustomer.issueReason?.trim()) {
        faultCues.push(prefillCustomer.issueReason.trim());
      } else if (prefillCustomer.lossStatus === 'los') {
        faultCues.push('LOS — ফাইবার কাটা বা সংযোগ বিচ্ছিন্ন');
      } else if (prefillCustomer.lossStatus === 'dying_gasp') {
        faultCues.push('Dying Gasp — বিদ্যুৎ / অনু বন্ধ');
      } else if (prefillCustomer.lossStatus === 'tj_fault') {
        faultCues.push('TJ বক্স জয়েন্ট লস');
      } else if (prefillCustomer.lossStatus === 'splitter_fault') {
        faultCues.push('স্প্লিটার পোর্ট লস');
      } else if (prefillCustomer.lossStatus === 'high_loss') {
        faultCues.push('হাই অপটিক্যাল লস');
      }
      if (prefillCustomer.oltInfo) faultCues.push(`OLT: ${prefillCustomer.oltInfo}`);
      if (prefillCustomer.rxPower) faultCues.push(`RX: ${prefillCustomer.rxPower}`);
      if (prefillCustomer.txPower) faultCues.push(`TX: ${prefillCustomer.txPower}`);
      if (prefillCustomer.fiberLength) faultCues.push(`দূরত্ব: ${prefillCustomer.fiberLength}`);
      if (prefillCustomer.onuMac) faultCues.push(`MAC: ${prefillCustomer.onuMac}`);
      if (prefillCustomer.tjBox) faultCues.push(`TJ: ${prefillCustomer.tjBox}`);
      if (prefillCustomer.splitterName) faultCues.push(`Splitter: ${prefillCustomer.splitterName}`);
      if (prefillCustomer.packageName) faultCues.push(`প্যাকেজ: ${prefillCustomer.packageName}`);
      if (prefillCustomer.dueAmount !== undefined && prefillCustomer.dueAmount > 0) {
        faultCues.push(`বকেয়া: ${formatCurrency(prefillCustomer.dueAmount)}`);
      }
      if (prefillCustomer.status !== 'active' && !faultCues.some((c) => c.includes('অবস্থা') || c.includes('Offline') || c.includes('LOS') || c.includes('Dying Gasp'))) {
        faultCues.push(
          prefillCustomer.statusLabel
            ? `বিলিং / লাইন অবস্থা: ${prefillCustomer.statusLabel}`
            : 'গ্রাহকের লাইন অফলাইন / বন্ধ'
        );
      }

      setComplainDetails(faultCues.join(' · '));
      const rxNum = Number(toEnglishDigits(prefillCustomer.rxPower || '').match(/-?\d+(?:\.\d+)?/)?.[0]);
      const isCrit =
        prefillCustomer.lossStatus === 'los' ||
        prefillCustomer.lossStatus === 'dying_gasp' ||
        (Number.isFinite(rxNum) && rxNum <= -27);
      const isUrg =
        prefillCustomer.lossStatus === 'high_loss' ||
        prefillCustomer.lossStatus === 'tj_fault' ||
        prefillCustomer.lossStatus === 'splitter_fault' ||
        (Number.isFinite(rxNum) && rxNum <= -25) ||
        prefillCustomer.status !== 'active';
      setPriority(isCrit ? 'critical' : isUrg ? 'urgent' : 'normal');
      setStatus('pending');
      setComplaintDate(getTodayString());
      setAssignedStaffId(currentUser.role === 'staff' ? currentUser.id : prefillStaffId || '');
      setResolutionNote('');
      setSendToWhatsAppGroup(whatsappGroupConfig?.autoOpenWhatsAppOnSubmit ?? true);
      setSaveToCustomerDirectory(false);
    } else {
      setName('');
      setIdNumber('');
      setMobileNumber('');
      setAddress('');
      setPackageName('');
      setOltInfo('');
      setOltPower('');
      setStatusLabel('');
      setComplainDetails('');
      setPriority('normal');
      setStatus('pending');
      setComplaintDate(getTodayString());
      setAssignedStaffId(currentUser.role === 'staff' ? currentUser.id : '');
      setResolutionNote('');
      setSendToWhatsAppGroup(whatsappGroupConfig?.autoOpenWhatsAppOnSubmit ?? true);
      setSaveToCustomerDirectory(true);
    }
    setErrorMsg('');
  }, [
    editingComplaint,
    prefillCustomer,
    prefillStaffId,
    isOpen,
    currentUser.id,
    currentUser.role,
    whatsappGroupConfig?.autoOpenWhatsAppOnSubmit
  ]);

  const autoAssignResult = useMemo(() => {
    if (!isOpen || staffs.length === 0) return null;
    if (!address.trim() && !oltInfo.trim()) return null;
    return autoAssignTechnicianByLocation({
      address,
      oltInfo,
      staffs,
      complaints,
    });
  }, [isOpen, address, oltInfo, staffs, complaints]);

  const historySuggestion = useMemo(() => {
    if (!isOpen || staffs.length === 0) return null;
    if (!address.trim() && !oltInfo.trim()) return null;
    return suggestBestTechnicianByLocationHistory({
      address,
      oltInfo,
      staffs,
      complaints,
    });
  }, [isOpen, address, oltInfo, staffs, complaints]);

  useEffect(() => {
    if (!isOpen || editingComplaint || currentUser.role === 'staff' || isManualStaffOverride) {
      return;
    }
    if (autoAssignResult?.staff) {
      setAssignedStaffId(autoAssignResult.staff.id);
    }
  }, [isOpen, editingComplaint, currentUser.role, isManualStaffOverride, autoAssignResult]);

  const memberLookupMatches = useMemo(() => {
    const q = toEnglishDigits(memberSearchQuery.trim().toLowerCase());
    if (!q || matchedCustomer) return [];
    return customers
      .filter((c) => {
        const hay = toEnglishDigits(
          `${c.memberId} ${c.name} ${c.phone} ${c.address} ${c.oltInfo || ''} ${c.oltPower || ''} ${c.packageName || ''}`.toLowerCase()
        );
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [customers, memberSearchQuery, matchedCustomer]);

  const idFieldSuggestions = useMemo(() => {
    const q = toEnglishDigits(idNumber.trim().toLowerCase());
    if (!q || matchedCustomer || editingComplaint) return [];
    return customers
      .filter((c) =>
        toEnglishDigits(`${c.memberId} ${c.name} ${c.phone} ${c.oltInfo || ''} ${c.oltPower || ''}`.toLowerCase()).includes(q)
      )
      .slice(0, 6);
  }, [customers, idNumber, matchedCustomer, editingComplaint]);

  const handleMemberSearchInput = (val: string) => {
    setMemberSearchQuery(val);
    setMatchedCustomer(null);
    setSearchNotFoundMsg('');
    const exactMatch = findCustomerByMemberOrPhone(val);
    if (exactMatch) {
      applyCustomerAutoFill(exactMatch);
    }
  };

  const handleManualCustomerSearch = () => {
    const q = memberSearchQuery.trim();
    if (!q) {
      setSearchNotFoundMsg('সদস্য আইডি বা মোবাইল নম্বর লিখে খুঁজুন।');
      return;
    }
    const exactMatch = findCustomerByMemberOrPhone(q);
    if (exactMatch) {
      applyCustomerAutoFill(exactMatch);
      return;
    }
    const normalizedQ = toEnglishDigits(q.toLowerCase());
    const partialMatches = customers.filter((c) =>
      toEnglishDigits(
        `${c.memberId} ${c.name} ${c.phone} ${c.address} ${c.oltInfo || ''} ${c.packageName || ''}`.toLowerCase()
      ).includes(normalizedQ)
    );
    if (partialMatches.length === 1) {
      applyCustomerAutoFill(partialMatches[0]);
      return;
    }
    if (partialMatches.length > 1) {
      setSearchNotFoundMsg(`${partialMatches.length} জন সম্ভাব্য গ্রাহক পাওয়া গেছে — নিচের তালিকা থেকে সিলেক্ট করুন।`);
      return;
    }
    setSearchNotFoundMsg(
      `"${q}" আইডি বা মোবাইল নম্বরের কোনো কাস্টমার তালিকায় পাওয়া যায়নি! চাইলে নিচে তথ্য লিখে সেভ করতে পারেন অথবা পোর্টাল থেকে দেখতে পারেন।`
    );
  };

  const handleIdNumberChange = (val: string) => {
    setIdNumber(val);
    const matched = findCustomerByMemberOrPhone(val);
    if (matched) {
      applyCustomerAutoFill(matched);
    } else if (matchedCustomer) {
      setMatchedCustomer(null);
      setPackageName('');
      setOltInfo('');
      setOltPower('');
      setStatusLabel('');
    }
  };

  const handleGenerateRandomId = () => {
    const randNum = Math.floor(100 + Math.random() * 900);
    handleIdNumberChange(`DBN-${randNum}`);
  };

  if (!isOpen) return null;

  const companyName = company?.name || 'DIP BHOLA NETWORK';
  const groupName = whatsappGroupConfig?.groupName || 'DIP BHOLA NETWORK - Complain Group';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('অনুগ্রহ করে গ্রাহকের নাম লিখুন');
      return;
    }
    if (!idNumber.trim()) {
      setErrorMsg('অনুগ্রহ করে আইডি নম্বর লিখুন');
      return;
    }
    if (!mobileNumber.trim()) {
      setErrorMsg('অনুগ্রহ করে মোবাইল নম্বর লিখুন');
      return;
    }
    if (!address.trim()) {
      setErrorMsg('অনুগ্রহ করে গ্রাহকের ঠিকানা / এলাকা লিখুন');
      return;
    }
    if (!complainDetails.trim()) {
      setErrorMsg('অনুগ্রহ করে অভিযোগের বিস্তারিত বিবরণ লিখুন');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const selectedStaff = staffs.find((s) => s.id === assignedStaffId);
      const assignedName =
        selectedStaff?.name ||
        (currentUser.role === 'staff' && assignedStaffId === currentUser.id ? currentUser.name : undefined);

      const resolvedAutoReason =
        !isManualStaffOverride &&
        autoAssignResult?.staff &&
        autoAssignResult.staff.id === assignedStaffId
          ? autoAssignResult.reasonBengali
          : editingComplaint?.autoAssignedReason;

      const finalPackageName = (packageName || matchedCustomer?.packageName || editingComplaint?.packageName || '').trim();
      const finalOltInfo = (oltInfo || matchedCustomer?.oltInfo || editingComplaint?.oltInfo || '').trim();
      const finalOltPower = (oltPower || matchedCustomer?.oltPower || editingComplaint?.oltPower || '').trim();

      const payload: Omit<CustomerComplaint, 'id' | 'createdAt'> & { id?: string } = {
        ...(editingComplaint?.id ? { id: editingComplaint.id } : {}),
        name: name.trim(),
        idNumber: idNumber.trim(),
        mobileNumber: mobileNumber.trim(),
        address: address.trim(),
        ...(finalPackageName ? { packageName: finalPackageName } : {}),
        ...(finalOltInfo ? { oltInfo: finalOltInfo } : {}),
        ...(finalOltPower ? { oltPower: finalOltPower } : {}),
        complainDetails: complainDetails.trim(),
        date: complaintDate || getTodayString(),
        status,
        priority,
        ...(assignedStaffId ? { assignedStaffId } : {}),
        ...(assignedName ? { assignedStaffName: assignedName } : {}),
        ...(resolvedAutoReason && assignedStaffId ? { autoAssignedReason: resolvedAutoReason } : {}),
        reportedBy: editingComplaint?.reportedBy || currentUser.name,
        reportedById: editingComplaint?.reportedById || currentUser.id,
        ...(resolutionNote.trim() ? { resolutionNote: resolutionNote.trim() } : {}),
        ...(status === 'resolved'
          ? { resolvedAt: editingComplaint?.resolvedAt || new Date().toISOString() }
          : {})
      };

      await onSave(payload);

      // Save newly entered unlisted customer to Directory if requested
      if (!editingComplaint && saveToCustomerDirectory && onSaveNewCustomer && !matchedCustomer) {
        const normalizedId = toEnglishDigits(idNumber.trim().toLowerCase());
        const alreadyExists = customers.some(
          (c) => toEnglishDigits((c.memberId || '').trim().toLowerCase()) === normalizedId
        );
        if (!alreadyExists) {
          onSaveNewCustomer({
            memberId: idNumber.trim(),
            name: name.trim(),
            phone: toEnglishDigits(mobileNumber.trim()),
            address: address.trim(),
            ...(finalPackageName ? { packageName: finalPackageName } : {}),
            ...(finalOltInfo ? { oltInfo: finalOltInfo } : {}),
            ...(finalOltPower ? { oltPower: finalOltPower } : {}),
            status: 'active',
            addedBy: currentUser.name
          }).catch(() => {});
        }
      }

      const smsText = formatComplaintGroupSms(
        { ...payload, createdAt: editingComplaint?.createdAt || new Date().toISOString() },
        companyName,
        groupName
      );

      // Fire optional external WhatsApp bot/gateway webhook asynchronously without blocking UI
      if (whatsappGroupConfig?.webhookUrl) {
        dispatchComplaintToWebhook(whatsappGroupConfig, payload, smsText)
          .then((ok) => {
            if (ok) setWebhookSent(true);
          })
          .catch(() => {});
      }

      if (sendToWhatsAppGroup) {
        setSavedSmsText(smsText);
        // Trigger WhatsApp safely; user also has direct 1-tap WhatsApp Group SMS button on screen
        try {
          openAnchorLinkSafely(buildWhatsAppShareUrl(smsText));
        } catch {
          // ignore popup block; post-save button handles manual 1-tap cleanly
        }
      } else {
        onClose();
      }
    } catch (err) {
      console.error('Error saving complaint:', err);
      const errMessage = err instanceof Error ? err.message : '';
      setErrorMsg(
        errMessage
          ? `অভিযোগ সংরক্ষণ করতে সমস্যা হয়েছে: ${errMessage}`
          : 'অভিযোগ সংরক্ষণ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopySavedSms = () => {
    if (!savedSmsText) return;
    navigator.clipboard.writeText(savedSmsText);
    setCopiedSms(true);
    setTimeout(() => setCopiedSms(false), 2500);
  };

  const quickSymptoms = [
    'ইন্টারনেট নেই (Red Light)',
    'স্পিড স্লো',
    'রাউটার সমস্যা',
    'বিল সংক্রান্ত',
    'অপটিক্যাল ফাইবার ড্রপ ক্যাবল কাটা পড়েছে',
    'কানেকশন ঘন ঘন ড্রপ বা ডিসকানেক্ট হচ্ছে'
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs">
              <Wrench className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {savedSmsText
                  ? 'অভিযোগ সংরক্ষিত হয়েছে · WhatsApp SMS'
                  : editingComplaint
                  ? 'গ্রাহক অভিযোগ সংশোধন'
                  : 'নতুন গ্রাহক অভিযোগ এন্ট্রি'}
              </h2>
              <p className="text-xs text-emerald-100">
                কাস্টমার কমপ্লেইন ও সরাসরি WhatsApp SMS গ্রুপে পাঠান
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Post-Save WhatsApp SMS Group Dispatch Screen */}
        {savedSmsText ? (
          <div className="p-6 space-y-4">
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">
                  {typeof navigator !== 'undefined' && !navigator.onLine
                    ? 'অফলাইনে অভিযোগটি নিরাপদে সংরক্ষিত হয়েছে!'
                    : 'অভিযোগটি সফলভাবে সেভ হয়েছে!'}
                </div>
                <div className="text-xs mt-0.5 text-emerald-800 dark:text-emerald-300">
                  {typeof navigator !== 'undefined' && !navigator.onLine
                    ? 'ইন্টারনেট সংযোগ আসলেই এই অভিযোগটি অটোমেটিক অনলাইনে সেভ হয়ে যাবে। চাইলে নিচের বাটনে SMS কপি বা পাঠাতে পারেন।'
                    : webhookSent
                    ? 'আপনার অটো-বট ওয়েবহুকের মাধ্যমে SMS পাঠানো হয়েছে এবং নিচের বাটন থেকেও WhatsApp গ্রুপে পাঠানো যাবে।'
                    : `এখন নিচের সবুজ বাটনে চাপলেই WhatsApp খুলবে—আপনার "${groupName}" গ্রুপটি সিলেক্ট করে Send চাপুন।`}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                WhatsApp গ্রুপ SMS প্রিভিউ:
              </label>
              <pre className="whitespace-pre-wrap text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-slate-800 dark:text-slate-200 font-sans leading-relaxed max-h-56 overflow-y-auto">
                {savedSmsText}
              </pre>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <a
                href={buildWhatsAppShareUrl(savedSmsText)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[200px] py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp গ্রুপে SMS পাঠান</span>
              </a>

              {whatsappGroupConfig?.groupInviteLink && (
                <a
                  href={whatsappGroupConfig.groupInviteLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-bold text-xs flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>গ্রুপ খুলুন</span>
                </a>
              )}

              <button
                type="button"
                onClick={handleCopySavedSms}
                className="py-3 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
              >
                {copiedSms ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSms ? 'কপি হয়েছে!' : 'SMS কপি'}</span>
              </button>

              <a
                href={buildDeviceSmsUrl(savedSmsText, whatsappGroupConfig?.smsAlertPhone)}
                className="py-3 px-3.5 rounded-xl bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-xs flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>ফোন SMS</span>
              </a>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-xl"
              >
                সম্পন্ন ও বন্ধ করুন
              </button>
            </div>
          </div>
        ) : (
          /* Modal Form Body */
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-300 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Instant Member Search & Auto-Fill Box */}
            {!editingComplaint && (
              <div className="p-3.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-emerald-600" />
                      <span>সদস্য আইডি বা মোবাইল নাম্বার দিয়ে খুঁজুন ({customers.length} জন)</span>
                    </label>
                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                      কাস্টমারের তথ্য ও OLT স্ট্যাটাস দেখতে পোর্টাল বা সার্চ ব্যবহার করুন
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {matchedCustomer && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[10px] font-bold">
                        <UserCheck className="w-3 h-3" />
                        অটো-ফিল হয়েছে
                      </span>
                    )}
                    {onOpenTroubleshootPortal ? (
                      <button
                        type="button"
                        onClick={onOpenTroubleshootPortal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black shadow-xs transition-colors cursor-pointer"
                      >
                        <Wifi className="w-3.5 h-3.5" />
                        <span>🔍 সমস্যা সমাধান পোর্টাল খুলুন</span>
                      </button>
                    ) : (
                      <a
                        href={getEffectiveTroubleshootPortalUrl(company)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black shadow-xs transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>🔍 সমস্যা সমাধান পোর্টাল খুলুন</span>
                      </a>
                    )}
                  </div>
                </div>

                <div className="relative flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={(e) => handleMemberSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleManualCustomerSearch();
                        }
                      }}
                      placeholder="যেমন: NEBW249 বা 01300986693"
                      className="w-full px-3 pr-8 py-2 text-sm rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {memberSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setMemberSearchQuery('');
                          setMatchedCustomer(null);
                          setSearchNotFoundMsg('');
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}

                    {memberLookupMatches.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                        {memberLookupMatches.map((cust) => (
                          <button
                            key={cust.id}
                            type="button"
                            onClick={() => applyCustomerAutoFill(cust)}
                            className="w-full px-3 py-2 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border-b border-slate-100 dark:border-slate-800 last:border-b-0 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-black text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                                <span className="font-mono text-emerald-700 dark:text-emerald-300">
                                  [{cust.memberId}]
                                </span>
                                <span className="truncate">{cust.name}</span>
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                                    cust.status === 'active'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : cust.status === 'inactive'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {cust.statusLabel ||
                                    (cust.status === 'active'
                                      ? 'সচল'
                                      : cust.status === 'inactive'
                                      ? 'বন্ধ'
                                      : 'বিচ্ছিন্ন')}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {cust.phone} • {cust.address}
                                {cust.packageName ? ` • ${cust.packageName}` : ''}
                                {cust.oltInfo ? ` • ${cust.oltInfo}` : ''}
                                {cust.oltPower ? ` • ${cust.oltPower}` : ''}
                              </div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 shrink-0">
                              নির্বাচন
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleManualCustomerSearch}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-xs font-black flex items-center justify-center gap-1.5 shrink-0 shadow-xs transition-colors"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>🔍 তথ্য খুঁজুন</span>
                  </button>
                </div>

                {searchNotFoundMsg && (
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{searchNotFoundMsg}</span>
                  </div>
                )}
              </div>
            )}

            {/* Bhola Dot Net Style Two-Section Customer & OLT/ONU Details Table */}
            {matchedCustomer && (
              <div className="rounded-xl border border-emerald-300 dark:border-emerald-700 overflow-hidden shadow-xs bg-white dark:bg-slate-900">
                <div className="px-3 py-2 bg-emerald-200/80 dark:bg-emerald-900/70 flex items-center justify-between gap-2 border-b border-emerald-300 dark:border-emerald-700">
                  <span className="text-[11px] font-black tracking-wide text-emerald-950 dark:text-emerald-100 uppercase">
                    CUSTOMER INFORMATION
                  </span>
                  {!editingComplaint && (
                    <button
                      type="button"
                      onClick={() => {
                        setMatchedCustomer(null);
                        setMemberSearchQuery('');
                        setPackageName('');
                        setOltInfo('');
                        setOltPower('');
                        setStatusLabel('');
                      }}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-white border border-emerald-300/60"
                    >
                      বদলান
                    </button>
                  )}
                </div>

                <table className="w-full text-xs border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <td className="w-2/5 px-3 py-1.5 font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 border-r border-slate-200 dark:border-slate-800">
                        CUSTOMER ID
                      </td>
                      <td className="px-3 py-1.5 font-mono font-black text-slate-900 dark:text-amber-300">
                        {matchedCustomer.memberId}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-1.5 font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 border-r border-slate-200 dark:border-slate-800">
                        CUSTOMER NAME
                      </td>
                      <td className="px-3 py-1.5 font-black text-slate-900 dark:text-white">
                        {matchedCustomer.name}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-1.5 font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 border-r border-slate-200 dark:border-slate-800">
                        CONTACT NO
                      </td>
                      <td className="px-3 py-1.5">
                        <a
                          href={`tel:${matchedCustomer.phone}`}
                          className="font-black text-emerald-700 dark:text-emerald-300 hover:underline inline-flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          {matchedCustomer.phone}
                        </a>
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-1.5 font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 border-r border-slate-200 dark:border-slate-800">
                        PACKAGE
                      </td>
                      <td className="px-3 py-1.5 font-bold text-slate-800 dark:text-slate-100">
                        {matchedCustomer.packageName || 'উল্লেখ নেই'}
                        {matchedCustomer.monthlyFee
                          ? ` (${formatCurrency(matchedCustomer.monthlyFee)}/মাস)`
                          : ''}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-1.5 font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 border-r border-slate-200 dark:border-slate-800">
                        STATUS
                      </td>
                      <td
                        className={`px-3 py-1.5 font-black ${
                          matchedCustomer.status === 'active'
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : matchedCustomer.status === 'inactive'
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {statusLabel ||
                          matchedCustomer.statusLabel ||
                          (matchedCustomer.status === 'active'
                            ? 'Unlocked / Active (সচল)'
                            : matchedCustomer.status === 'inactive'
                            ? 'Inactive (সাময়িক বন্ধ)'
                            : 'Disconnected (বিচ্ছিন্ন)')}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-1.5 font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 border-r border-slate-200 dark:border-slate-800">
                        ADDRESS
                      </td>
                      <td className="px-3 py-1.5 font-bold text-slate-800 dark:text-slate-100">
                        {matchedCustomer.address}
                      </td>
                    </tr>
                    <tr>
                      <th
                        colSpan={2}
                        className="px-3 py-1.5 text-center text-[11px] font-black tracking-wide text-emerald-950 dark:text-emerald-100 bg-emerald-200/80 dark:bg-emerald-900/70 border-y border-emerald-300 dark:border-emerald-700 uppercase"
                      >
                        OLT &amp; ONU DETAILS
                      </th>
                    </tr>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-1.5 font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 border-r border-slate-200 dark:border-slate-800">
                        OLT &amp; PON
                      </td>
                      <td className="px-3 py-1.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {matchedCustomer.oltInfo || 'তালিকায় দেওয়া নেই'}
                      </td>
                    </tr>
                    <tr className={matchedCustomer.notes ? 'border-b border-slate-200 dark:border-slate-800' : ''}>
                      <td className="px-3 py-1.5 font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 border-r border-slate-200 dark:border-slate-800">
                        POWER / DIST
                      </td>
                      <td className="px-3 py-1.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {matchedCustomer.oltPower || 'তালিকায় দেওয়া নেই'}
                      </td>
                    </tr>
                    {matchedCustomer.notes && (
                      <tr>
                        <td className="px-3 py-1.5 font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 border-r border-slate-200 dark:border-slate-800">
                          NOTE
                        </td>
                        <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">
                          {matchedCustomer.notes}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1. Customer Name (গ্রাহকের নাম) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  গ্রাহকের নাম (Name) *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="যেমন: মোঃ হোসেন / হারুন"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* 2. Customer ID / Line ID (আইডি / সদস্য নম্বর) */}
              <div className="relative">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    সদস্য / আইডি নম্বর (Member ID) *
                  </label>
                  {matchedCustomer ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      <UserCheck className="w-3 h-3" />
                      অটো-ফিল
                    </span>
                  ) : (
                    !editingComplaint && (
                      <button
                        type="button"
                        onClick={handleGenerateRandomId}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      >
                        + অটো আইডি
                      </button>
                    )
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={idNumber}
                  onChange={(e) => handleIdNumberChange(e.target.value)}
                  placeholder="সদস্য নম্বর লিখুন (যেমন: DBN-101 / 1024)"
                  className={`w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none font-mono ${
                    matchedCustomer
                      ? 'border-emerald-500 dark:border-emerald-500 ring-1 ring-emerald-500/40'
                      : 'border-slate-300 dark:border-slate-700'
                  }`}
                />
                {idFieldSuggestions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                    {idFieldSuggestions.map((cust) => (
                      <button
                        key={cust.id}
                        type="button"
                        onClick={() => applyCustomerAutoFill(cust)}
                        className="w-full px-3 py-1.5 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border-b border-slate-100 dark:border-slate-800 last:border-b-0 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                            <span className="font-mono text-emerald-700 dark:text-emerald-300 mr-1.5">
                              [{cust.memberId}]
                            </span>
                            {cust.name}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {cust.phone} • {cust.address}
                            {cust.packageName ? ` • ${cust.packageName}` : ''}
                            {cust.oltInfo ? ` • ${cust.oltInfo}` : ''}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                          সম্পূর্ণ তথ্য
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Mobile Number (মোবাইল নম্বর) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  মোবাইল নম্বর (Mobile Number) *
                </label>
                <input
                  type="tel"
                  required
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="যেমন: 01721200049"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* 4. Address / Area (ঠিকানা) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  ঠিকানা / এলাকা (Address) *
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="যেমন: বিশ্বরোড মোড় / বাপ্তা / ভোলা সদর"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* 5. OLT & PON + ONU Power (dBm / Dist) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Router className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  OLT ও PON পোর্ট (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={oltInfo}
                  onChange={(e) => setOltInfo(e.target.value)}
                  placeholder="যেমন: EPON0/1/3:32"
                  className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  ONU পাওয়ার (dBm / দূরত্ব)
                </label>
                <input
                  type="text"
                  value={oltPower}
                  onChange={(e) => setOltPower(e.target.value)}
                  placeholder="যেমন: -18.7 dBm | 2290 meter"
                  className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* 6. Complaint Date */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  অভিযোগের তারিখ (তারিখ অনুযায়ী সংরক্ষণের জন্য)
                </label>
                <input
                  type="date"
                  value={complaintDate}
                  onChange={(e) => setComplaintDate(e.target.value)}
                  className="w-full sm:w-64 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* 7. Problem Type Select + Complain Details (সমস্যার ধরন ও বিবরণ) */}
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  সমস্যার ধরন (দ্রুত বাছাই)
                </label>
                <select
                  value=""
                  onChange={(e) => {
                    const chosen = e.target.value;
                    if (!chosen) return;
                    setComplainDetails((prev) => {
                      const trimmed = prev.trim();
                      if (!trimmed) return chosen;
                      if (trimmed.startsWith(chosen)) return trimmed;
                      return `${chosen} — ${trimmed}`;
                    });
                  }}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">-- সমস্যার ধরন নির্বাচন করুন --</option>
                  <option value="ইন্টারনেট নেই (Red Light / LOS)">ইন্টারনেট নেই (Red Light / LOS)</option>
                  <option value="স্পিড স্লো / বাফারিং">স্পিড স্লো / বাফারিং</option>
                  <option value="রাউটার কনফিগারেশন / পাসওয়ার্ড">রাউটার কনফিগারেশন / পাসওয়ার্ড</option>
                  <option value="ফাইবার তার কাটা (Fiber Cut)">ফাইবার তার কাটা (Fiber Cut)</option>
                  <option value="বিল / সংযোগ চালু করা">বিল / সংযোগ চালু করা</option>
                  <option value="অন্যান্য সমস্যা">অন্যান্য সমস্যা</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  অভিযোগের বিবরণ / বিস্তারিত নোট (Complain Details) *
                </label>
                <textarea
                  required
                  rows={3}
                  value={complainDetails}
                  onChange={(e) => setComplainDetails(e.target.value)}
                  placeholder="টেকনিশিয়ানের জন্য কোনো বিশেষ নির্দেশনা বা সমস্যার বিবরণ লিখুন..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
                {/* Quick symptom picker */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 self-center">দ্রুত নির্বাচন:</span>
                  {quickSymptoms.map((sym, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setComplainDetails(sym)}
                      className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 transition-colors"
                    >
                      {sym.length > 25 ? sym.slice(0, 25) + '...' : sym}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Priority & Status & Assigned Staff */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              {/* Priority */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  অগ্রাধিকার (Priority)
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as ComplaintPriority)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="normal">🔵 সাধারণ (Normal - Blue)</option>
                  <option value="urgent">🟠 জরুরি (Urgent - Orange)</option>
                  <option value="critical">🔴 অতি জরুরি (Critical - Red)</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  স্ট্যাটাস (Status)
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ComplaintStatus)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="pending">⏳ পেন্ডিং (Pending)</option>
                  <option value="in_progress">🔧 কাজ চলছে (In Progress)</option>
                  <option value="resolved">✅ সমাধানকৃত (Resolved)</option>
                </select>
              </div>

              {/* Assigned Staff (Director/Manager only; Staff keeps self assignment) */}
              {currentUser.role !== 'staff' && (
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      দায়িত্বপ্রাপ্ত টেকনিশিয়ান
                    </label>
                    {autoAssignResult?.staff && (isManualStaffOverride || assignedStaffId !== autoAssignResult.staff.id) && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsManualStaffOverride(false);
                          if (autoAssignResult.staff) {
                            setAssignedStaffId(autoAssignResult.staff.id);
                          }
                        }}
                        className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
                      >
                        অটো-ম্যাচ দিন
                      </button>
                    )}
                  </div>
                  <select
                    value={assignedStaffId}
                    onChange={(e) => {
                      setIsManualStaffOverride(true);
                      setAssignedStaffId(e.target.value);
                    }}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">-- অটো / কাউকে নিয়োগ দেওয়া হয়নি --</option>
                    {staffs.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.designation || 'টেকনিশিয়ান'})
                        {s.assignedAreas && s.assignedAreas.length > 0
                          ? ` — [${s.assignedAreas.slice(0, 2).join(', ')}]`
                          : ''}
                      </option>
                    ))}
                  </select>
                  {autoAssignResult?.staff && assignedStaffId === autoAssignResult.staff.id && !isManualStaffOverride && (
                    <div className="mt-1.5 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate">{autoAssignResult.reasonBengali}</span>
                    </div>
                  )}
                  {historySuggestion?.hasLocationHistory && historySuggestion.suggestedStaff && (
                    <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-2">
                      <span className="truncate">
                        ⭐ সেরা প্রস্তাব: {historySuggestion.suggestedStaff.name} ({historySuggestion.resolvedCountInLocation}/{historySuggestion.totalCountInLocation} সমাধান, {historySuggestion.successRatePct}%)
                      </span>
                      {assignedStaffId !== historySuggestion.suggestedStaff.id && (
                        <button
                          type="button"
                          onClick={() => {
                            if (historySuggestion.suggestedStaff) {
                              setIsManualStaffOverride(true);
                              setAssignedStaffId(historySuggestion.suggestedStaff.id);
                            }
                          }}
                          className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-black shrink-0 cursor-pointer"
                        >
                          বাছাই করুন
                        </button>
                      )}
                    </div>
                  )}
                  {staffs.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {staffs.slice(0, 6).map((s) => (
                        <button
                          key={`chip-${s.id}`}
                          type="button"
                          onClick={() => {
                            setIsManualStaffOverride(true);
                            setAssignedStaffId(s.id);
                          }}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                            assignedStaffId === s.id
                              ? 'bg-emerald-600 text-white border-emerald-700'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Resolution Note (shown if resolving or edit) */}
            {(status === 'resolved' || editingComplaint?.resolutionNote) && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/50 space-y-2">
                <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  সমাধানের বিবরণ ও ফলাফল (Resolution Note)
                </label>
                <input
                  type="text"
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="যেমন: ফাইবার স্প্লাইসিং সম্পন্ন, সিগন্যাল ওকে, নেট চালু হয়েছে।"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            )}

            {/* Save new customer to Customer Directory checkbox */}
            {!editingComplaint && !matchedCustomer && onSaveNewCustomer && (
              <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  এই গ্রাহককে স্থায়ীভাবে সদস্য তালিকায় সেভ করুন (পরবর্তীতে সার্চে অটো চলে আসবে)
                </div>
                <input
                  type="checkbox"
                  checked={saveToCustomerDirectory}
                  onChange={(e) => setSaveToCustomerDirectory(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
                />
              </label>
            )}

            {/* WhatsApp SMS Group Auto-Send Option */}
            <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-[#25D366] text-slate-950 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-4 h-4" />
                </span>
                <div>
                  <div className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                    সংরক্ষণের পর WhatsApp SMS গ্রুপে পাঠান
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    টার্গেট গ্রুপ: {groupName}
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={sendToWhatsAppGroup}
                onChange={(e) => setSendToWhatsAppGroup(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              />
            </label>

            {/* Footer buttons */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 text-sm font-black text-white bg-gradient-to-r from-[#25D366] via-emerald-600 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'সংরক্ষণ হচ্ছে...'
                      : editingComplaint
                      ? 'আপডেট করুন'
                      : sendToWhatsAppGroup
                      ? '📲 স্টাফ WhatsApp গ্রুপে অভিযোগ পাঠান'
                      : 'অভিযোগ দাখিল করুন'}
                  </span>
                </button>
              </div>

              {whatsappGroupConfig?.groupInviteLink && (
                <div className="text-center">
                  <a
                    href={whatsappGroupConfig.groupInviteLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 underline hover:text-emerald-800"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>সরাসরি স্টাফ WhatsApp গ্রুপ ওপেন করুন</span>
                  </a>
                </div>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

