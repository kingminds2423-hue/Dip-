import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Key,
  Calendar,
  Check,
  Edit2,
  Trash2,
  DollarSign,
  X,
  Eye,
  EyeOff,
  History,
  Printer,
  FileText,
  Upload,
  Camera,
  HeartPulse,
  GraduationCap,
  MessageCircle,
  UserCheck,
  UserX,
  Lock,
  Unlock,
  ShieldCheck,
  QrCode
} from 'lucide-react';
import { Staff, StaffActionPermissions, Transaction, UserSession, Company, JoinRequest, WhatsAppGroupConfig } from '../types';
import { formatCurrency, toBengaliNumber, formatBengaliDate } from '../utils/formatters';
import { buildWhatsAppUrl, getGooglePlayStoreUrl, getJoiningPortalUrl, normalizeWhatsAppGroupLink } from '../utils/appUrls';
import {
  canUserPerformAction,
  countGrantedActions,
  DEFAULT_STAFF_ACTION_PERMISSIONS,
  DIRECTOR_ONLY_PORTALS,
  DEFAULT_STAFF_ALLOWED_PORTALS,
  ENTRY_AND_EDIT_STAFF_ACTION_PERMISSIONS,
  ERP_PORTAL_PERMISSIONS,
  FULL_STAFF_ACTION_PERMISSIONS,
  normalizeStaffActionPermissions,
  READONLY_STAFF_ACTION_PERMISSIONS,
  STAFF_ACTION_PERMISSION_DEFS,
  STAFF_ASSIGNABLE_PORTALS,
  STAFF_ASSIGNABLE_PORTAL_IDS
} from '../utils/portalPermissions';
import { StaffSalaryHistoryModal } from './StaffSalaryHistoryModal';
import { StaffJoiningLetterModal } from './StaffJoiningLetterModal';
import { DEFAULT_SERVICE_AREA_PRESETS, OLT_PON_AREA_OPTIONS } from '../utils/complaintAutoAssign';

interface StaffManagementProps {
  staffs: Staff[];
  transactions: Transaction[];
  currentUser: UserSession;
  company?: Company | null;
  joinRequests?: JoinRequest[];
  whatsappGroupConfig?: WhatsAppGroupConfig;
  onApproveJoinRequest?: (req: JoinRequest) => Promise<void>;
  onRejectJoinRequest?: (req: JoinRequest) => Promise<void>;
  onOpenWhatsAppGroups?: () => void;
  onAddStaff: (staff: Staff) => Promise<void>;
  onUpdateStaff: (id: string, staff: Partial<Staff>) => Promise<void>;
  onDeleteStaff: (id: string) => Promise<void>;
  onPaySalary: (staff: Staff) => void;
  onOpenStaffQr?: (staffId?: string) => void;
  openAddModalNonce?: number;
}

export const StaffManagement: React.FC<StaffManagementProps> = ({
  staffs,
  transactions,
  currentUser,
  company,
  joinRequests = [],
  whatsappGroupConfig,
  onApproveJoinRequest,
  onRejectJoinRequest,
  onOpenWhatsAppGroups,
  onAddStaff,
  onUpdateStaff,
  onDeleteStaff,
  onPaySalary,
  onOpenStaffQr,
  openAddModalNonce,
}) => {
  const isAdminOnly = currentUser.role === 'director' || currentUser.role === 'admin';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [selectedStaffForHistory, setSelectedStaffForHistory] = useState<Staff | null>(null);
  const [selectedStaffForJoiningLetter, setSelectedStaffForJoiningLetter] = useState<Staff | null>(null);
  const [showPins, setShowPins] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [nid, setNid] = useState('');
  const [address, setAddress] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O-');
  const [education, setEducation] = useState('HSC');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [designation, setDesignation] = useState('সহকারী টেকনিশিয়ান');
  const [salary, setSalary] = useState<number | ''>(8000);
  const [pin, setPin] = useState('');
  const [joinedAt, setJoinedAt] = useState(() => new Date().toISOString().split('T')[0]);
  const [photoUrl, setPhotoUrl] = useState('');
  const [allowedPortals, setAllowedPortals] = useState<string[]>(DEFAULT_STAFF_ALLOWED_PORTALS);
  const [assignedAreas, setAssignedAreas] = useState<string[]>([]);
  const [areaDraftInput, setAreaDraftInput] = useState('');
  const [oltPonScopes, setOltPonScopes] = useState<string[]>([]);
  const [actionPermissions, setActionPermissions] = useState<Required<StaffActionPermissions>>({
    ...DEFAULT_STAFF_ACTION_PERMISSIONS
  });
  const canManageTeam =
    currentUser.role !== 'staff' || canUserPerformAction('canAddStaffOrManageTeam', currentUser, staffs);

  const openAddModal = () => {
    setEditingStaff(null);
    setName('');
    setFatherName('');
    setMotherName('');
    setPhone('');
    setEmail('');
    setNid('');
    setAddress('জাংগালিয়া মিঝি বাড়ি। ৩নং পশ্চিম ইলিশা ভোলা সদর ভোলা');
    setPermanentAddress('জাংগালিয়া মিঝি বাড়ি। ৩নং পশ্চিম ইলিশা ভোলা সদর ভোলা');
    setBloodGroup('O-');
    setEducation('HSC');
    setEmergencyContact('');
    setDesignation('সহকারী টেকনিশিয়ান');
    setSalary(8000);
    setPin(Math.floor(1000 + Math.random() * 9000).toString());
    setJoinedAt(new Date().toISOString().split('T')[0]);
    setPhotoUrl('');
    setAllowedPortals(DEFAULT_STAFF_ALLOWED_PORTALS);
    setAssignedAreas([]);
    setAreaDraftInput('');
    setOltPonScopes([]);
    setActionPermissions({ ...DEFAULT_STAFF_ACTION_PERMISSIONS });
    setIsModalOpen(true);
  };

  React.useEffect(() => {
    if (openAddModalNonce && openAddModalNonce > 0) {
      openAddModal();
    }
  }, [openAddModalNonce]);

  const openEditModal = (staff: Staff) => {
    setEditingStaff(staff);
    setName(staff.name);
    setFatherName(staff.fatherName || '');
    setMotherName(staff.motherName || '');
    setPhone(staff.phone || '');
    setEmail(staff.email || '');
    setNid(staff.nid || '');
    setAddress(staff.address || '');
    setPermanentAddress(staff.permanentAddress || staff.address || '');
    setBloodGroup(staff.bloodGroup || 'O-');
    setEducation(staff.education || 'HSC');
    setEmergencyContact(staff.emergencyContact || staff.phone || '');
    setDesignation(staff.designation || 'সহকারী টেকনিশিয়ান');
    setSalary(staff.salary);
    setPin(staff.pin || '1234');
    setJoinedAt(staff.joinedAt || new Date().toISOString().split('T')[0]);
    setPhotoUrl(staff.photoUrl || '');
    setAllowedPortals(
      Array.isArray(staff.allowedPortals)
        ? staff.allowedPortals.filter((id) => !DIRECTOR_ONLY_PORTALS.includes(id))
        : DEFAULT_STAFF_ALLOWED_PORTALS
    );
    setActionPermissions(normalizeStaffActionPermissions(staff.actionPermissions));
    setAssignedAreas(Array.isArray(staff.assignedAreas) ? staff.assignedAreas : []);
    setAreaDraftInput('');
    setOltPonScopes(Array.isArray(staff.oltPonScopes) ? staff.oltPonScopes : []);
    setIsModalOpen(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setPhotoUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const staffData: Partial<Staff> = {
      name: name.trim(),
      fatherName: fatherName.trim(),
      motherName: motherName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      nid: nid.trim(),
      address: address.trim(),
      permanentAddress: permanentAddress.trim() || address.trim(),
      bloodGroup: bloodGroup.trim(),
      education: education.trim(),
      emergencyContact: emergencyContact.trim() || phone.trim(),
      designation: designation.trim(),
      salary: Number(salary) || 0,
      pin: pin.trim(),
      joinedAt,
      photoUrl: photoUrl.trim(),
      allowedPortals: allowedPortals.filter((id) => !DIRECTOR_ONLY_PORTALS.includes(id)),
      assignedAreas: Array.from(new Set(assignedAreas.map((a) => a.trim()).filter(Boolean))),
      oltPonScopes: Array.from(new Set(oltPonScopes.map((p) => p.trim().toUpperCase()).filter(Boolean))),
      ...(isAdminOnly ? { actionPermissions } : {})
    };

    if (editingStaff) {
      await onUpdateStaff(editingStaff.id, staffData);
    } else {
      const newStaff: Staff = {
        id: `staff-${Date.now()}`,
        name: name.trim(),
        ...staffData
      } as Staff;
      await onAddStaff(newStaff);
    }
    setIsModalOpen(false);
  };

  const totalMonthlyPayroll = staffs.reduce((sum, s) => sum + (s.salary || 0), 0);
  const pendingStaffJoins = joinRequests.filter((r) => r.role === 'staff' && r.status === 'pending');
  const staffGroupLink = normalizeWhatsAppGroupLink(
    whatsappGroupConfig?.staffGroupInviteLink || whatsappGroupConfig?.groupInviteLink
  );
  const staffJoinPortalUrl = getJoiningPortalUrl('staff');
  const playStoreUrl = getGooglePlayStoreUrl();

  const buildStaffInviteHref = (staff: Staff) => {
    const compName = company?.name || 'DIP BHOLA NETWORK';
    const lines = [
      `আসসালামু আলাইকুম *${staff.name}*,`,
      `*${compName}*-এর অফিসিয়াল স্টাফ অ্যাপে আপনাকে যুক্ত করা হয়েছে।`,
      ``,
      `📱 *আপনার মোবাইল:* ${staff.phone}`,
      `🔐 *আপনার লগইন পিন:* ${staff.pin}`,
      `📲 *অ্যাপ লিংক (Download/Install):* ${playStoreUrl}`,
      ...(staffGroupLink
        ? [`💬 *স্টাফ WhatsApp গ্রুপে জয়েন করুন:* ${staffGroupLink}`]
        : []),
      ``,
      `লগইন করে আপনার নিজস্ব পেজ থেকে দৈনিক খরচ ও অভিযোগ এন্ট্রি দিন (অফলাইনে এন্ট্রি করলেও নেট আসলে অটো অনলাইন হয়ে যাবে)।`
    ];
    return buildWhatsAppUrl(lines.join('\n'), staff.phone);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#043324] to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-lg border border-emerald-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              {toBengaliNumber(staffs.length)} জন সক্রিয় কর্মকর্তা
            </span>
            <span className="text-xs text-emerald-400 font-mono">লাইভ মনিটরিং</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            কেন্দ্রীয় স্টাফ তালিকা ও নিয়োগ মনিটরিং
          </h2>
          <p className="text-xs sm:text-sm text-emerald-200/90 mt-1">
            মাসিক মোট স্টাফ বেতন বাজেট:{' '}
            <span className="text-amber-300 font-extrabold text-base">{formatCurrency(totalMonthlyPayroll)}</span>
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {isAdminOnly && onOpenWhatsAppGroups && (
            <button
              type="button"
              onClick={onOpenWhatsAppGroups}
              className="px-3.5 py-2 text-xs font-black text-slate-950 bg-[#25D366] hover:bg-[#20ba59] rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
              title="স্টাফ জয়েনিং লিংক ও WhatsApp গ্রুপ ইনভাইট পাঠান"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp গ্রুপ ও ইনভাইট</span>
            </button>
          )}
          {onOpenStaffQr && (
            <button
              type="button"
              onClick={() => onOpenStaffQr()}
              className="px-3.5 py-2 text-xs font-black text-emerald-950 bg-amber-300 hover:bg-amber-200 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="ছবি ও বিস্তারিত সহ স্টাফদের QR ও ID কার্ড দেখুন"
            >
              <QrCode className="w-4 h-4 text-emerald-900" />
              <span>QR ও ID কার্ড</span>
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 rounded-xl transition-colors border border-slate-300 flex items-center gap-1.5 shadow-xs"
            title="সকল কর্মকর্তা ও টেকনিশিয়ানদের তালিকা প্রিন্ট করুন"
          >
            <Printer className="w-4 h-4 text-emerald-700" />
            <span>স্টাফ শিট প্রিন্ট</span>
          </button>
          <button
            onClick={() => setShowPins(!showPins)}
            className="px-3.5 py-2 text-xs font-bold text-emerald-100 bg-emerald-900/80 hover:bg-emerald-800 rounded-xl transition-colors border border-emerald-700/80 flex items-center gap-1.5"
            title="স্টাফদের লগইন পিন প্রদর্শন বা গোপন"
          >
            {showPins ? <EyeOff className="w-4 h-4 text-emerald-300" /> : <Eye className="w-4 h-4 text-emerald-300" />}
            <span>{showPins ? 'পিন গোপন' : 'লগইন পিন'}</span>
          </button>
          {canManageTeam && (
            <button
              onClick={openAddModal}
              className="px-4 py-2 text-xs sm:text-sm font-black text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-xl transition-all shadow-md shadow-emerald-950/40 flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              নতুন স্টাফ নিয়োগ
            </button>
          )}
        </div>
      </div>

      {/* Pending Staff Self-Joining Requests (Director/Manager approval) */}
      {currentUser.role !== 'staff' && pendingStaffJoins.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-amber-950 dark:text-amber-200 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-600" />
                <span>অপেক্ষমাণ স্টাফ জয়েনিং আবেদন ({toBengaliNumber(pendingStaffJoins.length)}টি)</span>
              </h3>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                জয়েনিং লিংক ({staffJoinPortalUrl}) থেকে আসা স্টাফ আবেদন — অ্যাপ্রুভ করলেই মোবাইল+পিনে লগইন করতে পারবে।
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingStaffJoins.map((req) => (
              <div key={req.id} className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-amber-200 dark:border-amber-800 flex flex-col justify-between gap-2.5">
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-sm text-slate-900 dark:text-white">{req.name}</strong>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                      {req.designationOrRole || 'সহকারী টেকনিশিয়ান'}
                    </span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 font-mono">
                    মোবাইল: <strong>{req.phone}</strong> · পিন: <strong>{req.pin}</strong>
                  </div>
                  {req.address && <div className="text-[11px] text-slate-500">ঠিকানা: {req.address}</div>}
                  {req.notes && <div className="text-[11px] text-slate-500 italic">নোট: {req.notes}</div>}
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {onRejectJoinRequest && (
                    <button
                      type="button"
                      onClick={() => onRejectJoinRequest(req)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 flex items-center gap-1"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>বাতিল</span>
                    </button>
                  )}
                  {onApproveJoinRequest && (
                    <button
                      type="button"
                      onClick={() => onApproveJoinRequest(req)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>অ্যাপ্রুভ ও যোগ করুন</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff Cards Grid with Colorful Badges & Direct Joining Letter Print */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {staffs.map((staff) => (
          <div
            key={staff.id}
            className="bg-white rounded-2xl border-2 border-slate-200/90 shadow-xs p-5 hover:shadow-lg transition-all relative overflow-hidden flex flex-col justify-between"
          >
            {/* Top Row: Photo, Name, Badge, Actions */}
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  {/* Photo Container */}
                  <div className="w-16 h-18 sm:w-18 sm:h-20 rounded-xl bg-slate-50 text-emerald-800 font-bold flex items-center justify-center overflow-hidden border-2 border-emerald-600 shrink-0 shadow-sm p-0.5">
                    {staff.photoUrl ? (
                      <img src={staff.photoUrl} alt={staff.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-1">
                        <Users className="w-6 h-6 text-emerald-600" />
                        <span className="text-[9px] text-slate-500 mt-0.5">নো ছবি</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 leading-tight">
                      {staff.name}
                    </h3>
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 mt-1">
                      {staff.designation}
                    </span>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      যোগদান: {formatBengaliDate(staff.joinedAt)}
                    </p>
                  </div>
                </div>

                {/* Edit (Director/Manager or Permitted Staff) & Delete (Admin only) Actions */}
                {canManageTeam && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditModal(staff)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="তথ্য ও অনুমতি পরিবর্তন"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {isAdminOnly && (
                      confirmDeleteId === staff.id ? (
                        <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg px-1.5 py-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteId(null);
                              onDeleteStaff(staff.id);
                            }}
                            className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black hover:bg-rose-700"
                          >
                            মুছুন
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold hover:bg-slate-300"
                          >
                            না
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(staff.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="মুছে ফেলুন (শুধুমাত্র অ্যাডমিন)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Personal & Official Details Table */}
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" /> মোবাইল / আইডি:
                  </span>
                  <span className="font-bold text-slate-900">{staff.phone}</span>
                </div>

                {staff.fatherName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">পিতার নাম:</span>
                    <span className="font-semibold text-slate-800">{staff.fatherName}</span>
                  </div>
                )}

                {staff.nid && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-indigo-600" /> জাতীয় পরিচয়পত্র (NID):
                    </span>
                    <span className="font-mono font-bold text-slate-800">{toBengaliNumber(staff.nid)}</span>
                  </div>
                )}

                {staff.address && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-500 flex items-center gap-1 shrink-0">
                      <MapPin className="w-3.5 h-3.5 text-rose-600" /> ঠিকানা:
                    </span>
                    <span className="text-slate-800 text-right font-medium">{staff.address}</span>
                  </div>
                )}

                {((staff.assignedAreas && staff.assignedAreas.length > 0) ||
                  (staff.oltPonScopes && staff.oltPonScopes.length > 0)) && (
                  <div className="p-2 rounded-xl bg-cyan-50/90 border border-cyan-200 space-y-1">
                    <div className="text-[10px] font-black text-cyan-950 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-cyan-700" />
                      <span>অটো-অভিযোগ এরিয়া ও PON জোন:</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(staff.assignedAreas || []).map((area) => (
                        <span
                          key={`area-${area}`}
                          className="px-1.5 py-0.5 rounded bg-white text-cyan-900 border border-cyan-300 text-[10px] font-bold"
                        >
                          📍 {area}
                        </span>
                      ))}
                      {(staff.oltPonScopes || []).map((pon) => (
                        <span
                          key={`pon-${pon}`}
                          className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-300 text-[10px] font-mono font-black"
                        >
                          {pon}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Login PIN Card */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50/90 border border-amber-300">
                  <span className="text-amber-900 font-bold flex items-center gap-1.5 text-xs">
                    <Key className="w-3.5 h-3.5 text-amber-700" /> মোবাইল লগইন পিন কোড:
                  </span>
                  <span className="font-mono font-black text-sm text-amber-950">
                    {showPins ? staff.pin : '••••'}
                  </span>
                </div>

                {/* Staff ERP Portal Access Summary */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      অনুমোদিত ERP পোর্টাল:
                    </span>
                    {currentUser.role !== 'staff' && (
                      <button
                        type="button"
                        onClick={() => openEditModal(staff)}
                        className="text-[11px] font-black text-indigo-700 hover:underline cursor-pointer"
                      >
                        পরিবর্তন করুন
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      const granted = (Array.isArray(staff.allowedPortals)
                        ? staff.allowedPortals
                        : DEFAULT_STAFF_ALLOWED_PORTALS
                      ).filter((pid) => !DIRECTOR_ONLY_PORTALS.includes(pid));
                      if (granted.length === 0) {
                        return (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold">
                            <Lock className="w-3 h-3" /> সব পোর্টাল লক করা
                          </span>
                        );
                      }
                      return granted.map((pid) => {
                        const meta = ERP_PORTAL_PERMISSIONS.find((p) => p.id === pid);
                        return (
                          <span
                            key={pid}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold"
                          >
                            <Unlock className="w-2.5 h-2.5 text-emerald-700" />
                            {meta?.shortLabel || pid}
                          </span>
                        );
                      });
                    })()}
                  </div>

                  {/* Granular Work & Edit Permission Summary */}
                  {(() => {
                    const summary = countGrantedActions(staff.actionPermissions);
                    return (
                      <div className="pt-1.5 mt-1 border-t border-slate-200/80 flex flex-wrap items-center gap-1.5 text-[10px] font-extrabold">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-200">
                          কাজের ক্ষমতা: {toBengaliNumber(summary.granted)}/{toBengaliNumber(summary.total)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md border ${
                            summary.canEditAny
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : 'bg-slate-200/80 text-slate-700 border-slate-300'
                          }`}
                        >
                          এডিট: {summary.canEditAny ? 'চালু' : 'বন্ধ'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md border ${
                            summary.canDeleteAny
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-slate-200/80 text-slate-700 border-slate-300'
                          }`}
                        >
                          ডিলিট: {summary.canDeleteAny ? 'চালু' : 'বন্ধ'}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Bottom Row: Salary & Quick Actions (Joining Letter Print, Salary Pay, History) */}
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 font-semibold block">মাসিক নির্ধারিত বেতন</span>
                  <span className="text-xl font-black text-emerald-800">{formatCurrency(staff.salary)}</span>
                </div>

                {/* High Priority: ছবি সহ প্রিন্ট কপি (নিয়োগপত্র ও সিভি) ও QR ID কার্ড */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {onOpenStaffQr && (
                    <button
                      type="button"
                      onClick={() => onOpenStaffQr(staff.id)}
                      className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-400 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                      title="স্টাফের ছবি ও বিস্তারিত তথ্যসহ অফিশিয়াল QR ও ID কার্ড দেখুন এবং প্রিন্ট/PDF করুন"
                    >
                      <QrCode className="w-3.5 h-3.5 text-amber-800" />
                      <span>QR ও ID কার্ড (ছবি সহ)</span>
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedStaffForJoiningLetter(staff)}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02]"
                    title="ইউজার রিকোয়েস্টেড ছবি সহ নিয়োগপত্র ও সিভি প্রিন্ট ফরম্যাট"
                  >
                    <FileText className="w-4 h-4 text-emerald-300" />
                    <span>নিয়োগপত্র ও সিভি প্রিন্ট</span>
                  </button>
                </div>
              </div>

              {/* Secondary Actions */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-slate-100">
                {isAdminOnly && (
                  <a
                    href={buildStaffInviteHref(staff)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-[#25D366] hover:bg-[#20ba59] text-slate-950 rounded-lg text-xs font-black flex items-center gap-1 transition-colors shadow-2xs"
                    title="স্টাফের WhatsApp-এ অ্যাপ লিংক, পিন ও স্টাফ গ্রুপ লিংক পাঠান"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp ইনভাইট</span>
                  </a>
                )}
                <button
                  onClick={() => setSelectedStaffForHistory(staff)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-300"
                >
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  বেতন হিস্ট্রি
                </button>
                {currentUser.role !== 'staff' && (
                  <button
                    onClick={() => onPaySalary(staff)}
                    className="px-3.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    বেতন পরিশোধ
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#043324] text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">
                  {editingStaff ? 'স্টাফ তথ্য পরিবর্তন ও সিভি আপডেট' : 'নতুন স্টাফ নিয়োগ ও সিভি এন্ট্রি'}
                </h3>
                <p className="text-xs text-emerald-300">ছবি ও বিস্তারিত তথ্যাবলী দিয়ে সম্পূর্ণ নিয়োগ ফরম পূরণ করুন</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-emerald-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              
              {/* Photo Upload Section */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-4">
                <div className="w-20 h-24 rounded-xl bg-white border-2 border-slate-300 overflow-hidden flex items-center justify-center shrink-0 shadow-inner p-0.5">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-1 text-slate-400">
                      <Camera className="w-6 h-6 text-slate-300" />
                      <span className="text-[10px] mt-1">পাসপোর্ট ছবি</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    পাসপোর্ট সাইজ ছবি আপলোড করুন
                  </label>
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>ছবি নির্বাচন করুন (কম্পিউটার/মোবাইল)</span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                  <p className="text-[10px] text-slate-500 mt-1">অথবা ছবির লিঙ্ক নিচে পেস্ট করতে পারেন</p>
                  <input
                    type="text"
                    value={photoUrl.startsWith('data:') ? 'ছবি আপলোড করা হয়েছে (Data Image)' : photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="ছবির সরাসরি লিঙ্ক (যেমন: https://...)"
                    className="w-full mt-1 px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              {/* Name & Designation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">স্টাফের নাম <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="যেমন: মো: সাওন"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">পদবি (Designation) <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="যেমন: সহকারী টেকনিশিয়ান"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm"
                  />
                </div>
              </div>

              {/* Phone & PIN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">মোবাইল (লগইন আইডি) <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+880 1321-454984"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">লগইন পিন (৪ ডিজিট) <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="যেমন: 4984"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-bold"
                  />
                </div>
              </div>

              {/* Father Name & Mother Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">পিতার নাম</label>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    placeholder="যেমন: আক্তার হোসেন"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">মাতার নাম</label>
                  <input
                    type="text"
                    value={motherName}
                    onChange={(e) => setMotherName(e.target.value)}
                    placeholder="যেমন: হাসনা বেগম"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm"
                  />
                </div>
              </div>

              {/* NID & Blood Group */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">জাতীয় পরিচয়পত্র (NID)</label>
                  <input
                    type="text"
                    value={nid}
                    onChange={(e) => setNid(e.target.value)}
                    placeholder="যেমন: ২০০৯০৯১১৮৫৫১৩৮৪৪৩"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">রক্তের গ্রুপ</label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold bg-white"
                  >
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              {/* Education & Emergency Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">শিক্ষাগত যোগ্যতা</label>
                  <input
                    type="text"
                    value={education}
                    onChange={(e) => setEducation(e.target.value)}
                    placeholder="যেমন: HSC / SSC / Diploma"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">জরুরি যোগাযোগ মোবাইল</label>
                  <input
                    type="text"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="জরুরি ফোন নম্বর"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm"
                  />
                </div>
              </div>

              {/* Salary & Joining Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">মাসিক নির্ধারিত বেতন (BDT) <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={salary}
                    onChange={(e) => setSalary(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-black text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">যোগদানের তারিখ</label>
                  <input
                    type="date"
                    value={joinedAt}
                    onChange={(e) => setJoinedAt(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm"
                  />
                </div>
              </div>

              {/* Addresses */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">বর্তমান ঠিকানা</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="যেমন: জাংগালিয়া মিঝি বাড়ি। ৩নং পশ্চিম ইলিশা ভোলা সদর ভোলা"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">স্থায়ী ঠিকানা</label>
                <input
                  type="text"
                  value={permanentAddress}
                  onChange={(e) => setPermanentAddress(e.target.value)}
                  placeholder="স্থায়ী ঠিকানা (খালি রাখলে বর্তমান ঠিকানাই ব্যবহৃত হবে)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm"
                />
              </div>

              {/* Service Areas & OLT PON Scopes for Automatic Complaint Assignment */}
              <div className="p-3.5 rounded-xl bg-cyan-50/70 border border-cyan-300 space-y-2.5">
                <div>
                  <span className="text-xs font-black text-cyan-950 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-cyan-700" />
                    দায়িত্বপ্রাপ্ত এলাকা ও PON জোন (অটো-অভিযোগ অ্যাসাইন)
                  </span>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    গ্রাহকের অভিযোগ আসার সাথে সাথে ঠিকানা বা OLT PON দেখে স্বয়ংক্রিয়ভাবে এই টেকনিশিয়ানকে অ্যাসাইন করা হবে।
                  </p>
                </div>

                {/* Custom Area Add */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={areaDraftInput}
                    onChange={(e) => setAreaDraftInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const items = areaDraftInput
                          .split(/[,،]+/)
                          .map((x) => x.trim())
                          .filter(Boolean);
                        if (items.length > 0) {
                          setAssignedAreas((prev) => Array.from(new Set([...prev, ...items])));
                          setAreaDraftInput('');
                        }
                      }
                    }}
                    placeholder="নতুন এলাকার নাম লিখুন (যেমন: বিশ্বরোড, বাপ্তা)..."
                    className="flex-1 px-3 py-1.5 text-xs border border-cyan-300 bg-white rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const items = areaDraftInput
                        .split(/[,،]+/)
                        .map((x) => x.trim())
                        .filter(Boolean);
                      if (items.length > 0) {
                        setAssignedAreas((prev) => Array.from(new Set([...prev, ...items])));
                        setAreaDraftInput('');
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold shrink-0"
                  >
                    + যোগ
                  </button>
                </div>

                {/* Preset Area Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(new Set([...DEFAULT_SERVICE_AREA_PRESETS, ...assignedAreas])).map((area) => {
                    const selected = assignedAreas.includes(area);
                    return (
                      <button
                        key={`preset-area-${area}`}
                        type="button"
                        onClick={() =>
                          setAssignedAreas((prev) =>
                            selected ? prev.filter((a) => a !== area) : [...prev, area]
                          )
                        }
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          selected
                            ? 'bg-cyan-700 text-white border-cyan-800 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-cyan-500'
                        }`}
                      >
                        {selected ? '✓ ' : '+ '}
                        {area}
                      </button>
                    );
                  })}
                </div>

                {/* OLT PON Port Checkboxes */}
                <div className="pt-2 border-t border-cyan-200/80 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-700">নির্ধারিত OLT PON পোর্ট:</span>
                  {OLT_PON_AREA_OPTIONS.map((pon) => {
                    const active = oltPonScopes.includes(pon);
                    return (
                      <button
                        key={`pon-scope-${pon}`}
                        type="button"
                        onClick={() =>
                          setOltPonScopes((prev) =>
                            active ? prev.filter((p) => p !== pon) : [...prev, pon]
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-black border transition-colors cursor-pointer ${
                          active
                            ? 'bg-indigo-700 text-white border-indigo-800'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'
                        }`}
                      >
                        {active ? '✓ ' : ''}
                        {pon}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Staff ERP Portal Access & Entry Permissions */}
              {isAdminOnly && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-300 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-700" />
                        ERP পোর্টাল প্রবেশ ও এন্ট্রি অনুমতি
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        স্টাফ শুধু নির্বাচিত পোর্টালগুলো খুলতে ও এন্ট্রি দিতে পারবেন; সিকিউরিটি ও ব্যাকআপ স্টাফের জন্য স্থায়ীভাবে লক থাকবে।
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAllowedPortals(DEFAULT_STAFF_ALLOWED_PORTALS)}
                        className="px-2 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-bold text-slate-700 cursor-pointer"
                      >
                        ডিফল্ট
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllowedPortals(STAFF_ASSIGNABLE_PORTAL_IDS)}
                        className="px-2 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-[11px] font-bold text-emerald-900 cursor-pointer"
                      >
                        সব খুলুন
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllowedPortals([])}
                        className="px-2 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-[11px] font-bold text-rose-900 cursor-pointer"
                      >
                        সব লক
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                    {STAFF_ASSIGNABLE_PORTALS.map((portal) => {
                      const isAllowed = allowedPortals.includes(portal.id);
                      return (
                        <label
                          key={portal.id}
                          className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                            isAllowed
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isAllowed}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setAllowedPortals((prev) =>
                                checked
                                  ? Array.from(new Set([...prev, portal.id]))
                                  : prev.filter((id) => id !== portal.id)
                              );
                            }}
                            className="mt-0.5 w-4 h-4 accent-emerald-600 rounded shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold flex items-center gap-1">
                              {isAllowed ? (
                                <Unlock className="w-3 h-3 text-emerald-600 shrink-0" />
                              ) : (
                                <Lock className="w-3 h-3 text-rose-500 shrink-0" />
                              )}
                              <span className="truncate">{portal.shortLabel}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                              {portal.description}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Granular Work & Edit Permissions Section (Admin Controlled) */}
                  <div className="pt-3 mt-3 border-t border-slate-300 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-indigo-600" />
                          কাজ, এন্ট্রি, এডিট ও ডিলিট অনুমতি (অ্যাডমিন নিয়ন্ত্রণ)
                        </span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          এই স্টাফ কী কী কাজ করতে পারবে এবং কোন কোন তথ্য এডিট বা ডিলিট করতে পারবে/পারবে না তা নির্ধারণ করুন।
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setActionPermissions({ ...READONLY_STAFF_ACTION_PERMISSIONS })}
                          className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-[10px] font-black text-slate-800 cursor-pointer"
                        >
                          শুধু দেখা
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionPermissions({ ...DEFAULT_STAFF_ACTION_PERMISSIONS })}
                          className="px-2 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-[10px] font-black text-slate-800 cursor-pointer"
                        >
                          শুধু নতুন এন্ট্রি
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionPermissions({ ...ENTRY_AND_EDIT_STAFF_ACTION_PERMISSIONS })}
                          className="px-2 py-1 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-[10px] font-black text-indigo-900 cursor-pointer"
                        >
                          এন্ট্রি + এডিট
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionPermissions({ ...FULL_STAFF_ACTION_PERMISSIONS })}
                          className="px-2 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-[10px] font-black text-emerald-900 cursor-pointer"
                        >
                          সব কাজের অনুমতি
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                      {Array.from(new Set(STAFF_ACTION_PERMISSION_DEFS.map((d) => d.groupLabel))).map((group) => {
                        const groupItems = STAFF_ACTION_PERMISSION_DEFS.filter((d) => d.groupLabel === group);
                        return (
                          <div key={group} className="rounded-xl bg-white border border-slate-200 p-2.5 space-y-1.5">
                            <div className="text-[11px] font-black text-slate-800 border-b border-slate-100 pb-1">
                              {group}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {groupItems.map((item) => {
                                const enabled = Boolean(actionPermissions[item.key]);
                                const badgeClass =
                                  item.kind === 'delete'
                                    ? 'bg-rose-100 text-rose-800'
                                    : item.kind === 'edit'
                                    ? 'bg-amber-100 text-amber-900'
                                    : item.kind === 'view'
                                    ? 'bg-sky-100 text-sky-900'
                                    : 'bg-emerald-100 text-emerald-900';
                                const badgeText =
                                  item.kind === 'delete'
                                    ? 'ডিলিট'
                                    : item.kind === 'edit'
                                    ? 'এডিট'
                                    : item.kind === 'view'
                                    ? 'দেখা'
                                    : item.kind === 'add'
                                    ? 'যোগ'
                                    : 'কাজ';
                                return (
                                  <label
                                    key={item.key}
                                    className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                                      enabled
                                        ? 'bg-indigo-50/70 border-indigo-300 text-slate-900'
                                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                                    }`}
                                  >
                                    <span className="flex items-center gap-2 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={enabled}
                                        onChange={(e) => {
                                          const checked = e.target.checked;
                                          setActionPermissions((prev) => ({
                                            ...prev,
                                            [item.key]: checked
                                          }));
                                        }}
                                        className="w-3.5 h-3.5 accent-indigo-600 rounded shrink-0"
                                      />
                                      <span className="text-[11px] font-bold truncate">{item.label}</span>
                                    </span>
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-black shrink-0 ${badgeClass}`}>
                                      {badgeText}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-xs font-black text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl flex items-center gap-1.5 shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Salary History Sub-component Modal */}
      {selectedStaffForHistory && (
        <StaffSalaryHistoryModal
          staff={selectedStaffForHistory}
          transactions={transactions}
          onClose={() => setSelectedStaffForHistory(null)}
          onPaySalary={onPaySalary}
        />
      )}

      {/* Staff Joining Letter & CV with Photo Print Modal */}
      {selectedStaffForJoiningLetter && (
        <StaffJoiningLetterModal
          isOpen={!!selectedStaffForJoiningLetter}
          onClose={() => setSelectedStaffForJoiningLetter(null)}
          staff={selectedStaffForJoiningLetter}
          company={company || null}
        />
      )}
    </div>
  );
};
