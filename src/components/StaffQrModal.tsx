import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  QrCode,
  Printer,
  User,
  Check,
  Copy,
  MessageCircle,
  Share2,
  Download,
  Camera,
  Phone,
  Mail,
  CreditCard,
  MapPin,
  HeartPulse,
  GraduationCap,
  Calendar,
  ShieldCheck,
  Loader2,
  Wifi
} from 'lucide-react';
import { Staff, Company } from '../types';
import { getGooglePlayStoreUrl, buildWhatsAppUrl, shareOrCopyAppLink } from '../utils/appUrls';
import { formatBengaliDate, toBengaliNumber } from '../utils/formatters';
import { generateQrDataUrl } from '../services/sharedReportService';
import { generatePdfFromElement, triggerPdfDownload } from '../services/pdfPrintService';

interface StaffQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffs: Staff[];
  company: Company | null;
  initialStaffId?: string;
  onUpdateStaff?: (id: string, updates: Partial<Staff>) => Promise<void>;
}

function compressPhotoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image'));
      img.onload = () => {
        const maxDim = 420;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(typeof reader.result === 'string' ? reader.result : '');
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      img.src = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.readAsDataURL(file);
  });
}

export const StaffQrModal: React.FC<StaffQrModalProps> = ({
  isOpen,
  onClose,
  staffs,
  company,
  initialStaffId,
  onUpdateStaff
}) => {
  const [selectedStaffId, setSelectedStaffId] = useState<string>(initialStaffId || staffs[0]?.id || '');
  const [copiedStaffLink, setCopiedStaffLink] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);
  const [photoStatusMsg, setPhotoStatusMsg] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (initialStaffId && staffs.some((s) => s.id === initialStaffId)) {
      setSelectedStaffId(initialStaffId);
    } else if (!staffs.some((s) => s.id === selectedStaffId) && staffs[0]) {
      setSelectedStaffId(staffs[0].id);
    }
  }, [isOpen, initialStaffId, staffs, selectedStaffId]);

  const activeStaff = staffs.find((s) => s.id === selectedStaffId) || staffs[0];
  const companyName = company?.name || 'DIP BHOLA NETWORK';
  const companySubTitle = company?.subTitle || 'ডিজিটাল নেটওয়ার্ক ও ইন্টারনেট ব্রডব্যান্ড সেবা';
  const companyOwner = company?.ownerName || 'জাহিদুল ইসলাম';
  const companyPhone = company?.phone || '01721200049';
  const companyAddress = company?.address || '৩নং পশ্চিম ইলিশা, ভোলা সদর, ভোলা';
  const unifiedPlayStoreUrl = getGooglePlayStoreUrl();

  const getStaffAppInstallUrl = (staff: Staff) => {
    const sep = unifiedPlayStoreUrl.includes('?') ? '&' : '?';
    return `${unifiedPlayStoreUrl}${sep}staff_id=${encodeURIComponent(staff.id)}`;
  };

  useEffect(() => {
    let active = true;
    if (!isOpen || !activeStaff) return;
    const qrPayload = getStaffAppInstallUrl(activeStaff);
    generateQrDataUrl(qrPayload, {
      width: 280,
      darkColor: '#020617',
      lightColor: '#ffffff'
    }).then((url) => {
      if (active) setQrDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, [isOpen, activeStaff?.id, unifiedPlayStoreUrl]);

  useEffect(() => {
    return () => {
      document.body.classList.remove('print-staff-card-active');
    };
  }, []);

  if (!isOpen) return null;

  const handlePrint = () => {
    document.body.classList.add('print-staff-card-active');
    const cleanup = () => {
      document.body.classList.remove('print-staff-card-active');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 1500);
  };

  const handleDownloadPdf = async () => {
    if (!cardRef.current || !activeStaff) return;
    setIsGeneratingPdf(true);
    try {
      const pdf = await generatePdfFromElement(cardRef.current, {
        fileName: `Staff-ID-Card-${activeStaff.name.replace(/\s+/g, '-')}-${activeStaff.id}.pdf`,
        size: 'A4',
        orientation: 'portrait',
        marginMm: 10,
        scalePercent: 100,
        colorMode: 'color'
      });
      triggerPdfDownload(pdf.blob, pdf.fileName);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleInlinePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeStaff || !onUpdateStaff) return;
    setIsUpdatingPhoto(true);
    setPhotoStatusMsg(null);
    try {
      const dataUrl = await compressPhotoFile(file);
      await onUpdateStaff(activeStaff.id, { photoUrl: dataUrl });
      setPhotoStatusMsg('স্টাফের ছবি সংরক্ষিত হয়েছে!');
      setTimeout(() => setPhotoStatusMsg(null), 2500);
    } catch {
      setPhotoStatusMsg('ছবি আপলোডে সমস্যা হয়েছে।');
    } finally {
      setIsUpdatingPhoto(false);
      e.target.value = '';
    }
  };

  const handleCopyStaffLink = () => {
    if (!activeStaff) return;
    navigator.clipboard.writeText(getStaffAppInstallUrl(activeStaff));
    setCopiedStaffLink(true);
    setTimeout(() => setCopiedStaffLink(false), 2500);
  };

  const handleWhatsAppStaffLink = () => {
    if (!activeStaff) return;
    const installUrl = getStaffAppInstallUrl(activeStaff);
    const msg = `আসসালামু আলাইকুম ${activeStaff.name},\n${companyName}-এর অফিসিয়াল ফিল্ড স্টাফ অ্যাপ ও আইডি তথ্য:\n${installUrl}\n\nআইডি: ${activeStaff.id}\nপদবী: ${activeStaff.designation}\nমোবাইল: ${activeStaff.phone}\nলগইন পিন: ${activeStaff.pin}\n\nলিংকটিতে গিয়ে Google অ্যাকাউন্ট দিয়ে অ্যাপ ইনস্টল ও ব্যবহার করুন।`;
    const a = document.createElement('a');
    a.href = buildWhatsAppUrl(msg, activeStaff.phone);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShareStaffLink = async () => {
    if (!activeStaff) return;
    const installUrl = getStaffAppInstallUrl(activeStaff);
    const res = await shareOrCopyAppLink(
      `${companyName} — ${activeStaff.name} (${activeStaff.designation})`,
      `${companyName} স্টাফ আইডি ও অ্যাপ লিঙ্ক`,
      installUrl
    );
    if (res === 'copied') {
      setCopiedStaffLink(true);
      setTimeout(() => setCopiedStaffLink(false), 2500);
    }
  };

  const staffInitials = activeStaff
    ? activeStaff.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : 'ST';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-[#064e3b] px-5 sm:px-6 py-4 flex items-center justify-between text-white shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-800/80 border border-emerald-500/60 flex items-center justify-center text-emerald-200">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                অফিশিয়াল স্টাফ কিউআর (QR) ও ছবি-সহ আইডি কার্ড
              </h2>
              <p className="text-xs text-emerald-200">
                স্টাফদের ছবি, সম্পূর্ণ পরিচয়, ওএলটি/এরিয়া ও ভেরিফিকেশন QR কার্ড প্রিন্ট ও PDF করুন
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 bg-slate-50/70">
          {/* Staff Selector Strip */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 print:hidden">
            {staffs.map((staff) => {
              const isSelected = activeStaff?.id === staff.id;
              return (
                <button
                  key={staff.id}
                  type="button"
                  onClick={() => setSelectedStaffId(staff.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 border cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {staff.photoUrl ? (
                    <img
                      src={staff.photoUrl}
                      alt={staff.name}
                      className="w-5 h-5 rounded-full object-cover border border-white/60"
                    />
                  ) : (
                    <User className="w-3.5 h-3.5" />
                  )}
                  <span>{staff.name}</span>
                </button>
              );
            })}
          </div>

          {activeStaff ? (
            <div className="flex flex-col items-center">
              {/* Printable Official Staff ID Card */}
              <div
                id="staff-qr-card"
                ref={cardRef}
                className="w-full max-w-2xl bg-white rounded-2xl border-2 border-emerald-800 shadow-xl overflow-hidden text-slate-950"
              >
                {/* Top Official Company Band */}
                <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-800 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b-4 border-amber-400">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-xs">
                      <img
                        src={company?.logoUrl || '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg'}
                        alt={companyName}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div>
                      <h3 className="font-black text-lg sm:text-xl tracking-wide uppercase text-white leading-tight">
                        {companyName}
                      </h3>
                      <p className="text-[11px] font-semibold text-emerald-100">
                        {companySubTitle}
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 text-[11px] font-black tracking-wide">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      অফিশিয়াল স্টাফ ID কার্ড
                    </span>
                    <div className="text-[11px] font-mono font-bold text-emerald-100 mt-1">
                      CARD ID: {activeStaff.id}
                    </div>
                  </div>
                </div>

                {/* Main Identity Body: Photo + Detailed Profile + QR */}
                <div className="p-5 sm:p-6 space-y-5 bg-white">
                  {/* Top Profile Row: Photo + Primary Identity */}
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-4 border-b-2 border-slate-200">
                    {/* Photo Frame + Optional Inline Upload */}
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <div className="w-32 h-36 rounded-2xl border-2 border-emerald-700 bg-emerald-50 overflow-hidden shadow-md flex items-center justify-center relative">
                        {activeStaff.photoUrl ? (
                          <img
                            src={activeStaff.photoUrl}
                            alt={activeStaff.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-emerald-900 p-2 text-center">
                            <div className="w-14 h-14 rounded-full bg-emerald-200 border border-emerald-400 flex items-center justify-center text-xl font-black mb-1">
                              {staffInitials}
                            </div>
                            <span className="text-[10px] font-bold text-emerald-800">ছবি সংযুক্ত নেই</span>
                          </div>
                        )}
                      </div>
                      {onUpdateStaff && (
                        <label className="print:hidden inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 text-emerald-900 border border-emerald-300 text-[11px] font-extrabold cursor-pointer transition-colors">
                          {isUpdatingPhoto ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Camera className="w-3 h-3 text-emerald-700" />
                          )}
                          <span>{activeStaff.photoUrl ? 'ছবি বদলান' : 'ছবি যুক্ত করুন'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleInlinePhotoUpload}
                            disabled={isUpdatingPhoto}
                            className="hidden"
                          />
                        </label>
                      )}
                      {photoStatusMsg && (
                        <span className="print:hidden text-[10px] font-bold text-emerald-700">
                          {photoStatusMsg}
                        </span>
                      )}
                    </div>

                    {/* Core Identity Info */}
                    <div className="flex-1 text-center sm:text-left space-y-2.5 w-full">
                      <div className="flex flex-wrap items-center justify-center sm:justify-between gap-2">
                        <div>
                          <h4 className="text-2xl font-black text-black leading-tight">
                            {activeStaff.name}
                          </h4>
                          <p className="text-sm font-extrabold text-emerald-800 mt-0.5">
                            {activeStaff.designation}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-black border ${
                              activeStaff.status === 'inactive'
                                ? 'bg-rose-100 text-rose-900 border-rose-300'
                                : 'bg-emerald-100 text-emerald-900 border-emerald-400'
                            }`}
                          >
                            {activeStaff.status === 'inactive' ? 'নিষ্ক্রিয় (Inactive)' : 'সক্রিয় কর্মকর্তা (Active)'}
                          </span>
                          {activeStaff.bloodGroup && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                              <HeartPulse className="w-3.5 h-3.5 text-rose-600" />
                              রক্ত: {activeStaff.bloodGroup}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick Highlight Badges */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                          <Phone className="w-4 h-4 text-emerald-700 shrink-0" />
                          <div className="text-left">
                            <div className="text-[10px] font-bold text-slate-600">মোবাইল / আইডি</div>
                            <div className="font-black text-black text-sm">{activeStaff.phone}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                          <Calendar className="w-4 h-4 text-indigo-700 shrink-0" />
                          <div className="text-left">
                            <div className="text-[10px] font-bold text-slate-600">যোগদানের তারিখ</div>
                            <div className="font-black text-black text-sm">
                              {activeStaff.joinedAt ? formatBengaliDate(activeStaff.joinedAt) : 'নির্ধারিত নয়'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Full Detailed Information Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between gap-2">
                      <span className="font-bold text-slate-700">পিতার নাম:</span>
                      <span className="font-black text-black text-right">{activeStaff.fatherName || '—'}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between gap-2">
                      <span className="font-bold text-slate-700">মাতার নাম:</span>
                      <span className="font-black text-black text-right">{activeStaff.motherName || '—'}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between gap-2">
                      <span className="font-bold text-slate-700 flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5 text-indigo-700" />
                        জাতীয় পরিচয়পত্র (NID):
                      </span>
                      <span className="font-mono font-black text-black text-right">
                        {activeStaff.nid ? toBengaliNumber(activeStaff.nid) : '—'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between gap-2">
                      <span className="font-bold text-slate-700 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-rose-700" />
                        জরুরি যোগাযোগ:
                      </span>
                      <span className="font-black text-black text-right">
                        {activeStaff.emergencyContact || activeStaff.phone || '—'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between gap-2">
                      <span className="font-bold text-slate-700 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-emerald-700" />
                        ইমেইল:
                      </span>
                      <span className="font-bold text-black text-right break-all">
                        {activeStaff.email || '—'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between gap-2">
                      <span className="font-bold text-slate-700 flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5 text-amber-700" />
                        শিক্ষাগত যোগ্যতা:
                      </span>
                      <span className="font-black text-black text-right">{activeStaff.education || '—'}</span>
                    </div>
                    <div className="sm:col-span-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
                      <span className="font-bold text-slate-700 flex items-center gap-1 shrink-0">
                        <MapPin className="w-3.5 h-3.5 text-rose-600" />
                        বর্তমান ঠিকানা:
                      </span>
                      <span className="font-bold text-black text-right">{activeStaff.address || '—'}</span>
                    </div>
                    {activeStaff.permanentAddress && activeStaff.permanentAddress !== activeStaff.address && (
                      <div className="sm:col-span-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
                        <span className="font-bold text-slate-700 flex items-center gap-1 shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                          স্থায়ী ঠিকানা:
                        </span>
                        <span className="font-bold text-black text-right">{activeStaff.permanentAddress}</span>
                      </div>
                    )}
                  </div>

                  {/* Assigned Areas & OLT Scopes */}
                  {((activeStaff.assignedAreas && activeStaff.assignedAreas.length > 0) ||
                    (activeStaff.oltPonScopes && activeStaff.oltPonScopes.length > 0)) && (
                    <div className="p-3 rounded-xl bg-cyan-50 border border-cyan-300 space-y-1.5">
                      <div className="text-xs font-black text-cyan-950 flex items-center gap-1.5">
                        <Wifi className="w-3.5 h-3.5 text-cyan-700" />
                        <span>দায়িত্বপ্রাপ্ত সার্ভিস এরিয়া ও OLT PON জোন:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(activeStaff.assignedAreas || []).map((area) => (
                          <span
                            key={area}
                            className="px-2 py-0.5 rounded-md bg-white text-cyan-950 border border-cyan-400 text-xs font-bold"
                          >
                            📍 {area}
                          </span>
                        ))}
                        {(activeStaff.oltPonScopes || []).map((pon) => (
                          <span
                            key={pon}
                            className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-950 border border-indigo-400 text-xs font-mono font-black"
                          >
                            {pon}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bottom QR Code & Authorized Director Verification */}
                  <div className="pt-4 border-t-2 border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-5">
                    <div className="flex items-center gap-3.5">
                      <div className="w-28 h-28 bg-white p-1.5 rounded-xl border-2 border-slate-800 shadow-xs flex items-center justify-center shrink-0">
                        {qrDataUrl ? (
                          <img
                            src={qrDataUrl}
                            alt={`QR code for ${activeStaff.name}`}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <QrCode className="w-12 h-12 text-slate-400" />
                        )}
                      </div>
                      <div className="text-left space-y-1">
                        <div className="text-xs font-black text-emerald-900">
                          ডিজিটাল স্টাফ ভেরিফিকেশন ও অ্যাপ QR
                        </div>
                        <p className="text-[11px] font-semibold text-slate-700 leading-snug max-w-xs">
                          এই QR কোড স্ক্যান করে সরাসরি {companyName}-এর অফিসিয়াল অ্যাপ ইনস্টল ও স্টাফ পরিচয় যাচাই করা যাবে।
                        </p>
                        <div className="text-[10px] font-mono font-bold text-slate-600">
                          STF-VERIFY-{activeStaff.id.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <div className="text-center sm:text-right shrink-0 pt-2 sm:pt-0">
                      <div className="w-40 border-b-2 border-slate-900 mb-1 mx-auto sm:ml-auto sm:mr-0"></div>
                      <div className="text-xs font-black text-black">{companyOwner}</div>
                      <div className="text-[11px] font-bold text-emerald-800">পরিচালক, {companyName}</div>
                      <div className="text-[10px] font-semibold text-slate-700">যোগাযোগ: {companyPhone}</div>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="bg-slate-900 text-slate-100 px-5 py-2.5 text-center text-[11px] font-semibold">
                  <span>অফিস ঠিকানা: {companyAddress} • জরুরি প্রয়োজনে: {companyPhone}</span>
                </div>
              </div>

              {/* Action Buttons (Screen Only) */}
              <div className="mt-4 w-full max-w-2xl bg-white border border-slate-200 rounded-xl p-2.5 text-[11px] font-mono text-slate-700 truncate print:hidden">
                {getStaffAppInstallUrl(activeStaff)}
              </div>
              <div className="mt-3 flex items-center justify-center gap-2 flex-wrap print:hidden">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-black rounded-xl shadow-sm flex items-center gap-1.5 text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>আইডি কার্ড প্রিন্ট করুন</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isGeneratingPdf}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-black rounded-xl shadow-sm flex items-center gap-1.5 text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 text-emerald-300" />
                  )}
                  <span>{isGeneratingPdf ? 'PDF তৈরি হচ্ছে...' : 'ID কার্ড PDF ডাউনলোড'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleWhatsAppStaffLink}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm flex items-center gap-1.5 text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp-এ পাঠান</span>
                </button>
                <button
                  type="button"
                  onClick={handleShareStaffLink}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm flex items-center gap-1.5 text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>শেয়ার করুন</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyStaffLink}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl border border-slate-300 flex items-center gap-1.5 text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  {copiedStaffLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedStaffLink ? 'কপি হয়েছে!' : 'লিংক কপি'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-slate-500">কোনো স্টাফ পাওয়া যায়নি।</div>
          )}
        </div>
      </div>
    </div>
  );
};
