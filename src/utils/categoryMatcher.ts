import { TransactionType } from '../types';

/**
 * Matches common Bengali & English keywords in a transaction title
 * and returns the corresponding category string if found.
 */
export function matchTransactionCategoryFromTitle(
  rawTitle: string,
  type: TransactionType
): string | null {
  const title = (rawTitle || '').trim().toLowerCase();
  if (!title) return null;

  if (type === 'income') {
    if (/(সংযোগ|কানেকশন|connection|নতুন লাইন|line fee)/i.test(title)) {
      return 'নতুন লাইন সংযোগ ফি';
    }
    if (/(রাউটার|অনু|onu|ডিভাইস|router|device|বিক্রি|sale)/i.test(title)) {
      return 'রাউটার / অনু / ডিভাইস বিক্রি';
    }
    if (/(ব্যাংক|bank|মুনাফা|কমিশন|ক্যাশব্যাক|interest)/i.test(title)) {
      return 'ব্যাংক মুনাফা / কমিশন';
    }
    if (/(বিল|bill|কালেকশন|আদায়|মাসিক|বকেয়া|due|রিচার্জ|renew)/i.test(title)) {
      return 'গ্রাহক মাসিক বিল কালেকশন';
    }
    return null;
  }

  // Expense category keyword rules
  if (/(বেতন|salary|স্যালারি|ভাতা|বোনাস|bonus|মজুরি)/i.test(title)) {
    return 'স্টাফ বেতন ও ভাতা';
  }
  if (/(রিপেয়ার|repair|মেরামত|লাইন সমস্যা|ফাইবার|fiber|ক্যাবল|cable|জয়েন্ট|সার্ভিস|fault|টিকেট)/i.test(title)) {
    return 'লাইন মেরামত ও সরঞ্জাম ক্রয়';
  }
  if (/(বিদ্যুৎ|কারেন্ট|পল্লী বিদ্যুৎ|electric|ব্যান্ডউইথ|bandwidth|ইলেকট্রিক|ইন্টারনেট বিল|বিল|bill)/i.test(title)) {
    return 'বিদ্যুৎ ও ইন্টারনেট বিল';
  }
  if (/(চা|নাস্তা|আপ্যায়ন|খাবার|বিরিয়ানি|হোটেল|লাঞ্চ|ডিনার|পানি|snack|tea)/i.test(title)) {
    return 'আপ্যায়ন ও নাস্তা খরচ';
  }
  if (/(গাড়ি|ভাড়া|যাতায়াত|তেল|পেট্রোল|অটো|রিকশা|মোটরসাইকেল|ডেলিভারি|বাইক|সিএনজি)/i.test(title)) {
    return 'যাতায়াত ও ডেলিভারি খরচ';
  }
  if (/(অফিস ভাড়া|দোকান ভাড়া|রুম ভাড়া|বাসা ভাড়া|গ্যাস|পানি বিল|ইউটিলিটি|rent)/i.test(title)) {
    return 'অফিস ভাড়া ও ইউটিলিটি';
  }
  if (/(রাউটার|অনু|onu|olt|সুইচ|adapter|এডাপ্টার|যন্ত্র|পার্টস|হার্ডওয়্যার|পিসি|কম্পিউটার)/i.test(title)) {
    return 'যন্ত্রপাতি ও হার্ডওয়্যার পার্টস';
  }
  if (/(পাইকারি|কাঁচামাল|মালামাল|ক্রয়|কেনা|purchase)/i.test(title)) {
    return 'পাইকারি পণ্য / কাঁচামাল ক্রয়';
  }
  if (/(প্রচার|ব্যানার|পোস্টার|লিফলেট|মার্কেটিং|বিজ্ঞাপন|মাইকিং|marketing|ads)/i.test(title)) {
    return 'প্রচার ও মার্কেটিং';
  }

  return null;
}
