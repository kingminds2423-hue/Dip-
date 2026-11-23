const BENGALI_TO_ENGLISH_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

// Convert Bengali numerals to English numerals
export function toEnglishDigits(input?: string | number | null): string {
  if (input === undefined || input === null) return '';
  return String(input).replace(/[০-৯]/g, (digit) => BENGALI_TO_ENGLISH_DIGITS[digit] ?? digit);
}

// Parse number cleanly from English/Bengali digits, stripping currency symbols & commas
export function parseNumericInput(input?: string | number | null): number {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : 0;
  }
  if (!input) return 0;
  const normalized = toEnglishDigits(input)
    .replace(/[৳,\s]/g, '')
    .replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Convert English numerals to Bengali numerals
export function toBengaliNumber(num: number | string | undefined | null): string {
  if (num === undefined || num === null) return '০';
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num
    .toString()
    .replace(/[0-9]/g, (digit) => banglaDigits[parseInt(digit, 10)]);
}

// Format Currency with ৳ Symbol
export function formatCurrency(amount: number | undefined | null, useBengali = true): string {
  if (amount === undefined || amount === null) return '৳ ০';
  const formatted = amount.toLocaleString('en-US');
  if (useBengali) {
    return `৳ ${toBengaliNumber(formatted)}`;
  }
  return `৳ ${formatted}`;
}

// Format Date YYYY-MM-DD to Bengali friendly
export function formatBengaliDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const months = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    const day = toBengaliNumber(parseInt(parts[2], 10));
    const month = months[parseInt(parts[1], 10) - 1] || parts[1];
    const year = toBengaliNumber(parts[0]);
    return `${day} ${month}, ${year}`;
  }
  return dateStr;
}

export const CATEGORIES_EXPENSE = [
  'যাতায়াত ও ডেলিভারি খরচ',
  'বিদ্যুৎ ও ইন্টারনেট বিল',
  'স্টাফ বেতন ও ভাতা',
  'পাইকারি পণ্য / কাঁচামাল ক্রয়',
  'আপ্যায়ন ও নাস্তা খরচ',
  'অফিস ভাড়া ও ইউটিলিটি',
  'লাইন মেরামত ও সরঞ্জাম ক্রয়',
  'যন্ত্রপাতি ও হার্ডওয়্যার পার্টস',
  'প্রচার ও মার্কেটিং',
  'অন্যান্য ব্যয়'
];

export const CATEGORIES_INCOME = [
  'গ্রাহক মাসিক বিল কালেকশন',
  'নতুন লাইন সংযোগ ফি',
  'ব্যাংক মুনাফা / কমিশন',
  'রাউটার / অনু / ডিভাইস বিক্রি',
  'অন্যান্য আয়'
];

export function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLastMonthString(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getLocalDateKey(isoOrDate?: string | null): string {
  if (!isoOrDate) return '';
  const trimmed = isoOrDate.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getComplaintDateKey(complaint?: { date?: string; createdAt?: string } | null): string {
  if (!complaint) return '';
  if (complaint.date && /^\d{4}-\d{2}-\d{2}$/.test(complaint.date.trim())) {
    return complaint.date.trim();
  }
  return getLocalDateKey(complaint.createdAt);
}

export function getTransactionDateKey(tx?: { date?: string; createdAt?: string } | null): string {
  if (!tx) return '';
  const fromDate = getLocalDateKey(tx.date);
  if (fromDate) return fromDate;
  return getLocalDateKey(tx.createdAt);
}

export function matchesTransactionSearch(
  tx: {
    id?: string;
    type?: string;
    title?: string;
    category?: string;
    note?: string;
    addedBy?: string;
    date?: string;
    createdAt?: string;
    amount?: number;
    paymentMethod?: string;
  },
  rawQuery: string
): boolean {
  const trimmed = rawQuery.trim();
  if (!trimmed) return true;

  const normalizeSearch = (val: string) =>
    toEnglishDigits(val)
      .toLowerCase()
      .replace(/৳/g, ' ')
      .replace(/,/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const dateKey = getTransactionDateKey(tx);
  const payLabel =
    tx.paymentMethod === 'bkash'
      ? 'বিকাশ bkash'
      : tx.paymentMethod === 'nagad'
      ? 'নগদ nagad'
      : tx.paymentMethod === 'bank'
      ? 'ব্যাংক bank'
      : tx.paymentMethod === 'rocket'
      ? 'রকেট rocket'
      : 'নগদ ক্যাশ cash';
  const typeLabel = tx.type === 'income' ? 'আয় জমা income' : 'ব্যয় খরচ expense';

  const haystack = normalizeSearch(
    [
      tx.title || '',
      tx.note || '',
      tx.id || '',
      tx.category || '',
      tx.addedBy || '',
      dateKey,
      tx.date || '',
      formatBengaliDate(dateKey || tx.date || ''),
      String(tx.amount ?? ''),
      toBengaliNumber(tx.amount ?? ''),
      payLabel,
      typeLabel,
    ].join(' ')
  );

  const tokens = normalizeSearch(trimmed).split(' ').filter(Boolean);
  return tokens.every((token) => haystack.includes(token));
}
