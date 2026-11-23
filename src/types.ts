export interface InvestmentRecord {
  id: string;
  date: string;
  amount: number;
  note: string;
}

export interface Partner {
  id: string;
  name: string;
  phone: string;
  role: string;
  occupation?: string; // কি করে / পেশা
  fatherName?: string; // বাবার নাম
  motherName?: string; // মায়ের নাম
  address?: string; // ঠিকানা
  permanentAddress?: string; // স্থায়ী ঠিকানা
  nidNumber?: string; // NID নাম্বার
  email?: string;
  photoUrl?: string; // অংশীদারের ছবি
  nidPhotoUrl?: string; // অংশীদারের NID কার্ডের ছবি
  fatherNidPhotoUrl?: string; // বাবার NID কার্ডের ছবি
  motherNidPhotoUrl?: string; // মায়ের NID কার্ডের ছবি
  joinedDate?: string; // অংশীদার হিসেবে যোগদানের তারিখ
  investment: number;
  sharePercentage: number;
  investmentHistory: InvestmentRecord[];
  notes?: string;
  pin?: string;
  status?: 'active' | 'inactive';
}

export interface Company {
  id?: string;
  name: string;
  subTitle: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  logoUrl?: string;
  currencySymbol: string;
  dailyExpenseThreshold?: number; // দৈনিক ব্যয়ের সর্বোচ্চ সতর্কতা সীমা (BDT)
  troubleshootPortalUrl?: string; // সমস্যা অনুসন্ধান ও সমাধান ওয়েব পোর্টাল লিংক
  partners?: Partner[];
}

export interface StaffActionPermissions {
  canAddTransaction?: boolean;
  canEditTransaction?: boolean;
  canDeleteTransaction?: boolean;
  canViewFinancialTotals?: boolean;
  canAddComplaint?: boolean;
  canEditComplaint?: boolean;
  canUpdateComplaintStatus?: boolean;
  canDeleteComplaint?: boolean;
  canViewAllComplaints?: boolean;
  canAddCustomer?: boolean;
  canEditCustomer?: boolean;
  canDeleteCustomer?: boolean;
  canAddDue?: boolean;
  canCollectDue?: boolean;
  canEditDue?: boolean;
  canDeleteDue?: boolean;
  canExportOrPrintReports?: boolean;
  canAddStaffOrManageTeam?: boolean;
}

export type StaffActionPermissionKey = keyof StaffActionPermissions;

export interface Staff {
  id: string;
  name: string;
  fatherName?: string;
  motherName?: string;
  phone: string;
  email?: string;
  nid?: string;
  address?: string;
  permanentAddress?: string;
  bloodGroup?: string;
  education?: string;
  emergencyContact?: string;
  designation: string;
  salary: number;
  joinedAt: string;
  photoUrl?: string;
  pin: string;
  status?: 'active' | 'inactive';
  allowedPortals?: string[];
  actionPermissions?: StaffActionPermissions;
  assignedAreas?: string[]; // অটো-অভিযোগ অ্যাসাইনের জন্য দায়িত্বপ্রাপ্ত এলাকা/লোকেশনসমূহ
  oltPonScopes?: string[]; // অটো-অভিযোগ অ্যাসাইনের জন্য নির্ধারিত OLT/PON পোর্ট (যেমন: PON1, PON2)
}

export type TransactionType = 'income' | 'expense';

export type PaymentMethod = 'cash' | 'bkash' | 'nagad' | 'bank' | 'rocket';

export interface Transaction {
  id: string;
  type: TransactionType;
  date: string;
  title: string;
  category: string;
  amount: number;
  paymentMethod: PaymentMethod | string;
  addedBy: string;
  addedById?: string;
  addedByUid?: string;
  note?: string;
  createdAt: string;
  _pendingSync?: boolean;
}

export interface CustomerDue {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  totalDue: number;
  paidAmount: number;
  currentDue: number;
  notes?: string;
  updatedAt: string;
}

export type OnuLossStatus =
  | 'normal'
  | 'high_loss'
  | 'los'
  | 'dying_gasp'
  | 'splitter_fault'
  | 'tj_fault';

export interface CustomerMember {
  id: string;
  memberId: string; // সদস্য নাম্বার / লাইন কোড (যেমন: DBN-101, 1024)
  name: string; // গ্রাহকের নাম
  phone: string; // মোবাইল নম্বর
  address: string; // ঠিকানা / এলাকা
  packageName?: string; // প্যাকেজ / ব্যান্ডউইথ (যেমন: 525TK-20MBPS)
  monthlyFee?: number; // মাসিক বিল (BDT)
  oltInfo?: string; // OLT & PON তথ্য (যেমন: OLT-Sujit-zahid-Zangalia (EPON0/1/3:32))
  oltPower?: string; // POWER / DIST (যেমন: -18.7 dBm | 2290 meter)
  onuMac?: string; // ONU MAC / SN (যেমন: e0:67:b3:1a:2b:3c)
  fiberLength?: string; // ফাইবার দূরত্ব / দৈর্ঘ্য (যেমন: 2290 m / 1.8 km)
  rxPower?: string; // ONU Rx Optical Power (যেমন: -18.7 dBm)
  txPower?: string; // ONU Tx Optical Power (যেমন: 2.3 dBm)
  pingLatency?: string; // Ping / Latency (যেমন: 4 ms)
  downloadSpeed?: string; // Download throughput / speed (যেমন: 45.2 Mbps)
  uploadSpeed?: string; // Upload throughput / speed (যেমন: 22.8 Mbps)
  tjBox?: string; // টিজি বক্সের নাম / নম্বর (যেমন: TJ-বিশ্বরোড-03)
  tjLoss?: string; // টিজি বক্সের লস (যেমন: -1.8 dB / 2.2 dB লস)
  splitterName?: string; // স্প্লিটারের নাম / কোড (যেমন: SP-বাপ্তা-01 (1:8))
  splitterLoss?: string; // স্প্লিটার লস (যেমন: -10.4 dB)
  lossStatus?: OnuLossStatus; // লস / ফল্ট ক্যাটাগরি
  issueReason?: string; // কি সমস্যা হয়েছে (যেমন: ফাইবার কাটা, টিজি জয়েন্ট লস, স্প্লিটার সমস্যা)
  status: 'active' | 'inactive' | 'disconnected';
  statusLabel?: string; // মূল স্ট্যাটাস টেক্সট (যেমন: Unlocked / Active / Expired)
  expiryDate?: string; // বিল বা সংযোগ মেয়াদোত্তীর্ণের তারিখ (YYYY-MM-DD / raw)
  dueAmount?: number; // গ্রাহকের বকেয়া পরিমাণ (BDT)
  notes?: string;
  addedBy?: string;
  createdAt: string;
  updatedAt: string;
  _pendingSync?: boolean;
}

export type ComplaintStatus = 'pending' | 'in_progress' | 'resolved';
export type ComplaintPriority = 'normal' | 'urgent' | 'critical';

export interface CustomerComplaint {
  id: string;
  name: string; // গ্রাহকের নাম
  idNumber: string; // আইডি নম্বর / গ্রাহক আইডি / লাইন কোড
  mobileNumber: string; // মোবাইল নম্বর
  address: string; // ঠিকানা / এলাকা
  packageName?: string; // প্যাকেজ (যেমন: 525TK-20MBPS)
  oltInfo?: string; // OLT & PON তথ্য
  oltPower?: string; // ONU Power & Distance (যেমন: -18.7 dBm | 2290 meter)
  complainDetails: string; // অভিযোগের বিবরণ
  status: ComplaintStatus; // পেন্ডিং | সমাধানাধীন | সমাধানকৃত
  priority: ComplaintPriority; // সাধারণ | জরুরি | অতি জরুরি
  assignedStaffId?: string; // দায়িত্বপ্রাপ্ত টেকনিশিয়ান আইডি
  assignedStaffName?: string; // দায়িত্বপ্রাপ্ত টেকনিশিয়ান নাম
  autoAssignedReason?: string; // লোকেশন / PON অনুযায়ী অটো-অ্যাসাইনের কারণ
  reportedBy?: string; // এন্ট্রিদাতা
  reportedById?: string; // এন্ট্রিদাতা আইডি
  resolutionNote?: string; // সমাধানের নোট
  resolvedAt?: string; // সমাধানের তারিখ ও সময়
  date?: string; // অভিযোগের তারিখ YYYY-MM-DD (দৈনিক ফিল্টার ও আর্কাইভের জন্য)
  createdAt: string; // অভিযোগের তারিখ ও সময়
  updatedAt?: string;
  _pendingSync?: boolean;
}

export interface AdminAuth {
  pin: string;
  phone: string;
}

export interface BackupData {
  version: string;
  exportedAt: string;
  company: Company;
  adminAuth: AdminAuth;
  staffs: Staff[];
  transactions: Transaction[];
  customerDues: CustomerDue[];
  complaints?: CustomerComplaint[];
  customers?: CustomerMember[];
}

export type UserRole = 'admin' | 'director' | 'manager' | 'staff' | 'partner';

export interface UserSession {
  role: UserRole;
  id: string;
  uid?: string;
  email?: string;
  photoUrl?: string;
  name: string;
  designation: string;
  phone?: string;
  allowedPortals?: string[];
  actionPermissions?: StaffActionPermissions;
}

export type AppUserApprovalStatus = 'pending' | 'approved' | 'rejected';
export type AppUserRole = 'pending' | 'director' | 'admin' | 'manager' | 'staff' | 'partner';

export interface AppUserAccount {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  photoUrl?: string;
  role: AppUserRole;
  requestedRole?: 'staff' | 'partner' | 'manager' | 'director';
  status: AppUserApprovalStatus;
  linkedStaffId?: string;
  linkedPartnerId?: string;
  approvedBy?: string;
  approvedByUid?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type SharedReportPeriodType = 'daily' | 'monthly' | 'yearly' | 'custom' | 'all';

export interface SharedReportSnapshot {
  id: string;
  companyName: string;
  companySubTitle?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyLogoUrl?: string;
  periodType: SharedReportPeriodType;
  periodLabel: string;
  verificationCode: string;
  auditScore?: number;
  generatedAt: string;
  generatedBy?: string;
  summary: {
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
    txCount: number;
    pendingDue: number;
  };
  categorySummary?: Array<{
    name: string;
    income: number;
    expense: number;
    count: number;
  }>;
  multiMonthSummary?: Array<{
    month: string;
    label: string;
    income: number;
    expense: number;
    net: number;
    count: number;
  }>;
  transactions: Array<{
    id: string;
    date: string;
    type: TransactionType;
    title: string;
    category: string;
    amount: number;
    paymentMethod?: string;
    addedBy?: string;
    note?: string;
  }>;
  signatories?: {
    directorName?: string;
    managerName?: string;
    auditorName?: string;
  };
}

export type CustomPortalIconName =
  | 'globe'
  | 'router'
  | 'billing'
  | 'wrench'
  | 'shield'
  | 'smartphone'
  | 'link'
  | 'server';

export interface CustomPortalLink {
  id: string;
  shortLabel: string;
  title: string;
  englishDomain?: string;
  description?: string;
  url: string;
  openMode: 'in_app' | 'new_tab';
  iconName?: CustomPortalIconName;
  allowedRoles?: Array<'director' | 'manager' | 'staff' | 'partner'>;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface PortalControlConfig {
  deletedPortalIds: string[];
  disabledPortalIds?: string[];
  customPortals: CustomPortalLink[];
  portalOverrides?: Record<
    string,
    {
      title?: string;
      shortLabel?: string;
      url?: string;
      description?: string;
    }
  >;
  updatedAt: string;
  updatedBy?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action:
    | 'transaction_add'
    | 'transaction_edit'
    | 'transaction_delete'
    | 'staff_add'
    | 'staff_edit'
    | 'staff_delete'
    | 'due_update'
    | 'customer_add'
    | 'customer_edit'
    | 'customer_delete'
    | 'customer_delete_all'
    | 'customer_due_delete_all'
    | 'portal_data_purge'
    | 'portal_control_update'
    | 'notice_update'
    | 'company_update'
    | 'officer_appoint'
    | 'security_alert'
    | 'complaint_add'
    | 'complaint_edit'
    | 'complaint_status'
    | 'complaint_delete'
    | 'complaint_delete_all'
    | 'app_release_push'
    | 'join_request_submit'
    | 'join_request_approve'
    | 'user_role_approve'
    | 'user_role_reject'
    | 'notifications_clear_all'
    | 'auto_backup_monthly_pdf'
    | 'portal_override_unlock'
    | 'login'
    | 'logout';
  actionBengali: string;
  performedBy: string;
  performedById: string;
  performedByUid?: string;
  role: UserRole;
  details: string;
  metadata?: Record<string, any>;
}

export interface NotificationControl {
  clearedAt: string;
  clearedBy: string;
  clearedKeys: string[];
  updatedAt?: string;
}

export type DisplayColor = 'emerald' | 'amber' | 'rose' | 'cyan' | 'purple' | 'gold' | 'neonblue';
export type DisplayMode = 'scroll' | 'glow' | 'steady';
export type DisplaySpeed = 'veryslow' | 'slow' | 'normal' | 'fast';
export type DisplayFontSize = 'medium' | 'large' | 'extralarge';
export type Row3NotificationMode = 'slow_scroll' | 'spotlight_slide' | 'steady';

export interface DigitalNotice {
  text: string; // ১ম লাইন: বড় ডিসপ্লে লেখা / প্রধান ঘোষণা
  subText?: string; // ২য় লাইন: সহযোগী বার্তা / লাইভ স্ট্যাটাস / হেল্পলাইন
  showClock?: boolean; // ডিজিটাল ঘড়ি ও সময় প্রদর্শন
  fontSize?: DisplayFontSize; // ফন্টের আকার
  color: DisplayColor;
  mode: DisplayMode;
  speed: DisplaySpeed;
  customSpeedPxPerSec?: number; // অ্যাডমিন কাস্টম পিক্সেল-পার-সেকেন্ড গতি (১০ থেকে ১০০)
  pauseOnHover?: boolean; // মাউস বা টাচে লেখা থেমে থাকবে কিনা
  showRow3Notifications?: boolean; // ৩য় সারিতে বড় নোটিফিকেশন দেখাবে কিনা
  row3FontSize?: DisplayFontSize; // ৩য় সারির ফন্ট সাইজ
  row3Mode?: Row3NotificationMode; // ৩য় সারির নোটিফিকেশন প্রদর্শনের ধরন
  row3SpeedPxPerSec?: number; // ৩য় সারির নোটিফিকেশন স্ক্রল গতি (৮ থেকে ৬০ px/s)
  row3SlideIntervalSec?: number; // স্পটলাইট মোডে প্রতিটি নোটিফিকেশন কত সেকেন্ড স্থির থাকবে
  active: boolean;
  updatedAt: string;
  updatedBy?: string;
}

export interface AppointedOfficer {
  id: string;
  type: 'manager' | 'auditor';
  name: string;
  designation: string; // শাখা ম্যানেজার, জেনারেল ম্যানেজার, অভ্যন্তরীণ হিসাব নিরীক্ষক ইত্যাদি
  phone: string;
  email?: string;
  nid?: string;
  fatherName?: string;
  motherName?: string;
  address?: string;
  permanentAddress?: string;
  education?: string;
  appointmentDate: string;
  salaryOrFee?: number;
  scopeOfWork?: string;
  photoUrl?: string;
  status: 'active' | 'previous';
  appointedBy?: string;
  terms?: string[];
  notes?: string;
  updatedAt?: string;
}

export interface OfficersState {
  manager: AppointedOfficer;
  auditor: AppointedOfficer;
  history?: AppointedOfficer[];
}

export interface AppReleaseInfo {
  version: string;
  buildId: string;
  buildTime: string;
  releaseNotes: string[];
  publishedBy?: string;
  forceAutoUpdate?: boolean;
  updatedAt?: string;
}

export interface WhatsAppGroupConfig {
  groupName: string;
  groupInviteLink: string;
  staffGroupName?: string;
  staffGroupInviteLink?: string;
  partnerGroupName?: string;
  partnerGroupInviteLink?: string;
  smsAlertPhone?: string;
  autoOpenWhatsAppOnSubmit: boolean;
  webhookUrl?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface JoinRequest {
  id: string;
  uid?: string;
  email?: string;
  role: 'staff' | 'partner';
  name: string;
  phone: string;
  pin: string;
  designationOrRole?: string;
  address?: string;
  nid?: string;
  initialInvestment?: number;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  _pendingSync?: boolean;
}

export interface BillingPortalMetricCard {
  label: string;
  value: string;
  numericValue: number | null;
}

export interface BillingPortalNavLink {
  label: string;
  linkname: string;
}

export interface BillingPortalTableData {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface BillingPortalSyncedRow {
  memberId: string;
  name: string;
  phone: string;
  address: string;
  packageName?: string;
  monthlyFee?: number;
  expiryDate?: string;
  dueAmount?: number;
  status: 'active' | 'inactive' | 'disconnected';
  statusLabel?: string;
  oltInfo?: string;
  onuMac?: string;
  rxPower?: string;
}

export interface BillingPortalDashReport {
  portalHost: string;
  username: string;
  syncedAt: string;
  pageTitle: string;
  totalCustomers: number | null;
  activeCustomers: number | null;
  expiredCustomers: number | null;
  inactiveCustomers: number | null;
  onlineCustomers: number | null;
  offlineCustomers: number | null;
  todayCollection: number | null;
  monthlyCollection: number | null;
  totalDue: number | null;
  metricCards: BillingPortalMetricCard[];
  navLinks: BillingPortalNavLink[];
  tables: BillingPortalTableData[];
  subscriberRows: BillingPortalSyncedRow[];
}

export interface OltSyncedOnuRow {
  ponPort: 'PON1' | 'PON2' | 'PON3' | 'PON4' | 'OTHER';
  oltInfo: string;
  onuId?: string;
  onuName?: string;
  onuMac?: string;
  phone?: string;
  status: 'active' | 'inactive' | 'disconnected';
  statusLabel: string;
  rxPower?: string;
  txPower?: string;
  fiberLength?: string;
  temperature?: string;
  lastDownReason?: string;
  lossStatus: OnuLossStatus;
  issueReason?: string;
}

export interface OltPonSummaryCard {
  ponId: 'PON1' | 'PON2' | 'PON3' | 'PON4';
  total: number;
  online: number;
  offline: number;
  highLossCount: number;
  losCount: number;
  avgRxDbm: number | null;
}

export interface OltDiscoveredPage {
  label: string;
  path: string;
}

export interface OltLiveReport {
  oltOrigin: string;
  username: string;
  syncedAt: string;
  pageTitle: string;
  deviceModel?: string;
  totalOnus: number;
  onlineOnus: number;
  offlineOnus: number;
  highLossOnus: number;
  losOnus: number;
  ponSummary: OltPonSummaryCard[];
  systemMetrics: BillingPortalMetricCard[];
  discoveredPages: OltDiscoveredPage[];
  onuRows: OltSyncedOnuRow[];
  rawTables: BillingPortalTableData[];
}
