import QRCode from 'qrcode';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Company,
  OfficersState,
  SharedReportPeriodType,
  SharedReportSnapshot,
  Transaction
} from '../types';
import { getPublicAppBaseUrl } from '../utils/appUrls';
import { stripUndefined } from './offlineSync';

const SHARED_REPORTS_CACHE_KEY = 'dip_bhola_shared_reports_cache_v1';

function generateHighEntropyReportId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let rand = '';
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const arr = new Uint8Array(22);
    window.crypto.getRandomValues(arr);
    for (let i = 0; i < arr.length; i += 1) {
      rand += chars[arr[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 22; i += 1) {
      rand += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return `rpt-${Date.now().toString(36)}-${rand}`;
}

function encodeBase64Url(jsonStr: string): string {
  try {
    const bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return '';
  }
}

function decodeBase64Url(encoded: string): string | null {
  try {
    const norm = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const pad = norm.length % 4 === 0 ? '' : '='.repeat(4 - (norm.length % 4));
    const binary = atob(norm + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function cacheSnapshotLocally(snapshot: SharedReportSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(SHARED_REPORTS_CACHE_KEY);
    const map: Record<string, SharedReportSnapshot> = raw ? JSON.parse(raw) : {};
    const keys = Object.keys(map);
    if (keys.length > 25) {
      keys.slice(0, keys.length - 25).forEach((k) => delete map[k]);
    }
    map[snapshot.id] = snapshot;
    window.localStorage.setItem(SHARED_REPORTS_CACHE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota limits
  }
}

function readCachedSnapshotLocally(reportId: string): SharedReportSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SHARED_REPORTS_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, SharedReportSnapshot>;
    return map[reportId] || null;
  } catch {
    return null;
  }
}

export async function generateQrDataUrl(
  text: string,
  options?: { width?: number; darkColor?: string; lightColor?: string }
): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: options?.width || 300,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: options?.darkColor || '#020c1b',
        light: options?.lightColor || '#ffffff'
      }
    });
  } catch {
    return '';
  }
}

export interface CreateSharedReportParams {
  company: Company | null;
  officers?: OfficersState | null;
  periodType: SharedReportPeriodType;
  periodLabel: string;
  verificationCode: string;
  auditScore?: number;
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
  transactions: Transaction[];
}

export interface CreatedSharedReportResult {
  reportId: string;
  shareUrl: string;
  qrDataUrl: string;
  snapshot: SharedReportSnapshot;
}

export async function createSharedReportAndQrUrl(
  params: CreateSharedReportParams
): Promise<CreatedSharedReportResult> {
  const reportId = generateHighEntropyReportId();
  const sanitizedTx = params.transactions.slice(0, 450).map((t) => ({
    id: t.id,
    date: t.date,
    type: t.type,
    title: (t.title || '').slice(0, 220),
    category: (t.category || '').slice(0, 100),
    amount: Number(t.amount) || 0,
    paymentMethod: t.paymentMethod || 'cash',
    addedBy: (t.addedBy || '').slice(0, 80),
    note: t.note ? t.note.slice(0, 250) : undefined
  }));

  const snapshot: SharedReportSnapshot = stripUndefined({
    id: reportId,
    companyName: params.company?.name || 'DIP BHOLA NETWORK',
    companySubTitle: params.company?.subTitle || 'দৈনিক আয়-ব্যয় ও কেন্দ্রীয় স্টাফ মনিটরিং সিস্টেম',
    companyAddress: params.company?.address || '৩নং পশ্চিম ইলিশা, ভোলা সদর, ভোলা',
    companyPhone: params.company?.phone || '01721200049',
    companyEmail: params.company?.email || 'zahidulislam53330@gmail.com',
    companyLogoUrl:
      params.company?.logoUrl && !params.company.logoUrl.startsWith('data:')
        ? params.company.logoUrl
        : '/assets/aistudio/FB_IMG_1793200670972_1fb968d5.jpg',
    periodType: params.periodType,
    periodLabel: params.periodLabel.slice(0, 150),
    verificationCode: params.verificationCode.slice(0, 60),
    auditScore: params.auditScore,
    generatedAt: new Date().toISOString(),
    generatedBy: params.generatedBy?.slice(0, 100),
    summary: {
      totalIncome: Number(params.summary.totalIncome) || 0,
      totalExpense: Number(params.summary.totalExpense) || 0,
      netBalance: Number(params.summary.netBalance) || 0,
      txCount: Number(params.summary.txCount) || sanitizedTx.length,
      pendingDue: Number(params.summary.pendingDue) || 0
    },
    categorySummary: (params.categorySummary || []).slice(0, 40),
    multiMonthSummary: (params.multiMonthSummary || []).slice(0, 24),
    transactions: sanitizedTx,
    signatories: {
      directorName: params.company?.ownerName || 'জাহিদুল ইসলাম',
      managerName: params.officers?.manager?.name || 'মোঃ সাইফুল ইসলাম',
      auditorName: params.officers?.auditor?.name || 'মোঃ কাওসার আহমেদ'
    }
  });

  cacheSnapshotLocally(snapshot);

  // Persist public capability-token snapshot to Firestore non-blocking
  setDoc(doc(db, 'sharedReports', reportId), snapshot).catch(() => {
    // fallback payload embedded in URL ensures QR remains readable offline
  });

  // Compact offline/instant fallback payload embedded inside QR URL (`?stmt_id=...&p=...`)
  const compactPayload = {
    c: snapshot.companyName,
    a: snapshot.companyAddress,
    ph: snapshot.companyPhone,
    pt: snapshot.periodType,
    pl: snapshot.periodLabel,
    vc: snapshot.verificationCode,
    ga: snapshot.generatedAt,
    s: snapshot.summary,
    tx: sanitizedTx.slice(0, 12).map((t) => [t.date, t.type === 'income' ? 1 : 0, t.title.slice(0, 40), t.amount])
  };
  const encodedFallback = encodeBase64Url(JSON.stringify(compactPayload));
  const base = getPublicAppBaseUrl();
  const shareUrl =
    encodedFallback && encodedFallback.length <= 1300
      ? `${base}/?stmt_id=${encodeURIComponent(reportId)}&p=${encodeURIComponent(encodedFallback)}`
      : `${base}/?stmt_id=${encodeURIComponent(reportId)}`;

  const qrDataUrl = await generateQrDataUrl(shareUrl, {
    width: 300,
    darkColor: '#000000',
    lightColor: '#ffffff'
  });

  return {
    reportId,
    shareUrl,
    qrDataUrl,
    snapshot
  };
}

export async function fetchSharedReportByIdOrFallback(
  reportId: string,
  fallbackParam?: string | null
): Promise<SharedReportSnapshot | null> {
  // 1. Try local cache first if offline or instant match
  const local = readCachedSnapshotLocally(reportId);

  // 2. Fetch full cloud snapshot from Firestore public capability-token path
  try {
    const snap = await getDoc(doc(db, 'sharedReports', reportId));
    if (snap.exists()) {
      const data = snap.data() as SharedReportSnapshot;
      cacheSnapshotLocally(data);
      return data;
    }
  } catch {
    // Ignore transient network errors and fall back to URL payload or cache
  }

  if (local) return local;

  // 3. Decode compact fallback payload embedded in QR URL
  if (fallbackParam) {
    const decoded = decodeBase64Url(fallbackParam);
    if (decoded) {
      try {
        const parsed = JSON.parse(decoded) as {
          c?: string;
          a?: string;
          ph?: string;
          pt?: SharedReportPeriodType;
          pl?: string;
          vc?: string;
          ga?: string;
          s?: SharedReportSnapshot['summary'];
          tx?: Array<[string, number, string, number]>;
        };
        return {
          id: reportId,
          companyName: parsed.c || 'DIP BHOLA NETWORK',
          companyAddress: parsed.a || '৩নং পশ্চিম ইলিশা, ভোলা সদর, ভোলা',
          companyPhone: parsed.ph || '01721200049',
          periodType: parsed.pt || 'monthly',
          periodLabel: parsed.pl || 'আর্থিক হিসাব বিবরণী',
          verificationCode: parsed.vc || reportId.slice(-8).toUpperCase(),
          generatedAt: parsed.ga || new Date().toISOString(),
          summary: parsed.s || {
            totalIncome: 0,
            totalExpense: 0,
            netBalance: 0,
            txCount: 0,
            pendingDue: 0
          },
          transactions: (parsed.tx || []).map((row, idx) => ({
            id: `fb-${idx}`,
            date: row[0],
            type: row[1] === 1 ? 'income' : 'expense',
            title: row[2],
            category: row[1] === 1 ? 'বিল কালেকশন' : 'সাধারণ খরচ',
            amount: Number(row[3]) || 0,
            paymentMethod: 'cash'
          })),
          signatories: {
            directorName: 'জাহিদুল ইসলাম',
            managerName: 'মোঃ সাইফুল ইসলাম',
            auditorName: 'মোঃ কাওসার আহমেদ'
          }
        };
      } catch {
        return null;
      }
    }
  }

  return null;
}
