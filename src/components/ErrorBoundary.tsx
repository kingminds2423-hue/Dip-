import React from 'react';
import { RefreshCw, AlertTriangle, Trash2 } from 'lucide-react';
import { clearAllLocalCache } from '../services/localCache';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'অ্যাপটি লোড হতে অপ্রত্যাশিত ত্রুটি হয়েছে।'
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetCacheAndReload = async () => {
    try {
      clearAllLocalCache();
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      // ignore cleanup failures
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-rose-500/40 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-rose-400" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-black text-white">
                অ্যাপ ওপেন করতে সমস্যা হয়েছে
              </h1>
              <p className="text-xs text-slate-300 leading-relaxed">
                ক্যাশ অথবা নেটওয়ার্কের কারণে স্ক্রিনটি লোড হতে পারেনি। নিচের বাটনে চাপ দিয়ে রিলোড করুন।
              </p>
              {this.state.errorMessage && (
                <p className="text-[11px] font-mono text-rose-300 bg-rose-950/60 border border-rose-800/60 rounded-xl p-2 mt-2 break-words">
                  {this.state.errorMessage}
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                <span>পুনরায় লোড করুন</span>
              </button>
              <button
                type="button"
                onClick={this.handleResetCacheAndReload}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>ক্যাশ ক্লিয়ার রিলোড</span>
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
