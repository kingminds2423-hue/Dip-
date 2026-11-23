import React, { useState } from 'react';
import { Gauge, Play, RefreshCw, Wifi, ArrowDown, ArrowUp, Activity, X } from 'lucide-react';
import { toBengaliNumber } from '../utils/formatters';

interface NetSpeedTestCardProps {
  onClose?: () => void;
}

interface SpeedTestResult {
  pingMs: number;
  jitterMs: number;
  downloadMbps: number;
  uploadMbps: number;
  testedAt: string;
}

export const NetSpeedTestCard: React.FC<NetSpeedTestCardProps> = ({ onClose }) => {
  const [phase, setPhase] = useState<'idle' | 'ping' | 'download' | 'upload' | 'done' | 'error'>('idle');
  const [progressPct, setProgressPct] = useState<number>(0);
  const [result, setResult] = useState<SpeedTestResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runSpeedTest = async () => {
    if (phase === 'ping' || phase === 'download' || phase === 'upload') return;
    setErrorMsg(null);
    setResult(null);
    setPhase('ping');
    setProgressPct(10);

    try {
      // 1. Ping & Jitter (4 live round-trip probes)
      const pings: number[] = [];
      for (let i = 0; i < 4; i++) {
        const t0 = performance.now();
        const r = await fetch(`/api/health?st=${Date.now()}_${i}`, { cache: 'no-store' });
        await r.text();
        pings.push(Math.max(1, performance.now() - t0));
        setProgressPct(15 + i * 5);
      }
      const avgPing = Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);
      let jitterSum = 0;
      for (let i = 1; i < pings.length; i++) {
        jitterSum += Math.abs(pings[i] - pings[i - 1]);
      }
      const jitterMs = Math.round(jitterSum / Math.max(1, pings.length - 1));

      // 2. Download Throughput Test (1 MB payload x 2 runs averaged)
      setPhase('download');
      setProgressPct(40);
      const dlSpeeds: number[] = [];
      for (const kb of [512, 1024]) {
        const t0 = performance.now();
        const res = await fetch(`/api/speedtest-download?kb=${kb}&r=${Date.now()}`, {
          cache: 'no-store'
        });
        const buf = await res.arrayBuffer();
        const elapsedSec = Math.max(0.015, (performance.now() - t0) / 1000);
        const mbps = (buf.byteLength * 8) / (elapsedSec * 1_000_000);
        dlSpeeds.push(mbps);
        setProgressPct(kb === 512 ? 58 : 74);
      }
      const downloadMbps = Math.round((dlSpeeds.reduce((a, b) => a + b, 0) / dlSpeeds.length) * 10) / 10;

      // 3. Upload Throughput Test (384 KB binary upload)
      setPhase('upload');
      setProgressPct(82);
      const uploadBytes = 384 * 1024;
      const uploadPayload = new Uint8Array(uploadBytes);
      for (let i = 0; i < uploadPayload.length; i += 64) {
        uploadPayload[i] = (i * 13) & 0xff;
      }
      const ut0 = performance.now();
      await fetch(`/api/speedtest-upload?r=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: uploadPayload
      });
      const uElapsedSec = Math.max(0.015, (performance.now() - ut0) / 1000);
      const uploadMbps = Math.round(((uploadBytes * 8) / (uElapsedSec * 1_000_000)) * 10) / 10;

      setProgressPct(100);
      setResult({
        pingMs: avgPing,
        jitterMs,
        downloadMbps,
        uploadMbps,
        testedAt: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
      setPhase('done');
    } catch (err: any) {
      setErrorMsg(err?.message || 'নেটওয়ার্ক স্পিড টেস্ট ব্যর্থ হয়েছে — ইন্টারনেট যাচাই করুন।');
      setPhase('error');
    }
  };

  const isRunning = phase === 'ping' || phase === 'download' || phase === 'upload';

  const qualityLabel = result
    ? result.downloadMbps >= 20 && result.pingMs <= 80
      ? { text: 'অসাধারণ হাই-স্পিড সংযোগ', tone: 'text-emerald-300 bg-emerald-500/20 border-emerald-400/50' }
      : result.downloadMbps >= 5 && result.pingMs <= 160
      ? { text: 'ভালো ও স্থিতিশীল সংযোগ', tone: 'text-cyan-200 bg-cyan-500/20 border-cyan-400/50' }
      : { text: 'ধীর / দুর্বল সিগন্যাল', tone: 'text-amber-200 bg-amber-500/20 border-amber-400/50' }
    : null;

  return (
    <div className="rounded-2xl bg-[#03142e] border-2 border-cyan-400/55 p-4 sm:p-5 text-white shadow-[0_0_26px_rgba(56,189,248,0.25)] space-y-4">
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-cyan-400/25">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-[#020c1b] flex items-center justify-center shrink-0">
            <Gauge className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-xl font-black text-white">
              নেটওয়ার্ক স্পিড টেস্ট (Net Speed Test)
            </h3>
            <p className="text-xs sm:text-sm font-semibold text-cyan-200">
              লাইভ পিং (Ping), ডাউনলোড ও আপলোড গতি পরিমাপ করুন
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/45 text-cyan-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Live Progress / Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono tabular-nums">
        <div className="rounded-xl bg-[#020c1b] border border-cyan-400/35 p-3">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-sans font-bold text-cyan-200">
            <Activity className="w-4 h-4 text-cyan-300" />
            <span>পিং (Ping)</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white mt-1">
            {result ? `${toBengaliNumber(result.pingMs)} ms` : isRunning && phase === 'ping' ? '...' : '—'}
          </div>
        </div>

        <div className="rounded-xl bg-[#020c1b] border border-cyan-400/35 p-3">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-sans font-bold text-cyan-200">
            <Wifi className="w-4 h-4 text-amber-300" />
            <span>জিটার (Jitter)</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-300 mt-1">
            {result ? `${toBengaliNumber(result.jitterMs)} ms` : '—'}
          </div>
        </div>

        <div className="rounded-xl bg-[#020c1b] border border-emerald-400/45 p-3">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-sans font-bold text-emerald-200">
            <ArrowDown className="w-4 h-4 text-emerald-300" />
            <span>ডাউনলোড</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-300 mt-1">
            {result ? `${toBengaliNumber(result.downloadMbps)} Mbps` : isRunning && phase === 'download' ? 'মাপা হচ্ছে...' : '—'}
          </div>
        </div>

        <div className="rounded-xl bg-[#020c1b] border border-sky-400/45 p-3">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-sans font-bold text-sky-200">
            <ArrowUp className="w-4 h-4 text-sky-300" />
            <span>আপলোড</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-sky-300 mt-1">
            {result ? `${toBengaliNumber(result.uploadMbps)} Mbps` : isRunning && phase === 'upload' ? 'মাপা হচ্ছে...' : '—'}
          </div>
        </div>
      </div>

      {isRunning && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-cyan-200">
            <span>
              {phase === 'ping'
                ? 'পিং ও লেটেন্সি যাচাই চলছে...'
                : phase === 'download'
                ? 'ডাউনলোড স্পিড পরীক্ষা চলছে...'
                : 'আপলোড স্পিড পরীক্ষা চলছে...'}
            </span>
            <span className="font-mono">{toBengaliNumber(progressPct)}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-900 overflow-hidden border border-cyan-400/35">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-sky-400 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/50 text-rose-100 text-xs sm:text-sm font-bold">
          {errorMsg}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {qualityLabel && (
            <span className={`px-3 py-1 rounded-xl text-xs sm:text-sm font-black border ${qualityLabel.tone}`}>
              {qualityLabel.text}
            </span>
          )}
          {result && (
            <span className="text-xs font-mono text-cyan-200/80">
              সময়: {result.testedAt}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => void runSpeedTest()}
          disabled={isRunning}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-[#020c1b] font-black text-sm sm:text-base flex items-center gap-2 shadow-md cursor-pointer active:scale-95 disabled:opacity-60"
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>টেস্ট চলছে...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>{result ? 'পুনরায় স্পিড টেস্ট' : 'স্পিড টেস্ট শুরু করুন'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
