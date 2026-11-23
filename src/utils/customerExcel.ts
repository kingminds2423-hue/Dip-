import { CustomerMember } from '../types';
import { getTodayString, parseNumericInput, toEnglishDigits } from './formatters';
import { normalizeExcelPhone, normalizeExcelStatus, isCustomerExpired } from './customerStatus';
export { normalizeExcelPhone, normalizeExcelStatus, isCustomerExpired };

const loadXlsx = () => import('xlsx');

export type CustomerExcelField =
  | 'memberId'
  | 'name'
  | 'phone'
  | 'address'
  | 'packageName'
  | 'monthlyFee'
  | 'oltInfo'
  | 'oltPower'
  | 'status'
  | 'notes';

export type ExcelColumnMapping = Record<CustomerExcelField, string>;

export interface ParsedExcelSheetResult {
  headers: string[];
  rawRows: Record<string, unknown>[];
  detectedMapping: ExcelColumnMapping;
}

function normalizeHeader(h: string): string {
  return toEnglishDigits(String(h || ''))
    .toLowerCase()
    .replace(/[\s_\-().:/]+/g, ' ')
    .trim();
}

const FIELD_KEYWORDS: Record<CustomerExcelField, string[]> = {
  memberId: [
    'member id',
    'memberid',
    'member no',
    'member number',
    'client id',
    'customer id',
    'user id',
    'userid',
    'username',
    'pppoe',
    'line id',
    'code',
    'সদস্য নম্বর',
    'সদস্য নাম্বার',
    'সদস্য আইডি',
    'আইডি নম্বর',
    'কোড',
    'id'
  ],
  name: [
    'customer name',
    'member name',
    'full name',
    'client name',
    'গ্রাহকের নাম',
    'সদস্যের নাম',
    'নাম',
    'name'
  ],
  phone: [
    'mobile number',
    'phone number',
    'contact number',
    'mobile',
    'phone',
    'cell',
    'contact',
    'মোবাইল নম্বর',
    'মোবাইল নাম্বার',
    'মোবাইল',
    'ফোন'
  ],
  address: [
    'address',
    'area',
    'location',
    'zone',
    'village',
    'ঠিকানা',
    'এলাকা',
    'গ্রাম'
  ],
  packageName: [
    'package',
    'plan',
    'bandwidth',
    'speed',
    'mbps',
    'প্যাকেজ',
    'স্পিড'
  ],
  monthlyFee: [
    'monthly fee',
    'monthly bill',
    'bill amount',
    'fee',
    'bill',
    'amount',
    'price',
    'মাসিক বিল',
    'বিল',
    'টাকা'
  ],
  oltInfo: [
    'olt pon',
    'olt & pon',
    'olt',
    'onu',
    'pon',
    'epon',
    'gpon',
    'mac',
    'port',
    'ip',
    'পোর্ট',
    'ওএলটি'
  ],
  oltPower: [
    'power dist',
    'power / dist',
    'onu power',
    'rx power',
    'optical power',
    'power',
    'dbm',
    'distance',
    'dist',
    'পাওয়ার',
    'দূরত্ব'
  ],
  status: ['status', 'state', 'connection', 'অবস্থা', 'স্ট্যাটাস'],
  notes: ['notes', 'note', 'remark', 'remarks', 'মন্তব্য', 'নোট']
};

function detectColumnMapping(headers: string[]): ExcelColumnMapping {
  const normalizedMap = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const used = new Set<string>();

  const pick = (keywords: string[]): string => {
    // Exact keyword match first
    for (const kw of keywords) {
      const found = normalizedMap.find((item) => !used.has(item.raw) && item.norm === kw);
      if (found) {
        used.add(found.raw);
        return found.raw;
      }
    }
    // Partial keyword match second
    for (const kw of keywords) {
      const found = normalizedMap.find((item) => !used.has(item.raw) && item.norm.includes(kw));
      if (found) {
        used.add(found.raw);
        return found.raw;
      }
    }
    return '';
  };

  return {
    memberId: pick(FIELD_KEYWORDS.memberId),
    name: pick(FIELD_KEYWORDS.name),
    phone: pick(FIELD_KEYWORDS.phone),
    address: pick(FIELD_KEYWORDS.address),
    packageName: pick(FIELD_KEYWORDS.packageName),
    monthlyFee: pick(FIELD_KEYWORDS.monthlyFee),
    oltInfo: pick(FIELD_KEYWORDS.oltInfo),
    oltPower: pick(FIELD_KEYWORDS.oltPower),
    status: pick(FIELD_KEYWORDS.status),
    notes: pick(FIELD_KEYWORDS.notes)
  };
}

/**
 * Parses .xlsx, .xls, or .csv spreadsheets into raw objects + smart Bengali/English column mapping.
 * Handles spreadsheets where row 1-2 is a company banner above the actual table headers.
 */
export async function parseCustomersExcelFile(file: File): Promise<ParsedExcelSheetResult> {
  const [XLSX, buffer] = await Promise.all([loadXlsx(), file.arrayBuffer()]);
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('ফাইলে কোনো ডেটা শিইট পাওয়া যায়নি।');
  }
  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  if (!matrix || matrix.length === 0) {
    throw new Error('Excel ফাইলটি সম্পূর্ণ খালি।');
  }

  // Find likely header row within first 6 non-empty rows
  const allKeywords = Object.values(FIELD_KEYWORDS).flat();
  let headerRowIdx = 0;
  let bestScore = -1;
  const maxScan = Math.min(matrix.length, 6);
  for (let r = 0; r < maxScan; r++) {
    const row = Array.isArray(matrix[r]) ? matrix[r] : [];
    const nonEmpty = row.map((cell) => normalizeHeader(String(cell ?? ''))).filter(Boolean);
    if (nonEmpty.length < 2) continue;
    let score = 0;
    for (const cell of nonEmpty) {
      if (allKeywords.some((kw) => cell === kw || cell.includes(kw))) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      headerRowIdx = r;
    }
  }

  const rawHeaderRow = (Array.isArray(matrix[headerRowIdx]) ? matrix[headerRowIdx] : []).map((h, idx) => {
    const label = String(h ?? '').trim();
    return label || `Column_${idx + 1}`;
  });

  // Deduplicate identical header names cleanly
  const seenHeaders = new Map<string, number>();
  const headers = rawHeaderRow.map((h) => {
    const count = seenHeaders.get(h) || 0;
    seenHeaders.set(h, count + 1);
    return count > 0 ? `${h} (${count + 1})` : h;
  });

  const rawRows: Record<string, unknown>[] = [];
  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const cells = Array.isArray(matrix[r]) ? matrix[r] : [];
    const hasAnyValue = cells.some((v) => String(v ?? '').trim() !== '');
    if (!hasAnyValue) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? '';
    });
    rawRows.push(obj);
  }

  if (rawRows.length === 0) {
    throw new Error('Excel শিইটে কোনো গ্রাহকের সারি পাওয়া যায়নি।');
  }

  return {
    headers,
    rawRows,
    detectedMapping: detectColumnMapping(headers)
  };
}

export function buildCustomersFromMappedRows(
  rawRows: Record<string, unknown>[],
  mapping: ExcelColumnMapping,
  addedBy: string
): {
  validCustomers: Array<Omit<CustomerMember, 'id' | 'createdAt' | 'updatedAt'>>;
  skippedCount: number;
} {
  const validCustomers: Array<Omit<CustomerMember, 'id' | 'createdAt' | 'updatedAt'>> = [];
  let skippedCount = 0;

  rawRows.forEach((row) => {
    const memberIdVal = mapping.memberId ? toEnglishDigits(String(row[mapping.memberId] ?? '').trim()) : '';
    const nameVal = mapping.name ? String(row[mapping.name] ?? '').trim() : '';

    if (!memberIdVal || !nameVal) {
      skippedCount += 1;
      return;
    }

    const phoneVal = mapping.phone ? normalizeExcelPhone(row[mapping.phone]) : '';
    const addressVal = mapping.address ? String(row[mapping.address] ?? '').trim() : '';
    const packageVal = mapping.packageName ? String(row[mapping.packageName] ?? '').trim() : '';
    const feeVal = mapping.monthlyFee ? parseNumericInput(String(row[mapping.monthlyFee] ?? '')) : 0;
    const oltVal = mapping.oltInfo ? String(row[mapping.oltInfo] ?? '').trim() : '';
    const powerVal = mapping.oltPower ? String(row[mapping.oltPower] ?? '').trim() : '';
    const rawStatusVal = mapping.status ? String(row[mapping.status] ?? '').trim() : '';
    const statusVal = mapping.status ? normalizeExcelStatus(rawStatusVal) : 'active';
    const noteVal = mapping.notes ? String(row[mapping.notes] ?? '').trim() : '';

    validCustomers.push({
      memberId: memberIdVal,
      name: nameVal,
      phone: phoneVal || 'দেওয়া হয়নি',
      address: addressVal || 'ভোলা সদর',
      ...(packageVal ? { packageName: packageVal } : {}),
      ...(feeVal > 0 ? { monthlyFee: feeVal } : {}),
      ...(oltVal ? { oltInfo: oltVal } : {}),
      ...(powerVal ? { oltPower: powerVal } : {}),
      status: statusVal,
      ...(rawStatusVal ? { statusLabel: rawStatusVal } : {}),
      ...(noteVal ? { notes: noteVal } : {}),
      addedBy
    });
  });

  return { validCustomers, skippedCount };
}

export async function downloadSampleCustomersExcel(): Promise<void> {
  const XLSX = await loadXlsx();
  const rows = [
    {
      'CUSTOMER ID': 'NEBW249',
      'CUSTOMER NAME': 'Md Rabbi',
      'CONTACT NO': '01300986693',
      'ADDRESS': 'Tails factory, Bhola sadar',
      'PACKAGE': '525TK-20MBPS',
      'MONTHLY FEE': 525,
      'OLT & PON': 'OLT-Sujit-zahid-Zangalia (EPON0/1/3:32)',
      'POWER / DIST': '-18.7 dBm | 2290 meter',
      'STATUS': 'Unlocked / Active',
      'NOTE': 'নিয়মিত গ্রাহক'
    },
    {
      'CUSTOMER ID': 'DBN-102',
      'CUSTOMER NAME': 'হারুন অর রশিদ',
      'CONTACT NO': '01823456789',
      'ADDRESS': 'বাপ্তা ইউনিয়ন পরিষদ সংলগ্ন, ভোলা সদর',
      'PACKAGE': '15 Mbps',
      'MONTHLY FEE': 700,
      'OLT & PON': 'PON-02 / ONU-05',
      'POWER / DIST': '-19.4 dBm | 1450 meter',
      'STATUS': 'Active',
      'NOTE': 'রাউটার সংযোগ সচল'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Members');
  XLSX.writeFile(wb, 'DIP_BHOLA_Members_Template.xlsx');
}

export async function exportCustomersToExcel(customers: CustomerMember[]): Promise<void> {
  const XLSX = await loadXlsx();
  const rows = customers.map((c, idx) => ({
    'SL': idx + 1,
    'CUSTOMER ID': c.memberId,
    'CUSTOMER NAME': c.name,
    'CONTACT NO': c.phone,
    'ADDRESS': c.address,
    'PACKAGE': c.packageName || '',
    'MONTHLY FEE': c.monthlyFee || 0,
    'OLT & PON': c.oltInfo || '',
    'POWER / DIST': c.oltPower || '',
    'STATUS':
      c.statusLabel ||
      (c.status === 'active' ? 'Active' : c.status === 'inactive' ? 'Inactive' : 'Disconnected'),
    'NOTE': c.notes || ''
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Members');
  XLSX.writeFile(wb, `DIP_BHOLA_Members_${getTodayString()}.xlsx`);
}
