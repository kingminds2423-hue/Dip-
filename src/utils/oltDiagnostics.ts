import { CustomerMember, OnuLossStatus } from '../types';
import { toEnglishDigits } from './formatters';

export type PonPortId = 'PON1' | 'PON2' | 'PON3' | 'PON4' | 'OTHER';
export type OpticalHealthTier = 'healthy' | 'warning' | 'critical' | 'unmeasured';

export interface ParsedOnuTelemetry {
  customer: CustomerMember;
  ponPort: PonPortId;
  ponLabel: string;
  techType: 'EPON' | 'XPON' | 'GPON';
  rxDbm: number | null;
  txDbm: number | null;
  rxDisplay: string;
  txDisplay: string;
  lengthMeters: number | null;
  lengthDisplay: string;
  onuMac: string;
  splitterLabel: string;
  tjLabel: string;
  isOffline: boolean;
  isLos: boolean;
  isHighLoss: boolean;
  hasProblem: boolean;
  tier: OpticalHealthTier;
  problemSummary: string;
}

export interface PonBucketStats {
  ponId: 'PON1' | 'PON2' | 'PON3' | 'PON4';
  subtitle: string;
  total: number;
  online: number;
  offline: number;
  highLossCount: number;
  losCount: number;
  avgRxDbm: number | null;
  problemRatePct: number;
  items: ParsedOnuTelemetry[];
}

export function parseFirstDecimal(raw?: string): number | null {
  if (!raw) return null;
  const match = toEnglishDigits(raw).match(/(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

export function parseDistanceInMeters(raw?: string): number | null {
  if (!raw) return null;
  const eng = toEnglishDigits(raw).trim();
  const kmMatch = eng.match(/(\d+(?:\.\d+)?)\s*km/i);
  if (kmMatch) {
    const v = Number(kmMatch[1]);
    return Number.isFinite(v) ? Math.round(v * 1000) : null;
  }
  const mMatch = eng.match(/(\d+(?:\.\d+)?)\s*(?:meter|meters|mtr|m)\b/i);
  if (mMatch) {
    const v = Number(mMatch[1]);
    return Number.isFinite(v) ? Math.round(v) : null;
  }
  if (/^\d+(?:\.\d+)?$/.test(eng)) {
    const v = Number(eng);
    return Number.isFinite(v) ? Math.round(v) : null;
  }
  return null;
}

export function detectPonPort(oltInfo?: string, fallbackIndex = 0): {
  ponPort: PonPortId;
  ponLabel: string;
  techType: 'EPON' | 'XPON' | 'GPON';
} {
  const raw = toEnglishDigits(oltInfo || '').trim();
  const upper = raw.toUpperCase();
  const techType: 'EPON' | 'XPON' | 'GPON' = upper.includes('XPON')
    ? 'XPON'
    : upper.includes('GPON')
    ? 'GPON'
    : 'EPON';

  if (/\bPON\s*[-_:]?\s*1\b|(?:EPON|GPON|XPON)\s*0\/1\/1\b|(?:EPON|GPON|XPON)\s*0\/0\/1\b/i.test(upper)) {
    return { ponPort: 'PON1', ponLabel: 'PON1', techType };
  }
  if (/\bPON\s*[-_:]?\s*2\b|(?:EPON|GPON|XPON)\s*0\/1\/2\b|(?:EPON|GPON|XPON)\s*0\/0\/2\b/i.test(upper)) {
    return { ponPort: 'PON2', ponLabel: 'PON2', techType };
  }
  if (/\bPON\s*[-_:]?\s*3\b|(?:EPON|GPON|XPON)\s*0\/1\/3\b|(?:EPON|GPON|XPON)\s*0\/0\/3\b/i.test(upper)) {
    return { ponPort: 'PON3', ponLabel: 'PON3', techType };
  }
  if (/\bPON\s*[-_:]?\s*4\b|(?:EPON|GPON|XPON)\s*0\/1\/4\b|(?:EPON|GPON|XPON)\s*0\/0\/4\b/i.test(upper)) {
    return { ponPort: 'PON4', ponLabel: 'PON4', techType };
  }

  // Fallback check on 0/1/X where X > 4 (map modulo 4 cleanly if it's an explicit PON path)
  const slotMatch = upper.match(/(?:EPON|GPON|XPON)\s*\d+\/\d+\/(\d+)/);
  if (slotMatch) {
    const portNum = Number(slotMatch[1]);
    if (portNum >= 1 && portNum <= 4) {
      return { ponPort: `PON${portNum}` as PonPortId, ponLabel: `PON${portNum}`, techType };
    }
    if (portNum > 4) {
      const mod = ((portNum - 1) % 4) + 1;
      return { ponPort: `PON${mod}` as PonPortId, ponLabel: `PON${mod}`, techType };
    }
  }

  if (raw) {
    return { ponPort: 'OTHER', ponLabel: raw.slice(0, 14), techType };
  }
  // If customer has no OLT info yet, keep as OTHER (still searchable, shows unmeasured)
  void fallbackIndex;
  return { ponPort: 'OTHER', ponLabel: 'অনির্ধারিত', techType };
}

export function analyzeCustomerOnu(customer: CustomerMember, index = 0): ParsedOnuTelemetry {
  const { ponPort, ponLabel, techType } = detectPonPort(customer.oltInfo, index);

  const rxRaw = customer.rxPower || customer.oltPower || '';
  const txRaw = customer.txPower || '';
  const lenRaw = customer.fiberLength || customer.oltPower || '';

  const rxDbm = parseFirstDecimal(rxRaw);
  const txDbm = parseFirstDecimal(txRaw);
  const lengthMeters = parseDistanceInMeters(lenRaw);

  const lossStatus = customer.lossStatus;
  const rxUpper = rxRaw.toUpperCase();
  const isOffline = customer.status !== 'active';
  const isLos =
    lossStatus === 'los' ||
    rxUpper.includes('LOS') ||
    (isOffline && rxDbm === null && Boolean(customer.onuMac || customer.oltInfo));

  const isHighLoss =
    lossStatus === 'high_loss' ||
    lossStatus === 'tj_fault' ||
    lossStatus === 'splitter_fault' ||
    (rxDbm !== null && rxDbm <= -25.0);

  const hasFaultStatus =
    lossStatus === 'dying_gasp' ||
    lossStatus === 'tj_fault' ||
    lossStatus === 'splitter_fault' ||
    lossStatus === 'high_loss' ||
    lossStatus === 'los';

  const hasProblem = isLos || isHighLoss || hasFaultStatus || isOffline || Boolean(customer.issueReason?.trim());

  let tier: OpticalHealthTier = 'unmeasured';
  if (isLos || lossStatus === 'dying_gasp' || (rxDbm !== null && rxDbm <= -27)) {
    tier = 'critical';
  } else if (isHighLoss || hasFaultStatus || isOffline) {
    tier = 'warning';
  } else if (rxDbm !== null || customer.status === 'active') {
    tier = rxDbm !== null ? 'healthy' : customer.onuMac || customer.oltInfo ? 'healthy' : 'unmeasured';
  }

  let problemSummary = 'স্বাভাবিক সিগন্যাল';
  if (lossStatus === 'los' || rxUpper.includes('LOS')) {
    problemSummary = 'LOS — ফাইবার কাটা বা সংযোগ বিচ্ছিন্ন';
  } else if (lossStatus === 'dying_gasp') {
    problemSummary = 'Dying Gasp — বিদ্যুৎ / অনু বন্ধ';
  } else if (lossStatus === 'tj_fault') {
    problemSummary = 'TJ বক্স জয়েন্ট লস';
  } else if (lossStatus === 'splitter_fault') {
    problemSummary = 'স্প্লিটার পোর্ট লস';
  } else if (rxDbm !== null && rxDbm <= -27) {
    problemSummary = `ক্রিটিকাল হাই লস (${rxDbm} dBm)`;
  } else if (rxDbm !== null && rxDbm <= -25) {
    problemSummary = `সতর্কতা হাই লস (${rxDbm} dBm)`;
  } else if (customer.issueReason?.trim()) {
    problemSummary = customer.issueReason.trim();
  } else if (isOffline) {
    problemSummary = customer.status === 'disconnected' ? 'সংযোগ বিচ্ছিন্ন' : 'সাময়িক অফলাইন';
  } else if (rxDbm === null) {
    problemSummary = 'পাওয়ার পরিমাপ করা হয়নি';
  }

  const rxDisplay = rxUpper.includes('LOS')
    ? 'LOS'
    : rxDbm !== null
    ? `${rxDbm}`
    : '—';
  const txDisplay = txDbm !== null ? `${txDbm}` : '—';
  const lengthDisplay = lengthMeters !== null ? `${lengthMeters.toLocaleString('en-US')} m` : '—';

  const splitterParts = [customer.splitterName?.trim(), customer.splitterLoss?.trim()].filter(Boolean);
  const tjParts = [customer.tjBox?.trim(), customer.tjLoss?.trim()].filter(Boolean);

  return {
    customer,
    ponPort,
    ponLabel,
    techType,
    rxDbm,
    txDbm,
    rxDisplay,
    txDisplay,
    lengthMeters,
    lengthDisplay,
    onuMac: customer.onuMac?.trim() || '—',
    splitterLabel: splitterParts.join(' · ') || '—',
    tjLabel: tjParts.join(' · ') || '—',
    isOffline,
    isLos,
    isHighLoss,
    hasProblem,
    tier,
    problemSummary
  };
}

export function computePonBuckets(
  items: ParsedOnuTelemetry[]
): Record<'PON1' | 'PON2' | 'PON3' | 'PON4', PonBucketStats> {
  const defaultMeta: Record<'PON1' | 'PON2' | 'PON3' | 'PON4', string> = {
    PON1: 'পোর্ট ১ (EPON0/1/1)',
    PON2: 'পোর্ট ২ (EPON0/1/2)',
    PON3: 'পোর্ট ৩ (EPON0/1/3)',
    PON4: 'পোর্ট ৪ (EPON0/1/4)'
  };

  const result = {} as Record<'PON1' | 'PON2' | 'PON3' | 'PON4', PonBucketStats>;
  (['PON1', 'PON2', 'PON3', 'PON4'] as const).forEach((ponId) => {
    const ponItems = items.filter((item) => item.ponPort === ponId);
    const online = ponItems.filter((i) => !i.isOffline && !i.isLos).length;
    const offline = ponItems.filter((i) => i.isOffline || i.isLos).length;
    const highLossCount = ponItems.filter((i) => i.rxDbm !== null && i.rxDbm <= -25).length;
    const losCount = ponItems.filter((i) => i.isLos).length;
    const rxValues = ponItems.map((i) => i.rxDbm).filter((v): v is number => v !== null);
    const avgRxDbm =
      rxValues.length > 0
        ? Number((rxValues.reduce((s, v) => s + v, 0) / rxValues.length).toFixed(1))
        : null;
    const problemCount = ponItems.filter((i) => i.hasProblem).length;
    const problemRatePct =
      ponItems.length > 0 ? Math.round((problemCount / ponItems.length) * 100) : 0;

    result[ponId] = {
      ponId,
      subtitle: defaultMeta[ponId],
      total: ponItems.length,
      online,
      offline,
      highLossCount,
      losCount,
      avgRxDbm,
      problemRatePct,
      items: ponItems
    };
  });

  return result;
}

export interface ParsedBulkOnuRow {
  memberId?: string;
  name?: string;
  phone?: string;
  address?: string;
  oltInfo?: string;
  onuMac?: string;
  rxPower?: string;
  txPower?: string;
  fiberLength?: string;
  tjBox?: string;
  splitterName?: string;
  status: 'active' | 'inactive' | 'disconnected';
  lossStatus: OnuLossStatus;
  issueReason?: string;
}

/**
 * Parses pasted lines from C-DATA OLT CLI / web table / CSV / tab-separated ONU exports
 * so operators can bulk-sync optical telemetry straight into Firestore customers.
 */
export function parseOltPasteLines(rawText: string): ParsedBulkOnuRow[] {
  const lines = toEnglishDigits(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const parsed: ParsedBulkOnuRow[] = [];

  for (const line of lines) {
    // Skip header lines
    if (/^(?:pon|sl|id|onu|customer|name)\s*[,|\t]/i.test(line)) continue;

    const macMatch = line.match(/([0-9A-Fa-f]{2}(?:[:-][0-9A-Fa-f]{2}){5})/);
    const ponMatch = line.match(/\b(PON\s*[1-4]|(?:EPON|GPON|XPON)\s*\d+\/\d+\/\d+(?::\d+)?)\b/i);
    const rxMatch = line.match(/(?:rx\s*[:=]?\s*)?(-\d{1,2}(?:\.\d+)?)\s*(?:dBm)?/i);
    const lenMatch = line.match(/(\d{2,5})\s*(?:m|meter|meters|mtr)\b/i);
    const phoneMatch = line.match(/\b(01[3-9]\d{8})\b/);
    const lower = line.toLowerCase();

    const cols = line.split(/\t|,|\|/).map((c) => c.trim()).filter(Boolean);

    const isLos = /\blos\b|offline|down|dying.?gasp/i.test(lower);
    const isDyingGasp = /dying.?gasp|power.?off/i.test(lower);
    const status: 'active' | 'inactive' | 'disconnected' = /\bonline\b|\bup\b|\bactive\b/i.test(lower)
      ? 'active'
      : isLos
      ? 'inactive'
      : rxMatch
      ? 'active'
      : 'inactive';

    const rxVal = rxMatch ? Number(rxMatch[1]) : null;
    const lossStatus: OnuLossStatus = isDyingGasp
      ? 'dying_gasp'
      : /\blos\b/i.test(lower)
      ? 'los'
      : rxVal !== null && rxVal <= -25
      ? 'high_loss'
      : 'normal';

    let memberId = '';
    let name = '';
    for (const col of cols) {
      if (!memberId && /^(?:DBN|NEBW|DIP)?[-_]?\d{2,6}$/i.test(col)) {
        memberId = col;
        continue;
      }
      if (
        !name &&
        col.length >= 2 &&
        !col.includes(':') &&
        !/^-?\d+(?:\.\d+)?\s*(?:dbm|m|meter)?$/i.test(col) &&
        !/^(?:pon\d|epon|gpon|xpon|online|offline|los|active|inactive|dying)/i.test(col)
      ) {
        name = col;
      }
    }

    if (!macMatch && !memberId && !name && !ponMatch) continue;

    parsed.push({
      ...(memberId ? { memberId } : {}),
      ...(name ? { name } : {}),
      ...(phoneMatch ? { phone: phoneMatch[1] } : {}),
      ...(ponMatch ? { oltInfo: ponMatch[1].toUpperCase().replace(/\s+/g, '') } : {}),
      ...(macMatch ? { onuMac: macMatch[1].toUpperCase().replace(/-/g, ':') } : {}),
      ...(rxVal !== null ? { rxPower: `${rxVal} dBm` } : {}),
      ...(lenMatch ? { fiberLength: `${lenMatch[1]} meter` } : {}),
      status,
      lossStatus,
      ...(isDyingGasp
        ? { issueReason: 'Dying Gasp (বিদ্যুৎ বা অ্যাডাপ্টার বন্ধ)' }
        : /\blos\b/i.test(lower)
        ? { issueReason: 'ফাইবার কাটা / LOS' }
        : {})
    });
  }

  return parsed;
}
