import React, { useState } from 'react';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import type { OfflineSyncState } from '../services/offlineSync';
import { toBengaliNumber } from '../utils/formatters';

interface CloudSyncStatusIndicatorProps {
  offlineSyncState?: OfflineSyncState;
  onManualSync?: () => Promise<void> | void;
}

function formatExactSyncTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'সিঙ্কের অপেক্ষায়';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'সিঙ্কের অপেক্ষায়';

  try {
    const formatted = new Intl.DateTimeFormat('bn-BD', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date);
    return formatted;
  } catch {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
}

export const CloudSyncStatusIndicator: React.FC<CloudSyncStatusIndicatorProps> = ({
  offlineSyncState,
  onManualSync
}) => {
  const [isChecking, setIsChecking] = useState(false);

  const isOnline = offlineSyncState?.isOnline ?? (typeof navigator !== 'undefined' ? navigator.onLine : true);
  const isSyncing = Boolean(offlineSyncState?.isSyncing) || isChecking;
  const pendingCount = offlineSyncState?.pendingCount ?? 0;
  const lastSyncedAt = offlineSyncState?.lastSyncedAt ?? null;

  const exactLabel = formatExactSyncTimestamp(lastSyncedAt);
  const fullTooltip = lastSyncedAt
    ? `সর্বশেষ সফল ক্লাউড সিঙ্ক: ${new Date(lastSyncedAt).toLocaleString('bn-BD')}`
    : 'এখনো সফল Firestore ক্লাউড সিঙ্ক সম্পন্ন হয়নি';

  const handleTrigger = async () => {
    if (!onManualSync || isChecking) return;
    setIsChecking(true);
    try {
      await onManualSync();
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div
      title={fullTooltip}
      aria-label={fullTooltip}
      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-[10px] transition-colors ${
        !isOnline
          ? 'bg-amber-950/60 border-amber-500/40 text-amber-200'
          : pendingCount > 0
          ? 'bg-amber-950/40 border-emerald-700/60 text-emerald-100'
          : 'bg-emerald-950/75 border-emerald-800/70 text-emerald-100'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="relative flex h-2 w-2 shrink-0">
          {isOnline && lastSyncedAt && !isSyncing && pendingCount === 0 && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              !isOnline
                ? 'bg-amber-400'
                : isSyncing
                ? 'bg-cyan-400 animate-pulse'
                : lastSyncedAt
                ? pendingCount > 0
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
                : 'bg-slate-400'
            }`}
          />
        </span>

        {isOnline ? (
          <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        ) : (
          <CloudOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        )}

        <div className="min-w-0">
          <div className="font-bold text-emerald-200 leading-tight truncate flex items-center gap-1">
            <span>{isOnline ? 'ক্লাউড সিঙ্ক' : 'অফলাইন ক্যাশ'}</span>
            {pendingCount > 0 && (
              <span className="text-[9px] font-black text-amber-300">
                ({toBengaliNumber(pendingCount)} বাকি)
              </span>
            )}
          </div>
          <div className="font-mono tabular-nums text-[10px] text-emerald-300/95 leading-tight truncate">
            {isSyncing ? 'সিঙ্ক হচ্ছে...' : exactLabel}
          </div>
        </div>
      </div>

      {onManualSync && (
        <button
          type="button"
          onClick={() => void handleTrigger()}
          disabled={isSyncing}
          title="ক্লাউড সিঙ্ক রিফ্রেশ করুন"
          aria-label="ক্লাউড সিঙ্ক রিফ্রেশ করুন"
          className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-200 hover:text-white transition-colors shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
        </button>
      )}
    </div>
  );
};
