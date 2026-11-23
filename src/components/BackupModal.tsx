import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Cloud,
  FileSpreadsheet,
  ExternalLink,
  Check,
  LogOut,
  Mail,
  Send,
  ShieldCheck,
  Clock,
  FileText,
  Printer,
  Eye,
  Share2,
  Calendar,
  FolderOpen,
  ListTodo,
  Plus,
  Trash2,
  Square,
  CheckSquare
} from 'lucide-react';
import {
  Company,
  Partner,
  Staff,
  Transaction,
  CustomerDue,
  AdminAuth
} from '../types';
import { DEFAULT_TROUBLESHOOT_PORTAL_URL } from '../utils/appUrls';
import {
  generateBackupJson,
  seedInitialDataIfEmpty,
  generateCsvData
} from '../services/dataService';
import {
  initGoogleAuth,
  googleSignIn,
  googleLogout,
  getAccessToken,
  getConnectedGoogleEmail,
  uploadFullBackupToDrive,
  uploadMonthlyA4StatementToDrive,
  uploadPdfBlobToDrive,
  uploadCsvStatementToDrive,
  listDriveBackups,
  sendBackupEmailViaGmail,
  buildA4MonthlyBodyMarkup,
  buildA4MonthlyHtmlDocument,
  formatGoogleDriveAuthError,
  loadAutoBackupSettings,
  saveAutoBackupSettings,
  getPreviousMonthKey,
  openGoogleDrivePicker,
  fetchPickedDriveFileText,
  listGoogleTaskLists,
  listGoogleTasks,
  createGoogleTask,
  updateGoogleTaskStatus,
  deleteGoogleTask,
  AutoBackupSettings,
  DriveFileInfo,
  PickedDriveFile,
  GoogleTaskList,
  GoogleTaskItem
} from '../services/googleDriveService';
import {
  generatePdfFromHtmlMarkup,
  triggerPdfDownload,
  sharePdfFileNatively,
  applyDynamicPrintPageRule,
  GeneratedPdfResult
} from '../services/pdfPrintService';
import { toBengaliNumber } from '../utils/formatters';
import { User } from 'firebase/auth';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company | null;
  partners: Partner[];
  staffs: Staff[];
  transactions: Transaction[];
  customerDues: CustomerDue[];
  adminAuth: AdminAuth | null;
  onRefreshData: () => Promise<void>;
  onAutoSettingsUpdated?: (settings: AutoBackupSettings) => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  company,
  partners,
  staffs,
  transactions,
  customerDues,
  adminAuth,
  onRefreshData,
  onAutoSettingsUpdated
}) => {
  const defaultEmail = company?.email || 'zahidulislam53330@gmail.com';
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Google Drive & Gmail Auth state
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [driveToken, setDriveToken] = useState<string | null>(() => getAccessToken());
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFileInfo[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Google Picker state
  const [isOpeningPicker, setIsOpeningPicker] = useState(false);
  const [pickedDriveFile, setPickedDriveFile] = useState<PickedDriveFile | null>(null);

  // Google Tasks state
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [selectedTaskListId, setSelectedTaskListId] = useState<string>('@default');
  const [googleTasks, setGoogleTasks] = useState<GoogleTaskItem[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [pendingTaskAction, setPendingTaskAction] = useState<
    | { type: 'create'; title: string; notes: string }
    | { type: 'toggle'; task: GoogleTaskItem; nextStatus: 'needsAction' | 'completed' }
    | { type: 'delete'; task: GoogleTaskItem }
    | null
  >(null);

  // Auto Backup (Drive + Gmail) settings
  const [autoSettings, setAutoSettings] = useState<AutoBackupSettings>(() =>
    loadAutoBackupSettings(defaultEmail)
  );

  // Explicit Confirmation state (never use window.confirm)
  const [pendingConfirm, setPendingConfirm] = useState<'gmail_backup' | 'prev_month_pdf' | 'restore_seed' | null>(null);

  // Built-in PDF Viewer & Print Overlay state
  const [previewPdf, setPreviewPdf] = useState<{
    result: GeneratedPdfResult;
    monthKey: string;
    htmlMarkup: string;
    driveViewLink?: string;
  } | null>(null);
  const [isPrintingPdf, setIsPrintingPdf] = useState(false);

  const previousMonthKey = getPreviousMonthKey();

  useEffect(() => {
    return () => {
      if (previewPdf?.result.blobUrl) {
        URL.revokeObjectURL(previewPdf.result.blobUrl);
      }
    };
  }, [previewPdf]);

  useEffect(() => {
    if (!isOpen) return;
    setAutoSettings(loadAutoBackupSettings(defaultEmail));
    const currentTok = getAccessToken();
    if (currentTok) {
      setDriveToken(currentTok);
      fetchDriveFiles(currentTok);
      fetchGoogleTasksData(currentTok, '@default');
    }

    const unsub = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setDriveToken(token);
        fetchDriveFiles(token);
        fetchGoogleTasksData(token, selectedTaskListId);
      },
      () => {
        setGoogleUser(null);
        setDriveToken(null);
        setDriveFiles([]);
        setTaskLists([]);
        setGoogleTasks([]);
      }
    );

    return () => unsub();
  }, [isOpen, defaultEmail]);

  const fetchDriveFiles = async (token: string) => {
    setIsLoadingFiles(true);
    try {
      const files = await listDriveBackups(token);
      setDriveFiles(files);
    } catch (e) {
      console.warn('Failed to load drive files:', e);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const fetchGoogleTasksData = async (token: string, listId = selectedTaskListId) => {
    setIsLoadingTasks(true);
    try {
      const lists = await listGoogleTaskLists(token);
      setTaskLists(lists);
      const effectiveListId = lists.some((l) => l.id === listId)
        ? listId
        : lists[0]?.id || '@default';
      setSelectedTaskListId(effectiveListId);
      const items = await listGoogleTasks(token, effectiveListId);
      setGoogleTasks(items);
    } catch (e) {
      console.warn('Failed to load Google Tasks:', e);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const handleOpenGooglePicker = async () => {
    let token = driveToken;
    if (!token) {
      await handleGoogleDriveConnect();
      token = getAccessToken();
      if (!token) return;
    }
    setIsOpeningPicker(true);
    setStatusMessage(null);
    try {
      const picked = await openGoogleDrivePicker(token);
      if (picked) {
        setPickedDriveFile(picked);
        setStatusMessage({
          type: 'success',
          text: `Google Picker দিয়ে ফাইল নির্বাচিত হয়েছে: ${picked.name}`
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Google Picker চালু করতে সমস্যা হয়েছে। পুনরায় Sign in with Google করুন।'
      });
    } finally {
      setIsOpeningPicker(false);
    }
  };

  const handleDownloadPickedFile = async () => {
    if (!pickedDriveFile || !driveToken) return;
    try {
      setIsProcessing(true);
      const content = await fetchPickedDriveFileText(driveToken, pickedDriveFile.id);
      const blob = new Blob([content], { type: pickedDriveFile.mimeType || 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pickedDriveFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Google Drive ফাইল ডাউনলোড করতে সমস্যা হয়েছে।'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const executeConfirmedTaskAction = async () => {
    if (!pendingTaskAction || !driveToken) return;
    try {
      setIsLoadingTasks(true);
      setStatusMessage(null);
      if (pendingTaskAction.type === 'create') {
        await createGoogleTask(driveToken, selectedTaskListId, {
          title: pendingTaskAction.title,
          notes: pendingTaskAction.notes
        });
        setNewTaskTitle('');
        setNewTaskNotes('');
        setStatusMessage({ type: 'success', text: `Google Tasks-এ নতুন কাজ যুক্ত হয়েছে: ${pendingTaskAction.title}` });
      } else if (pendingTaskAction.type === 'toggle') {
        await updateGoogleTaskStatus(
          driveToken,
          selectedTaskListId,
          pendingTaskAction.task.id,
          pendingTaskAction.nextStatus
        );
        setStatusMessage({
          type: 'success',
          text:
            pendingTaskAction.nextStatus === 'completed'
              ? `টাস্ক সম্পন্ন হিসেবে চিহ্নিত: ${pendingTaskAction.task.title}`
              : `টাস্ক পুনরায় সচল করা হয়েছে: ${pendingTaskAction.task.title}`
        });
      } else if (pendingTaskAction.type === 'delete') {
        await deleteGoogleTask(driveToken, selectedTaskListId, pendingTaskAction.task.id);
        setStatusMessage({ type: 'success', text: `Google Task মুছে ফেলা হয়েছে: ${pendingTaskAction.task.title}` });
      }
      setPendingTaskAction(null);
      await fetchGoogleTasksData(driveToken, selectedTaskListId);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Google Tasks অপারেশনে সমস্যা হয়েছে।'
      });
    } finally {
      setIsLoadingTasks(false);
    }
  };

  if (!isOpen) return null;

  const companyName = company?.name || 'DIP BHOLA NETWORK';
  const ownerName = company?.ownerName || 'জাহিদুল ইসলাম';
  const rememberedEmail = googleUser?.email || getConnectedGoogleEmail() || autoSettings.connectedEmail;

  const persistAutoSettings = (next: AutoBackupSettings) => {
    const saved = saveAutoBackupSettings(next);
    setAutoSettings(saved);
    if (onAutoSettingsUpdated) onAutoSettingsUpdated(saved);
  };

  // Handle Google Drive + Gmail Sign-In
  const handleGoogleDriveConnect = async () => {
    setIsConnectingDrive(true);
    setStatusMessage(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setDriveToken(res.accessToken);
        const userEmail = res.user.email || autoSettings.targetGmail || defaultEmail;
        const nextSettings: AutoBackupSettings = {
          ...autoSettings,
          connectedEmail: userEmail,
          targetGmail: autoSettings.targetGmail || userEmail
        };
        persistAutoSettings(nextSettings);
        setStatusMessage({
          type: 'success',
          text: `Google Drive ও Gmail সফলভাবে সংযুক্ত হয়েছে (${userEmail}) — অটো ব্যাকআপ সক্রিয় রয়েছে!`
        });
        await fetchDriveFiles(res.accessToken);
      }
    } catch (err: any) {
      console.error('Google sign in failed:', err);
      setStatusMessage({
        type: 'error',
        text: formatGoogleDriveAuthError(err)
      });
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleGoogleDriveDisconnect = async () => {
    await googleLogout();
    setGoogleUser(null);
    setDriveToken(null);
    setDriveFiles([]);
    persistAutoSettings({
      ...autoSettings,
      connectedEmail: ''
    });
    setStatusMessage({ type: 'success', text: 'Google Drive ও Gmail সংযোগ বিচ্ছিন্ন করা হয়েছে।' });
  };

  const getFullBackupData = () => {
    return generateBackupJson(
      company || {
        name: 'DIP BHOLA NETWORK',
        subTitle: 'দৈনিক আয়-ব্যয় ও কেন্দ্রীয় স্টাফ মনিটরিং সিস্টেম',
        ownerName: 'জাহিদুল ইসলাম',
        phone: '01721200049',
        email: 'zahidulislam53330@gmail.com',
        address: '৩নং পশ্চিম ইলিশা।ভোলা সদর ভোলা',
        currencySymbol: '৳',
        troubleshootPortalUrl: DEFAULT_TROUBLESHOOT_PORTAL_URL
      },
      partners,
      adminAuth || { pin: '1234', phone: '01700000000' },
      staffs,
      transactions,
      customerDues
    );
  };

  // 1. Upload Full Database Backup JSON to Google Drive
  const handleUploadBackupToDrive = async () => {
    if (!driveToken) {
      await handleGoogleDriveConnect();
      return;
    }

    try {
      setIsProcessing(true);
      setStatusMessage(null);
      const backupData = getFullBackupData();
      const fileInfo = await uploadFullBackupToDrive(driveToken, backupData);
      const nowIso = new Date().toISOString();
      persistAutoSettings({
        ...autoSettings,
        lastDriveBackupAt: nowIso,
        lastBackupDate: nowIso.split('T')[0],
        lastBackupTxCount: transactions.length
      });
      setStatusMessage({
        type: 'success',
        text: `Google Drive-এ সম্পূর্ণ ব্যাকআপ সফলভাবে আপলোড হয়েছে! ফাইল: ${fileInfo.name}`
      });
      await fetchDriveFiles(driveToken);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Google Drive-এ ব্যাকআপ আপলোডে সমস্যা হয়েছে।'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Upload Monthly A4 Statement + CSV to Google Drive
  const handleUploadMonthlyA4ToDrive = async () => {
    if (!driveToken) {
      await handleGoogleDriveConnect();
      return;
    }

    try {
      setIsProcessing(true);
      setStatusMessage(null);
      const todayStr = new Date().toISOString().split('T')[0];
      const targetMonth = todayStr.substring(0, 7);
      const monthTx = transactions.filter((t) => t.date && t.date.startsWith(targetMonth));

      const a4Html = buildA4MonthlyHtmlDocument({
        companyName,
        subTitle: company?.subTitle || 'ডিজিটাল নেটওয়ার্ক ও ইন্টারনেট ব্রডব্যান্ড সেবা',
        address: company?.address || 'ভোলা সদর',
        phone: company?.phone || '০১৭২১২০০০৪৯',
        ownerName,
        targetMonth,
        transactions
      });

      await uploadMonthlyA4StatementToDrive(driveToken, a4Html, targetMonth, companyName);
      const csvData = generateCsvData(monthTx, companyName, targetMonth);
      await uploadCsvStatementToDrive(driveToken, csvData, targetMonth);

      persistAutoSettings({
        ...autoSettings,
        lastDriveBackupAt: new Date().toISOString(),
        lastBackupMonth: targetMonth
      });

      setStatusMessage({
        type: 'success',
        text: `চলতি মাস (${targetMonth}) এর A4 সাইজ আর্থিক বিবরণী ও CSV গুগল ড্রাইভে সংরক্ষিত হয়েছে!`
      });
      await fetchDriveFiles(driveToken);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'A4 স্টেটমেন্ট আপলোডে সমস্যা হয়েছে।'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 2B. View & Print Previous Month (or Selected Month) A4 PDF directly in app
  const handleViewAndPrintMonthlyPdf = async (targetMonth: string) => {
    try {
      setIsProcessing(true);
      setStatusMessage(null);
      const markup = buildA4MonthlyBodyMarkup({
        companyName,
        subTitle: company?.subTitle || 'দৈনিক আয়-ব্যয় ও কেন্দ্রীয় স্টাফ মনিটরিং সিস্টেম',
        address: company?.address || 'ভোলা সদর',
        phone: company?.phone || '01721200049',
        ownerName,
        targetMonth,
        transactions
      });
      const pdfResult = await generatePdfFromHtmlMarkup(
        markup,
        `dip_bhola_report_${targetMonth}.pdf`
      );
      setPreviewPdf({
        result: pdfResult,
        monthKey: targetMonth,
        htmlMarkup: markup,
        driveViewLink:
          targetMonth === previousMonthKey ? autoSettings.lastPrevMonthPdfDriveLink : undefined
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'PDF তৈরি করতে সমস্যা হয়েছে।'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintActivePreview = () => {
    if (!previewPdf) return;
    applyDynamicPrintPageRule('A4', 'portrait', 8);
    setIsPrintingPdf(true);
    document.body.classList.add('print-studio-active');
    const cleanup = () => {
      document.body.classList.remove('print-studio-active');
      setIsPrintingPdf(false);
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 3000);
    }, 120);
  };

  // 2C. Confirmed Previous-Month PDF Report + Full Backup Dispatch (Drive + Gmail)
  const executeConfirmedPrevMonthPdfDispatch = async () => {
    setPendingConfirm(null);
    let token = driveToken;
    if (!token) {
      try {
        setIsConnectingDrive(true);
        const res = await googleSignIn();
        if (!res) return;
        token = res.accessToken;
        setGoogleUser(res.user);
        setDriveToken(token);
      } catch (err: any) {
        setStatusMessage({ type: 'error', text: formatGoogleDriveAuthError(err) });
        return;
      } finally {
        setIsConnectingDrive(false);
      }
    }

    try {
      setIsProcessing(true);
      setStatusMessage(null);
      const backupData = getFullBackupData();
      const todayStr = new Date().toISOString().split('T')[0];

      const markup = buildA4MonthlyBodyMarkup({
        companyName,
        subTitle: company?.subTitle || 'দৈনিক আয়-ব্যয় ও কেন্দ্রীয় স্টাফ মনিটরিং সিস্টেম',
        address: company?.address || 'ভোলা সদর',
        phone: company?.phone || '01721200049',
        ownerName,
        targetMonth: previousMonthKey,
        transactions
      });

      const pdfResult = await generatePdfFromHtmlMarkup(
        markup,
        `dip_bhola_monthly_report_${previousMonthKey}.pdf`
      );

      const driveJsonFile = await uploadFullBackupToDrive(token, backupData);
      const drivePdfFile = await uploadPdfBlobToDrive(
        token,
        pdfResult.blob,
        pdfResult.fileName,
        previousMonthKey
      );
      const a4Html = buildA4MonthlyHtmlDocument({
        companyName,
        subTitle: company?.subTitle || 'দৈনিক আয়-ব্যয় ও কেন্দ্রীয় স্টাফ মনিটরিং সিস্টেম',
        address: company?.address || 'ভোলা সদর',
        phone: company?.phone || '01721200049',
        ownerName,
        targetMonth: previousMonthKey,
        transactions
      });
      await uploadMonthlyA4StatementToDrive(token, a4Html, previousMonthKey, companyName);
      const prevTx = transactions.filter((t) => t.date && t.date.startsWith(previousMonthKey));
      await uploadCsvStatementToDrive(
        token,
        generateCsvData(prevTx, companyName, previousMonthKey),
        previousMonthKey
      );

      const recipient = (autoSettings.targetGmail || rememberedEmail || defaultEmail).trim();
      await sendBackupEmailViaGmail({
        accessToken: token,
        toEmail: recipient,
        companyName,
        backupData,
        reportMonth: previousMonthKey,
        driveFileLink: driveJsonFile.webViewLink,
        drivePdfLink: drivePdfFile.webViewLink,
        pdfAttachment: { fileName: pdfResult.fileName, blob: pdfResult.blob }
      });

      const nowIso = new Date().toISOString();
      persistAutoSettings({
        ...autoSettings,
        targetGmail: recipient,
        lastDriveBackupAt: nowIso,
        lastGmailSentAt: nowIso,
        lastBackupDate: todayStr,
        lastBackupMonth: previousMonthKey,
        lastAutoPrevMonthSent: previousMonthKey,
        lastPrevMonthPdfDriveLink: drivePdfFile.webViewLink,
        lastBackupTxCount: transactions.length
      });

      setPreviewPdf({
        result: pdfResult,
        monthKey: previousMonthKey,
        htmlMarkup: markup,
        driveViewLink: drivePdfFile.webViewLink
      });

      setStatusMessage({
        type: 'success',
        text: `গত মাস (${previousMonthKey})-এর A4 PDF রিপোর্ট ও ব্যাকআপ Google Drive-এ সেভ এবং ${recipient} ঠিকানায় সফলভাবে পাঠানো হয়েছে!`
      });
      await fetchDriveFiles(token);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'গত মাসের PDF রিপোর্ট পাঠাতে সমস্যা হয়েছে।'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Confirmed Full Sync (Google Drive JSON + A4 PDF + Gmail Report Attachment)
  const executeConfirmedDriveAndGmailBackup = async () => {
    setPendingConfirm(null);
    let token = driveToken;
    if (!token) {
      try {
        setIsConnectingDrive(true);
        const res = await googleSignIn();
        if (!res) return;
        token = res.accessToken;
        setGoogleUser(res.user);
        setDriveToken(token);
      } catch (err: any) {
        setStatusMessage({ type: 'error', text: formatGoogleDriveAuthError(err) });
        return;
      } finally {
        setIsConnectingDrive(false);
      }
    }

    try {
      setIsProcessing(true);
      setStatusMessage(null);
      const backupData = getFullBackupData();
      const todayStr = new Date().toISOString().split('T')[0];
      const targetMonth = todayStr.substring(0, 7);

      const driveJsonFile = await uploadFullBackupToDrive(token, backupData);

      let drivePdfLink: string | undefined;
      let pdfAttachment: { fileName: string; blob: Blob } | undefined;

      if (autoSettings.autoMonthlyA4Enabled) {
        const markup = buildA4MonthlyBodyMarkup({
          companyName,
          subTitle: company?.subTitle || 'দৈনিক আয়-ব্যয় ও কেন্দ্রীয় স্টাফ মনিটরিং সিস্টেম',
          address: company?.address || 'ভোলা সদর',
          phone: company?.phone || '01721200049',
          ownerName,
          targetMonth,
          transactions
        });
        const pdfResult = await generatePdfFromHtmlMarkup(
          markup,
          `dip_bhola_monthly_report_${targetMonth}.pdf`
        );
        const drivePdfFile = await uploadPdfBlobToDrive(
          token,
          pdfResult.blob,
          pdfResult.fileName,
          targetMonth
        );
        drivePdfLink = drivePdfFile.webViewLink;
        pdfAttachment = { fileName: pdfResult.fileName, blob: pdfResult.blob };

        const a4Html = buildA4MonthlyHtmlDocument({
          companyName,
          subTitle: company?.subTitle || 'দৈনিক আয়-ব্যয় ও কেন্দ্রীয় স্টাফ মনিটরিং সিস্টেম',
          address: company?.address || 'ভোলা সদর',
          phone: company?.phone || '01721200049',
          ownerName,
          targetMonth,
          transactions
        });
        await uploadMonthlyA4StatementToDrive(token, a4Html, targetMonth, companyName);
      }

      const recipient = (autoSettings.targetGmail || rememberedEmail || defaultEmail).trim();
      await sendBackupEmailViaGmail({
        accessToken: token,
        toEmail: recipient,
        companyName,
        backupData,
        reportMonth: targetMonth,
        driveFileLink: driveJsonFile.webViewLink,
        drivePdfLink,
        pdfAttachment
      });

      const nowIso = new Date().toISOString();
      persistAutoSettings({
        ...autoSettings,
        targetGmail: recipient,
        lastDriveBackupAt: nowIso,
        lastGmailSentAt: nowIso,
        lastBackupDate: todayStr,
        lastBackupMonth: targetMonth,
        lastBackupTxCount: transactions.length
      });

      setStatusMessage({
        type: 'success',
        text: `Google Drive-এ PDF ও JSON ব্যাকআপ আপলোড এবং ${recipient} ঠিকানায় Gmail রিপোর্ট সফলভাবে পাঠানো হয়েছে!`
      });
      await fetchDriveFiles(token);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Drive ও Gmail ব্যাকআপে সমস্যা হয়েছে।'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Local JSON Download
  const handleDownloadBackup = () => {
    try {
      const backupData = getFullBackupData();
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `hisab_khata_full_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage({ type: 'success', text: 'সম্পূর্ণ ব্যাকআপ ফাইল সফলভাবে ডাউনলোড হয়েছে।' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'ব্যাকআপ ফাইল ডাউনলোডে সমস্যা হয়েছে।' });
    }
  };

  // Confirmed Restore Seed
  const executeConfirmedRestoreSeed = async () => {
    setPendingConfirm(null);
    try {
      setIsProcessing(true);
      setStatusMessage(null);
      await seedInitialDataIfEmpty(true);
      await onRefreshData();
      setStatusMessage({ type: 'success', text: 'ফায়ারবেসে ব্যাকআপ ডাটা সফলভাবে রিস্টোর হয়েছে!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'রিস্টোরে সমস্যা হয়েছে।' });
    } finally {
      setIsProcessing(false);
    }
  };

  const isTokenReady = Boolean(driveToken);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col my-auto">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Gmail ও Google Drive অটো ব্যাকআপ সিস্টেম</span>
              </h3>
              <p className="text-xs text-slate-400">
                স্বয়ংক্রিয় Google Drive ক্লাউড ব্যাকআপ, Gmail রিপোর্ট ও মাসিক A4 স্টেটমেন্ট
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1" aria-label="বন্ধ করুন">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {statusMessage && (
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 font-medium'
                  : 'bg-rose-50 text-rose-900 border border-rose-200 font-medium'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Explicit Confirmation Dialog Banner for Sending Gmail / Restoring */}
          {pendingConfirm === 'gmail_backup' && (
            <div className="p-4 rounded-2xl bg-indigo-50 border-2 border-indigo-400 space-y-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-extrabold text-indigo-950 text-sm">
                    নিশ্চিত করুন: Google Drive ও Gmail-এ PDF ও ব্যাকআপ পাঠানো হবে
                  </div>
                  <p className="text-xs text-indigo-900 leading-relaxed">
                    <strong>{toBengaliNumber(transactions.length)} টি</strong> লেনদেনসহ সম্পূর্ণ হিসাবের JSON ফাইল ও চলতি মাসের A4 PDF আপনার Google Drive-এ আপলোড করা হবে এবং{' '}
                    <strong>{autoSettings.targetGmail || rememberedEmail || defaultEmail}</strong> ইমেইলে PDF অ্যাটাচমেন্টসহ পাঠানো হবে।
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingConfirm(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
                >
                  বাতিল করুন
                </button>
                <button
                  type="button"
                  onClick={executeConfirmedDriveAndGmailBackup}
                  disabled={isProcessing}
                  className="px-4 py-1.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-black flex items-center gap-1.5 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>নিশ্চিত, এখনই পাঠান</span>
                </button>
              </div>
            </div>
          )}

          {pendingConfirm === 'prev_month_pdf' && (
            <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-400 space-y-3">
              <div className="flex items-start gap-2.5">
                <FileText className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-extrabold text-emerald-950 text-sm">
                    নিশ্চিত করুন: গত মাস ({previousMonthKey})-এর A4 PDF Drive ও Gmail-এ পাঠানো হবে
                  </div>
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    গত মাস <strong>{previousMonthKey}</strong>-এর পূর্ণাঙ্গ A4 PDF রিপোর্ট Google Drive-এ সংরক্ষিত হবে এবং{' '}
                    <strong>{autoSettings.targetGmail || rememberedEmail || defaultEmail}</strong> ঠিকানায় PDF অ্যাটাচমেন্ট হিসেবে পাঠানো হবে।
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingConfirm(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
                >
                  বাতিল করুন
                </button>
                <button
                  type="button"
                  onClick={executeConfirmedPrevMonthPdfDispatch}
                  disabled={isProcessing}
                  className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black flex items-center gap-1.5 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>নিশ্চিত, PDF পাঠান</span>
                </button>
              </div>
            </div>
          )}

          {pendingConfirm === 'restore_seed' && (
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-400 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-extrabold text-amber-950 text-sm">
                    নিশ্চিত করুন: ফায়ারবেস ডাটা রিস্টোর সিঙ্ক
                  </div>
                  <p className="text-xs text-amber-900 mt-0.5">
                    আপনি কি পূর্ববর্তী এটাচমেন্ট ব্যাকআপ ডাটা দিয়ে ফায়ারবেস পুনরায় সিঙ্ক করতে চান?
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingConfirm(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={executeConfirmedRestoreSeed}
                  disabled={isProcessing}
                  className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black"
                >
                  হ্যাঁ, সিঙ্ক করুন
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SECTION 1: GOOGLE DRIVE + GMAIL CONNECTION & AUTO BACKUP */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl border border-indigo-500/30 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white p-2 shrink-0 flex items-center justify-center shadow-md">
                  <svg className="w-full h-full" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 10.15z" fill="#ea4335"/>
                    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.25z" fill="#00832d"/>
                    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                  </svg>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-extrabold text-white">Google Drive ও Gmail ব্যাকআপ</h4>
                    {isTokenReady ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        অটো সেশন সক্রিয়
                      </span>
                    ) : rememberedEmail ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-200 border border-amber-400/40">
                        টোকেন নবায়ন প্রয়োজন
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                        সংযুক্ত নেই
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {rememberedEmail
                      ? `অ্যাকাউন্ট: ${rememberedEmail}`
                      : 'আপনার Gmail ও Google Drive অ্যাকাউন্ট একবার সংযুক্ত করুন'}
                  </p>
                </div>
              </div>

              {/* Official Sign in with Google / Disconnect Button */}
              {isTokenReady ? (
                <button
                  type="button"
                  onClick={handleGoogleDriveDisconnect}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  লগআউট
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleDriveConnect}
                  disabled={isConnectingDrive}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 shrink-0"
                >
                  <svg className="w-4 h-4" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  <span>
                    {isConnectingDrive
                      ? 'সংযোগ হচ্ছে...'
                      : rememberedEmail
                        ? 'Google সেশন সক্রিয় করুন'
                        : 'Sign in with Google'}
                  </span>
                </button>
              )}
            </div>

            {/* Target Gmail + Auto Controls */}
            <div className="bg-slate-950/60 border border-indigo-800/60 rounded-xl p-3.5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-[11px] font-bold text-indigo-200 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-rose-400" />
                  <span>অটো ব্যাকআপ রিসিভার Gmail ঠিকানা:</span>
                </label>
                <input
                  type="email"
                  value={autoSettings.targetGmail}
                  onChange={(e) =>
                    persistAutoSettings({ ...autoSettings, targetGmail: e.target.value })
                  }
                  placeholder="example@gmail.com"
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white w-full sm:w-64 focus:ring-1 focus:ring-emerald-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-900/80 border border-slate-800 rounded-lg px-2.5 py-2">
                  <input
                    type="checkbox"
                    checked={autoSettings.autoDriveEnabled}
                    onChange={(e) =>
                      persistAutoSettings({ ...autoSettings, autoDriveEnabled: e.target.checked })
                    }
                    className="w-4 h-4 text-emerald-500 rounded bg-slate-800 border-slate-700"
                  />
                  <span className="text-[11px] text-slate-200 font-semibold">
                    অটো Google Drive ব্যাকআপ
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-900/80 border border-slate-800 rounded-lg px-2.5 py-2">
                  <input
                    type="checkbox"
                    checked={autoSettings.autoGmailEnabled}
                    onChange={(e) =>
                      persistAutoSettings({ ...autoSettings, autoGmailEnabled: e.target.checked })
                    }
                    className="w-4 h-4 text-emerald-500 rounded bg-slate-800 border-slate-700"
                  />
                  <span className="text-[11px] text-slate-200 font-semibold">
                    অটো Gmail রিপোর্ট পাঠানো
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-900/80 border border-slate-800 rounded-lg px-2.5 py-2">
                  <input
                    type="checkbox"
                    checked={autoSettings.autoMonthlyA4Enabled}
                    onChange={(e) =>
                      persistAutoSettings({ ...autoSettings, autoMonthlyA4Enabled: e.target.checked })
                    }
                    className="w-4 h-4 text-emerald-500 rounded bg-slate-800 border-slate-700"
                  />
                  <span className="text-[11px] text-slate-200 font-semibold">
                    মাসিক A4 ও CSV অটো সেভ
                  </span>
                </label>
              </div>

              {(autoSettings.lastDriveBackupAt || autoSettings.lastGmailSentAt) && (
                <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] text-emerald-300">
                  {autoSettings.lastDriveBackupAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      শেষ Drive ব্যাকআপ: {new Date(autoSettings.lastDriveBackupAt).toLocaleString('bn-BD')}
                    </span>
                  )}
                  {autoSettings.lastGmailSentAt && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      শেষ Gmail পাঠানো: {new Date(autoSettings.lastGmailSentAt).toLocaleString('bn-BD')}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 border-t border-indigo-900/80">
              <button
                type="button"
                onClick={() => setPendingConfirm('gmail_backup')}
                disabled={isProcessing}
                className="px-3.5 py-2.5 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 active:scale-95 text-white font-black rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <Send className="w-4 h-4" />
                <span>Drive + Gmail ব্যাকআপ</span>
              </button>

              <button
                type="button"
                onClick={handleUploadBackupToDrive}
                disabled={isProcessing}
                className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <Cloud className="w-4 h-4" />
                <span>শুধু Drive JSON সেভ</span>
              </button>

              <button
                type="button"
                onClick={handleUploadMonthlyA4ToDrive}
                disabled={isProcessing}
                className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                <span>মাসিক A4 + CSV সেভ</span>
              </button>

              <button
                type="button"
                onClick={handleOpenGooglePicker}
                disabled={isOpeningPicker || isProcessing}
                className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <FolderOpen className="w-4 h-4" />
                <span>{isOpeningPicker ? 'খুলছে...' : 'Google Picker ফাইল বাছুন'}</span>
              </button>
            </div>

            {pickedDriveFile && (
              <div className="bg-amber-500/10 border border-amber-400/50 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-black text-amber-300">
                    Google Picker দ্বারা নির্বাচিত ফাইল:
                  </div>
                  <div className="text-xs font-extrabold text-white truncate">
                    {pickedDriveFile.name}
                  </div>
                  <div className="text-[10px] text-slate-300 font-mono truncate">
                    ID: {pickedDriveFile.id} · {pickedDriveFile.mimeType}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadPickedFile}
                    disabled={isProcessing}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ডাউনলোড</span>
                  </button>
                  {pickedDriveFile.url && (
                    <a
                      href={pickedDriveFile.url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1.5 rounded-lg bg-white text-slate-900 text-[11px] font-bold flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>খুলুন</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setPickedDriveFile(null)}
                    className="p-1 text-slate-300 hover:text-white rounded-lg"
                    aria-label="বন্ধ করুন"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* 1st-of-Month Auto Previous-Month PDF Card */}
            <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-300 shrink-0" />
                  <div>
                    <div className="text-xs font-extrabold text-white">
                      প্রতি মাসের ১ তারিখ অটো গত মাসের PDF রিপোর্ট ({previousMonthKey})
                    </div>
                    <div className="text-[10px] text-emerald-200">
                      মাসের ১ তারিখে স্বয়ংক্রিয়ভাবে গত মাসের A4 PDF Google Drive ও {autoSettings.targetGmail || defaultEmail}-এ চলে যাবে।
                    </div>
                  </div>
                </div>
                {autoSettings.lastAutoPrevMonthSent === previousMonthKey ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950">
                    {previousMonthKey} পাঠানো হয়েছে ✅
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-200 border border-amber-400/40">
                    অপেক্ষমাণ ({previousMonthKey})
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleViewAndPrintMonthlyPdf(previousMonthKey)}
                  disabled={isProcessing}
                  className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-900 font-extrabold rounded-xl text-[11px] flex items-center gap-1.5 shadow-sm"
                >
                  <Eye className="w-3.5 h-3.5 text-indigo-600" />
                  <span>গত মাসের ({previousMonthKey}) PDF দেখুন ও প্রিন্ট করুন</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPendingConfirm('prev_month_pdf')}
                  disabled={isProcessing}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-[11px] flex items-center gap-1.5 shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>এখনই গত মাসের PDF Drive + Gmail-এ পাঠান</span>
                </button>

                {autoSettings.lastPrevMonthPdfDriveLink && (
                  <a
                    href={autoSettings.lastPrevMonthPdfDriveLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 font-bold rounded-xl text-[11px] flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Drive-এ PDF দেখুন</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Drive Files List in User's Folder */}
          {isTokenReady && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Google Drive-এ সংরক্ষিত ফাইলসমূহ (DIP BHOLA NETWORK ফোল্ডার):</span>
                </div>
                <button
                  type="button"
                  onClick={() => driveToken && fetchDriveFiles(driveToken)}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                  রিফ্রেশ
                </button>
              </div>

              {driveFiles.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-[11px]">
                  এখনো কোনো ব্যাকআপ ফাইল আপলোড করা হয়নি। উপরের বাটনে ক্লিক করে আপলোড করুন।
                </div>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white overflow-hidden max-h-36 overflow-y-auto">
                  {driveFiles.map((file) => (
                    <div key={file.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-slate-800 truncate" title={file.name}>
                          {file.name}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          আপলোড: {file.modifiedTime ? file.modifiedTime.substring(0, 10) : ''}
                        </div>
                      </div>
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1 shrink-0"
                        >
                          <ExternalLink className="w-3 h-3" />
                          ড্রাইভে দেখুন
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Google Tasks Integration Card */}
          <div className="bg-slate-50 border border-indigo-200 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                <ListTodo className="w-4 h-4 text-indigo-600" />
                <span>Google Tasks ফলো-আপ ও রিমাইন্ডার তালিকা</span>
              </div>
              {isTokenReady && driveToken ? (
                <div className="flex items-center gap-2">
                  {taskLists.length > 0 && (
                    <select
                      value={selectedTaskListId}
                      onChange={(e) => {
                        const nextList = e.target.value;
                        setSelectedTaskListId(nextList);
                        fetchGoogleTasksData(driveToken, nextList);
                      }}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-bold text-slate-800"
                    >
                      {taskLists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.title}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => fetchGoogleTasksData(driveToken, selectedTaskListId)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingTasks ? 'animate-spin' : ''}`} />
                    রিফ্রেশ
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleDriveConnect}
                  disabled={isConnectingDrive}
                  className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold"
                >
                  Google Tasks চালু করতে Sign in করুন
                </button>
              )}
            </div>

            {isTokenReady && driveToken && (
              <>
                {pendingTaskAction && (
                  <div className="p-3 rounded-xl bg-amber-50 border-2 border-amber-400 space-y-2">
                    <div className="text-xs font-extrabold text-amber-950">
                      {pendingTaskAction.type === 'create'
                        ? `নিশ্চিত করুন: "${pendingTaskAction.title}" কাজটি Google Tasks-এ যুক্ত করা হবে?`
                        : pendingTaskAction.type === 'toggle'
                        ? `নিশ্চিত করুন: "${pendingTaskAction.task.title}" কাজটির অবস্থা "${
                            pendingTaskAction.nextStatus === 'completed' ? 'সম্পন্ন' : 'চলমান'
                          }" করা হবে?`
                        : `নিশ্চিত করুন: "${pendingTaskAction.task.title}" কাজটি Google Tasks থেকে মুছে ফেলা হবে?`}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingTaskAction(null)}
                        className="px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 text-[11px] font-bold"
                      >
                        বাতিল
                      </button>
                      <button
                        type="button"
                        onClick={executeConfirmedTaskAction}
                        disabled={isLoadingTasks}
                        className={`px-3 py-1 rounded-lg text-white text-[11px] font-black ${
                          pendingTaskAction.type === 'delete'
                            ? 'bg-rose-600 hover:bg-rose-700'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        নিশ্চিত করুন
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="নতুন টাস্ক (যেমন: মাসিক বিল অডিট / OLT পাওয়ার চেক)"
                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
                  />
                  <input
                    type="text"
                    value={newTaskNotes}
                    onChange={(e) => setNewTaskNotes(e.target.value)}
                    placeholder="নোট (ঐচ্ছিক)"
                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900"
                  />
                  <button
                    type="button"
                    disabled={!newTaskTitle.trim() || isLoadingTasks}
                    onClick={() =>
                      setPendingTaskAction({
                        type: 'create',
                        title: newTaskTitle.trim(),
                        notes: newTaskNotes.trim()
                      })
                    }
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>টাস্ক যোগ</span>
                  </button>
                </div>

                {googleTasks.length === 0 ? (
                  <div className="text-center py-3 text-slate-400 text-[11px]">
                    এই তালিকায় এখনো কোনো Google Task নেই।
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white max-h-44 overflow-y-auto">
                    {googleTasks.map((task) => {
                      const isDone = task.status === 'completed';
                      return (
                        <div key={task.id} className="p-2.5 flex items-center justify-between gap-2 text-xs hover:bg-slate-50">
                          <button
                            type="button"
                            onClick={() =>
                              setPendingTaskAction({
                                type: 'toggle',
                                task,
                                nextStatus: isDone ? 'needsAction' : 'completed'
                              })
                            }
                            className="flex items-start gap-2 min-w-0 text-left flex-1"
                          >
                            {isDone ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0">
                              <div className={`font-bold truncate ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                {task.title || '(শিরোনামহীন)'}
                              </div>
                              {task.notes && (
                                <div className="text-[10px] text-slate-500 truncate">{task.notes}</div>
                              )}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingTaskAction({ type: 'delete', task })}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                            title="টাস্ক মুছুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Current Database Summary */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1 text-xs">
            <div className="font-bold text-slate-900 mb-1">বর্তমানে ফায়ারবেস ক্লাউডে সংরক্ষিত রেকর্ড:</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600">
              <div className="bg-white p-2 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block">লেনদেন</span>
                <span className="font-bold text-slate-900 text-sm">{toBengaliNumber(transactions.length)} টি</span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block">কর্মকর্তা/স্টাফ</span>
                <span className="font-bold text-slate-900 text-sm">{toBengaliNumber(staffs.length)} জন</span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block">অংশীদার</span>
                <span className="font-bold text-slate-900 text-sm">{toBengaliNumber(partners.length)} জন</span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block">বাকি খাতা</span>
                <span className="font-bold text-slate-900 text-sm">{toBengaliNumber(customerDues.length)} জন</span>
              </div>
            </div>
          </div>

          {/* Offline JSON Download and Reset Sync Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-indigo-600" />
                  <span>অফলাইন ব্যাকআপ ফাইল ডাউনলোড (JSON)</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  কম্পিউটার বা ফোনে সম্পূর্ণ হিসাব খাতার অফলাইন কপি সংরক্ষণ করুন।
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                ফাইল ডাউনলোড করুন
              </button>
            </div>

            <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 text-emerald-600" />
                  <span>ফায়ারবেস ডাটা সিঙ্ক ও রিস্টোর</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ক্লাউড ডেটাবেস পুনরায় ডিফল্ট রেকর্ড দিয়ে সিঙ্ক করতে ক্লিক করুন।
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingConfirm('restore_seed')}
                disabled={isProcessing}
                className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                {isProcessing ? 'সিঙ্ক হচ্ছে...' : 'ডাটা সিঙ্ক করুন'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Built-in Monthly PDF Viewer & Print Overlay */}
      {previewPdf && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5 print:hidden">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 sm:px-6 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="text-sm font-extrabold">
                    মাসিক A4 PDF রিপোর্ট ({previewPdf.monthKey})
                  </div>
                  <div className="text-[10px] text-slate-300">
                    ফাইল: {previewPdf.result.fileName} • {toBengaliNumber(previewPdf.result.pageCount)} পৃষ্ঠা
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrintActivePreview}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>প্রিন্ট করুন</span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerPdfDownload(previewPdf.result.blob, previewPdf.result.fileName)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF ডাউনলোড</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    sharePdfFileNatively(
                      previewPdf.result.file,
                      `${companyName} - ${previewPdf.monthKey}`,
                      `${previewPdf.monthKey} মাসের A4 আর্থিক বিবরণী`
                    )
                  }
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>শেয়ার</span>
                </button>
                {previewPdf.driveViewLink && (
                  <a
                    href={previewPdf.driveViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Drive-এ খুলুন</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewPdf(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                  aria-label="বন্ধ করুন"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-200 p-3 sm:p-6">
              <div
                className="bg-white max-w-[794px] mx-auto p-6 sm:p-8 rounded-xl shadow-lg border border-slate-300"
                dangerouslySetInnerHTML={{ __html: previewPdf.htmlMarkup }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Exclusive Print Portal for Backup A4 Report */}
      {isPrintingPdf &&
        previewPdf &&
        typeof document !== 'undefined' &&
        createPortal(
          <div id="print-studio-portal-root" className="hidden print:block bg-white p-0 m-0">
            <div
              id="print-studio-capture-surface"
              dangerouslySetInnerHTML={{ __html: previewPdf.htmlMarkup }}
            />
          </div>,
          document.body
        )}
    </div>
  );
};
