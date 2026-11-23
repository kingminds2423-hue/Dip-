import React, { useState, useEffect } from 'react';
import {
  Users,
  PieChart,
  Phone,
  Key,
  MapPin,
  CreditCard,
  Briefcase,
  MessageCircle,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  UserPlus,
  X,
  Coins
} from 'lucide-react';
import { Company, JoinRequest, WhatsAppGroupConfig } from '../types';
import { auth } from '../firebase';
import { ensureOrLoadUserAccount, signInWithGoogle } from '../services/userRoleService';
import { buildWhatsAppUrl, normalizeWhatsAppGroupLink } from '../utils/appUrls';

interface JoiningModalProps {
  isOpen: boolean;
  isPage?: boolean;
  initialRole?: 'staff' | 'partner';
  company?: Company | null;
  whatsappGroupConfig?: WhatsAppGroupConfig | null;
  onClose: () => void;
  onSubmitJoinRequest: (
    data: Omit<JoinRequest, 'id' | 'status' | 'createdAt'>
  ) => Promise<JoinRequest>;
  onOpenLogin?: () => void;
}

export const JoiningModal: React.FC<JoiningModalProps> = ({
  isOpen,
  isPage = false,
  initialRole = 'staff',
  company,
  whatsappGroupConfig,
  onClose,
  onSubmitJoinRequest,
  onOpenLogin,
}) => {
  const [role, setRole] = useState<'staff' | 'partner'>(initialRole);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [designationOrRole, setDesignationOrRole] = useState('');
  const [address, setAddress] = useState('');
  const [nid, setNid] = useState('');
  const [initialInvestment, setInitialInvestment] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string>(auth.currentUser?.email || '');
  const [error, setError] = useState('');
  const [submittedRequest, setSubmittedRequest] = useState<JoinRequest | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRole(initialRole);
      setDesignationOrRole(initialRole === 'staff' ? 'ফিল্ড টেকনিশিয়ান' : 'শেয়ার অংশীদার');
      setVerifiedEmail(auth.currentUser?.email || '');
      if (auth.currentUser?.displayName && !name) {
        setName(auth.currentUser.displayName);
      }
      setError('');
    }
  }, [isOpen, initialRole]);

  if (!isOpen) return null;

  const companyName = company?.name || 'DIP BHOLA NETWORK';
  const directorPhone = company?.phone || '01721200049';

  const activeGroupLink = normalizeWhatsAppGroupLink(
    role === 'staff'
      ? whatsappGroupConfig?.staffGroupInviteLink || whatsappGroupConfig?.groupInviteLink
      : whatsappGroupConfig?.partnerGroupInviteLink || whatsappGroupConfig?.groupInviteLink
  );

  const activeGroupName =
    role === 'staff'
      ? whatsappGroupConfig?.staffGroupName || whatsappGroupConfig?.groupName || `${companyName} - Staff Group`
      : whatsappGroupConfig?.partnerGroupName || whatsappGroupConfig?.groupName || `${companyName} - Share Partners Group`;

  const handleRoleSwitch = (nextRole: 'staff' | 'partner') => {
    setRole(nextRole);
    setDesignationOrRole(nextRole === 'staff' ? 'ফিল্ড টেকনিশিয়ান' : 'শেয়ার অংশীদার');
    setError('');
  };

  const handleVerifyGoogle = async () => {
    setError('');
    try {
      const fbUser = await signInWithGoogle();
      setVerifiedEmail(fbUser.email || '');
      if (!name.trim() && fbUser.displayName) {
        setName(fbUser.displayName);
      }
    } catch (err: any) {
      setError(err?.message || 'Google ভেরিফিকেশন সম্পন্ন হয়নি।');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('অনুগ্রহ করে আপনার পূর্ণ নাম লিখুন।');
      return;
    }
    if (!phone.trim() || phone.replace(/[^0-9]/g, '').length < 10) {
      setError('সঠিক ১১-ডিজিটের মোবাইল নাম্বার দিন।');
      return;
    }
    if (!pin.trim() || pin.trim().length < 4) {
      setError('লগইনের জন্য কমপক্ষে ৪ সংখ্যার পিন কোড দিন।');
      return;
    }

    setIsSubmitting(true);
    try {
      let fbUser = auth.currentUser;
      if (!fbUser || !fbUser.email) {
        fbUser = await signInWithGoogle();
      }
      setVerifiedEmail(fbUser.email || '');

      await ensureOrLoadUserAccount(fbUser, {
        displayName: name.trim(),
        phone: phone.trim(),
        requestedRole: role
      });

      const saved = await onSubmitJoinRequest({
        uid: fbUser.uid,
        email: fbUser.email || undefined,
        role,
        name: name.trim(),
        phone: phone.trim(),
        pin: pin.trim(),
        designationOrRole:
          designationOrRole.trim() || (role === 'staff' ? 'ফিল্ড টেকনিশিয়ান' : 'শেয়ার অংশীদার'),
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(nid.trim() ? { nid: nid.trim() } : {}),
        ...(role === 'partner' && initialInvestment.trim() && Number(initialInvestment) > 0
          ? { initialInvestment: Number(initialInvestment) }
          : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setSubmittedRequest(saved);
    } catch (err: any) {
      console.error('Join request submit error:', err);
      setError(err?.message || 'আবেদন সংরক্ষণ করতে সমস্যা হয়েছে। অনুগ্রহ করে Google সাইন-ইন করে আবার চেষ্টা করুন।');
    } finally {
      setIsSubmitting(false);
    }
  };

  const directorNotifyMessage = submittedRequest
    ? `আসসালামু আলাইকুম,\nআমি ${submittedRequest.name} (${
        submittedRequest.role === 'staff' ? 'Staff / টেকনিশিয়ান' : 'Share Partner / শেয়ার অংশীদার'
      }) হিসেবে ${companyName}-এ জয়েন করার আবেদন করেছি।\n\n📱 মোবাইল: ${submittedRequest.phone}\n🔑 পছন্দকৃত পিন: ${
        submittedRequest.pin
      }\n💼 পদবি/ভূমিকা: ${submittedRequest.designationOrRole || ''}\n${
        submittedRequest.address ? `📍 ঠিকানা: ${submittedRequest.address}\n` : ''
      }\nঅনুগ্রহ করে অ্যাপ থেকে আমার জয়েনিং অনুমোদন (Approve) করে দিন।`
    : '';

  const containerClass = isPage
    ? 'min-h-screen w-full bg-gradient-to-br from-[#022017] via-[#043426] to-slate-950 flex flex-col items-center justify-center p-3 sm:p-6'
    : 'fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4';

  return (
    <div className={containerClass}>
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full shadow-2xl border border-emerald-500/30 dark:border-slate-800 overflow-hidden my-4">
        {/* Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 bg-gradient-to-r from-[#022b1f] via-[#054d37] to-slate-900 text-white flex items-center justify-between border-b border-emerald-700/40">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#064e3b] border border-amber-400/60 overflow-hidden shadow-md shrink-0 flex items-center justify-center">
              <img
                src="/db-logo-192.png"
                alt={companyName}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide">
                {companyName} · জয়েনিং ও ইনভাইটেশন
              </h2>
              <p className="text-xs text-emerald-300 font-medium">
                Staff ও Share Partner জয়েনিং এবং WhatsApp গ্রুপ সংযোগ
              </p>
            </div>
          </div>

          {!isPage ? (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            onOpenLogin && (
              <button
                type="button"
                onClick={onOpenLogin}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>লগইন পেজ</span>
              </button>
            )
          )}
        </div>

        <div className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Role Selector */}
          {!submittedRequest && (
            <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={() => handleRoleSwitch('staff')}
                className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                  role === 'staff'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Staff জয়েনিং</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoleSwitch('partner')}
                className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                  role === 'partner'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <PieChart className="w-4 h-4" />
                <span>Share Partner জয়েনিং</span>
              </button>
            </div>
          )}

          {/* Direct WhatsApp Group Join Banner */}
          {activeGroupLink ? (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-[#25D366] text-slate-950 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </span>
                <div>
                  <div className="text-xs font-black text-emerald-950 dark:text-emerald-200">
                    {activeGroupName}
                  </div>
                  <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                    সরাসরি অফিসিয়াল WhatsApp গ্রুপে যুক্ত হতে নিচের বাটনে চাপুন।
                  </p>
                </div>
              </div>
              <a
                href={activeGroupLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-sm shrink-0 whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>WhatsApp গ্রুপে জয়েন</span>
              </a>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
              পরিচালক WhatsApp গ্রুপ লিংক যুক্ত করলে এখান থেকেই সরাসরি গ্রুপে জয়েন করা যাবে।
            </div>
          )}

          {!submittedRequest && (
            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-2">
              <div className="text-xs">
                <div className="font-black text-indigo-900 dark:text-indigo-200">
                  {verifiedEmail ? `ভেরিফায়েড Google: ${verifiedEmail}` : 'Google অ্যাকাউন্ট ভেরিফিকেশন'}
                </div>
                <div className="text-[11px] text-indigo-700 dark:text-indigo-300">
                  {verifiedEmail
                    ? 'আবেদন জমা দিলে এই Google ইমেইল সহ পরিচালকের কাছে যাবে।'
                    : 'আবেদন জমা দেওয়ার আগে বা সময় Google Sign-In যাচাই করা হবে।'}
                </div>
              </div>
              {!verifiedEmail && (
                <button
                  type="button"
                  onClick={() => void handleVerifyGoogle()}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0 cursor-pointer"
                >
                  Google ভেরিফাই
                </button>
              )}
            </div>
          )}

          {submittedRequest ? (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h3 className="text-base font-black text-emerald-950 dark:text-emerald-200">
                  {submittedRequest._pendingSync
                    ? 'অফলাইনে জয়েনিং আবেদন সংরক্ষিত হয়েছে!'
                    : 'জয়েনিং আবেদন সফলভাবে জমা হয়েছে!'}
                </h3>
                <p className="text-xs text-emerald-800 dark:text-emerald-300">
                  {submittedRequest._pendingSync
                    ? 'ইন্টারনেট সংযোগ পেলেই আবেদনটি অটো অনলাইনে পৌঁছে যাবে। পরিচালক অনুমোদন করলেই আপনি আপনার মোবাইল নাম্বার ও পিন দিয়ে লগইন করতে পারবেন।'
                    : 'পরিচালক আপনার আবেদন অনুমোদন (Approve) করার সাথে সাথেই আপনি মোবাইল নাম্বার ও পিন দিয়ে আপনার নিজস্ব পেজে ঢুকতে পারবেন।'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">আবেদনকারীর নাম:</span>
                  <strong className="text-slate-900 dark:text-white">{submittedRequest.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">পদের ধরন:</span>
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    {submittedRequest.role === 'staff' ? 'Staff (স্টাফ)' : 'Share Partner (শেয়ার পার্টনার)'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">মোবাইল নাম্বার:</span>
                  <strong className="font-mono text-slate-900 dark:text-white">{submittedRequest.phone}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">আপনার পিন:</span>
                  <strong className="font-mono text-amber-700 dark:text-amber-300">{submittedRequest.pin}</strong>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <a
                  href={buildWhatsAppUrl(directorNotifyMessage, directorPhone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-[200px] py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>পরিচালককে WhatsApp-এ জানান</span>
                </a>

                {activeGroupLink && (
                  <a
                    href={activeGroupLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>গ্রুপে জয়েন করুন</span>
                  </a>
                )}
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setSubmittedRequest(null);
                    setName('');
                    setPhone('');
                    setPin('');
                  }}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  আরেকজন আবেদন করুন
                </button>
                {onOpenLogin && (
                  <button
                    type="button"
                    onClick={onOpenLogin}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                  >
                    লগইন পেজে যান
                  </button>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    পূর্ণ নাম (Full Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={role === 'staff' ? 'যেমন: মোঃ রাজিব' : 'যেমন: মোঃ কামরুল হাসান'}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-600" />
                    মোবাইল নাম্বার *
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Key className="w-3 h-3 text-amber-600" />
                    লগইন ৪-ডিজিট পিন (PIN) *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="যেমন: 4580"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Briefcase className="w-3 h-3 text-indigo-600" />
                    {role === 'staff' ? 'পদবি / কাজের ধরন' : 'অংশীদার পদবি'}
                  </label>
                  <input
                    type="text"
                    value={designationOrRole}
                    onChange={(e) => setDesignationOrRole(e.target.value)}
                    placeholder={role === 'staff' ? 'সহকারী টেকনিশিয়ান / লাইনম্যান' : 'শেয়ার অংশীদার'}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-slate-500" />
                    NID নাম্বার (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={nid}
                    onChange={(e) => setNid(e.target.value)}
                    placeholder="জাতীয় পরিচয়পত্র নম্বর"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {role === 'partner' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                      <Coins className="w-3 h-3 text-amber-600" />
                      বিনিয়োগের পরিমাণ ৳ (ঐচ্ছিক)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={initialInvestment}
                      onChange={(e) => setInitialInvestment(e.target.value)}
                      placeholder="যেমন: 100000"
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-rose-500" />
                  ঠিকানা / এলাকা
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="গ্রাম / ওয়ার্ড / থানা / জেলা"
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  অতিরিক্ত নোট (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="অভিজ্ঞতা বা অন্যান্য তথ্য"
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-60 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'জমা হচ্ছে...'
                    : role === 'staff'
                    ? 'Staff হিসেবে জয়েনিং আবেদন জমা দিন'
                    : 'Share Partner হিসেবে জয়েনিং আবেদন জমা দিন'}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
