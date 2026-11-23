import React, { useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  Sliders,
  AlertCircle
} from 'lucide-react';
import { CustomPortalLink } from '../types';
import { renderCustomPortalIcon } from './PortalControlModal';

interface CustomPortalViewProps {
  portal: CustomPortalLink;
  isDirectorOrAdmin?: boolean;
  onBackToHub: () => void;
  onOpenPortalControl?: () => void;
}

export const CustomPortalView: React.FC<CustomPortalViewProps> = ({
  portal,
  isDirectorOrAdmin = false,
  onBackToHub,
  onOpenPortalControl
}) => {
  const [reloadKey, setReloadKey] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(portal.url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  };

  return (
    <div className="space-y-3">
      {/* Top Action Strip */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToHub}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>হাব</span>
          </button>

          <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
            {renderCustomPortalIcon(portal.iconName, 'w-5 h-5')}
          </div>

          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
              {portal.title || portal.shortLabel}
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="font-mono truncate max-w-xs sm:max-w-md">{portal.url}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'কপি হয়েছে' : 'লিংক কপি'}</span>
          </button>

          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>রিফ্রেশ</span>
          </button>

          <a
            href={portal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>নতুন ট্যাবে খুলুন</span>
          </a>

          {isDirectorOrAdmin && onOpenPortalControl && (
            <button
              type="button"
              onClick={onOpenPortalControl}
              className="px-3 py-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 text-amber-900 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>পোর্টাল কন্ট্রোল</span>
            </button>
          )}
        </div>
      </div>

      {/* Embedded Frame */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <iframe
          key={`${portal.id}-${reloadKey}`}
          src={portal.url}
          title={portal.title || portal.shortLabel}
          className="w-full h-[72vh] min-h-[480px] border-0 bg-white"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
        />
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              কোনো ওয়েবসাইট নিরাপত্তার কারণে অ্যাপের ভেতরে লোড হতে না দিলে ডানপাশের <strong>নতুন ট্যাবে খুলুন</strong> বাটনে চাপুন।
            </span>
          </div>
          <a
            href={portal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline shrink-0"
          >
            সরাসরি ওয়েবসাইটে যান →
          </a>
        </div>
      </div>
    </div>
  );
};
