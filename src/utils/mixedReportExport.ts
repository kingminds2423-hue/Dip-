import {
  BillingPortalDashReport,
  Company,
  OltLiveReport
} from '../types';
import { ParsedOnuTelemetry } from './oltDiagnostics';
import { formatCurrency, getTodayString, toBengaliNumber } from './formatters';

export type MixedSourceKind = 'both' | 'olt' | 'billing' | 'local';

export interface UnifiedMixExportStats {
  totalMembers: number;
  activeMembers: number;
  onlineMembers: number;
  offlineMembers: number;
  disabledOrExpiredCount: number;
  dueMemberCount: number;
  onuLinkedCount: number;
  onuUpLinkedCount: number;
  onlineMemberPct: number;
  totalOnus: number;
  onlineOnus: number;
  activeOnus: number;
  offlineOnus: number;
  alarmOnus: number;
  xponTotal: number;
  eponTotal: number;
  onlineOnuPct: number;
  activeOnuPct: number;
  alarmOnuPct: number;
  ponDetailed: Array<{
    ponId: 'PON1' | 'PON2' | 'PON3' | 'PON4';
    total: number;
    online: number;
    offline: number;
    alarmCount: number;
    xponCount: number;
    eponCount: number;
    avgRxDbm?: number | null;
  }>;
}

export interface MixedSummaryExportPayload {
  company: Company | null;
  exportedBy: string;
  stats: UnifiedMixExportStats;
  telemetryRows: ParsedOnuTelemetry[];
  mixSourceById: Map<string, MixedSourceKind>;
  liveDashReport: BillingPortalDashReport | null;
  liveOltReport: OltLiveReport | null;
  activeFilterLabel?: string;
}

function sourceLabelBengali(src: MixedSourceKind): string {
  if (src === 'both') return 'OLT + বিলিং';
  if (src === 'olt') return 'শুধু OLT';
  if (src === 'billing') return 'শুধু বিলিং';
  return 'লোকাল ডেটাবেজ';
}

function formatDateTimeNow(): string {
  try {
    return new Date().toLocaleString('bn-BD', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return new Date().toISOString().slice(0, 16).replace('T', ' ');
  }
}

function makeFileStamp(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${getTodayString()}_${hh}${mm}`;
}

export async function exportMixedSummaryToExcel(
  payload: MixedSummaryExportPayload
): Promise<void> {
  const XLSX = await import('xlsx');
  const {
    company,
    exportedBy,
    stats,
    telemetryRows,
    mixSourceById,
    liveDashReport,
    liveOltReport,
    activeFilterLabel
  } = payload;

  const summaryRows: Array<Record<string, string | number>> = [
    {
      'বিভাগ / তথ্য (Section)': 'প্রতিষ্ঠান (Company)',
      'বিবরণ (Metric)': company?.name || 'DIP BHOLA NETWORK',
      'মান (Value)': activeFilterLabel || 'সম্পূর্ণ রিপোর্ট',
      'অতিরিক্ত নোট (Note)': `প্রস্তুতকারক: ${exportedBy} · সময়: ${formatDateTimeNow()}`
    },
    {
      'বিভাগ / তথ্য (Section)': 'পোর্টাল সংযোগ (Sources)',
      'বিবরণ (Metric)': 'admin.bhola.net (বিলিং)',
      'মান (Value)': liveDashReport ? `সংযুক্ত (${liveDashReport.username})` : 'সংযুক্ত নয়',
      'অতিরিক্ত নোট (Note)': liveDashReport?.syncedAt ? `সিঙ্ক: ${liveDashReport.syncedAt}` : ''
    },
    {
      'বিভাগ / তথ্য (Section)': 'পোর্টাল সংযোগ (Sources)',
      'বিবরণ (Metric)': 'OLT 103.158.206.4:6560',
      'মান (Value)': liveOltReport ? `সংযুক্ত (${liveOltReport.username})` : 'সংযুক্ত নয়',
      'অতিরিক্ত নোট (Note)': liveOltReport?.syncedAt ? `সিঙ্ক: ${liveOltReport.syncedAt}` : ''
    },
    {
      'বিভাগ / তথ্য (Section)': 'সদস্য ও বিলিং',
      'বিবরণ (Metric)': 'Online সদস্য',
      'মান (Value)': stats.onlineMembers,
      'অতিরিক্ত নোট (Note)': `${stats.onlineMemberPct}% · ONU Up ${stats.onuUpLinkedCount}`
    },
    {
      'বিভাগ / তথ্য (Section)': 'সদস্য ও বিলিং',
      'বিবরণ (Metric)': 'Active সদস্য',
      'মান (Value)': stats.activeMembers,
      'অতিরিক্ত নোট (Note)': `বকেয়া (Due) ${stats.dueMemberCount}`
    },
    {
      'বিভাগ / তথ্য (Section)': 'সদস্য ও বিলিং',
      'বিবরণ (Metric)': 'Offline সদস্য',
      'মান (Value)': stats.offlineMembers,
      'অতিরিক্ত নোট (Note)': `Disabled / Expired ${stats.disabledOrExpiredCount}`
    },
    {
      'বিভাগ / তথ্য (Section)': 'সদস্য ও বিলিং',
      'বিবরণ (Metric)': 'মোট সদস্য',
      'মান (Value)': stats.totalMembers,
      'অতিরিক্ত নোট (Note)': `ONU লিংকড: ${stats.onuLinkedCount}`
    },
    {
      'বিভাগ / তথ্য (Section)': 'OLT INFORMATION',
      'বিবরণ (Metric)': 'Online অনু',
      'মান (Value)': stats.onlineOnus,
      'অতিরিক্ত নোট (Note)': `${stats.onlineOnuPct}% Online`
    },
    {
      'বিভাগ / তথ্য (Section)': 'OLT INFORMATION',
      'বিবরণ (Metric)': 'Active অনু',
      'মান (Value)': stats.activeOnus,
      'অতিরিক্ত নোট (Note)': `${stats.activeOnuPct}% Active`
    },
    {
      'বিভাগ / তথ্য (Section)': 'OLT INFORMATION',
      'বিবরণ (Metric)': 'Off-line অনু',
      'মান (Value)': stats.offlineOnus,
      'অতিরিক্ত নোট (Note)': `Alarm ${stats.alarmOnus} (${stats.alarmOnuPct}%)`
    },
    {
      'বিভাগ / তথ্য (Section)': 'OLT INFORMATION',
      'বিবরণ (Metric)': 'মোট নিবন্ধিত অনু (OLT)',
      'মান (Value)': stats.totalOnus,
      'অতিরিক্ত নোট (Note)': `XPON: ${stats.xponTotal} · EPON: ${stats.eponTotal}`
    }
  ];

  if (liveDashReport?.todayCollection !== null && liveDashReport?.todayCollection !== undefined) {
    summaryRows.push({
      'বিভাগ / তথ্য (Section)': 'বিলিং আদায় (Live)',
      'বিবরণ (Metric)': 'আজকের আদায়',
      'মান (Value)': liveDashReport.todayCollection,
      'অতিরিক্ত নোট (Note)':
        liveDashReport.monthlyCollection !== null && liveDashReport.monthlyCollection !== undefined
          ? `মাসিক আদায়: ${liveDashReport.monthlyCollection}`
          : ''
    });
  }

  stats.ponDetailed.forEach((p) => {
    summaryRows.push({
      'বিভাগ / তথ্য (Section)': `PON পোর্ট (${p.ponId})`,
      'বিবরণ (Metric)': `Active ${p.online}/${p.total}`,
      'মান (Value)': p.online,
      'অতিরিক্ত নোট (Note)': `Off: ${p.offline} · Alarm: ${p.alarmCount} · XPON: ${p.xponCount} · EPON: ${p.eponCount}`
    });
  });

  const detailRows = telemetryRows.map((row, idx) => {
    const c = row.customer;
    const src = mixSourceById.get(c.id) || 'local';
    return {
      'ক্রমিক (SL)': idx + 1,
      'ডেটা উৎস (Source)': sourceLabelBengali(src),
      'গ্রাহক আইডি (ID)': c.memberId,
      'গ্রাহকের নাম (Name)': c.name,
      'মোবাইল (Phone)': c.phone || '—',
      'ঠিকানা (Address)': c.address || '—',
      'প্যাকেজ (Package)': c.packageName || '—',
      'মাসিক বিল (BDT)': c.monthlyFee ?? 0,
      'বকেয়া (Due BDT)': c.dueAmount ?? 0,
      'মেয়াদ (Expiry)': c.expiryDate || '—',
      'বিলিং অবস্থা': c.statusLabel || (c.status === 'active' ? 'Active' : 'Inactive/Expired'),
      'PON পোর্ট': row.ponLabel,
      'টেকনোলজি': row.techType,
      'OLT ও পোর্ট বিস্তারিত': c.oltInfo || '—',
      'ONU MAC / SN': row.onuMac,
      'Rx Power (dBm)': row.rxDisplay,
      'Tx Power (dBm)': row.txDisplay,
      'ফাইবার দৈর্ঘ্য': row.lengthDisplay,
      'ONU লাইভ অবস্থা': row.isOffline ? 'Offline' : 'Online',
      'সমস্যা / ডায়াগনোসিস': row.problemSummary
    };
  });

  const problemRows = telemetryRows
    .filter((row) => row.hasProblem || row.isOffline || (row.customer.dueAmount || 0) > 0)
    .map((row, idx) => {
      const c = row.customer;
      const src = mixSourceById.get(c.id) || 'local';
      return {
        'ক্রমিক (SL)': idx + 1,
        'ডেটা উৎস': sourceLabelBengali(src),
        'গ্রাহক আইডি': c.memberId,
        'গ্রাহকের নাম': c.name,
        'মোবাইল': c.phone || '—',
        'PON': row.ponLabel,
        'MAC': row.onuMac,
        'Rx Power': row.rxDisplay,
        'বকেয়া (BDT)': c.dueAmount ?? 0,
        'অবস্থা': row.isOffline ? 'Offline' : 'Online',
        'সমস্যার কারণ': row.problemSummary
      };
    });

  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  const wsDetails = XLSX.utils.json_to_sheet(
    detailRows.length > 0 ? detailRows : [{ 'তথ্য': 'কোনো OLT বা বিলিং লাইন পাওয়া যায়নি' }]
  );
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary & PON');
  XLSX.utils.book_append_sheet(wb, wsDetails, 'Mixed OLT+Billing');

  if (problemRows.length > 0) {
    const wsProblem = XLSX.utils.json_to_sheet(problemRows);
    XLSX.utils.book_append_sheet(wb, wsProblem, 'Fault & Due Lines');
  }

  XLSX.writeFile(wb, `DIP_BHOLA_OLT_Billing_Summary_${makeFileStamp()}.xlsx`);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  styleText = '',
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (styleText) node.style.cssText = styleText;
  if (text !== undefined) node.textContent = text;
  return node;
}

export async function exportMixedSummaryToPdf(
  payload: MixedSummaryExportPayload
): Promise<void> {
  const {
    company,
    exportedBy,
    stats,
    telemetryRows,
    mixSourceById,
    liveDashReport,
    liveOltReport,
    activeFilterLabel
  } = payload;

  const MAX_PDF_ROWS = 140;
  const prioritizedRows = [...telemetryRows].sort((a, b) => {
    if (a.hasProblem !== b.hasProblem) return a.hasProblem ? -1 : 1;
    if (a.isOffline !== b.isOffline) return a.isOffline ? -1 : 1;
    const ra = mixSourceById.get(a.customer.id) === 'both' ? 0 : 1;
    const rb = mixSourceById.get(b.customer.id) === 'both' ? 0 : 1;
    return ra - rb;
  });
  const pdfRows = prioritizedRows.slice(0, MAX_PDF_ROWS);

  const stageHost = document.createElement('div');
  stageHost.style.cssText =
    'position:fixed;left:-12000px;top:0;z-index:-1;pointer-events:none;background:#ffffff;';

  const pageWidthPx = 920;
  const root = el(
    'div',
    `width:${pageWidthPx}px;background:#ffffff;color:#0f172a;font-family:"Hind Siliguri","Noto Sans Bengali",system-ui,-apple-system,sans-serif;padding:24px 28px;box-sizing:border-box;line-height:1.4;`
  );

  // Header
  const header = el(
    'div',
    'display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0e7490;padding-bottom:12px;margin-bottom:14px;gap:12px;'
  );
  const headerLeft = el('div', 'flex:1;');
  headerLeft.appendChild(
    el('div', 'font-size:20px;font-weight:800;color:#0f172a;', company?.name || 'DIP BHOLA NETWORK')
  );
  headerLeft.appendChild(
    el(
      'div',
      'font-size:13px;font-weight:700;color:#0e7490;margin-top:2px;',
      'সমস্যা সমাধান পোর্টাল — OLT ও বিলিং মিক্সড সামারি রিপোর্ট'
    )
  );
  if (company?.address || company?.phone) {
    headerLeft.appendChild(
      el(
        'div',
        'font-size:10px;color:#475569;margin-top:2px;',
        [company.address, company.phone].filter(Boolean).join(' · ')
      )
    );
  }

  const headerRight = el('div', 'text-align:right;font-size:10px;color:#334155;');
  headerRight.appendChild(el('div', 'font-weight:700;', `তারিখ: ${formatDateTimeNow()}`));
  headerRight.appendChild(el('div', '', `প্রস্তুতকারক: ${exportedBy}`));
  headerRight.appendChild(
    el(
      'div',
      'margin-top:2px;color:#0369a1;font-weight:700;',
      `Billing: ${liveDashReport ? 'Live' : 'Local'} | OLT: ${liveOltReport ? 'Live' : 'Stored'}`
    )
  );
  if (activeFilterLabel) {
    headerRight.appendChild(el('div', 'color:#b45309;font-weight:700;', `ফিল্টার: ${activeFilterLabel}`));
  }

  header.appendChild(headerLeft);
  header.appendChild(headerRight);
  root.appendChild(header);

  // Section 1: Member & Billing + OLT Combined KPIs (2 rows of 4 boxes)
  root.appendChild(
    el(
      'div',
      'font-size:12px;font-weight:800;color:#0f172a;margin-bottom:8px;',
      '১. সদস্য ও বিলিং + OLT INFORMATION সামারি'
    )
  );

  const kpiGrid = el(
    'div',
    'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:14px;'
  );

  const kpis: Array<{ label: string; value: string; sub: string; bg: string; border: string; accent: string }> = [
    {
      label: 'Online সদস্য',
      value: toBengaliNumber(stats.onlineMembers),
      sub: `${toBengaliNumber(stats.onlineMemberPct)}% · ONU Up ${toBengaliNumber(stats.onuUpLinkedCount)}`,
      bg: '#ecfdf5',
      border: '#6ee7b7',
      accent: '#047857'
    },
    {
      label: 'Active সদস্য',
      value: toBengaliNumber(stats.activeMembers),
      sub: `বকেয়া (Due) ${toBengaliNumber(stats.dueMemberCount)}`,
      bg: '#eff6ff',
      border: '#93c5fd',
      accent: '#0369a1'
    },
    {
      label: 'Offline সদস্য',
      value: toBengaliNumber(stats.offlineMembers),
      sub: `Disabled/Exp ${toBengaliNumber(stats.disabledOrExpiredCount)}`,
      bg: '#fff1f2',
      border: '#fda4af',
      accent: '#be123c'
    },
    {
      label: 'মোট সদস্য',
      value: toBengaliNumber(stats.totalMembers),
      sub: `ONU লিংকড: ${toBengaliNumber(stats.onuLinkedCount)}`,
      bg: '#f8fafc',
      border: '#cbd5e1',
      accent: '#0f172a'
    },
    {
      label: 'Online অনু (OLT)',
      value: toBengaliNumber(stats.onlineOnus),
      sub: `${toBengaliNumber(stats.onlineOnuPct)}% Online`,
      bg: '#f0fdf4',
      border: '#86efac',
      accent: '#15803d'
    },
    {
      label: 'Active অনু (OLT)',
      value: toBengaliNumber(stats.activeOnus),
      sub: `${toBengaliNumber(stats.activeOnuPct)}% Active`,
      bg: '#f0f9ff',
      border: '#7dd3fc',
      accent: '#0284c7'
    },
    {
      label: 'Off-line / Alarm অনু',
      value: toBengaliNumber(stats.offlineOnus),
      sub: `Alarm ${toBengaliNumber(stats.alarmOnus)} (${toBengaliNumber(stats.alarmOnuPct)}%)`,
      bg: '#fef2f2',
      border: '#fca5a5',
      accent: '#b91c1c'
    },
    {
      label: 'মোট নিবন্ধিত অনু',
      value: toBengaliNumber(stats.totalOnus),
      sub: `XPON ${toBengaliNumber(stats.xponTotal)} · EPON ${toBengaliNumber(stats.eponTotal)}`,
      bg: '#f8fafc',
      border: '#cbd5e1',
      accent: '#1e293b'
    }
  ];

  kpis.forEach((k) => {
    const card = el(
      'div',
      `background:${k.bg};border:1px solid ${k.border};border-radius:8px;padding:8px 10px;`
    );
    card.appendChild(el('div', 'font-size:10px;font-weight:700;color:#334155;', k.label));
    card.appendChild(el('div', `font-size:18px;font-weight:800;color:${k.accent};margin-top:2px;`, k.value));
    card.appendChild(el('div', 'font-size:9.5px;color:#475569;margin-top:2px;', k.sub));
    kpiGrid.appendChild(card);
  });
  root.appendChild(kpiGrid);

  if (liveDashReport && (liveDashReport.todayCollection !== null || liveDashReport.monthlyCollection !== null)) {
    const finBar = el(
      'div',
      'background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:8px 12px;margin-bottom:14px;display:flex;flex-wrap:wrap;gap:18px;font-size:11px;font-weight:700;color:#0f172a;'
    );
    if (liveDashReport.todayCollection !== null) {
      finBar.appendChild(el('span', '', `আজকের লাইভ আদায়: ${formatCurrency(liveDashReport.todayCollection)}`));
    }
    if (liveDashReport.monthlyCollection !== null) {
      finBar.appendChild(el('span', '', `মাসিক আদায়: ${formatCurrency(liveDashReport.monthlyCollection)}`));
    }
    if (liveDashReport.totalDue !== null) {
      finBar.appendChild(el('span', '', `মোট বকেয়া: ${formatCurrency(liveDashReport.totalDue)}`));
    }
    root.appendChild(finBar);
  }

  // Section 2: PON Port Breakdown (PON1 - PON4)
  root.appendChild(
    el(
      'div',
      'font-size:12px;font-weight:800;color:#0f172a;margin-bottom:8px;',
      '২. PON পোর্ট অনুযায়ী OLT বিশ্লেষণ (PON1 – PON4)'
    )
  );
  const ponGrid = el(
    'div',
    'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:16px;'
  );
  stats.ponDetailed.forEach((p) => {
    const box = el(
      'div',
      'background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;'
    );
    const top = el('div', 'display:flex;justify-content:space-between;font-size:11px;font-weight:800;');
    top.appendChild(el('span', 'color:#0f172a;', p.ponId));
    top.appendChild(el('span', 'color:#0369a1;', `Act ${p.online}/${p.total}`));
    box.appendChild(top);
    box.appendChild(
      el(
        'div',
        'font-size:10px;color:#334155;margin-top:3px;',
        `On: ${p.online} · Off: ${p.offline}${p.alarmCount > 0 ? ` · !Alarm: ${p.alarmCount}` : ''}`
      )
    );
    box.appendChild(
      el('div', 'font-size:9.5px;color:#0e7490;font-weight:700;margin-top:2px;', `XPON: ${p.xponCount} · EPON: ${p.eponCount}`)
    );
    ponGrid.appendChild(box);
  });
  root.appendChild(ponGrid);

  // Section 3: Mixed OLT + Billing Table
  const tableTitleText =
    telemetryRows.length > MAX_PDF_ROWS
      ? `৩. সমন্বিত OLT + বিলিং তালিকা (মোট ${toBengaliNumber(telemetryRows.length)}টির মধ্যে অগ্রাধিকারভিত্তিক ${toBengaliNumber(pdfRows.length)}টি — সম্পূর্ণ তালিকা Excel-এ)`
      : `৩. সমন্বিত OLT + বিলিং তালিকা (মোট ${toBengaliNumber(pdfRows.length)}টি লাইন)`;

  root.appendChild(el('div', 'font-size:12px;font-weight:800;color:#0f172a;margin-bottom:6px;', tableTitleText));

  const table = el('table', 'width:100%;border-collapse:collapse;font-size:9.5px;');
  const thead = el('thead');
  const headRow = el('tr', 'background:#0f172a;color:#ffffff;');
  const headers = ['ক্রমিক', 'উৎস', 'আইডি ও নাম', 'মোবাইল / প্যাকেজ', 'PON / MAC', 'Rx / Tx / দৈর্ঘ্য', 'অবস্থা ও সমস্যা'];
  headers.forEach((h) => {
    headRow.appendChild(el('th', 'text-align:left;padding:6px 6px;border:1px solid #334155;font-weight:700;', h));
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = el('tbody');
  if (pdfRows.length === 0) {
    const emptyTr = el('tr');
    const emptyTd = el('td', 'padding:12px;text-align:center;color:#64748b;border:1px solid #cbd5e1;', 'কোনো সমন্বিত লাইন পাওয়া যায়নি।');
    emptyTd.colSpan = 7;
    emptyTr.appendChild(emptyTd);
    tbody.appendChild(emptyTr);
  } else {
    pdfRows.forEach((row, idx) => {
      const c = row.customer;
      const src = mixSourceById.get(c.id) || 'local';
      const isFault = row.hasProblem || row.isOffline;
      const tr = el(
        'tr',
        `background:${isFault ? '#fff1f2' : idx % 2 === 0 ? '#ffffff' : '#f8fafc'};`
      );

      const tdSl = el('td', 'padding:5px 6px;border:1px solid #cbd5e1;vertical-align:top;', toBengaliNumber(idx + 1));
      const tdSrc = el('td', 'padding:5px 6px;border:1px solid #cbd5e1;vertical-align:top;font-weight:700;color:#0369a1;', sourceLabelBengali(src));

      const tdName = el('td', 'padding:5px 6px;border:1px solid #cbd5e1;vertical-align:top;');
      tdName.appendChild(el('div', 'font-weight:700;color:#0f172a;', c.name));
      tdName.appendChild(el('div', 'color:#475569;font-family:monospace;', c.memberId));

      const tdPkg = el('td', 'padding:5px 6px;border:1px solid #cbd5e1;vertical-align:top;');
      tdPkg.appendChild(el('div', '', c.phone || '—'));
      tdPkg.appendChild(
        el(
          'div',
          'color:#475569;',
          [c.packageName, c.dueAmount ? `বকেয়া ৳${c.dueAmount}` : ''].filter(Boolean).join(' · ') || '—'
        )
      );

      const tdPon = el('td', 'padding:5px 6px;border:1px solid #cbd5e1;vertical-align:top;font-family:monospace;');
      tdPon.appendChild(el('div', 'font-weight:700;', `${row.ponLabel} (${row.techType})`));
      tdPon.appendChild(el('div', 'color:#475569;', row.onuMac));

      const tdPower = el('td', 'padding:5px 6px;border:1px solid #cbd5e1;vertical-align:top;font-family:monospace;');
      tdPower.appendChild(
        el(
          'div',
          `font-weight:700;color:${row.isLos || (row.rxDbm !== null && row.rxDbm <= -27) ? '#be123c' : row.isHighLoss ? '#b45309' : '#047857'};`,
          `Rx: ${row.rxDisplay} / Tx: ${row.txDisplay}`
        )
      );
      tdPower.appendChild(el('div', 'color:#475569;', row.lengthDisplay));

      const tdStatus = el('td', 'padding:5px 6px;border:1px solid #cbd5e1;vertical-align:top;');
      tdStatus.appendChild(
        el(
          'div',
          `font-weight:800;color:${row.isOffline ? '#be123c' : '#047857'};`,
          row.isOffline ? 'Offline' : 'Online'
        )
      );
      tdStatus.appendChild(el('div', 'color:#334155;', row.problemSummary));

      tr.appendChild(tdSl);
      tr.appendChild(tdSrc);
      tr.appendChild(tdName);
      tr.appendChild(tdPkg);
      tr.appendChild(tdPon);
      tr.appendChild(tdPower);
      tr.appendChild(tdStatus);
      tbody.appendChild(tr);
    });
  }
  table.appendChild(tbody);
  root.appendChild(table);

  stageHost.appendChild(root);
  document.body.appendChild(stageHost);

  const [{ jsPDF }, html2canvasModule] = await Promise.all([
    import('jspdf'),
    import('html2canvas-pro')
  ]);
  const html2canvas =
    html2canvasModule.default ||
    (html2canvasModule as unknown as (el: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLCanvasElement>);

  let canvas: HTMLCanvasElement;
  try {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    const captureWidth = Math.max(pageWidthPx, root.scrollWidth || pageWidthPx);
    const captureHeight = Math.max(200, root.scrollHeight);
    canvas = await html2canvas(root, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      width: captureWidth,
      height: captureHeight,
      windowWidth: captureWidth,
      windowHeight: captureHeight
    });
  } finally {
    stageHost.remove();
  }

  // A4 Portrait (210mm x 297mm)
  const widthMm = 210;
  const heightMm = 297;
  const marginMm = 8;
  const usableWidthMm = widthMm - marginMm * 2;
  const usableHeightMm = heightMm - marginMm * 2 - 6;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pxPerMm = canvas.width / usableWidthMm;
  const pageCanvasHeightPx = Math.floor(usableHeightMm * pxPerMm);
  const totalPages = Math.max(1, Math.ceil(canvas.height / pageCanvasHeightPx));

  let yOffsetPx = 0;
  let pageIndex = 0;

  while (yOffsetPx < canvas.height) {
    const sliceHeightPx = Math.min(pageCanvasHeightPx, canvas.height - yOffsetPx);
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeightPx;
    const ctx = sliceCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        yOffsetPx,
        canvas.width,
        sliceHeightPx,
        0,
        0,
        canvas.width,
        sliceHeightPx
      );
    }

    const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.94);
    const sliceHeightMm = sliceHeightPx / pxPerMm;

    if (pageIndex > 0) {
      pdf.addPage('a4', 'portrait');
    }

    pdf.addImage(sliceData, 'JPEG', marginMm, marginMm, usableWidthMm, sliceHeightMm, undefined, 'FAST');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(
      `${company?.name || 'DIP BHOLA NETWORK'} | OLT + Billing Summary | Page ${pageIndex + 1} / ${totalPages}`,
      marginMm,
      heightMm - 4
    );

    yOffsetPx += sliceHeightPx;
    pageIndex += 1;
  }

  pdf.save(`DIP_BHOLA_OLT_Billing_Summary_${makeFileStamp()}.pdf`);
}
