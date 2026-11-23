import React from 'react';
import {
  MapPin,
  Phone,
  Mail,
  UserCheck
} from 'lucide-react';
import { Company, UserSession } from '../types';

interface HeaderProps {
  company: Company | null;
  currentUser?: UserSession;
}

export const Header: React.FC<HeaderProps> = ({
  company,
  currentUser
}) => {
  const companyName = company?.name || 'DIP BHOLA NETWORK';
  const subTitle = company?.subTitle || 'দৈনিক আয়-ব্যয় হিসাব ও কেন্দ্রীয় স্টাফ মনিটরিং সিস্টেম';
  const ownerName = company?.ownerName || 'জাহিদুল ইসলাম';
  const phone = company?.phone || '01721200049';
  const email = company?.email || 'zahidulislam53330@gmail.com';
  const address = company?.address || '৩নং পশ্চিম ইলিশা, ভোলা সদর, ভোলা';
  const logoUrl = company?.logoUrl || '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg';

  const isStaffRole = currentUser?.role === 'staff';

  return (
    <header className="bg-gradient-to-r from-[#020a18] via-[#041d42] to-[#020e21] text-white border-t-4 border-t-cyan-400 border-b border-cyan-400/30 shadow-lg relative z-30 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-3 sm:gap-5">
          {/* LEFT ZONE: Official Dip Bhola Network App Logo Box */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border-2 border-cyan-300/80 shadow-[0_0_22px_rgba(56,189,248,0.45)] flex items-center justify-center overflow-hidden p-1.5 shrink-0">
            <img
              src={logoUrl}
              alt={companyName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg';
              }}
            />
          </div>

          {/* CENTER ZONE: Official Business Letterhead Pad Block */}
          <div className="flex-1 text-center min-w-0 px-1 sm:px-4">
            <div className="flex flex-wrap items-center justify-center gap-2 mb-1">
              <span className="text-xs sm:text-sm font-bold text-cyan-300 tracking-wide">
                বিসমিল্লাহির রাহমানির রাহিম · অনুমোদিত ব্রডব্যান্ড ইন্টারনেট ও কেবল নেটওয়ার্ক
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white leading-none drop-shadow-[0_0_12px_rgba(56,189,248,0.4)]">
              {companyName}
            </h1>

            <p className="text-cyan-200 text-xs sm:text-sm md:text-base font-bold mt-1 truncate">
              {subTitle}
            </p>

            {/* Hairline Official Pad Metadata Divider (Hidden Director details for Staff) */}
            {!isStaffRole ? (
              <div className="mt-1.5 pt-1.5 border-t border-cyan-400/25 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-xs sm:text-sm text-cyan-100">
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <UserCheck className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                  <span className="text-cyan-200/80">পরিচালক:</span>
                  <strong className="font-bold text-white">{ownerName}</strong>
                </span>
                <span aria-hidden="true" className="text-cyan-500/50 hidden sm:inline">|</span>
                <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
                  <Phone className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                  <span className="text-cyan-200/80">মোবাইল:</span>
                  <strong className="font-bold text-white">{phone}</strong>
                </span>
                <span aria-hidden="true" className="text-cyan-500/50 hidden md:inline">|</span>
                <span className="hidden md:inline-flex items-center gap-1 whitespace-nowrap">
                  <Mail className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                  <span className="font-mono text-xs text-cyan-100">{email}</span>
                </span>
              </div>
            ) : (
              <div className="mt-1.5 pt-1.5 border-t border-cyan-400/25 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-xs sm:text-sm text-cyan-200">
                <span className="inline-flex items-center gap-1.5 font-bold">
                  <UserCheck className="w-4 h-4 text-cyan-300 shrink-0" />
                  <span>স্বাগতম, {currentUser?.name}</span>
                  {currentUser?.designation && (
                    <span className="text-cyan-300/80 font-medium">· {currentUser.designation}</span>
                  )}
                </span>
              </div>
            )}

            <div className="mt-0.5 flex items-center justify-center gap-1 text-xs sm:text-sm font-medium text-cyan-200/85">
              <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate">কার্যালয় ও ঠিকানা: {address}</span>
            </div>
          </div>

          {/* RIGHT SYMMETRY SPACER (desktop balance so letterhead stays dead-center) */}
          <div className="hidden sm:block w-20 shrink-0" aria-hidden="true" />
        </div>
      </div>
    </header>
  );
};
