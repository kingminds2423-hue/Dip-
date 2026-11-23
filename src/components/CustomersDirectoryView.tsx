import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Phone,
  MapPin,
  Hash,
  Wrench,
  Edit2,
  Trash2,
  Wifi,
  X,
  Check,
  Router,
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Globe,
  Coins,
  WifiOff,
  Calendar,
  ScanSearch,
  GitMerge
} from 'lucide-react';
import { CustomerDue, CustomerMember, Staff, Transaction, UserSession } from '../types';
import {
  formatCurrency,
  getTodayString,
  getTransactionDateKey,
  parseNumericInput,
  toBengaliNumber,
  toEnglishDigits
} from '../utils/formatters';
import { isCustomerExpired } from '../utils/customerStatus';
import { canUserPerformAction } from '../utils/portalPermissions';
import {
  parseCustomersExcelFile,
  buildCustomersFromMappedRows,
  downloadSampleCustomersExcel,
  exportCustomersToExcel,
  ExcelColumnMapping,
  CustomerExcelField
} from '../utils/customerExcel';
import {
  analyzeCustomerDatabaseBloat,
  cleanupAndDeduplicateCustomers,
  deleteRedundantMembersBulk,
  detectDuplicateMembersByMobile,
  mergeDuplicateMembersByMobileGroup,
  MobileDuplicateGroup
} from '../services/dataService';
import { CustomerOnuDetailModal } from './CustomerOnuDetailModal';

interface CustomersDirectoryViewProps {
  customers: CustomerMember[];
  transactions?: Transaction[];
  customerDues?: CustomerDue[];
  currentUser: UserSession;
  staffs?: Staff[];
  onAddCustomer: (c: Omit<CustomerMember, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateCustomer: (id: string, updates: Partial<CustomerMember>) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
  onDeleteAllCustomers?: () => Promise<number | void>;
  onImportCustomers?: (
    rows: Array<Omit<CustomerMember, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<{ addedCount: number; updatedCount: number; totalProcessed: number }>;
  onOpenTroubleshootPortal?: () => void;
  onCreateComplaintFromCustomer: (customer: CustomerMember) => void;
}

export const CustomersDirectoryView: React.FC<CustomersDirectoryViewProps> = ({
  customers,
  transactions = [],
  customerDues = [],
  currentUser,
  staffs = [],
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onDeleteAllCustomers,
  onImportCustomers,
  onOpenTroubleshootPortal,
  onCreateComplaintFromCustomer
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'inactive' | 'disconnected'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerMember | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [detailCustomerId, setDetailCustomerId] = useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(48);
  const detailCustomer = useMemo(
    () => (detailCustomerId ? customers.find((c) => c.id === detailCustomerId) || null : null),
    [customers, detailCustomerId]
  );

  // Excel import states
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [excelFileName, setExcelFileName] = useState('');
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelRawRows, setExcelRawRows] = useState<Record<string, unknown>[]>([]);
  const [columnMapping, setColumnMapping] = useState<ExcelColumnMapping>({
    memberId: '',
    name: '',
    phone: '',
    address: '',
    packageName: '',
    monthlyFee: '',
    oltInfo: '',
    oltPower: '',
    status: '',
    notes: ''
  });
  const [excelError, setExcelError] = useState('');
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [importBanner, setImportBanner] = useState<{
    addedCount: number;
    updatedCount: number;
    totalProcessed: number;
  } | null>(null);

  // Form states
  const [memberId, setMemberId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [packageName, setPackageName] = useState('10 Mbps');
  const [monthlyFee, setMonthlyFee] = useState('500');
  const [oltInfo, setOltInfo] = useState('');
  const [oltPower, setOltPower] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'disconnected'>('active');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [isCleaningDb, setIsCleaningDb] = useState(false);
  const [dbCleanBanner, setDbCleanBanner] = useState<string | null>(null);
  const [showDbCleanerPanel, setShowDbCleanerPanel] = useState(false);
  const [confirmDeleteAllCustomers, setConfirmDeleteAllCustomers] = useState(false);
  const [isDeletingAllCustomers, setIsDeletingAllCustomers] = useState(false);

  // Duplicate Member Detection (Mobile Number Scan) modal & selection state
  const [isDuplicateScanModalOpen, setIsDuplicateScanModalOpen] = useState(false);
  const [hasTriggeredDupScan, setHasTriggeredDupScan] = useState(false);
  const [selectedKeepByPhone, setSelectedKeepByPhone] = useState<Record<string, string>>({});
  const [dupActionBusyKey, setDupActionBusyKey] = useState<string | null>(null);
  const [dupActionBanner, setDupActionBanner] = useState<string | null>(null);

  const customersRef = useRef<CustomerMember[]>(customers);

  useEffect(() => {
    setVisibleLimit(48);
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    customersRef.current = customers;
  }, [customers]);

  const canAddCustomer = canUserPerformAction('canAddCustomer', currentUser, staffs);
  const canEditCustomer = canUserPerformAction('canEditCustomer', currentUser, staffs);
  const canDelete = canUserPerformAction('canDeleteCustomer', currentUser, staffs);
  const canExportExcel = canUserPerformAction('canExportOrPrintReports', currentUser, staffs);
  const canCreateComplaint = canUserPerformAction('canAddComplaint', currentUser, staffs);

  const mobileDuplicateGroups = useMemo<MobileDuplicateGroup[]>(
    () => detectDuplicateMembersByMobile(customers),
    [customers]
  );

  const totalRedundantMobileEntries = useMemo(
    () => mobileDuplicateGroups.reduce((sum, g) => sum + Math.max(0, g.members.length - 1), 0),
    [mobileDuplicateGroups]
  );

  const bloatReport = useMemo(
    () => analyzeCustomerDatabaseBloat(customers),
    [customers]
  );

  const openExcelModal = () => {
    setExcelFileName('');
    setExcelHeaders([]);
    setExcelRawRows([]);
    setColumnMapping({
      memberId: '',
      name: '',
      phone: '',
      address: '',
      packageName: '',
      monthlyFee: '',
      oltInfo: '',
      oltPower: '',
      status: '',
      notes: ''
    });
    setExcelError('');
    setImportBanner(null);
    setIsExcelModalOpen(true);
  };

  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingExcel(true);
    setExcelError('');
    setImportBanner(null);
    try {
      const parsed = await parseCustomersExcelFile(file);
      setExcelFileName(file.name);
      setExcelHeaders(parsed.headers);
      setExcelRawRows(parsed.rawRows);
      setColumnMapping(parsed.detectedMapping);
    } catch (err) {
      setExcelFileName(file.name);
      setExcelHeaders([]);
      setExcelRawRows([]);
      setExcelError(
        err instanceof Error
          ? err.message
          : 'Excel ফাইল পড়া সম্ভব হয়নি। সঠিক .xlsx, .xls বা .csv ফাইল দিন।'
      );
    } finally {
      setIsParsingExcel(false);
      e.target.value = '';
    }
  };

  const mappedPreview = useMemo(() => {
    if (excelRawRows.length === 0) {
      return { validCustomers: [], skippedCount: 0 };
    }
    return buildCustomersFromMappedRows(excelRawRows, columnMapping, currentUser.name);
  }, [excelRawRows, columnMapping, currentUser.name]);

  const handleConfirmExcelImport = async () => {
    if (!onImportCustomers) return;
    if (!columnMapping.memberId || !columnMapping.name) {
      setExcelError('অন্তত "সদস্য নাম্বার (Member ID)" এবং "গ্রাহকের নাম (Name)" কলাম নির্বাচন করুন।');
      return;
    }
    if (mappedPreview.validCustomers.length === 0) {
      setExcelError('ইমপোর্ট করার জন্য কোনো বৈধ গ্রাহক পাওয়া যায়নি।');
      return;
    }

    setIsImportingExcel(true);
    setExcelError('');
    try {
      const result = await onImportCustomers(mappedPreview.validCustomers);
      setImportBanner(result);
      setIsExcelModalOpen(false);
    } catch (err) {
      console.error('Excel import error:', err);
      setExcelError('সদস্য তালিকা ইমপোর্ট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsImportingExcel(false);
    }
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    const nextNum = customers.length + 101;
    setMemberId(`DBN-${nextNum}`);
    setName('');
    setPhone('');
    setAddress('');
    setPackageName('10 Mbps');
    setMonthlyFee('500');
    setOltInfo('');
    setOltPower('');
    setStatus('active');
    setNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (c: CustomerMember) => {
    setEditingCustomer(c);
    setMemberId(c.memberId || '');
    setName(c.name || '');
    setPhone(c.phone || '');
    setAddress(c.address || '');
    setPackageName(c.packageName || '');
    setMonthlyFee(c.monthlyFee !== undefined ? String(c.monthlyFee) : '');
    setOltInfo(c.oltInfo || '');
    setOltPower(c.oltPower || '');
    setStatus(c.status || 'active');
    setNotes(c.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const filteredCustomers = useMemo(() => {
    const q = toEnglishDigits(searchQuery.trim().toLowerCase());
    return customers.filter((c) => {
      if (statusFilter === 'expired') {
        if (!isCustomerExpired(c)) return false;
      } else if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = toEnglishDigits(
        `${c.memberId} ${c.name} ${c.phone} ${c.address} ${c.oltInfo || ''} ${c.onuMac || ''} ${c.rxPower || ''} ${c.packageName || ''} ${c.statusLabel || ''} ${c.expiryDate || ''}`.toLowerCase()
      );
      return haystack.includes(q);
    });
  }, [customers, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const activeCount = customers.filter((c) => c.status === 'active').length;
    const expiredCount = customers.filter((c) => isCustomerExpired(c)).length;
    const inactiveCount = customers.filter((c) => c.status === 'inactive').length;
    const disconnectedCount = customers.filter((c) => c.status === 'disconnected').length;
    const totalFee = customers
      .filter((c) => c.status === 'active')
      .reduce((sum, c) => sum + (Number(c.monthlyFee) || 0), 0);

    const todayKey = getTodayString();
    const monthKey = todayKey.substring(0, 7);
    const appTodayIncome = transactions
      .filter((tx) => tx.type === 'income' && getTransactionDateKey(tx) === todayKey)
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const appMonthIncome = transactions
      .filter((tx) => tx.type === 'income' && getTransactionDateKey(tx).startsWith(monthKey))
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const totalDueReceivable = customerDues.reduce((sum, d) => sum + (Number(d.currentDue) || 0), 0);

    return {
      total: customers.length,
      active: activeCount,
      expired: expiredCount,
      inactive: inactiveCount,
      disconnected: disconnectedCount,
      totalFee,
      appTodayIncome,
      appMonthIncome,
      totalDueReceivable
    };
  }, [customerDues, customers, transactions]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId.trim()) {
      setFormError('অনুগ্রহ করে সদস্য নাম্বার লিখুন');
      return;
    }
    if (!name.trim()) {
      setFormError('অনুগ্রহ করে গ্রাহকের নাম লিখুন');
      return;
    }
    if (!phone.trim()) {
      setFormError('অনুগ্রহ করে মোবাইল নম্বর লিখুন');
      return;
    }
    if (!address.trim()) {
      setFormError('অনুগ্রহ করে ঠিকানা / এলাকা লিখুন');
      return;
    }

    // Prevent duplicate Member ID when adding new
    const normalizedId = toEnglishDigits(memberId.trim().toLowerCase());
    const duplicate = customers.find(
      (c) =>
        toEnglishDigits((c.memberId || '').trim().toLowerCase()) === normalizedId &&
        c.id !== editingCustomer?.id
    );
    if (duplicate) {
      setFormError(`সদস্য নাম্বার "${memberId.trim()}" ইতিমধ্যে ${duplicate.name}-এর নামে সংরক্ষিত আছে!`);
      return;
    }

    setIsSaving(true);
    setFormError('');
    try {
      const payload = {
        memberId: memberId.trim(),
        name: name.trim(),
        phone: toEnglishDigits(phone.trim()),
        address: address.trim(),
        packageName: packageName.trim(),
        monthlyFee: parseNumericInput(monthlyFee),
        oltInfo: oltInfo.trim(),
        oltPower: oltPower.trim(),
        status,
        notes: notes.trim(),
        addedBy: currentUser.name
      };

      if (editingCustomer) {
        await onUpdateCustomer(editingCustomer.id, payload);
      } else {
        await onAddCustomer(payload);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save customer:', err);
      setFormError('গ্রাহকের তথ্য সংরক্ষণে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsSaving(false);
    }
  };


  const handleDeduplicateAndClean = async () => {
    if (!canDelete || isCleaningDb) return;
    setIsCleaningDb(true);
    setDbCleanBanner(null);
    try {
      const res = await cleanupAndDeduplicateCustomers(customersRef.current, {
        mergeDuplicates: true,
        deletePhantoms: true
      });
      setDbCleanBanner(
        `ডাটাবেস পরিষ্কার সম্পন্ন: ${toBengaliNumber(res.mergedGroupCount)} টি ডুপ্লিকেট একত্রিত এবং ${toBengaliNumber(res.deletedCount)} টি অতিরিক্ত/ভুয়া রেকর্ড মুছে ফেলা হয়েছে — বর্তমান গ্রাহক ${toBengaliNumber(res.remainingCount)} জন।`
      );
    } catch {
      setDbCleanBanner('ডাটাবেস পরিষ্কার করতে সাময়িক সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsCleaningDb(false);
    }
  };

  const handleOpenDuplicateScanModal = () => {
    const initialSelections: Record<string, string> = {};
    mobileDuplicateGroups.forEach((g) => {
      initialSelections[g.normalizedPhone] = g.recommendedKeepId;
    });
    setSelectedKeepByPhone(initialSelections);
    setHasTriggeredDupScan(true);
    setDupActionBanner(null);
    setIsDuplicateScanModalOpen(true);
  };

  const handleMergePhoneGroup = async (group: MobileDuplicateGroup) => {
    if (dupActionBusyKey) return;
    const keepId = selectedKeepByPhone[group.normalizedPhone] || group.recommendedKeepId;
    setDupActionBusyKey(group.normalizedPhone);
    setDupActionBanner(null);
    try {
      const res = await mergeDuplicateMembersByMobileGroup(keepId, group.members, customersRef.current);
      setDupActionBanner(
        `মোবাইল ${group.normalizedPhone}: তথ্য একত্রিত করে মূল রেকর্ড (${res.mergedCustomer.memberId}) রাখা হয়েছে এবং ${toBengaliNumber(res.deletedCount)}টি ডুপ্লিকেট মুছে ফেলা হয়েছে।`
      );
    } catch {
      setDupActionBanner(`মোবাইল ${group.normalizedPhone} মার্জ করতে সমস্যা হয়েছে।`);
    } finally {
      setDupActionBusyKey(null);
    }
  };

  const handleDeleteRedundantInGroup = async (group: MobileDuplicateGroup) => {
    if (dupActionBusyKey) return;
    const keepId = selectedKeepByPhone[group.normalizedPhone] || group.recommendedKeepId;
    const dropIds = group.members.filter((m) => m.id !== keepId).map((m) => m.id);
    if (dropIds.length === 0) return;
    setDupActionBusyKey(group.normalizedPhone);
    setDupActionBanner(null);
    try {
      const res = await deleteRedundantMembersBulk(dropIds, customersRef.current);
      setDupActionBanner(
        `মোবাইল ${group.normalizedPhone}-এর অতিরিক্ত ${toBengaliNumber(res.deletedCount)}টি ডুপ্লিকেট এন্ট্রি মুছে ফেলা হয়েছে।`
      );
    } catch {
      setDupActionBanner('অতিরিক্ত এন্ট্রি মুছতে সমস্যা হয়েছে।');
    } finally {
      setDupActionBusyKey(null);
    }
  };

  const handleMergeAllMobileDuplicates = async () => {
    if (dupActionBusyKey || mobileDuplicateGroups.length === 0) return;
    setDupActionBusyKey('__all__');
    setDupActionBanner(null);
    let totalDeleted = 0;
    let totalGroups = 0;
    try {
      for (const group of mobileDuplicateGroups) {
        const keepId = selectedKeepByPhone[group.normalizedPhone] || group.recommendedKeepId;
        const res = await mergeDuplicateMembersByMobileGroup(keepId, group.members, customersRef.current);
        totalDeleted += res.deletedCount;
        totalGroups += 1;
      }
      setDupActionBanner(
        `সব ডুপ্লিকেট সমাধান সম্পন্ন: ${toBengaliNumber(totalGroups)}টি মোবাইল নম্বর গ্রুপ একত্রিত করে ${toBengaliNumber(totalDeleted)}টি অতিরিক্ত এন্ট্রি মুছে ফেলা হয়েছে।`
      );
    } catch {
      setDupActionBanner('সব ডুপ্লিকেট মার্জ করার সময় সাময়িক সমস্যা হয়েছে।');
    } finally {
      setDupActionBusyKey(null);
    }
  };


  return (
    <div className="space-y-4 pb-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#064e3b] via-emerald-800 to-teal-800 rounded-2xl p-5 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black">
              গ্রাহক ও সদস্য তালিকা (Customer Directory)
            </h2>
            <p className="text-xs text-emerald-100 mt-0.5">
              গ্রাহক সংরক্ষণ করুন — লাইন সমস্যা হলে অভিযোগ এন্ট্রির সময় সদস্য নাম্বার দিয়ে সার্চ করলেই নাম, মোবাইল ও ঠিকানা অটো চলে আসবে।
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenTroubleshootPortal && (
            <button
              type="button"
              onClick={onOpenTroubleshootPortal}
              className="px-3.5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
            >
              <Globe className="w-4 h-4" />
              <span>সমস্যা সমাধান পোর্টাল</span>
            </button>
          )}
          {onImportCustomers && canAddCustomer && (
            <button
              type="button"
              onClick={openExcelModal}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel ইমপোর্ট</span>
            </button>
          )}
          {customers.length > 0 && canExportExcel && (
            <button
              type="button"
              onClick={() => void exportCustomersToExcel(filteredCustomers.length > 0 ? filteredCustomers : customers)}
              className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 border border-white/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel ডাউনলোড</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenDuplicateScanModal}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform border ${
              mobileDuplicateGroups.length > 0
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-200'
                : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-white border-cyan-300/40'
            }`}
            title="একই মোবাইল নম্বরের ডুপ্লিকেট গ্রাহক শনাক্ত করে মার্জ বা ডিলিট করুন"
          >
            <ScanSearch className="w-4 h-4 shrink-0" />
            <span>ডুপ্লিকেট মোবাইল স্ক্যান</span>
            {mobileDuplicateGroups.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-slate-950 text-amber-300 text-[10px] font-black tabular-nums">
                {toBengaliNumber(mobileDuplicateGroups.length)}
              </span>
            )}
          </button>
          {canAddCustomer && (
            <button
              type="button"
              onClick={openAddModal}
              className="px-4 py-2.5 rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 text-xs font-black flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
            >
              <UserPlus className="w-4 h-4" />
              <span>নতুন গ্রাহক যোগ করুন</span>
            </button>
          )}
        </div>
      </div>

      {/* Excel Bulk Import Success Banner */}
      {importBanner && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm font-bold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              Excel থেকে মোট {toBengaliNumber(importBanner.totalProcessed)} জন সদস্য প্রসেস হয়েছে — নতুন যোগ:{' '}
              {toBengaliNumber(importBanner.addedCount)} জন, তথ্য আপডেট:{' '}
              {toBengaliNumber(importBanner.updatedCount)} জন। এখন অভিযোগ বক্সে সদস্য নাম্বার দিয়ে সার্চ করলেই পুরো তথ্য দেখাবে!
            </span>
          </div>
          <button
            type="button"
            onClick={() => setImportBanner(null)}
            className="text-emerald-700 dark:text-emerald-300 hover:opacity-75 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Local Database Hygiene & Deduplication Panel (Shown when bloat exists or toggled) */}
      {(canDelete ||
        bloatReport.hasSignificantBloat ||
        bloatReport.cleanupCandidateIds.length > 0 ||
        dbCleanBanner) && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-emerald-200 dark:border-emerald-800/70 shadow-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Globe className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  গ্রাহক ডিরেক্টরি ও ডাটাবেস রক্ষণাবেক্ষণ
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  মোট সংরক্ষিত গ্রাহক: {toBengaliNumber(bloatReport.totalDb)} জন • ডুপ্লিকেট মোবাইল গ্রুপ: {toBengaliNumber(mobileDuplicateGroups.length)} টি
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onDeleteAllCustomers && customers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteAllCustomers(true)}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="সব পুরাতন গ্রাহক স্থায়ীভাবে মুছে নতুন করে শুরু করুন"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>সব পুরাতন গ্রাহক মুছুন ({toBengaliNumber(customers.length)})</span>
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => setShowDbCleanerPanel((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                    bloatReport.hasSignificantBloat || bloatReport.cleanupCandidateIds.length > 0
                      ? 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/50 dark:border-amber-700 dark:text-amber-300'
                      : 'bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  DB পরিষ্কার
                </button>
              )}
            </div>
          </div>

          {confirmDeleteAllCustomers && onDeleteAllCustomers && (
            <div className="rounded-xl p-4 bg-rose-50 dark:bg-rose-950/55 border-2 border-rose-400 dark:border-rose-700 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-black text-rose-900 dark:text-rose-200">
                    সব পুরাতন গ্রাহক স্থায়ীভাবে মুছে ফেলতে চান? ({toBengaliNumber(customers.length)} জন)
                  </h4>
                  <p className="text-xs text-rose-800 dark:text-rose-300 mt-0.5 leading-relaxed">
                    হ্যাঁ দিলে ক্লাউড ডাটাবেজ ও ক্যাশ থেকে সকল {toBengaliNumber(customers.length)} জন পুরাতন গ্রাহক মুছে ০ জনে নেমে আসবে। এরপর আপনি admin.bhola.net থেকে লাইভ সিঙ্ক বা নতুন Excel ইমপোর্ট করতে পারবেন।
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isDeletingAllCustomers}
                  onClick={() => setConfirmDeleteAllCustomers(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                >
                  বাতিল করুন
                </button>
                <button
                  type="button"
                  disabled={isDeletingAllCustomers}
                  onClick={async () => {
                    setIsDeletingAllCustomers(true);
                    try {
                      const prevCount = customers.length;
                      const wiped = await onDeleteAllCustomers();
                      setConfirmDeleteAllCustomers(false);
                      if (typeof wiped === 'number' && wiped === 0 && prevCount > 0) {
                        setDbCleanBanner('পরিচালক পিন যাচাই না হওয়ায় পুরাতন গ্রাহক মোছা হয়নি।');
                      } else {
                        setDbCleanBanner(
                          `সব পুরাতন গ্রাহক (${toBengaliNumber(typeof wiped === 'number' ? wiped : prevCount)} জন) স্থায়ীভাবে মুছে ফেলা হয়েছে।`
                        );
                      }
                    } finally {
                      setIsDeletingAllCustomers(false);
                    }
                  }}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeletingAllCustomers ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, সব মুছে ০ করুন'}</span>
                </button>
              </div>
            </div>
          )}

          {(showDbCleanerPanel ||
            bloatReport.hasSignificantBloat ||
            bloatReport.cleanupCandidateIds.length > 0 ||
            dbCleanBanner) && (
            <div className="rounded-xl p-3 bg-amber-50/90 dark:bg-amber-950/35 border border-amber-300 dark:border-amber-800/80 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="text-xs font-black text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>ডাটাবেস ডুপ্লিকেট ও অপ্রয়োজনীয় রেকর্ড বিশ্লেষণ</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold tabular-nums text-slate-700 dark:text-slate-300">
                    <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      বর্তমান DB: {toBengaliNumber(bloatReport.totalDb)} টি
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200">
                      ডুপ্লিকেট: {toBengaliNumber(bloatReport.duplicateDocIds.length)} টি
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/50 text-rose-900 dark:text-rose-200">
                      ভুয়া/লগ/MAC: {toBengaliNumber(bloatReport.phantomDocIds.length)} টি
                    </span>
                  </div>
                </div>

                {canDelete && bloatReport.cleanupCandidateIds.length > 0 && (
                  <button
                    type="button"
                    disabled={isCleaningDb}
                    onClick={() => void handleDeduplicateAndClean()}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-[11px] font-black flex items-center gap-1 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {isCleaningDb
                        ? 'পরিষ্কার হচ্ছে...'
                        : `ডুপ্লিকেট ও ভুয়া পরিষ্কার (${toBengaliNumber(bloatReport.cleanupCandidateIds.length)})`}
                    </span>
                  </button>
                )}
              </div>

              {dbCleanBanner && (
                <div className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex items-center justify-between gap-2">
                  <span>{dbCleanBanner}</span>
                  <button
                    type="button"
                    onClick={() => setDbCleanBanner(null)}
                    className="p-0.5 hover:opacity-75"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Summary Stats Row: Active, Expired, Collection (আদায়), Total & Due */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* 1. Customer Active */}
        <button
          type="button"
          onClick={() => setStatusFilter('active')}
          className="text-left bg-white dark:bg-slate-900 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/70 shadow-xs hover:border-emerald-400 transition-colors"
        >
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
            <span className="flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5" />
              কাস্টমার Active
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">
            {toBengaliNumber(stats.active)} জন
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            ডেটাবেজে সচল গ্রাহক: {toBengaliNumber(stats.active)} জন
          </div>
        </button>

        {/* 2. Customer Expired / বন্ধ / বিচ্ছিন্ন */}
        <button
          type="button"
          onClick={() => setStatusFilter(stats.expired > 0 ? 'expired' : 'inactive')}
          className="text-left bg-white dark:bg-slate-900 p-4 rounded-2xl border border-rose-200 dark:border-rose-800/70 shadow-xs hover:border-rose-400 transition-colors"
        >
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-rose-700 dark:text-rose-400">
            <span className="flex items-center gap-1.5">
              <WifiOff className="w-3.5 h-3.5" />
              Expired / বন্ধ
            </span>
          </div>
          <div className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-1 tabular-nums">
            {toBengaliNumber(stats.expired || stats.inactive + stats.disconnected)} জন
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            Expired: {toBengaliNumber(stats.expired)} · বন্ধ: {toBengaliNumber(stats.inactive)} · বিচ্ছিন্ন: {toBengaliNumber(stats.disconnected)}
          </div>
        </button>

        {/* 3. আজকের ও মাসিক আদায় (Collection) */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-sky-200 dark:border-sky-800/70 shadow-xs">
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-sky-700 dark:text-sky-400">
            <span className="flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5" />
              আজকের ও মাসিক আদায়
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">হিসাব খাতা</span>
          </div>
          <div className="text-2xl font-black text-sky-800 dark:text-sky-200 mt-1 tabular-nums">
            {formatCurrency(stats.appTodayIncome)}
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 truncate tabular-nums">
            চলতি মাস:{' '}
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {formatCurrency(stats.appMonthIncome)}
            </span>
          </div>
        </div>

        {/* 4. Total Customers & Monthly Potential / Receivable */}
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className="text-left bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-400 transition-colors"
        >
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
            <span>মোট গ্রাহক ও সম্ভাব্য বিল</span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
            {toBengaliNumber(stats.total)} জন
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate tabular-nums">
            Active বিল: {formatCurrency(stats.totalFee)} · বকেয়া: {formatCurrency(stats.totalDueReceivable)}
          </div>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="সদস্য নাম্বার (যেমন DBN-101), নাম, মোবাইল বা এলাকা দিয়ে খুঁজুন..."
            className="w-full pl-10 pr-8 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
          {([
            ['all', `সবাই (${toBengaliNumber(stats.total)})`],
            ['active', `Active (${toBengaliNumber(stats.active)})`],
            ['expired', `Expired (${toBengaliNumber(stats.expired)})`],
            ['inactive', `বন্ধ (${toBengaliNumber(stats.inactive)})`],
            ['disconnected', `বিচ্ছিন্ন (${toBengaliNumber(stats.disconnected)})`]
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === key
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick-Tap Search Match Strip when searching by Name, Phone, or Member ID */}
      {searchQuery.trim().length > 0 && filteredCustomers.length > 0 && (
        <div className="bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-3 space-y-2">
          <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2">
            <span>
              সার্চ ফলাফল ({toBengaliNumber(filteredCustomers.length)} জন) — নামের উপর চাপ দিয়ে পূর্ণ অনু পাওয়ার, Length, MAC, TJ ও লস সমাধান দেখুন:
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {filteredCustomers.slice(0, 8).map((c) => (
              <button
                key={`quick-${c.id}`}
                type="button"
                onClick={() => setDetailCustomerId(c.id)}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 shadow-xs transition-colors"
              >
                <span className="font-mono text-emerald-700 dark:text-emerald-300">#{c.memberId}</span>
                <span>{c.name}</span>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">({c.phone})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Customer Cards List */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center space-y-3">
          <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {customers.length === 0
              ? 'এখনো কোনো গ্রাহক বা সদস্য যোগ করা হয়নি'
              : 'আপনার সার্চের সাথে মিলে এমন কোনো গ্রাহক পাওয়া যায়নি'}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            "নতুন গ্রাহক যোগ করুন" অথবা "Excel ইমপোর্ট" বাটনে ক্লিক করে একসাথে শত শত সদস্যের তথ্য সেভ করুন যাতে লাইন সমস্যায় সাথে সাথে খুঁজে পাওয়া যায়।
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {onImportCustomers && canAddCustomer && (
              <button
                type="button"
                onClick={openExcelModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel ফাইল থেকে ইমপোর্ট</span>
              </button>
            )}
            {canAddCustomer && (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
              >
                <UserPlus className="w-4 h-4" />
                <span>প্রথম গ্রাহক যোগ করুন</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filteredCustomers.slice(0, visibleLimit).map((c) => {
            const expired = isCustomerExpired(c);
            const statusBadge =
              c.status === 'active'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : expired || c.status === 'disconnected'
                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
            const statusLabel =
              c.status === 'active'
                ? 'সচল (Active)'
                : expired
                ? 'Expired (মেয়াদ শেষ)'
                : c.status === 'inactive'
                ? 'সাময়িক বন্ধ'
                : 'বিচ্ছিন্ন';

            return (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setDetailCustomerId(c.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-emerald-900 text-amber-300 text-xs font-mono font-bold transition-colors"
                      >
                        <Hash className="w-3 h-3" />
                        <span>{c.memberId}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailCustomerId(c.id)}
                        className="block text-left text-base font-black text-slate-900 dark:text-white hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline underline-offset-2 mt-1.5 truncate max-w-full"
                        title="ট্যাপ করে পূর্ণ তথ্য, অনু পাওয়ার, Length ও লস দেখুন"
                      >
                        {c.name}
                      </button>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold shrink-0 ${statusBadge}`}>
                      {c.statusLabel || statusLabel}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <a href={`tel:${c.phone}`} className="font-bold hover:text-emerald-700 underline-offset-2 hover:underline">
                        {c.phone}
                      </a>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <span>{c.address}</span>
                    </div>
                    {(c.packageName || c.monthlyFee) && (
                      <div className="flex items-center gap-2">
                        <Wifi className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>
                          {c.packageName || 'সাধারণ প্যাকেজ'}
                          {c.monthlyFee ? ` • ${formatCurrency(c.monthlyFee)}/মাস` : ''}
                        </span>
                      </div>
                    )}
                    {(c.expiryDate || c.dueAmount) && (
                      <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        {c.expiryDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>মেয়াদ: {toBengaliNumber(c.expiryDate)}</span>
                          </span>
                        )}
                        {c.dueAmount !== undefined && c.dueAmount > 0 && (
                          <span className="text-rose-600 dark:text-rose-400 font-bold tabular-nums">
                            বকেয়া: {formatCurrency(c.dueAmount)}
                          </span>
                        )}
                      </div>
                    )}
                    {(c.oltInfo || c.oltPower) && (
                      <div className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <Router className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          {c.oltInfo && <div>OLT/PON: {c.oltInfo}</div>}
                          {c.oltPower && <div className="font-mono">Power/Dist: {c.oltPower}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDetailCustomerId(c.id)}
                    className="flex-1 py-2 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Router className="w-3.5 h-3.5" />
                    <span>অনু পাওয়ার ও লস</span>
                  </button>

                  {canCreateComplaint && (
                    <button
                      type="button"
                      onClick={() => onCreateComplaintFromCustomer(c)}
                      className="py-2 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-extrabold flex items-center justify-center gap-1 transition-colors"
                      title="লাইন সমস্যা / অভিযোগ এন্ট্রি"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>অভিযোগ</span>
                    </button>
                  )}

                  {canEditCustomer && (
                    <button
                      type="button"
                      onClick={() => openEditModal(c)}
                      title="তথ্য পরিবর্তন"
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {canDelete && (
                    deleteConfirmId === c.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteCustomer(c.id);
                            setDeleteConfirmId(null);
                          }}
                          className="px-2 py-1.5 rounded-lg bg-rose-600 text-white text-[10px] font-bold"
                        >
                          মুছুন
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold"
                        >
                          না
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(c.id)}
                        title="মুছে ফেলুন"
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredCustomers.length > visibleLimit && (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setVisibleLimit((prev) => prev + 48)}
              className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-black shadow-sm cursor-pointer"
            >
              আরও {toBengaliNumber(Math.min(48, filteredCustomers.length - visibleLimit))} জন দেখুন ({toBengaliNumber(visibleLimit)} / {toBengaliNumber(filteredCustomers.length)})
            </button>
            <button
              type="button"
              onClick={() => setVisibleLimit(filteredCustomers.length)}
              className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-bold cursor-pointer"
            >
              সবাইকে একসাথে দেখুন ({toBengaliNumber(filteredCustomers.length)})
            </button>
          </div>
        )}
        </>
      )}

      {/* Add / Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6">
            <div className="px-5 py-4 bg-[#064e3b] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserPlus className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="text-base font-black">
                    {editingCustomer ? 'গ্রাহকের তথ্য সংশোধন' : 'নতুন গ্রাহক / সদস্য যোগ করুন'}
                  </h3>
                  <p className="text-[11px] text-emerald-100">
                    লাইন সমস্যা হলে সদস্য নাম্বার দিয়ে সার্চ করলেই অটো-ফিল হবে
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    সদস্য নাম্বার / আইডি *
                  </label>
                  <input
                    type="text"
                    required
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    placeholder="যেমন: DBN-101 বা 1024"
                    className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    গ্রাহকের নাম *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="যেমন: মোঃ হারুন"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    মোবাইল নম্বর *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    লাইন স্ট্যাটাস
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'active' | 'inactive' | 'disconnected')}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="active">সচল (Active)</option>
                    <option value="inactive">সাময়িক বন্ধ (Inactive)</option>
                    <option value="disconnected">বিচ্ছিন্ন (Disconnected)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ঠিকানা / এলাকা *
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="যেমন: বাপ্তা, বিশ্বরোড মোড়, ভোলা সদর"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    প্যাকেজ (Mbps)
                  </label>
                  <input
                    type="text"
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    placeholder="10 Mbps"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    মাসিক বিল (টাকা)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={monthlyFee}
                    onChange={(e) => setMonthlyFee(e.target.value)}
                    placeholder="500"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    OLT &amp; PON তথ্য (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={oltInfo}
                    onChange={(e) => setOltInfo(e.target.value)}
                    placeholder="যেমন: OLT-Sujit (EPON0/1/3:32)"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    POWER / DIST (dBm / মিটার)
                  </label>
                  <input
                    type="text"
                    value={oltPower}
                    onChange={(e) => setOltPower(e.target.value)}
                    placeholder="যেমন: -18.7 dBm | 2290 meter"
                    className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  অতিরিক্ত নোট (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="সংযোগের বিশেষ কোনো তথ্য..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-black text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Excel Sheet Import Modal */}
      {isExcelModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-[#064e3b] via-emerald-800 to-teal-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-black">
                    Excel শিইট থেকে একসাথে সদস্য যোগ করুন (.xlsx / .xls / .csv)
                  </h3>
                  <p className="text-[11px] text-emerald-100">
                    আপনার ISP পোর্টাল বা নিজস্ব Excel ফাইল আপলোড করলেই কলাম অটো-ডিটেক্ট হবে এবং অভিযোগ বক্সে সার্চ করলে পুরো তথ্য দেখাবে।
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExcelModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
              {excelError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{excelError}</span>
                </div>
              )}

              {/* File Upload + Sample Template Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
                <label className="md:col-span-2 flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer transition-colors">
                  <div className="flex items-center gap-3 text-center sm:text-left">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                        {isParsingExcel
                          ? 'Excel ফাইল পড়া হচ্ছে...'
                          : excelFileName
                          ? `নির্বাচিত ফাইল: ${excelFileName}`
                          : 'এখানে ক্লিক করে Excel বা CSV ফাইল নির্বাচন করুন'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        সমর্থিত ফরম্যাট: .xlsx, .xls, .csv (বাংলা ও ইংরেজি কলাম সাপোর্টেড)
                      </div>
                    </div>
                  </div>
                  <span className="px-3.5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-black shrink-0">
                    ফাইল বাছুন
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelFileChange}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void downloadSampleCustomersExcel()}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 flex flex-col items-center justify-center gap-1.5 text-center transition-colors"
                >
                  <Download className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                    নমুনা Excel ডাউনলোড
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    ফরম্যাট দেখে সহজে তৈরি করুন
                  </span>
                </button>
              </div>

              {/* Column Mapping & Preview Section */}
              {excelHeaders.length > 0 && (
                <>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">
                        কলাম মিলিয়ে নিন (অটো-ডিটেক্টেড — প্রয়োজনে পরিবর্তন করুন)
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                          মোট সারি: {toBengaliNumber(excelRawRows.length)}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
                          সঠিক সদস্য: {toBengaliNumber(mappedPreview.validCustomers.length)} জন
                        </span>
                        {mappedPreview.skippedCount > 0 && (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                            বাদ: {toBengaliNumber(mappedPreview.skippedCount)} টি (আইডি/নাম নেই)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {([
                        ['memberId', 'সদস্য নাম্বার (Member ID) *'],
                        ['name', 'গ্রাহকের নাম (Name) *'],
                        ['phone', 'মোবাইল নম্বর (Mobile)'],
                        ['address', 'ঠিকানা / এলাকা (Address)'],
                        ['packageName', 'প্যাকেজ (Package Mbps)'],
                        ['monthlyFee', 'মাসিক বিল (Monthly Fee)'],
                        ['oltInfo', 'OLT & PON তথ্য'],
                        ['oltPower', 'POWER / DIST (dBm / মিটার)'],
                        ['status', 'লাইন স্ট্যাটাস (Status)'],
                        ['notes', 'মন্তব্য / নোট (Notes)']
                      ] as Array<[CustomerExcelField, string]>).map(([fieldKey, label]) => (
                        <div key={fieldKey}>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                            {label}
                          </label>
                          <select
                            value={columnMapping[fieldKey]}
                            onChange={(e) =>
                              setColumnMapping((prev) => ({
                                ...prev,
                                [fieldKey]: e.target.value
                              }))
                            }
                            className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">-- নির্বাচন করা হয়নি --</option>
                            {excelHeaders.map((hdr) => (
                              <option key={hdr} value={hdr}>
                                {hdr}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Preview Table */}
                  {mappedPreview.validCustomers.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-[11px] font-black text-slate-700 dark:text-slate-200 flex items-center justify-between">
                        <span>
                          প্রিভিউ (প্রথম {toBengaliNumber(Math.min(8, mappedPreview.validCustomers.length))} জন)
                        </span>
                        <span className="text-emerald-700 dark:text-emerald-300">
                          পূর্বের মিল থাকা সদস্য নাম্বারগুলো অটো আপডেট হবে
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                              <th className="px-3 py-2">সদস্য নং</th>
                              <th className="px-3 py-2">নাম</th>
                              <th className="px-3 py-2">মোবাইল</th>
                              <th className="px-3 py-2">ঠিকানা</th>
                              <th className="px-3 py-2">প্যাকেজ / বিল</th>
                              <th className="px-3 py-2">OLT &amp; PON</th>
                              <th className="px-3 py-2">Power / Dist</th>
                              <th className="px-3 py-2">স্ট্যাটাস</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {mappedPreview.validCustomers.slice(0, 8).map((row, idx) => (
                              <tr key={`${row.memberId}-${idx}`} className="bg-white dark:bg-slate-900">
                                <td className="px-3 py-2 font-mono font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                                  {row.memberId}
                                </td>
                                <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">
                                  {row.name}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">{row.phone}</td>
                                <td className="px-3 py-2 max-w-[180px] truncate">{row.address}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {row.packageName || '-'}
                                  {row.monthlyFee ? ` (${formatCurrency(row.monthlyFee)})` : ''}
                                </td>
                                <td className="px-3 py-2 max-w-[140px] truncate">{row.oltInfo || '-'}</td>
                                <td className="px-3 py-2 max-w-[130px] truncate font-mono">{row.oltPower || '-'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      row.status === 'active'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : row.status === 'inactive'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {row.status === 'active'
                                      ? 'সচল'
                                      : row.status === 'inactive'
                                      ? 'বন্ধ'
                                      : 'বিচ্ছিন্ন'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsExcelModalOpen(false)}
                  disabled={isImportingExcel}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  disabled={isImportingExcel || mappedPreview.validCustomers.length === 0}
                  onClick={handleConfirmExcelImport}
                  className="px-5 py-2.5 text-xs font-black text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl flex items-center gap-1.5 shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isImportingExcel
                      ? 'সদস্য তালিকা সেভ হচ্ছে...'
                      : `${toBengaliNumber(mappedPreview.validCustomers.length)} জন সদস্য ইমপোর্ট করুন`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Member Detection (Mobile Number Scan & Merge/Delete) Modal */}
      {isDuplicateScanModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6">
            <div className="px-5 py-4 bg-gradient-to-r from-[#020a18] via-[#041d42] to-[#020e21] text-white flex items-center justify-between gap-3 border-b border-cyan-400/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-400/20 border border-cyan-300/50 flex items-center justify-center shrink-0">
                  <ScanSearch className="w-5 h-5 text-cyan-300" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black">
                    ডুপ্লিকেট মেম্বার ডিটেকশন (মোবাইল নম্বর স্ক্যান)
                  </h3>
                  <p className="text-xs text-cyan-200/85">
                    একই মোবাইল নম্বরে একাধিক এন্ট্রি শনাক্ত করে তথ্য মার্জ (Merge) বা অতিরিক্ত রেকর্ড ডিলিট করুন
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDuplicateScanModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Scan Summary Cards */}
              <div className="grid grid-cols-3 gap-2.5 font-mono tabular-nums">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-3">
                  <div className="text-xs font-sans font-bold text-slate-500 dark:text-slate-400">মোট স্ক্যান</div>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                    {toBengaliNumber(customers.length)} জন
                  </div>
                </div>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3">
                  <div className="text-xs font-sans font-bold text-amber-800 dark:text-amber-300">ডুপ্লিকেট মোবাইল গ্রুপ</div>
                  <div className="text-xl font-black text-amber-700 dark:text-amber-300 mt-0.5">
                    {toBengaliNumber(mobileDuplicateGroups.length)} টি
                  </div>
                </div>
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-3">
                  <div className="text-xs font-sans font-bold text-rose-800 dark:text-rose-300">অতিরিক্ত এন্ট্রি</div>
                  <div className="text-xl font-black text-rose-700 dark:text-rose-300 mt-0.5">
                    {toBengaliNumber(totalRedundantMobileEntries)} টি
                  </div>
                </div>
              </div>

              {dupActionBanner && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm font-bold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{dupActionBanner}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDupActionBanner(null)}
                    className="p-1 hover:opacity-75"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {hasTriggeredDupScan && mobileDuplicateGroups.length === 0 ? (
                <div className="py-10 px-4 text-center rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  <h4 className="text-base font-black text-emerald-950 dark:text-emerald-200">
                    কোনো ডুপ্লিকেট মোবাইল নম্বর পাওয়া যায়নি!
                  </h4>
                  <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 max-w-md mx-auto">
                    ডিরেক্টরির সব {toBengaliNumber(customers.length)} জন গ্রাহকের মোবাইল নম্বর ইউনিক ও পরিচ্ছন্ন রয়েছে।
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {mobileDuplicateGroups.length > 1 && canDelete && (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-300 dark:border-amber-800">
                      <span className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-200">
                        সব {toBengaliNumber(mobileDuplicateGroups.length)}টি ডুপ্লিকেট মোবাইল গ্রুপ একসাথে মূল রেকর্ডে মার্জ করুন:
                      </span>
                      <button
                        type="button"
                        disabled={dupActionBusyKey !== null}
                        onClick={() => void handleMergeAllMobileDuplicates()}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                      >
                        <GitMerge className="w-4 h-4" />
                        <span>
                          {dupActionBusyKey === '__all__'
                            ? 'সব মার্জ হচ্ছে...'
                            : `সব ডুপ্লিকেট মার্জ করুন (${toBengaliNumber(totalRedundantMobileEntries)}টি মুছবে)`}
                        </span>
                      </button>
                    </div>
                  )}

                  {mobileDuplicateGroups.map((group) => {
                    const keepId = selectedKeepByPhone[group.normalizedPhone] || group.recommendedKeepId;
                    const isBusy = dupActionBusyKey === group.normalizedPhone || dupActionBusyKey === '__all__';
                    return (
                      <div
                        key={group.normalizedPhone}
                        className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 overflow-hidden"
                      >
                        <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-emerald-600 dark:text-cyan-400 shrink-0" />
                            <span className="font-mono text-sm font-black text-slate-900 dark:text-white">
                              {group.normalizedPhone}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 text-xs font-black">
                              {toBengaliNumber(group.members.length)}টি ডুপ্লিকেট এন্ট্রি
                            </span>
                          </div>

                          {canDelete && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleMergePhoneGroup(group)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-black flex items-center gap-1 cursor-pointer"
                              >
                                <GitMerge className="w-3.5 h-3.5" />
                                <span>{isBusy ? 'কাজ চলছে...' : 'মার্জ করে ১টি করুন'}</span>
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleDeleteRedundantInGroup(group)}
                                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-black flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>অতিরিক্তগুলো মুছুন</span>
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="p-3 space-y-2">
                          {group.members.map((m) => {
                            const isKeep = m.id === keepId;
                            return (
                              <div
                                key={m.id}
                                className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                                  isKeep
                                    ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                <label className="flex items-start gap-2.5 cursor-pointer min-w-0 flex-1">
                                  <input
                                    type="radio"
                                    name={`keep-${group.normalizedPhone}`}
                                    checked={isKeep}
                                    onChange={() =>
                                      setSelectedKeepByPhone((prev) => ({
                                        ...prev,
                                        [group.normalizedPhone]: m.id
                                      }))
                                    }
                                    className="mt-1 accent-emerald-600 w-4 h-4 shrink-0"
                                  />
                                  <div className="min-w-0 space-y-0.5">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-slate-900 text-amber-300">
                                        #{m.memberId || '—'}
                                      </span>
                                      <span className="text-sm font-black text-slate-900 dark:text-white truncate">
                                        {m.name}
                                      </span>
                                      {isKeep && (
                                        <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black">
                                          মূল রেকর্ড (রাখা হবে)
                                        </span>
                                      )}
                                      {m.id === group.recommendedKeepId && !isKeep && (
                                        <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 text-[10px] font-bold">
                                          প্রস্তাবিত
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-x-3 gap-y-0.5">
                                      <span>ঠিকানা: {m.address || '—'}</span>
                                      {m.packageName && <span>প্যাকেজ: {m.packageName}</span>}
                                      {m.monthlyFee ? <span>বিল: {formatCurrency(m.monthlyFee)}</span> : null}
                                      {m.oltInfo && <span className="font-mono">OLT: {m.oltInfo}</span>}
                                    </div>
                                  </div>
                                </label>

                                {canDelete && !isKeep && (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={async () => {
                                      setDupActionBusyKey(group.normalizedPhone);
                                      try {
                                        await onDeleteCustomer(m.id);
                                        setDupActionBanner(
                                          `ডুপ্লিকেট এন্ট্রি #${m.memberId} (${m.name}) মুছে ফেলা হয়েছে।`
                                        );
                                      } finally {
                                        setDupActionBusyKey(null);
                                      }
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-200 text-xs font-bold flex items-center gap-1 self-end sm:self-center shrink-0 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>মুছুন</span>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsDuplicateScanModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-cyan-500 text-white dark:text-slate-950 text-xs font-black cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rich Customer Info & Optical ONU Telemetry / Loss Troubleshooter Modal */}
      <CustomerOnuDetailModal
        customer={detailCustomer}
        onClose={() => setDetailCustomerId(null)}
        onUpdateCustomer={onUpdateCustomer}
        onCreateComplaint={onCreateComplaintFromCustomer}
        onOpenTroubleshootPortal={onOpenTroubleshootPortal}
      />
    </div>
  );
};
