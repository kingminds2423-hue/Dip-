import React, { useMemo, useState } from 'react';
import {
  Shield,
  X,
  Search,
  Clock,
  User,
  Activity,
  Trash2,
  Edit,
  PlusCircle,
  UserCheck,
  Calendar,
  RotateCcw
} from 'lucide-react';
import { AuditLog, UserSession } from '../types';
import { formatBengaliDate, toBengaliNumber } from '../utils/formatters';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditLogs: AuditLog[];
  currentUser: UserSession;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({
  isOpen,
  onClose,
  auditLogs,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const actorOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role: string }>();
    auditLogs.forEach((log) => {
      const idKey = (log.performedById || log.performedBy || '').trim();
      if (!idKey) return;
      if (!map.has(idKey)) {
        map.set(idKey, {
          id: idKey,
          name: log.performedBy || idKey,
          role: log.role || ''
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const fromBound = dateFrom && dateTo && dateFrom > dateTo ? dateTo : dateFrom;
    const toBound = dateFrom && dateTo && dateFrom > dateTo ? dateFrom : dateTo;

    return auditLogs.filter((log) => {
      const matchSearch =
        !q ||
        (log.details || '').toLowerCase().includes(q) ||
        (log.performedBy || '').toLowerCase().includes(q) ||
        (log.performedById || '').toLowerCase().includes(q) ||
        (log.actionBengali || '').toLowerCase().includes(q) ||
        (log.action || '').toLowerCase().includes(q);

      const act = (log.action || '').toLowerCase();
      const matchAction =
        actionFilter === 'all' ||
        (actionFilter === 'delete' && act.includes('delete')) ||
        (actionFilter === 'edit' && (act.includes('edit') || act.includes('update'))) ||
        (actionFilter === 'add' && act.includes('add')) ||
        (actionFilter === 'transaction' && act.includes('transaction')) ||
        (actionFilter === 'complaint' && act.includes('complaint')) ||
        (actionFilter === 'staff' && (act.includes('staff') || act.includes('join'))) ||
        (actionFilter === 'security' &&
          (act.includes('security') || act.includes('officer') || act.includes('pin')));

      const actorKey = (log.performedById || log.performedBy || '').trim();
      const matchActor =
        actorFilter === 'all' ||
        actorKey === actorFilter ||
        (log.performedBy || '').trim() === actorFilter;

      const logDateKey = (log.timestamp || '').slice(0, 10);
      const matchDateFrom = !fromBound || (logDateKey && logDateKey >= fromBound);
      const matchDateTo = !toBound || (logDateKey && logDateKey <= toBound);

      return matchSearch && matchAction && matchActor && matchDateFrom && matchDateTo;
    });
  }, [auditLogs, searchTerm, actionFilter, actorFilter, dateFrom, dateTo]);

  if (!isOpen) return null;

  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    actionFilter !== 'all' ||
    actorFilter !== 'all' ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const resetFilters = () => {
    setSearchTerm('');
    setActionFilter('all');
    setActorFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const getActionBadge = (action: string) => {
    if (action.includes('delete')) {
      return {
        bg: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800',
        icon: Trash2
      };
    }
    if (action.includes('edit') || action.includes('update')) {
      return {
        bg: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800',
        icon: Edit
      };
    }
    if (action.includes('add')) {
      return {
        bg: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800',
        icon: PlusCircle
      };
    }
    if (action.includes('officer')) {
      return {
        bg: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800',
        icon: UserCheck
      };
    }
    return {
      bg: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
      icon: Activity
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#03291d] to-[#064e3b] px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-800/80 border border-emerald-600 flex items-center justify-center text-emerald-200">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <span>নিরাপত্তা ও অডিট লগ (Audit Log)</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-black">
                  লাইভ সিকিউরিটি
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-emerald-200">
                মুছে ফেলা লেনদেন, আপডেট, স্টাফ/পার্টনার আইডি ও তারিখ সীমা অনুযায়ী অডিট ইতিহাস
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

        {/* Enhanced Search, Date-Range, Actor & Action Type Filter Bar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
            {/* Search input */}
            <div className="relative md:col-span-5">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="বিবরণ, আইডি, কর্মী বা অ্যাকশন খুঁজুন..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Staff / Partner / Actor ID dropdown */}
            <div className="md:col-span-3">
              <select
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                aria-label="স্টাফ বা পার্টনার নির্বাচন"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100"
              >
                <option value="all">সকল স্টাফ / পার্টনার</option>
                {actorOptions.map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.name} ({actor.role || 'member'} · {actor.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Date-range pickers */}
            <div className="md:col-span-4 flex items-center gap-1.5">
              <label className="flex-1 flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2 py-1.5 text-xs">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  aria-label="শুরুর তারিখ"
                  className="w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </label>
              <span className="text-slate-400 font-bold">—</span>
              <label className="flex-1 flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2 py-1.5 text-xs">
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  aria-label="শেষ তারিখ"
                  className="w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(
                [
                  { id: 'all', label: `সকল (${toBengaliNumber(auditLogs.length)})` },
                  { id: 'delete', label: `মুছে ফেলা (${toBengaliNumber(auditLogs.filter((l) => l.action.includes('delete')).length)})` },
                  { id: 'transaction', label: 'লেনদেন হিসাব' },
                  { id: 'complaint', label: 'অভিযোগ' },
                  { id: 'staff', label: 'স্টাফ / জয়েন' },
                  { id: 'security', label: 'সিকিউরিটি / পিন' }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActionFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
                    actionFilter === tab.id
                      ? tab.id === 'delete'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ফিল্টার রিসেট</span>
              </button>
            )}
          </div>
        </div>

        {/* List of Audit Logs */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Shield className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">কোনো অডিট রেকর্ড পাওয়া যায়নি।</p>
              <p className="text-xs mt-1 text-slate-500">
                ফিল্টার পরিবর্তন করে দেখুন অথবা গুরুত্বপূর্ণ অ্যাকশন (যেমন লেনদেন ডিলিট বা এডিট) এখানে সংরক্ষিত হয়।
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const badge = getActionBadge(log.action);
              const Icon = badge.icon;
              const dateObj = new Date(log.timestamp);
              const timeStr = dateObj.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
              const dateStr = formatBengaliDate(log.timestamp.split('T')[0]);

              return (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-xs hover:border-emerald-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${badge.bg}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${badge.bg}`}>
                          {log.actionBengali}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          {log.details}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                          <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>সম্পাদনকারী: {log.performedBy}</span>
                          {log.performedById && (
                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              ({log.performedById})
                            </span>
                          )}
                          <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase">
                            {log.role}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 text-xs text-slate-500 dark:text-slate-400 flex sm:flex-col items-center sm:items-end gap-1.5 sm:gap-0.5 self-end sm:self-center font-mono">
                    <span className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {timeStr}
                    </span>
                    <span className="text-xs text-slate-400 font-sans">{dateStr}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          <span>মোট রেকর্ড: {toBengaliNumber(filteredLogs.length)} টি</span>
          <span>শুধুমাত্র পরিচালক ও ম্যানেজারের দৃশ্যমান</span>
        </div>
      </div>
    </div>
  );
};
