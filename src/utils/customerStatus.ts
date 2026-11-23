import { CustomerMember } from '../types';
import { getTodayString, toEnglishDigits } from './formatters';

export function normalizeExcelPhone(raw: unknown): string {
  const rawStr = toEnglishDigits(String(raw ?? '').trim());
  if (!rawStr) return '';
  // Remove spaces/dashes when normalizing pure digits
  const compact = rawStr.replace(/[\s\-()]+/g, '');
  // Restore leading zero stripped by Excel numeric formatting (e.g., 1712345678 -> 01712345678)
  if (/^1[3-9]\d{8}$/.test(compact)) {
    return `0${compact}`;
  }
  if (/^8801[3-9]\d{8}$/.test(compact)) {
    return `0${compact.slice(3)}`;
  }
  if (/^\+8801[3-9]\d{8}$/.test(compact)) {
    return `0${compact.slice(4)}`;
  }
  return rawStr;
}

export function normalizeExcelStatus(raw: unknown): 'active' | 'inactive' | 'disconnected' {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return 'active';

  // Explicitly active / unlocked states first so 'unlocked' never triggers 'locked'
  if (
    s.includes('unlock') ||
    s === 'active' ||
    s === 'online' ||
    s === 'up' ||
    s === 'enable' ||
    s === 'enabled' ||
    s === 'connected' ||
    s === 'running' ||
    s.includes('সচল')
  ) {
    return 'active';
  }

  if (
    s.includes('disconnect') ||
    s.includes('expire') ||
    s.includes('terminat') ||
    /\blos\b/.test(s) ||
    /\bcut\b/.test(s) ||
    s.includes('closed') ||
    s.includes('close') ||
    s.includes('বিচ্ছিন্ন') ||
    s.includes('বন্ধ স্থায়ী') ||
    s.includes('স্থায়ী বন্ধ')
  ) {
    return 'disconnected';
  }

  if (
    s.includes('deactiv') ||
    s.includes('inactive') ||
    s.includes('disable') ||
    s.includes('suspend') ||
    s.includes('hold') ||
    s.includes('offline') ||
    /\boff\b/.test(s) ||
    /\bdown\b/.test(s) ||
    s.includes('dying') ||
    s.includes('gasp') ||
    s.includes('block') ||
    /\block(?:ed)?\b/.test(s) ||
    /\bdue\b/.test(s) ||
    s.includes('সাময়িক') ||
    s.includes('নিষ্ক্রিয়') ||
    s === 'বন্ধ'
  ) {
    return 'inactive';
  }

  return 'active';
}

export function isCustomerExpired(
  customer: Pick<CustomerMember, 'status' | 'statusLabel' | 'expiryDate' | 'notes'>
): boolean {
  const lbl = `${customer.statusLabel || ''} ${customer.notes || ''}`.toLowerCase();
  if (/expir|মেয়াদ/i.test(lbl)) {
    return true;
  }
  const rawExp = toEnglishDigits((customer.expiryDate || '').trim());
  if (rawExp) {
    // Support YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, YYYY/MM/DD
    let iso = '';
    const ymd = rawExp.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    const dmy = rawExp.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (ymd) {
      iso = `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
    } else if (dmy) {
      iso = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    }
    if (iso) {
      const todayIso = getTodayString();
      if (iso < todayIso && customer.status !== 'active') {
        return true;
      }
    }
  }
  return false;
}
