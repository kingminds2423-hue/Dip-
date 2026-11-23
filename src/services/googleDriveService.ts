import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import { auth } from '../firebase';
import { BackupData, Transaction } from '../types';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/tasks.readonly'
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account'
});

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token strictly in memory (never localStorage/sessionStorage).
let cachedAccessToken: string | null = null;
let cachedGoogleEmail: string | null = null;

// Initialize auth state listener
export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && !user.isAnonymous) {
      cachedGoogleEmail = user.email || cachedGoogleEmail;
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export function formatGoogleDriveAuthError(error: any): string {
  const code = String(error?.code || '').toLowerCase();
  const msg = String(error?.message || '').toLowerCase();

  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) {
    return 'Google লগইন উইন্ডোটি সম্পন্ন হওয়ার আগেই বন্ধ হয়ে গেছে। আবার চেষ্টা করুন।';
  }
  if (code.includes('unauthorized-domain')) {
    return 'বর্তমান ডোমেইনটি Firebase Authentication > Settings > Authorized domains-এ অনুমোদিত নয়।';
  }
  if (msg.includes('access_denied') || code.includes('access_denied') || msg.includes('403')) {
    return 'Google OAuth যাচাইকরণ (Error 403: access_denied) ব্লক করেছে। Google Cloud Console > Audience-এ আপনার Gmail Test users-এ যুক্ত করুন অথবা লোকাল ব্যাকআপ ডাউনলোড ব্যবহার করুন।';
  }
  return 'Google Drive / Gmail সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে আবার "Sign in with Google" বাটনে ক্লিক করুন।';
}

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('গুগল ড্রাইভ/জিমেইল অ্যাক্সেস টোকেন পাওয়া যায়নি');
    }

    cachedAccessToken = credential.accessToken;
    cachedGoogleEmail = result.user.email || cachedGoogleEmail;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const getConnectedGoogleEmail = (): string | null => {
  return cachedGoogleEmail || (auth.currentUser && !auth.currentUser.isAnonymous ? auth.currentUser.email : null);
};

export const googleLogout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  cachedGoogleEmail = null;
};

/* ═══════════════════════════════════════════════════════════════ */
/* AUTO BACKUP SETTINGS (Non-secret preferences persisted locally) */
/* ═══════════════════════════════════════════════════════════════ */

export interface AutoBackupSettings {
  autoDriveEnabled: boolean;
  autoGmailEnabled: boolean;
  autoMonthlyA4Enabled: boolean;
  targetGmail: string;
  connectedEmail: string;
  lastDriveBackupAt?: string;
  lastGmailSentAt?: string;
  lastBackupDate?: string;
  lastBackupMonth?: string;
  lastAutoPrevMonthSent?: string;
  lastPrevMonthPdfDriveLink?: string;
  lastBackupTxCount?: number;
}

const AUTO_BACKUP_STORAGE_KEY = 'dip_bhola_auto_backup_settings_v2';

export function getPreviousMonthKey(refDate = new Date()): string {
  const year = refDate.getFullYear();
  const monthIdx = refDate.getMonth(); // 0 = Jan .. 11 = Dec
  if (monthIdx === 0) {
    return `${year - 1}-12`;
  }
  const prevM = String(monthIdx).padStart(2, '0');
  return `${year}-${prevM}`;
}

export function loadAutoBackupSettings(defaultEmail = 'zahidulislam53330@gmail.com'): AutoBackupSettings {
  try {
    const raw = localStorage.getItem(AUTO_BACKUP_STORAGE_KEY);
    const legacyMonthly = localStorage.getItem('dip_bhola_auto_drive_a4');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        autoDriveEnabled: parsed.autoDriveEnabled !== false,
        autoGmailEnabled: parsed.autoGmailEnabled !== false,
        autoMonthlyA4Enabled: parsed.autoMonthlyA4Enabled !== false,
        targetGmail: typeof parsed.targetGmail === 'string' && parsed.targetGmail.trim() ? parsed.targetGmail.trim() : defaultEmail,
        connectedEmail: typeof parsed.connectedEmail === 'string' ? parsed.connectedEmail : '',
        lastDriveBackupAt: parsed.lastDriveBackupAt,
        lastGmailSentAt: parsed.lastGmailSentAt,
        lastBackupDate: parsed.lastBackupDate,
        lastBackupMonth: parsed.lastBackupMonth,
        lastAutoPrevMonthSent: parsed.lastAutoPrevMonthSent,
        lastPrevMonthPdfDriveLink: parsed.lastPrevMonthPdfDriveLink,
        lastBackupTxCount: typeof parsed.lastBackupTxCount === 'number' ? parsed.lastBackupTxCount : undefined
      };
    }
    return {
      autoDriveEnabled: true,
      autoGmailEnabled: true,
      autoMonthlyA4Enabled: legacyMonthly !== 'false',
      targetGmail: defaultEmail,
      connectedEmail: ''
    };
  } catch {
    return {
      autoDriveEnabled: true,
      autoGmailEnabled: true,
      autoMonthlyA4Enabled: true,
      targetGmail: defaultEmail,
      connectedEmail: ''
    };
  }
}

export function saveAutoBackupSettings(settings: AutoBackupSettings): AutoBackupSettings {
  try {
    localStorage.setItem(AUTO_BACKUP_STORAGE_KEY, JSON.stringify(settings));
    localStorage.setItem('dip_bhola_auto_drive_a4', settings.autoMonthlyA4Enabled ? 'true' : 'false');
  } catch {
    // ignore storage errors
  }
  return settings;
}

// Google Drive API Helpers
const BACKUP_FOLDER_NAME = 'DIP BHOLA NETWORK - ক্লাউড হিসাব ব্যাকআপ';

// Get or Create dedicated Google Drive folder
export async function getOrCreateDriveFolder(accessToken: string): Promise<string> {
  const query = `name = '${BACKUP_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!searchRes.ok) {
    throw new Error('গুগল ড্রাইভ ফোল্ডার সার্চে ব্যর্থ হয়েছে (লগইন টোকেন নবায়ন করুন)');
  }

  const data = await searchRes.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'DIP BHOLA NETWORK স্বয়ংক্রিয় ক্লাউড ব্যাকআপ ও মাসিক A4 আর্থিক বিবরণী ফোল্ডার'
    })
  });

  if (!createRes.ok) {
    throw new Error('গুগল ড্রাইভে নতুন ফোল্ডার তৈরিতে ব্যর্থ হয়েছে');
  }

  const newFolder = await createRes.json();
  return newFolder.id;
}

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  webViewLink?: string;
}

// Multipart file upload to Google Drive (supports both text strings and binary Blobs like PDF)
async function uploadMultipartFile(
  accessToken: string,
  metadata: { name: string; mimeType: string; parents?: string[]; description?: string },
  content: string | Blob,
  contentType: string
): Promise<DriveFileInfo> {
  const boundary = '-------314159265358979323846';
  const preamble =
    `\r\n--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`;
  const epilogue = `\r\n--${boundary}--`;

  const bodyBlob = new Blob([preamble, content, epilogue]);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: bodyBlob
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error('Drive upload failed:', errText);
    throw new Error(`গুগল ড্রাইভে ফাইল আপলোড ব্যর্থ: ${res.statusText}`);
  }

  return await res.json();
}

// 1. Upload Full Database Backup JSON to Google Drive
export async function uploadFullBackupToDrive(
  accessToken: string,
  backupData: BackupData
): Promise<DriveFileInfo> {
  const folderId = await getOrCreateDriveFolder(accessToken);
  const todayStr = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
  const fileName = `dip_bhola_full_backup_${todayStr}_${timeStr}.json`;
  const jsonContent = JSON.stringify(backupData, null, 2);

  return await uploadMultipartFile(
    accessToken,
    {
      name: fileName,
      mimeType: 'application/json',
      parents: [folderId],
      description: `DIP BHOLA NETWORK পূর্ণাঙ্গ হিসাব খাতা ব্যাকআপ (${todayStr})`
    },
    jsonContent,
    'application/json'
  );
}

// 2. Upload Monthly A4 Financial Statement (HTML/Print-Ready) to Google Drive
export async function uploadMonthlyA4StatementToDrive(
  accessToken: string,
  htmlContent: string,
  monthStr: string,
  companyName: string
): Promise<DriveFileInfo> {
  const folderId = await getOrCreateDriveFolder(accessToken);
  const fileName = `mashik_a4_statement_${monthStr}_${companyName.replace(/\s+/g, '_')}.html`;

  return await uploadMultipartFile(
    accessToken,
    {
      name: fileName,
      mimeType: 'text/html',
      parents: [folderId],
      description: `DIP BHOLA NETWORK মাসিক A4 সাইজ আর্থিক বিবরণী প্রতিবেদন (${monthStr})`
    },
    htmlContent,
    'text/html; charset=UTF-8'
  );
}

// 2B. Upload Monthly A4 PDF Statement (.pdf) directly to Google Drive (viewable & printable anywhere)
export async function uploadPdfBlobToDrive(
  accessToken: string,
  pdfBlob: Blob,
  fileName: string,
  monthStr: string
): Promise<DriveFileInfo> {
  const folderId = await getOrCreateDriveFolder(accessToken);
  const cleanName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;

  return await uploadMultipartFile(
    accessToken,
    {
      name: cleanName,
      mimeType: 'application/pdf',
      parents: [folderId],
      description: `DIP BHOLA NETWORK মাসিক A4 PDF প্রতিবেদন (${monthStr})`
    },
    pdfBlob,
    'application/pdf'
  );
}

// 3. Upload Monthly CSV Ledger to Google Drive
export async function uploadCsvStatementToDrive(
  accessToken: string,
  csvContent: string,
  monthStr: string
): Promise<DriveFileInfo> {
  const folderId = await getOrCreateDriveFolder(accessToken);
  const fileName = `mashik_ledger_${monthStr}.csv`;

  return await uploadMultipartFile(
    accessToken,
    {
      name: fileName,
      mimeType: 'text/csv',
      parents: [folderId],
      description: `DIP BHOLA NETWORK মাসিক লেনদেন লেজার CSV (${monthStr})`
    },
    csvContent,
    'text/csv; charset=UTF-8'
  );
}

// 4. List Files in Backup Folder
export async function listDriveBackups(accessToken: string): Promise<DriveFileInfo[]> {
  try {
    const folderId = await getOrCreateDriveFolder(accessToken);
    const query = `'${folderId}' in parents and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query
    )}&orderBy=modifiedTime desc&pageSize=15&fields=files(id,name,mimeType,size,modifiedTime,webViewLink)`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.error('Failed to list drive files:', err);
    return [];
  }
}

/* ═══════════════════════════════════════════════════════════════ */
/* GMAIL AUTO BACKUP DISPATCHER                                    */
/* ═══════════════════════════════════════════════════════════════ */

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function utf8ToBase64(str: string): string {
  return bytesToBase64(new TextEncoder().encode(str));
}

function utf8ToBase64Url(str: string): string {
  return utf8ToBase64(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeMimeHeaderUtf8(text: string): string {
  return `=?UTF-8?B?${utf8ToBase64(text)}?=`;
}

export function buildA4MonthlyBodyMarkup(params: {
  companyName: string;
  subTitle: string;
  address: string;
  phone: string;
  ownerName: string;
  targetMonth: string;
  transactions: Transaction[];
}): string {
  const { companyName, subTitle, address, phone, ownerName, targetMonth, transactions } = params;
  const todayStr = new Date().toISOString().split('T')[0];
  const monthTx = transactions.filter((t) => t.date && t.date.startsWith(targetMonth));
  const totalInc = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExp = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const net = totalInc - totalExp;

  return `
  <div style="font-family: 'Hind Siliguri', Arial, sans-serif; color: #0f172a; line-height: 1.45;">
    <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
      <div>
        <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #0f172a;">${companyName}</h1>
        <p style="margin: 3px 0; font-size: 11px; color: #334155;">${subTitle}</p>
        <p style="margin: 2px 0; font-size: 10px; color: #64748b;">ঠিকানা: ${address} | মোবাইল: ${phone}</p>
      </div>
      <div style="text-align: right; font-size: 10.5px; color: #1e293b; flex-shrink: 0;">
        <div style="font-weight: 800; font-size: 12.5px; color: #064e3b;">মাসিক আর্থিক বিবরণী (A4 PDF)</div>
        <div>হিসাবের মাস: <strong>${targetMonth}</strong></div>
        <div>প্রস্তুত তারিখ: ${todayStr}</div>
        <div>পরিচালক: ${ownerName}</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; border-radius: 8px;">
      <div style="background: #fff; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center;">
        <div style="font-size: 10px; color: #64748b; font-weight: bold;">মোট লেনদেন</div>
        <div style="font-size: 14px; font-weight: 800; margin-top: 3px; color: #0f172a;">${monthTx.length} টি</div>
      </div>
      <div style="background: #fff; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center;">
        <div style="font-size: 10px; color: #64748b; font-weight: bold;">মোট আয় (+)</div>
        <div style="font-size: 14px; font-weight: 800; margin-top: 3px; color: #059669;">৳ ${totalInc.toLocaleString()}</div>
      </div>
      <div style="background: #fff; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center;">
        <div style="font-size: 10px; color: #64748b; font-weight: bold;">মোট ব্যয় (-)</div>
        <div style="font-size: 14px; font-weight: 800; margin-top: 3px; color: #e11d48;">৳ ${totalExp.toLocaleString()}</div>
      </div>
      <div style="background: #fff; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center;">
        <div style="font-size: 10px; color: #64748b; font-weight: bold;">নিট ব্যালেন্স</div>
        <div style="font-size: 14px; font-weight: 800; margin-top: 3px; color: #0f172a;">৳ ${net.toLocaleString()}</div>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 10px; table-layout: auto;">
      <thead>
        <tr style="background: #f1f5f9;">
          <th style="padding: 7px 6px; border: 1px solid #cbd5e1; text-align: center; white-space: nowrap;">নং</th>
          <th style="padding: 7px 6px; border: 1px solid #cbd5e1; text-align: left; white-space: nowrap;">তারিখ</th>
          <th style="padding: 7px 6px; border: 1px solid #cbd5e1; text-align: center; white-space: nowrap;">ধরন</th>
          <th style="padding: 7px 6px; border: 1px solid #cbd5e1; text-align: left;">খাত / বিবরণ</th>
          <th style="padding: 7px 6px; border: 1px solid #cbd5e1; text-align: left; white-space: nowrap;">ক্যাটাগরি</th>
          <th style="padding: 7px 6px; border: 1px solid #cbd5e1; text-align: right; white-space: nowrap;">পরিমাণ</th>
          <th style="padding: 7px 6px; border: 1px solid #cbd5e1; text-align: left; white-space: nowrap;">পেমেন্ট</th>
          <th style="padding: 7px 6px; border: 1px solid #cbd5e1; text-align: left; white-space: nowrap;">এন্ট্রিদাতা</th>
        </tr>
      </thead>
      <tbody>
        ${
          monthTx.length === 0
            ? `<tr><td colspan="8" style="padding: 16px; text-align: center; border: 1px solid #e2e8f0; color: #64748b;">এই মাসে (${targetMonth}) কোনো লেনদেন পাওয়া যায়নি।</td></tr>`
            : monthTx
                .map(
                  (t, idx) => `
          <tr style="page-break-inside: avoid;">
            <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: center; white-space: nowrap; vertical-align: top;">${idx + 1}</td>
            <td style="padding: 6px; border: 1px solid #e2e8f0; white-space: nowrap; vertical-align: top;">${t.date}</td>
            <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: center; white-space: nowrap; font-weight: bold; vertical-align: top; color: ${t.type === 'income' ? '#059669' : '#e11d48'};">${t.type === 'income' ? 'আয়' : 'ব্যয়'}</td>
            <td style="padding: 6px; border: 1px solid #e2e8f0; vertical-align: top; word-break: break-word;">${t.title}${t.note ? `<div style="font-size:9px;color:#64748b;">(${t.note})</div>` : ''}</td>
            <td style="padding: 6px; border: 1px solid #e2e8f0; vertical-align: top; word-break: break-word;">${t.category}</td>
            <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold; white-space: nowrap; vertical-align: top;">৳ ${t.amount.toLocaleString()}</td>
            <td style="padding: 6px; border: 1px solid #e2e8f0; white-space: nowrap; vertical-align: top;">${t.paymentMethod === 'bkash' ? 'বিকাশ' : t.paymentMethod === 'nagad' ? 'নগদ' : t.paymentMethod === 'bank' ? 'ব্যাংক' : 'ক্যাশ'}</td>
            <td style="padding: 6px; border: 1px solid #e2e8f0; vertical-align: top; word-break: break-word;">${t.addedBy}</td>
          </tr>
        `
                )
                .join('')
        }
      </tbody>
    </table>

    <div style="margin-top: 42px; display: flex; justify-content: space-between; text-align: center; page-break-inside: avoid;">
      <div style="width: 165px; border-top: 1px solid #000; padding-top: 5px; font-weight: bold; font-size: 10px;">শাখা / জেনারেল ম্যানেজার</div>
      <div style="width: 165px; border-top: 1px solid #000; padding-top: 5px; font-weight: bold; font-size: 10px;">হিসাব নিরীক্ষক (অডিট)</div>
      <div style="width: 165px; border-top: 1px solid #000; padding-top: 5px; font-weight: bold; font-size: 10px;">প্রধান পরিচালক (${ownerName})</div>
    </div>
  </div>`;
}

export function buildA4MonthlyHtmlDocument(params: {
  companyName: string;
  subTitle: string;
  address: string;
  phone: string;
  ownerName: string;
  targetMonth: string;
  transactions: Transaction[];
}): string {
  const inner = buildA4MonthlyBodyMarkup(params);
  return `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <title>${params.companyName} - মাসিক আর্থিক বিবরণী (${params.targetMonth})</title>
  <style>
    body { margin: 22px; background: #fff; }
    @media print { @page { size: A4 portrait; margin: 10mm; } body { margin: 0; } }
  </style>
</head>
<body>${inner}</body>
</html>`;
}

export async function sendBackupEmailViaGmail(params: {
  accessToken: string;
  toEmail: string;
  companyName: string;
  backupData: BackupData;
  reportMonth?: string;
  driveFileLink?: string;
  drivePdfLink?: string;
  pdfAttachment?: { fileName: string; blob: Blob };
}): Promise<{ id: string }> {
  const {
    accessToken,
    toEmail,
    companyName,
    backupData,
    reportMonth,
    driveFileLink,
    drivePdfLink,
    pdfAttachment
  } = params;
  const cleanRecipient = toEmail.trim();
  if (!cleanRecipient || !cleanRecipient.includes('@')) {
    throw new Error('সঠিক প্রাপক Gmail ঠিকানা দিন।');
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const targetMonth = reportMonth || todayStr.substring(0, 7);
  const allTx = backupData.transactions || [];
  const monthTx = reportMonth
    ? allTx.filter((t) => t.date && t.date.startsWith(targetMonth))
    : allTx;

  const totalInc = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExp = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const net = totalInc - totalExp;

  const subject = reportMonth
    ? `${companyName} — মাসিক PDF রিপোর্ট ও ব্যাকআপ (${targetMonth})`
    : `${companyName} — অটো হিসাব ব্যাকআপ (${todayStr})`;
  const jsonAttachmentName = `dip_bhola_backup_${todayStr}.json`;
  const jsonBase64 = utf8ToBase64(JSON.stringify(backupData, null, 2));

  let pdfPart = '';
  if (pdfAttachment) {
    const pdfBytes = new Uint8Array(await pdfAttachment.blob.arrayBuffer());
    const pdfBase64 = bytesToBase64(pdfBytes);
    const pdfName = pdfAttachment.fileName.endsWith('.pdf')
      ? pdfAttachment.fileName
      : `${pdfAttachment.fileName}.pdf`;
    pdfPart = [
      `--dip_bhola_mime_boundary`,
      `Content-Type: application/pdf; name="${pdfName}"`,
      `Content-Disposition: attachment; filename="${pdfName}"`,
      'Content-Transfer-Encoding: base64',
      '',
      pdfBase64,
      ''
    ].join('\r\n');
  }

  const htmlBody = `
    <div style="font-family:'Hind Siliguri',Arial,sans-serif;max-width:640px;margin:0 auto;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;color:#0f172a;">
      <div style="background:#064e3b;color:#fff;padding:18px 22px;">
        <h2 style="margin:0;font-size:18px;">${companyName} — মাসিক PDF ও ক্লাউড ব্যাকআপ</h2>
        <p style="margin:4px 0 0;font-size:12px;color:#a7f3d0;">রিপোর্টের মাস: ${targetMonth} | প্রস্তুত: ${todayStr}</p>
      </div>
      <div style="padding:18px 22px;background:#ffffff;">
        <p style="margin:0 0 12px;font-size:13px;">
          ${reportMonth ? `<strong>${targetMonth}</strong> মাসের পূর্ণাঙ্গ A4 PDF রিপোর্ট` : 'সর্বশেষ হিসাব খাতার সম্পূর্ণ ব্যাকআপ'} ও ডেটাবেস JSON ফাইল নিচে সংযুক্ত করা হয়েছে। যেকোনো ডিভাইস থেকে PDF ফাইলটি সরাসরি ওপেন করে দেখতে ও প্রিন্ট করতে পারবেন:
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:14px;">
          <tr>
            <td style="padding:8px;border:1px solid #e2e8f0;background:#f8fafc;">রিপোর্টের লেনদেন (${targetMonth})</td>
            <td style="padding:8px;border:1px solid #e2e8f0;font-weight:bold;">${monthTx.length} টি (মোট সংরক্ষিত: ${allTx.length} টি)</td>
          </tr>
          <tr>
            <td style="padding:8px;border:1px solid #e2e8f0;background:#f8fafc;">আয় / জমা (+)</td>
            <td style="padding:8px;border:1px solid #e2e8f0;font-weight:bold;color:#047857;">৳ ${totalInc.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding:8px;border:1px solid #e2e8f0;background:#f8fafc;">ব্যয় / খরচ (-)</td>
            <td style="padding:8px;border:1px solid #e2e8f0;font-weight:bold;color:#be123c;">৳ ${totalExp.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding:8px;border:1px solid #e2e8f0;background:#f8fafc;">নিট ব্যালেন্স</td>
            <td style="padding:8px;border:1px solid #e2e8f0;font-weight:bold;">৳ ${net.toLocaleString()}</td>
          </tr>
        </table>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0;">
          ${
            drivePdfLink
              ? `<a href="${drivePdfLink}" style="display:inline-block;padding:10px 16px;background:#047857;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:13px;margin-right:8px;">Google Drive-এ PDF দেখুন ও প্রিন্ট করুন</a>`
              : ''
          }
          ${
            driveFileLink
              ? `<a href="${driveFileLink}" style="display:inline-block;padding:10px 16px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:13px;">Drive JSON ব্যাকআপ</a>`
              : ''
          }
        </div>
        <p style="margin:12px 0 0;font-size:11px;color:#64748b;">
          সংযুক্ত ফাইলসমূহ: ${pdfAttachment ? `<strong>${pdfAttachment.fileName}</strong> (A4 প্রিন্ট উপযোগী PDF) এবং ` : ''}<strong>${jsonAttachmentName}</strong> (রিস্টোর ব্যাকআপ)।
        </p>
      </div>
    </div>
  `;

  const boundary = 'dip_bhola_mime_boundary';
  const rawMimeParts = [
    `To: ${cleanRecipient}`,
    `Subject: ${encodeMimeHeaderUtf8(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    utf8ToBase64(htmlBody),
    ''
  ];

  if (pdfPart) {
    rawMimeParts.push(pdfPart.trimEnd());
  }

  rawMimeParts.push(
    `--${boundary}`,
    `Content-Type: application/json; name="${jsonAttachmentName}"`,
    `Content-Disposition: attachment; filename="${jsonAttachmentName}"`,
    'Content-Transfer-Encoding: base64',
    '',
    jsonBase64,
    '',
    `--${boundary}--`
  );

  const rawMime = rawMimeParts.join('\r\n');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      raw: utf8ToBase64Url(rawMime)
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('Gmail send failed:', errText);
    throw new Error(`Gmail-এ ব্যাকআপ পাঠানো ব্যর্থ হয়েছে (${res.status})। পুনরায় Sign in with Google করুন।`);
  }

  return await res.json();
}

/* ═══════════════════════════════════════════════════════════════ */
/* GOOGLE PICKER API (CLIENT-SIDE ONLY, NO DEVELOPER KEY)          */
/* ═══════════════════════════════════════════════════════════════ */

export interface PickedDriveFile {
  id: string;
  name: string;
  mimeType: string;
  url?: string;
  sizeBytes?: number;
  iconUrl?: string;
}

declare global {
  interface Window {
    gapi?: {
      load: (api: string, options: { callback: () => void; onerror?: (err: unknown) => void }) => void;
    };
    google?: {
      picker?: {
        PickerBuilder: new () => {
          addView: (view: unknown) => any;
          setOAuthToken: (token: string) => any;
          setCallback: (cb: (data: any) => void) => any;
          setOrigin: (origin: string) => any;
          build: () => { setVisible: (visible: boolean) => void };
        };
        ViewId: {
          DOCS: unknown;
        };
        Action: {
          PICKED: string;
          CANCEL: string;
        };
      };
    };
  }
}

let gapiPickerReadyPromise: Promise<void> | null = null;

function loadGooglePickerApi(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Picker শুধুমাত্র ব্রাউজারে চলে।'));
  }
  if (window.google?.picker?.PickerBuilder) {
    return Promise.resolve();
  }
  if (gapiPickerReadyPromise) {
    return gapiPickerReadyPromise;
  }

  gapiPickerReadyPromise = new Promise<void>((resolve, reject) => {
    const initPicker = () => {
      if (!window.gapi?.load) {
        gapiPickerReadyPromise = null;
        reject(new Error('Google API লোডার পাওয়া যায়নি।'));
        return;
      }
      window.gapi.load('picker', {
        callback: () => resolve(),
        onerror: (err: unknown) => {
          gapiPickerReadyPromise = null;
          reject(err instanceof Error ? err : new Error('Google Picker লোড করতে ব্যর্থ হয়েছে।'));
        }
      });
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src^="https://apis.google.com/js/api.js"]'
    );
    if (existingScript) {
      if (window.gapi?.load) {
        initPicker();
      } else {
        existingScript.addEventListener('load', initPicker, { once: true });
        existingScript.addEventListener(
          'error',
          () => {
            gapiPickerReadyPromise = null;
            reject(new Error('apis.google.com স্ক্রিপ্ট লোড করা যায়নি।'));
          },
          { once: true }
        );
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = initPicker;
    script.onerror = () => {
      gapiPickerReadyPromise = null;
      reject(new Error('apis.google.com/js/api.js লোড করতে ব্যর্থ হয়েছে।'));
    };
    document.head.appendChild(script);
  });

  return gapiPickerReadyPromise;
}

export async function openGoogleDrivePicker(accessToken: string): Promise<PickedDriveFile | null> {
  if (!accessToken) {
    throw new Error('Google অ্যাকাউন্টে Sign in করুন।');
  }

  await loadGooglePickerApi();

  const pickerNs = window.google?.picker;
  if (!pickerNs?.PickerBuilder) {
    throw new Error('Google Picker লাইব্রেরি প্রস্তুত নয়।');
  }

  const pickerOrigin =
    window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0
      ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
      : window.location.origin;

  return new Promise<PickedDriveFile | null>((resolve) => {
    const picker = new pickerNs.PickerBuilder()
      .addView(pickerNs.ViewId.DOCS)
      .setOAuthToken(accessToken)
      .setOrigin(pickerOrigin)
      .setCallback((data: any) => {
        if (data?.action === pickerNs.Action.PICKED && Array.isArray(data.docs) && data.docs[0]) {
          const doc = data.docs[0];
          resolve({
            id: String(doc.id || ''),
            name: String(doc.name || 'অজানা ফাইল'),
            mimeType: String(doc.mimeType || 'application/octet-stream'),
            url: typeof doc.url === 'string' ? doc.url : undefined,
            sizeBytes: typeof doc.sizeBytes === 'number' ? doc.sizeBytes : undefined,
            iconUrl: typeof doc.iconUrl === 'string' ? doc.iconUrl : undefined
          });
        } else if (data?.action === pickerNs.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();

    picker.setVisible(true);
  });
}

export async function fetchPickedDriveFileText(accessToken: string, fileId: string): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  if (!res.ok) {
    throw new Error(`Google Drive ফাইল পড়তে ব্যর্থ হয়েছে (${res.status})`);
  }
  return await res.text();
}

/* ═══════════════════════════════════════════════════════════════ */
/* GOOGLE TASKS API (CLIENT-SIDE OAUTH)                            */
/* ═══════════════════════════════════════════════════════════════ */

export interface GoogleTaskList {
  id: string;
  title: string;
  updated?: string;
}

export interface GoogleTaskItem {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  status: 'needsAction' | 'completed';
  completed?: string;
  updated?: string;
  webViewLink?: string;
}

export async function listGoogleTaskLists(accessToken: string): Promise<GoogleTaskList[]> {
  const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    throw new Error(`Google Tasks তালিকা লোড করতে ব্যর্থ (${res.status})। পুনরায় Sign in with Google করুন।`);
  }
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

export async function listGoogleTasks(
  accessToken: string,
  taskListId = '@default'
): Promise<GoogleTaskItem[]> {
  const res = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(
      taskListId
    )}/tasks?showCompleted=true&showHidden=false&maxResults=40`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  if (!res.ok) {
    throw new Error(`Google Tasks আইটেম লোড করতে ব্যর্থ (${res.status})।`);
  }
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

export async function createGoogleTask(
  accessToken: string,
  taskListId = '@default',
  payload: { title: string; notes?: string; due?: string }
): Promise<GoogleTaskItem> {
  const res = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: payload.title.trim(),
        ...(payload.notes?.trim() ? { notes: payload.notes.trim() } : {}),
        ...(payload.due ? { due: payload.due } : {})
      })
    }
  );
  if (!res.ok) {
    throw new Error(`Google Task তৈরি করতে ব্যর্থ হয়েছে (${res.status})।`);
  }
  return await res.json();
}

export async function updateGoogleTaskStatus(
  accessToken: string,
  taskListId: string,
  taskId: string,
  status: 'needsAction' | 'completed'
): Promise<GoogleTaskItem> {
  const res = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(
      taskId
    )}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status,
        completed: status === 'completed' ? new Date().toISOString() : null
      })
    }
  );
  if (!res.ok) {
    throw new Error(`Google Task স্ট্যাটাস আপডেট ব্যর্থ হয়েছে (${res.status})।`);
  }
  return await res.json();
}

export async function deleteGoogleTask(
  accessToken: string,
  taskListId: string,
  taskId: string
): Promise<void> {
  const res = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(
      taskId
    )}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  if (!res.ok) {
    throw new Error(`Google Task মুছতে ব্যর্থ হয়েছে (${res.status})।`);
  }
}

