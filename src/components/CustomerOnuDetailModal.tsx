import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Box,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Cpu,
  Edit2,
  Gauge,
  Globe,
  MapPin,
  Phone,
  Router,
  Ruler,
  ShieldCheck,
  Signal,
  Split,
  Wifi,
  Wrench,
  X
} from 'lucide-react';
import { CustomerMember, OnuLossStatus } from '../types';
import { formatCurrency, toBengaliNumber, toEnglishDigits } from '../utils/formatters';

function localIsWeakOrPhoneCustomerName(name?: string, memberId?: string, onuMac?: string): boolean {
  const n = toEnglishDigits((name || '').trim());
  if (!n || n.length < 2) return true;
  if (/^01\d{8,9}$/.test(n.replace(/[\s-]/g, ''))) return true;
  if (/^\d{7,14}$/.test(n.replace(/[\s-]/g, ''))) return true;
  if (/^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(n)) return true;
  if (memberId && n.toLowerCase() === toEnglishDigits(memberId.trim()).toLowerCase()) return true;
  if (onuMac && n.toLowerCase() === onuMac.trim().toLowerCase()) return true;
  return false;
}

function localParseOnuDetailPaste(rawText: string): {
  name?: string;
  oltInfo?: string;
  rxPower?: string;
  txPower?: string;
  fiberLength?: string;
  onuMac?: string;
  downloadSpeed?: string;
  uploadSpeed?: string;
  pingLatency?: string;
  tjBox?: string;
} {
  const text = toEnglishDigits(rawText || '').trim();
  if (!text) return {};

  const out: {
    name?: string;
    oltInfo?: string;
    rxPower?: string;
    txPower?: string;
    fiberLength?: string;
    onuMac?: string;
    downloadSpeed?: string;
    uploadSpeed?: string;
    pingLatency?: string;
    tjBox?: string;
  } = {};

  const oltMatch = text.match(/(?:^|\n|\s)OLT\s*[:=]\s*([^\n\r]+)/i);
  const portMatch = text.match(/(?:Onu\s*Port|PON\s*Port|Port)\s*[:=]\s*([^\n\r]+)/i);
  if (oltMatch && portMatch) {
    out.oltInfo = `${oltMatch[1].trim()} (${portMatch[1].trim()})`;
  } else if (oltMatch) {
    out.oltInfo = oltMatch[1].trim();
  } else if (portMatch) {
    out.oltInfo = portMatch[1].trim();
  }

  const rxMatch = text.match(/(?:Rx\s*Power|Power)\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*(?:dBm)?/i);
  if (rxMatch) out.rxPower = `${rxMatch[1]} dBm`;

  const txMatch = text.match(/Tx\s*Power\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*(?:dBm)?/i);
  if (txMatch) out.txPower = `${txMatch[1]} dBm`;

  const distMatch = text.match(/(?:Distance|Length)\s*[:=]\s*(\d+(?:\.\d+)?)\s*(?:meter|meters|mtr|m)?/i);
  if (distMatch) out.fiberLength = `${distMatch[1]} meter`;

  const macMatch = text.match(/([0-9A-Fa-f]{2}(?:[:-][0-9A-Fa-f]{2}){5})/);
  if (macMatch) out.onuMac = macMatch[1].toUpperCase();

  const dlMatch = text.match(/(?:Download|DL)\s*[:=]\s*(\d+(?:\.\d+)?)\s*(?:Mbps|M)?/i);
  if (dlMatch) out.downloadSpeed = `${dlMatch[1]} Mbps`;

  const ulMatch = text.match(/(?:Upload|UL)\s*[:=]\s*(\d+(?:\.\d+)?)\s*(?:Mbps|M)?/i);
  if (ulMatch) out.uploadSpeed = `${ulMatch[1]} Mbps`;

  const pingMatch = text.match(/Ping\s*[:=]\s*(\d+(?:\.\d+)?)\s*(?:ms)?/i);
  if (pingMatch) out.pingLatency = `${pingMatch[1]} ms`;

  const tjMatch = text.match(/(?:TJ\s*Box|TJ)\s*[:=]\s*([^\n\r]+)/i);
  if (tjMatch) out.tjBox = tjMatch[1].trim();

  const nameMatch = text.match(/(?:Customer\s*Name|Name)\s*[:=]\s*([^\n\r]+)/i);
  if (nameMatch) out.name = nameMatch[1].trim();

  return out;
}

interface CustomerOnuDetailModalProps {
  customer: CustomerMember | null;
  onClose: () => void;
  onUpdateCustomer?: (id: string, updates: Partial<CustomerMember>) => Promise<void>;
  onCreateComplaint?: (customer: CustomerMember) => void;
  onOpenTroubleshootPortal?: () => void;
  startInEditMode?: boolean;
}

const QUICK_RX_CHIPS = ['-18.5 dBm', '-21.8 dBm', '-24.5 dBm', '-27.5 dBm'];
const QUICK_TX_CHIPS = ['2.2 dBm', '2.5 dBm', '3.0 dBm'];
const QUICK_SPEED_CHIPS = ['10 Mbps', '20 Mbps', '30 Mbps', '50 Mbps'];
const QUICK_LENGTH_CHIPS = ['300 meter', '750 meter', '1200 meter', '1500 meter'];

const LOSS_TYPE_OPTIONS: Array<{ value: OnuLossStatus; label: string }> = [
  { value: 'normal', label: 'স্বাভাবিক (কোনো লস নেই)' },
  { value: 'high_loss', label: 'হাই অপটিক্যাল লস (Rx কম)' },
  { value: 'los', label: 'ফাইবার কাটা / LOS (Red Light)' },
  { value: 'dying_gasp', label: 'বিদ্যুৎ নেই / অনু বন্ধ (Dying Gasp)' },
  { value: 'tj_fault', label: 'টিজি বক্সে জয়েন্ট লস (TJ Fault)' },
  { value: 'splitter_fault', label: 'স্প্লিটার পোর্ট লস / সমস্যা' }
];

const FAULT_REASON_CHIPS = [
  'টিজি বক্সে জয়েন্ট / স্প্লাইস লস',
  'স্প্লিটার পোর্ট ড্যামেজ বা হাই লস',
  'ড্রপ ফাইবার কাটা / ব্যান্ড (LOS)',
  'অনু কানেক্টর / প্যাচ কর্ড লুজ',
  'বাসায় বিদ্যুৎ নেই (Dying Gasp)',
  'পিং হাই / ব্যান্ডউইথ ড্রপ'
];

function normDbm(raw: string): string {
  const s = toEnglishDigits(raw || '').trim();
  if (!s) return '';
  if (/^-?\d+(?:\.\d+)?$/.test(s)) return `${s} dBm`;
  return s;
}

function normSpeed(raw: string): string {
  const s = toEnglishDigits(raw || '').trim();
  if (!s) return '';
  if (/^\d+(?:\.\d+)?$/.test(s)) return `${s} Mbps`;
  return s;
}

function normMeter(raw: string): string {
  const s = toEnglishDigits(raw || '').trim();
  if (!s) return '';
  if (/^\d+(?:\.\d+)?$/.test(s)) return `${s} meter`;
  return s;
}

function parseFirstNum(raw?: string): number | null {
  if (!raw) return null;
  const m = toEnglishDigits(raw).match(/(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function parseDistanceMeters(raw?: string): number | null {
  if (!raw) return null;
  const eng = toEnglishDigits(raw).trim();
  const kmM = eng.match(/(\d+(?:\.\d+)?)\s*km/i);
  if (kmM) {
    const v = Number(kmM[1]);
    return Number.isFinite(v) ? Math.round(v * 1000) : null;
  }
  const mM = eng.match(/(\d+(?:\.\d+)?)\s*(?:meter|meters|mtr|m)?\b/i);
  if (mM) {
    const v = Number(mM[1]);
    return Number.isFinite(v) ? Math.round(v) : null;
  }
  return null;
}

export const CustomerOnuDetailModal: React.FC<CustomerOnuDetailModalProps> = ({
  customer,
  onClose,
  onUpdateCustomer,
  onCreateComplaint,
  onOpenTroubleshootPortal,
  startInEditMode = false
}) => {
  const [isEditing, setIsEditing] = useState(startInEditMode);
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'disconnected'>('active');
  const [oltInfo, setOltInfo] = useState('');
  const [rxPower, setRxPower] = useState('');
  const [txPower, setTxPower] = useState('');
  const [downloadSpeed, setDownloadSpeed] = useState('');
  const [uploadSpeed, setUploadSpeed] = useState('');
  const [fiberLength, setFiberLength] = useState('');
  const [pingLatency, setPingLatency] = useState('');
  const [onuMac, setOnuMac] = useState('');
  const [tjBox, setTjBox] = useState('');
  const [tjLoss, setTjLoss] = useState('');
  const [splitterName, setSplitterName] = useState('');
  const [splitterLoss, setSplitterLoss] = useState('');
  const [lossStatus, setLossStatus] = useState<OnuLossStatus>('normal');
  const [issueReason, setIssueReason] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!customer) return;
    setCustomerName(customer.name || '');
    setStatus(customer.status || 'active');
    setOltInfo(customer.oltInfo || '');
    setRxPower(customer.rxPower || '');
    setTxPower(customer.txPower || '');
    setDownloadSpeed(customer.downloadSpeed || '');
    setUploadSpeed(customer.uploadSpeed || '');
    setFiberLength(customer.fiberLength || '');
    setPingLatency(customer.pingLatency || '');
    setOnuMac(customer.onuMac || '');
    setTjBox(customer.tjBox || '');
    setTjLoss(customer.tjLoss || '');
    setSplitterName(customer.splitterName || '');
    setSplitterLoss(customer.splitterLoss || '');
    setLossStatus(customer.lossStatus || 'normal');
    setIssueReason(customer.issueReason || '');
    setNotes(customer.notes || '');
    setSaveToast(null);
    setIsPasteOpen(false);
    setPasteText('');
    setIsEditing(Boolean(startInEditMode));
  }, [customer, startInEditMode]);

  const diagnosis = useMemo(() => {
    if (!customer) return null;
    const rxNum = parseFirstNum(isEditing ? rxPower : customer.rxPower || customer.oltPower);
    const txNum = parseFirstNum(isEditing ? txPower : customer.txPower);
    const lenMeters = parseDistanceMeters(isEditing ? fiberLength : customer.fiberLength || customer.oltPower);
    const tjLossNum = parseFirstNum(isEditing ? tjLoss : customer.tjLoss);
    const spLossNum = parseFirstNum(isEditing ? splitterLoss : customer.splitterLoss);
    const pingNum = parseFirstNum(isEditing ? pingLatency : customer.pingLatency);
    const curStatus = isEditing ? status : customer.status;
    const curLoss = isEditing ? lossStatus : customer.lossStatus || 'normal';
    const curTj = (isEditing ? tjBox : customer.tjBox || '').trim();
    const curSp = (isEditing ? splitterName : customer.splitterName || '').trim();
    const curReason = (isEditing ? issueReason : customer.issueReason || '').trim();

    let signalLabel = 'অজানা (পাওয়ার দিন)';
    let signalTier: 'good' | 'fair' | 'critical' | 'unknown' = 'unknown';
    let signalMeterPct = 0;

    if (rxNum !== null) {
      // Map -10 (100%) down to -34 (10%)
      signalMeterPct = Math.max(8, Math.min(100, Math.round(((rxNum + 35) / 25) * 100)));
      if (rxNum >= -24.5) {
        signalTier = 'good';
        signalLabel = `ভালো সিগন্যাল (${rxNum} dBm)`;
      } else if (rxNum >= -27.2) {
        signalTier = 'fair';
        signalLabel = `মাঝারি লস (${rxNum} dBm)`;
      } else {
        signalTier = 'critical';
        signalLabel = `হাই লস / ক্রিটিক্যাল (${rxNum} dBm)`;
      }
    }

    const expectedFiberLossDb =
      lenMeters !== null ? Number(((lenMeters / 1000) * 0.35).toFixed(2)) : null;

    const lossPoints: string[] = [];
    const solutions: string[] = [];

    if (curStatus === 'disconnected' || curLoss === 'los') {
      lossPoints.push('অনু সম্পূর্ণ LOS (ফাইবার কাটা বা OLT থেকে সিগন্যাল আসছে না)');
      solutions.push(
        `১. ${curTj || 'টিজি বক্স'} থেকে গ্রাহকের বাসা (${lenMeters ? `${lenMeters} মিটার` : 'ড্রপ কেবল'}) পর্যন্ত ফাইবার কাটা বা ভাঙা আছে কিনা দেখুন।`
      );
      solutions.push('২. পাওয়ার মিটার দিয়ে টিজি বক্সের ইনপুট ও আউটপুট dBm পরীক্ষা করে পigtail / জয়েন্ট রিস্প্লাইস করুন।');
    }

    if (rxNum !== null && rxNum < -27.2) {
      lossPoints.push(`অপটিক্যাল Rx পাওয়ার ক্রিটিক্যাল (${rxNum} dBm — অনু স্থিতিশীল থাকতে -২৫ dBm-এর বেশি ভালো)`);
      solutions.push(
        `• ${curTj || 'নিকটস্থ টিজি বক্স'} ও ${curSp || 'স্প্লিটার'} পোর্টের Rx পাওয়ার মাপুন (লস ৩ dB-এর বেশি হলে জয়েন্ট নতুন করে করুন)।`
      );
    } else if (rxNum !== null && rxNum < -24.5) {
      lossPoints.push(`অপটিক্যাল পাওয়ার কিছুটা দুর্বল (${rxNum} dBm — জয়েন্ট/বেন্ড লস থাকতে পারে)`);
      solutions.push('• অনুর পেছনের SC/APC বা SC/UPC প্যাচ কর্ড ও অ্যালকোহল দিয়ে কানেক্টর পরিষ্কার করুন।');
    }

    if (tjLossNum !== null && Math.abs(tjLossNum) >= 2.2) {
      lossPoints.push(`${curTj || 'টিজি বক্সে'} অতিরিক্ত জয়েন্ট লস (${tjLossNum} dB)`);
      solutions.push(`• ${curTj || 'টিজি বক্স'} খুলে ফিউশন স্প্লাইস/ট্রে ব্যান্ড ঠিক করে পুনরায় স্প্লাইস করুন।`);
    } else if (curLoss === 'tj_fault') {
      lossPoints.push(`${curTj || 'টিজি বক্সে'} ফল্ট চিহ্নিত রয়েছে`);
      solutions.push(`• ${curTj || 'টিজি বক্স'} পরীক্ষা ও ওয়াটার/ডাস্ট ক্লিনিং করুন।`);
    }

    if (spLossNum !== null && Math.abs(spLossNum) >= 12) {
      lossPoints.push(`${curSp || 'স্প্লিটারে'} অতিরিক্ত পোর্ট লস (${spLossNum} dB)`);
      solutions.push(`• ${curSp || 'স্প্লিটারে'} খালি অন্য একটি পোর্টে গ্রাহকের ড্রপ ফাইবার পরিবর্তন করে দিন।`);
    } else if (curLoss === 'splitter_fault') {
      lossPoints.push(`${curSp || 'স্প্লিটার'} পোর্টে সমস্যা চিহ্নিত`);
      solutions.push('• স্প্লিটার আউটপুট পাওয়ার যাচাই করে পোর্ট সুইচ করুন।');
    }

    if (txNum !== null && (txNum < 0 || txNum > 6)) {
      lossPoints.push(`ONU Tx লেজার পাওয়ার অস্বাভাবিক (${txNum} dBm)`);
      solutions.push('• অনুর Tx পাওয়ার দুর্বল বা বেশি হলে অনু রিস্টার্ট দিন অথবা অনু ডিভাইস পরিবর্তন করে দেখুন।');
    }

    if (pingNum !== null && pingNum > 80) {
      lossPoints.push(`হাই Ping / ল্যাটেন্সি (${pingNum} ms) — প্যাকেট লস বা রাউটার লোড`);
      solutions.push('• OLT PON পোর্টের অপটিক্যাল CRC এরর ও গ্রাহকের রাউটার/MAC ডুপ্লিকেট চেক করুন।');
    }

    if (curLoss === 'dying_gasp') {
      lossPoints.push('গ্রাহকের বাসায় বিদ্যুৎ নেই বা অনু অ্যাডাপ্টার বন্ধ (Dying Gasp)');
      solutions.push('• গ্রাহককে কল দিয়ে অনুর লাল/সবুজ আলো ও ১২V পাওয়ার অ্যাডাপ্টার চেক করতে বলুন।');
    }

    if (curReason && !lossPoints.some((p) => p.includes(curReason))) {
      lossPoints.push(`চিহ্নিত সমস্যা: ${curReason}`);
    }

    if (lossPoints.length === 0) {
      if (curStatus === 'inactive') {
        lossPoints.push('অ্যাকাউন্ট Deactivate / সংযোগ মেয়াদ শেষ বা সাময়িক বন্ধ');
        solutions.push('• সংযোগ স্ট্যাটাস যাচাই করে অ্যাপ থেকে Active করুন।');
      } else {
        lossPoints.push('স্বাভাবিক — এই মুহূর্তে কোনো অপটিক্যাল লস বা লাইন ফল্ট নেই।');
        solutions.push(
          rxNum !== null
            ? `• বর্তমান সিগন্যাল (${rxNum} dBm) আদর্শ সীমার মধ্যে রয়েছে।`
            : '• লস ট্র্যাক করতে Rx পাওয়ার, Length (meter) ও TJ বক্স যুক্ত করুন।'
        );
      }
    }

    return {
      rxNum,
      txNum,
      lenMeters,
      expectedFiberLossDb,
      signalLabel,
      signalTier,
      signalMeterPct,
      lossPoints,
      solutions
    };
  }, [
    customer,
    isEditing,
    rxPower,
    txPower,
    fiberLength,
    tjLoss,
    splitterLoss,
    pingLatency,
    status,
    lossStatus,
    tjBox,
    splitterName,
    issueReason
  ]);

  if (!customer || !diagnosis) return null;

  const isOnline = (isEditing ? status : customer.status) === 'active';

  const handleApplyBholaPaste = () => {
    const parsed = localParseOnuDetailPaste(pasteText);
    if (parsed.name && !localIsWeakOrPhoneCustomerName(parsed.name, customer.memberId, parsed.onuMac || onuMac)) {
      setCustomerName(parsed.name);
    }
    if (parsed.oltInfo) setOltInfo(parsed.oltInfo);
    if (parsed.rxPower) setRxPower(parsed.rxPower);
    if (parsed.txPower) setTxPower(parsed.txPower);
    if (parsed.fiberLength) setFiberLength(parsed.fiberLength);
    if (parsed.onuMac) setOnuMac(parsed.onuMac);
    if (parsed.downloadSpeed) setDownloadSpeed(parsed.downloadSpeed);
    if (parsed.uploadSpeed) setUploadSpeed(parsed.uploadSpeed);
    if (parsed.pingLatency) setPingLatency(parsed.pingLatency);
    if (parsed.tjBox) setTjBox(parsed.tjBox);
    setIsPasteOpen(false);
    setPasteText('');
    setSaveToast('পোর্টাল বিবরণ থেকে Rx, Tx, Length (meter), MAC ও OLT তথ্য অটো-ফিল হয়েছে — নিচে সংরক্ষণ করুন।');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateCustomer || isSaving) return;
    setIsSaving(true);
    try {
      const cleanRx = normDbm(rxPower);
      const cleanTx = normDbm(txPower);
      const cleanDl = normSpeed(downloadSpeed);
      const cleanUl = normSpeed(uploadSpeed);
      const cleanLen = normMeter(fiberLength);
      const cleanMac = onuMac.trim().toUpperCase();
      const combinedPower = [cleanRx, cleanTx ? `Tx: ${cleanTx}` : '', cleanLen]
        .filter(Boolean)
        .join(' | ');
      const defaultStatusLabel =
        status === 'active'
          ? 'Active (Online)'
          : status === 'inactive'
          ? 'Deactivate (বন্ধ)'
          : 'Disconnected / LOS';
      const cleanedName = customerName.trim();

      await onUpdateCustomer(customer.id, {
        ...(cleanedName ? { name: cleanedName } : {}),
        status,
        statusLabel: customer.statusLabel || defaultStatusLabel,
        oltInfo: oltInfo.trim(),
        oltPower: combinedPower || customer.oltPower || '',
        rxPower: cleanRx,
        txPower: cleanTx,
        downloadSpeed: cleanDl,
        uploadSpeed: cleanUl,
        fiberLength: cleanLen,
        pingLatency: pingLatency.trim(),
        onuMac: cleanMac,
        tjBox: tjBox.trim(),
        tjLoss: tjLoss.trim(),
        splitterName: splitterName.trim(),
        splitterLoss: splitterLoss.trim(),
        lossStatus,
        issueReason: issueReason.trim(),
        notes: notes.trim()
      });

      setRxPower(cleanRx);
      setTxPower(cleanTx);
      setDownloadSpeed(cleanDl);
      setUploadSpeed(cleanUl);
      setFiberLength(cleanLen);
      setOnuMac(cleanMac);
      setIsEditing(false);
      setSaveToast('সদস্যের নাম, Rx/Tx, স্পিড, অপটিক্যাল Length, MAC, TJ ও লাইন ফল্ট তথ্য ক্লাউডে সেভ হয়েছে।');
    } finally {
      setIsSaving(false);
    }
  };

  const hasWeakStoredName = localIsWeakOrPhoneCustomerName(customerName, customer.memberId, onuMac);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#07111a] text-slate-100 rounded-2xl max-w-3xl w-full shadow-2xl border border-emerald-500/40 overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Top Modal Header (Mobile-clean 3-row hierarchy, zero cramping at 360px) */}
        <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-[#042f22] via-emerald-950 to-[#091827] border-b border-emerald-500/30 space-y-2.5 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                <Router className="w-4 h-4 text-amber-300" />
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 text-xs font-mono font-bold whitespace-nowrap">
                ID: {customer.memberId}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                  isOnline
                    ? 'bg-emerald-500/15 border border-emerald-400/35 text-emerald-300'
                    : 'bg-rose-500/15 border border-rose-400/35 text-rose-300'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isOnline ? 'bg-emerald-400 ring-2 ring-emerald-400/30' : 'bg-rose-500 ring-2 ring-rose-500/30'
                  }`}
                />
                <span>{isOnline ? 'Active (অনলাইন)' : status === 'inactive' ? 'Deactivate' : 'LOS / বিচ্ছিন্ন'}</span>
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="বন্ধ করুন"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-white break-words leading-snug">
                {customerName || `সদস্য #${customer.memberId}`}
              </h3>
              {hasWeakStoredName && (
                <div className="text-[11px] text-amber-300/90 font-semibold mt-0.5">
                  গ্রাহকের সঠিক নাম ও টেলিমেট্রি যোগ করতে "টেলিমেট্রি যোগ / এডিট" চাপুন
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onOpenTroubleshootPortal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenTroubleshootPortal();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1.5 whitespace-nowrap transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>সমস্যা সমাধান পোর্টাল</span>
                </button>
              )}

              {onUpdateCustomer && (
                <button
                  type="button"
                  onClick={() => setIsEditing((v) => !v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    isEditing
                      ? 'bg-emerald-400 text-slate-950 font-black'
                      : 'bg-emerald-700 hover:bg-emerald-600 text-white'
                  }`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'ভিউ দেখুন' : 'টেলিমেট্রি যোগ / এডিট'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {saveToast && (
            <div className="px-3.5 py-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{saveToast}</span>
              </div>
              <button type="button" onClick={() => setSaveToast(null)}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 1. CUSTOMER INFORMATION & CONNECTION STATUS SUMMARY (Matching Bhola Portal Detail Layout) */}
          <div className="rounded-xl bg-[#0d1824] border border-slate-800 overflow-hidden">
            <div className="px-3.5 py-2 bg-[#112331] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-black tracking-wide uppercase text-emerald-300">
                CUSTOMER INFORMATION · CONNECTION STATUS
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {customer.packageName || 'সাধারণ প্যাকেজ'}
                {customer.monthlyFee ? ` · ${formatCurrency(customer.monthlyFee)}` : ''}
              </span>
            </div>

            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="flex items-center gap-2 text-slate-200">
                <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-slate-400">মোবাইল:</span>
                <a href={`tel:${customer.phone}`} className="font-mono font-bold text-white hover:underline">
                  {customer.phone}
                </a>
              </div>
              <div className="flex items-start gap-2 text-slate-200">
                <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <span className="text-slate-400 shrink-0">এলাকা:</span>
                <span className="font-semibold text-white">{customer.address}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <Wifi className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-slate-400">মেয়াদ:</span>
                <span className="font-mono font-bold text-amber-300">
                  {customer.expiryDate ? toBengaliNumber(customer.expiryDate) : '-'}
                </span>
                {customer.dueAmount !== undefined && customer.dueAmount > 0 && (
                  <span className="ml-auto px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold tabular-nums">
                    বকেয়া: {formatCurrency(customer.dueAmount)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <Router className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-slate-400 shrink-0">OLT / PON:</span>
                <span className="font-mono font-bold text-emerald-300 truncate">
                  {oltInfo || 'অনির্ধারিত PON'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. DIGITAL ONU & OPTICAL TELEMETRY PANEL */}
          <div className="rounded-xl bg-[#0d1824] border border-slate-800 overflow-hidden">
            <div className="px-3.5 py-2 bg-[#112331] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-black tracking-wide uppercase text-cyan-300 flex items-center gap-1.5">
                <Signal className="w-3.5 h-3.5" />
                <span>ONU DETAILS · OPTICAL POWER &amp; LOSS TELEMETRY</span>
              </span>
              <span
                className={`text-[11px] font-bold ${
                  diagnosis.signalTier === 'good'
                    ? 'text-emerald-400'
                    : diagnosis.signalTier === 'fair'
                    ? 'text-amber-300'
                    : diagnosis.signalTier === 'critical'
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }`}
              >
                {diagnosis.signalLabel}
              </span>
            </div>

            <div className="p-3.5 space-y-3">
              {/* Visual Optical Signal Gauge Bar */}
              {diagnosis.rxNum !== null && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">অপটিক্যাল Rx সিগন্যাল মিটার</span>
                    <span className="font-mono font-bold text-white">
                      Rx: {diagnosis.rxNum} dBm
                      {diagnosis.txNum !== null ? ` · Tx: ${diagnosis.txNum} dBm` : ''}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${diagnosis.signalMeterPct}%` }}
                      className={`h-full transition-all duration-500 ${
                        diagnosis.signalTier === 'good'
                          ? 'bg-emerald-500'
                          : diagnosis.signalTier === 'fair'
                          ? 'bg-amber-400'
                          : 'bg-rose-500'
                      }`}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono tabular-nums">
                <div className="p-2.5 rounded-lg bg-[#09121c] border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-sans">Rx পাওয়ার</div>
                  <div className="font-black text-white mt-0.5 truncate">{rxPower || '-'}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#09121c] border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-sans">Tx পাওয়ার</div>
                  <div className="font-black text-white mt-0.5 truncate">{txPower || '-'}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#09121c] border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                    <ArrowDown className="w-3 h-3 text-emerald-400" />
                    <span>ডাউনলোড /</span>
                    <ArrowUp className="w-3 h-3 text-cyan-400" />
                    <span>আপলোড</span>
                  </div>
                  <div className="font-black text-emerald-400 mt-0.5 truncate">
                    {downloadSpeed || '-'} / {uploadSpeed || '-'}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#09121c] border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                    <Ruler className="w-3 h-3 text-amber-300" />
                    <span>অপটিক্যাল Length</span>
                  </div>
                  <div className="font-black text-amber-300 mt-0.5 truncate">
                    {fiberLength || '-'}
                    {diagnosis.expectedFiberLossDb !== null && (
                      <span className="block text-[10px] font-normal text-slate-400">
                        (~{diagnosis.expectedFiberLossDb} dB কেবল লস)
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#09121c] border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-slate-400" />
                    <span>ONU MAC</span>
                  </div>
                  <div className="font-bold text-slate-100 mt-0.5 truncate">{onuMac || '-'}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#09121c] border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                    <Box className="w-3 h-3 text-amber-400" />
                    <span>টিজি বক্স ও লস (TJ)</span>
                  </div>
                  <div className="font-bold text-slate-100 mt-0.5 font-sans truncate">
                    {tjBox || '-'} {tjLoss ? `(${tjLoss})` : ''}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#09121c] border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                    <Split className="w-3 h-3 text-cyan-400" />
                    <span>স্প্লিটার ও লস</span>
                  </div>
                  <div className="font-bold text-slate-100 mt-0.5 font-sans truncate">
                    {splitterName || '-'} {splitterLoss ? `(${splitterLoss})` : ''}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#09121c] border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-emerald-400" />
                    <span>Ping · ফল্ট</span>
                  </div>
                  <div className="font-bold text-slate-100 mt-0.5 truncate">
                    {pingLatency || '-'} · {lossStatus === 'normal' ? 'Normal' : lossStatus.toUpperCase()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. WHERE IS THE LOSS & SOLUTION DIAGNOSTIC ENGINE */}
          <div
            className={`rounded-xl border p-3.5 space-y-2.5 ${
              diagnosis.signalTier === 'critical' || status === 'disconnected' || lossStatus === 'los'
                ? 'bg-rose-950/40 border-rose-500/50'
                : diagnosis.signalTier === 'fair' || lossStatus !== 'normal' || status === 'inactive'
                ? 'bg-amber-950/35 border-amber-500/45'
                : 'bg-emerald-950/35 border-emerald-500/40'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-black text-white flex items-center gap-1.5">
                {lossStatus === 'normal' && isOnline && diagnosis.signalTier !== 'critical' ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-300" />
                )}
                <span>কোথায় লস / কি সমস্যা ও সমাধান (Troubleshooting)</span>
              </div>
              {onCreateComplaint && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCreateComplaint(customer);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1 shrink-0"
                >
                  <Wrench className="w-3 h-3" />
                  <span>অভিযোগ এন্ট্রি</span>
                </button>
              )}
            </div>

            <div className="space-y-1 text-xs">
              {diagnosis.lossPoints.map((pt, idx) => (
                <div key={idx} className="font-bold text-amber-200 flex items-start gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{pt}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-white/10 space-y-1 text-[11px] text-slate-200">
              <div className="font-bold text-emerald-300">দ্রুত সমাধানের ধাপ:</div>
              {diagnosis.solutions.map((sol, idx) => (
                <div key={idx} className="leading-relaxed">
                  {sol}
                </div>
              ))}
            </div>
          </div>

          {/* 4. TAP-TO-ADD / EDIT TELEMETRY FORM */}
          {onUpdateCustomer && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="w-full py-2.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-amber-200 text-xs font-black flex items-center justify-center gap-2 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              <span>
                ট্যাপ করে Rx পাওয়ার / Tx পাওয়ার / ডাউনলোড / আপলোড / অনুর পাওয়ার / লাইন ফল্ট / Length Meter / MAC / TJ যোগ করুন
              </span>
            </button>
          )}

          {onUpdateCustomer && isEditing && (
            <form
              onSubmit={handleSave}
              className="rounded-xl bg-[#0c1926] border border-emerald-500/45 p-3.5 space-y-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-black text-emerald-300">
                  Rx পাওয়ার · Tx পাওয়ার · ডাউনলোড / আপলোড · Length (Meter) · MAC · TJ · লাইন ফল্ট যোগ করুন
                </div>
                <button
                  type="button"
                  onClick={() => setIsPasteOpen((v) => !v)}
                  className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-black flex items-center gap-1"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>ONU Details টেক্সট পেস্ট</span>
                </button>
              </div>

              {isPasteOpen && (
                <div className="rounded-xl bg-[#07111a] border border-amber-400/50 p-3 space-y-2">
                  <div className="text-[11px] text-amber-200 leading-relaxed">
                    কপি করা <code className="font-mono">ONU Details</code> (যেমন <code className="font-mono">OLT=... Onu Port=EPON0/1/4:25 Power=-21.87 Distance=1451 meter Tx Power=2.23 ONU Mac=48:D5:39:E6:FE:3D</code>) পেস্ট করে অটো-ফিল চাপুন:
                  </div>
                  <textarea
                    rows={4}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={`OLT=Sujit-zahid-Zangalia-Ecom-OLT\nOnu Port=EPON0/1/4:25\nPower= -21.87\nDistance=1451 meter\nTx Power= 2.23\nONU Mac=48:D5:39:E6:FE:3D`}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-[#0d1824] border border-slate-700 text-slate-100 outline-none focus:border-amber-400"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPasteOpen(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold"
                    >
                      বন্ধ
                    </button>
                    <button
                      type="button"
                      disabled={!pasteText.trim()}
                      onClick={handleApplyBholaPaste}
                      className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 text-xs font-black"
                    >
                      অটো-ফিল করুন
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Customer Name (editable so wrong phone-as-name can be corrected anytime) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">গ্রাহকের নাম (Customer Name)</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="গ্রাহকের আসল নাম"
                    className="w-full px-2.5 py-2 text-xs rounded-lg bg-[#07111a] border border-slate-700 text-white outline-none focus:border-emerald-400"
                  />
                </div>

                {/* Rx Power */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Rx পাওয়ার (dBm)</label>
                  <input
                    type="text"
                    value={rxPower}
                    onChange={(e) => setRxPower(e.target.value)}
                    placeholder="-21.87 dBm"
                    className="w-full px-2.5 py-2 text-xs font-mono rounded-lg bg-[#07111a] border border-slate-700 text-white outline-none focus:border-emerald-400"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {QUICK_RX_CHIPS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setRxPower(v)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-emerald-900 text-[10px] font-mono text-emerald-300"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tx Power */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Tx পাওয়ার (dBm)</label>
                  <input
                    type="text"
                    value={txPower}
                    onChange={(e) => setTxPower(e.target.value)}
                    placeholder="2.23 dBm"
                    className="w-full px-2.5 py-2 text-xs font-mono rounded-lg bg-[#07111a] border border-slate-700 text-white outline-none focus:border-emerald-400"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {QUICK_TX_CHIPS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setTxPower(v)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-emerald-900 text-[10px] font-mono text-slate-300"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optical Length Meter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    অপটিক্যাল Length (Meter)
                  </label>
                  <input
                    type="text"
                    value={fiberLength}
                    onChange={(e) => setFiberLength(e.target.value)}
                    placeholder="1451 meter"
                    className="w-full px-2.5 py-2 text-xs font-mono rounded-lg bg-[#07111a] border border-slate-700 text-white outline-none focus:border-emerald-400"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {QUICK_LENGTH_CHIPS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setFiberLength(v)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-amber-900 text-[10px] font-mono text-amber-300"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Download Speed */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">ডাউনলোড (Download)</label>
                  <input
                    type="text"
                    value={downloadSpeed}
                    onChange={(e) => setDownloadSpeed(e.target.value)}
                    placeholder="30 Mbps"
                    className="w-full px-2.5 py-2 text-xs font-mono rounded-lg bg-[#07111a] border border-slate-700 text-white outline-none focus:border-emerald-400"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {QUICK_SPEED_CHIPS.map((v) => (
                      <button
                        key={`d-${v}`}
                        type="button"
                        onClick={() => setDownloadSpeed(v)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-emerald-900 text-[10px] font-mono text-emerald-300"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Upload Speed */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">আপলোড (Upload)</label>
                  <input
                    type="text"
                    value={uploadSpeed}
                    onChange={(e) => setUploadSpeed(e.target.value)}
                    placeholder="30 Mbps"
                    className="w-full px-2.5 py-2 text-xs font-mono rounded-lg bg-[#07111a] border border-slate-700 text-white outline-none focus:border-emerald-400"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {QUICK_SPEED_CHIPS.map((v) => (
                      <button
                        key={`u-${v}`}
                        type="button"
                        onClick={() => setUploadSpeed(v)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-cyan-900 text-[10px] font-mono text-cyan-300"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ONU MAC */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">ONU MAC Address</label>
                  <input
                    type="text"
                    value={onuMac}
                    onChange={(e) => setOnuMac(e.target.value)}
                    placeholder="48:D5:39:E6:FE:3D"
                    className="w-full px-2.5 py-2 text-xs font-mono uppercase rounded-lg bg-[#07111a] border border-slate-700 text-white outline-none focus:border-emerald-400"
                  />
                </div>

                {/* OLT & PON Port */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">OLT ও PON পোর্ট</label>
                  <input
                    type="text"
                    value={oltInfo}
                    onChange={(e) => setOltInfo(e.target.value)}
                    placeholder="Sujit-OLT (EPON0/1/4:25)"
                    className="w-full px-2.5 py-2 text-xs font-mono rounded-lg bg-[#07111a] border border-slate-700 text-white outline-none focus:border-emerald-400"
                  />
                </div>

                {/* TJ Box & TJ Loss */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">টিজি বক্স (TJ Box)</label>
                  <input
                    type="text"
                    value={tjBox}
                    onChange={(e) => setTjBox(e.target.value)}
                    placeholder="TJ-জঙ্গলিয়া-02"
                    className="w-full px-2.5 py-2 text-xs rounded-lg bg-[#07111a] border border-slate-700 text-white outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">টিজিতে কত লস (TJ Loss)</label>
                  <input
                    type="text"
                    value={tjLoss}
                    onChange={(e) => setTjLoss(e.target.value)}
                    placeholder="-1.8 dB"
                    className="w-full px-2.5 py-2 text-xs font-mono rounded-lg bg-[#07111a] border border-slate-700 text-white outline-none focus:border-emerald-400"
                  />
                </div>

                {/* Splitter & Splitter Loss */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">স্প্লিটার (Splitter)</label>
                  <input
                    type="text"
                    value={splitterName}
                    onChange={(e) => setSplitterName(e.target.value)}
                    placeholder="SP-01 (1:8)"
                    className="w-full px-2.5 py-2 text-xs rounded-lg bg-[#07111a] border border-slate-700 text-white outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">স্প্লিটার লস</label>
                  <input
                    type="text"
                    value={splitterLoss}
                    onChange={(e) => setSplitterLoss(e.target.value)}
                    placeholder="-10.5 dB"
                    className="w-full px-2.5 py-2 text-xs font-mono rounded-lg bg-[#07111a] border border-slate-700 text-white outline-none focus:border-emerald-400"
                  />
                </div>

                {/* Ping & Status */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Ping ও অনু স্ট্যাটাস</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      value={pingLatency}
                      onChange={(e) => setPingLatency(e.target.value)}
                      placeholder="4 ms"
                      className="w-full px-2 py-2 text-xs font-mono rounded-lg bg-[#07111a] border border-slate-700 text-white outline-none focus:border-emerald-400"
                    />
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'active' | 'inactive' | 'disconnected')}
                      className="w-full px-2 py-2 text-xs font-bold rounded-lg bg-[#07111a] border border-slate-700 text-white outline-none focus:border-emerald-400"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Deactivate</option>
                      <option value="disconnected">LOS</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Line Fault Type & Exact Problem Reason */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">লাইন ফল্ট / লসের ধরন</label>
                  <select
                    value={lossStatus}
                    onChange={(e) => setLossStatus(e.target.value as OnuLossStatus)}
                    className="w-full px-2.5 py-2 text-xs font-bold rounded-lg bg-[#07111a] border border-slate-700 text-white outline-none focus:border-emerald-400"
                  >
                    {LOSS_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">কি সমস্যা হয়েছে / নোট</label>
                  <input
                    type="text"
                    value={issueReason}
                    onChange={(e) => setIssueReason(e.target.value)}
                    placeholder="যেমন: টিজি-৩ তে জয়েন্ট লস, প্যাচ কর্ড পরিবর্তন..."
                    className="w-full px-2.5 py-2 text-xs rounded-lg bg-[#07111a] border border-slate-700 text-white outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {FAULT_REASON_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setIssueReason(chip)}
                    className="px-2 py-1 rounded-md bg-slate-800 hover:bg-emerald-900/70 text-slate-300 text-[10px] font-semibold"
                  >
                    + {chip}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
