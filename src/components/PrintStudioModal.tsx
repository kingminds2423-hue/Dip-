import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Download,
  FileText,
  MessageCircle,
  Mail,
  CheckCircle2,
  Maximize2,
  BookOpen,
  Share2,
  ExternalLink,
  Smartphone,
  Sparkles,
  Loader2,
  Users,
  Palette,
  BookmarkPlus,
  FolderOpen,
  Trash2,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Type,
  RotateCcw
} from 'lucide-react';
import {
  PaperSize,
  PaperOrientation,
  PrintColorMode,
  PrintPagePreferences,
  PrintPreset,
  SavedPrintDocument,
  PAPER_SPECS,
  COLOR_THEMES,
  getSavedPrintPreferences,
  savePrintPreferences,
  getSavedPrintPresets,
  savePrintPreset,
  deletePrintPreset,
  listSavedPrintDocuments,
  savePrintDocumentForLater,
  deleteSavedPrintDocument,
  getPaperPixelDimensions,
  applyDynamicPrintPageRule,
  buildScopedPrintThemeCss,
  resolveAccentColors,
  generatePdfFromElement,
  triggerPdfDownload,
  sharePdfFileNatively,
  openWhatsAppSummaryMessage,
  openGmailComposeSummary,
  GeneratedPdfResult
} from '../services/pdfPrintService';
import { WhatsAppGroupConfig } from '../types';
import { normalizeWhatsAppGroupLink } from '../utils/appUrls';
import { toBengaliNumber } from '../utils/formatters';

export interface PrintStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  fileNamePrefix: string;
  summaryText: string;
  whatsappGroupConfig?: WhatsAppGroupConfig | null;
  children: React.ReactNode;
}

const PAPER_SIZE_OPTIONS: { id: PaperSize; label: string; sub: string }[] = [
  { id: 'A4', label: 'A4 (ডিফল্ট)', sub: '210×297 mm' },
  { id: 'Legal', label: 'Legal', sub: '216×356 mm' },
  { id: 'Letter', label: 'Letter', sub: '216×279 mm' },
  { id: 'A5', label: 'A5 মিনি', sub: '148×210 mm' },
  { id: 'Custom', label: 'কাস্টম সাইজ', sub: 'নিজের মাপ mm' }
];

const SCALE_OPTIONS: { value: number; label: string }[] = [
  { value: 115, label: '১১৫% (বড়)' },
  { value: 105, label: '১০৫%' },
  { value: 100, label: '১০০% (ফিট)' },
  { value: 90, label: '৯০%' },
  { value: 80, label: '৮০%' },
  { value: 70, label: '৭০%' },
  { value: 60, label: '৬০%' }
];

const COLOR_MODE_OPTIONS: { id: PrintColorMode; label: string; swatch: string }[] = [
  { id: 'color', label: 'মূল রঙিন', swatch: '#047857' },
  { id: 'grayscale', label: 'সাদা-কালো (B&W)', swatch: '#0f172a' },
  { id: 'royal_blue', label: 'অফিসিয়াল নীল', swatch: '#1d4ed8' },
  { id: 'emerald', label: 'গাঢ় সবুজ', swatch: '#059669' },
  { id: 'maroon', label: 'রাজকীয় মেরুন', swatch: '#9f1239' },
  { id: 'amber_gold', label: 'গোল্ডেন অ্যাম্বার', swatch: '#b45309' },
  { id: 'custom', label: 'নিজের কালার', swatch: '#4f46e5' }
];

const CUSTOM_DIMENSION_PRESETS: { label: string; w: number; h: number }[] = [
  { label: 'POS রসিদ (80×297)', w: 80, h: 297 },
  { label: 'B5 (176×250)', w: 176, h: 250 },
  { label: 'A4 (210×297)', w: 210, h: 297 },
  { label: 'A3 বড় (297×420)', w: 297, h: 420 }
];

export const PrintStudioModal: React.FC<PrintStudioModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  fileNamePrefix,
  summaryText,
  whatsappGroupConfig,
  children
}) => {
  const [prefs, setPrefs] = useState<PrintPagePreferences>(() => getSavedPrintPreferences());
  const [presets, setPresets] = useState<PrintPreset[]>(() => getSavedPrintPresets());
  const [savedDocs, setSavedDocs] = useState<SavedPrintDocument[]>([]);
  const [activeSavedHtml, setActiveSavedHtml] = useState<{ id: string; title: string; html: string } | null>(null);

  const [viewMode, setViewMode] = useState<'paper' | 'pdf_reader' | 'saved_archive'>('paper');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSavingForLater, setIsSavingForLater] = useState(false);
  const [pdfResult, setPdfResult] = useState<GeneratedPdfResult | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [shareDrawerTab, setShareDrawerTab] = useState<'none' | 'whatsapp' | 'gmail' | 'presets' | 'visual'>('none');
  const [newPresetName, setNewPresetName] = useState('');
  const [personalWhatsAppPhone, setPersonalWhatsAppPhone] = useState('');
  const [gmailRecipient, setGmailRecipient] = useState('');
  const [previewViewportWidth, setPreviewViewportWidth] = useState<number>(800);

  const captureRef = useRef<HTMLDivElement | null>(null);
  const contentBodyRef = useRef<HTMLDivElement | null>(null);
  const previewWrapRef = useRef<HTMLDivElement | null>(null);

  // Load saved print archive whenever studio opens
  useEffect(() => {
    if (!isOpen) return;
    listSavedPrintDocuments().then((docs) => setSavedDocs(docs));
    setPresets(getSavedPrintPresets());
  }, [isOpen]);

  // Clean up previous blob URL on close or regenerate
  useEffect(() => {
    return () => {
      if (pdfResult?.blobUrl) {
        URL.revokeObjectURL(pdfResult.blobUrl);
      }
    };
  }, [pdfResult?.blobUrl]);

  // Apply body class & dynamic @page CSS whenever modal is open or prefs change
  useEffect(() => {
    if (!isOpen) {
      document.body.classList.remove('print-studio-active');
      return;
    }

    document.body.classList.add('print-studio-active');
    applyDynamicPrintPageRule(
      prefs.size,
      prefs.orientation,
      prefs.marginMm,
      prefs.customWidthMm,
      prefs.customHeightMm,
      {
        top: prefs.marginTopMm,
        right: prefs.marginRightMm,
        bottom: prefs.marginBottomMm,
        left: prefs.marginLeftMm
      }
    );
    savePrintPreferences(prefs);

    // Clear stale PDF if page settings changed so next PDF action uses updated size & color
    setPdfResult((prev) => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return null;
    });

    return () => {
      document.body.classList.remove('print-studio-active');
    };
  }, [isOpen, prefs]);

  // Observe preview container width to scale page proportionally on mobile screens without clipping
  useEffect(() => {
    if (!isOpen || !previewWrapRef.current) return;
    const el = previewWrapRef.current;
    const updateWidth = () => {
      setPreviewViewportWidth(el.clientWidth || window.innerWidth);
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen, viewMode]);

  // Apply exact pixel-level font scaling inside contentBodyRef so Tailwind px-based classes (text-[9.5px], text-xs, text-xl) scale cleanly in preview, print, and PDF
  useEffect(() => {
    if (!isOpen || viewMode !== 'paper' || !contentBodyRef.current) return;
    const container = contentBodyRef.current;
    const scaleFactor = (prefs.fontScalePercent || 100) / 100;
    const nodes = container.querySelectorAll<HTMLElement>(
      'h1, h2, h3, h4, h5, h6, p, span, td, th, li, div, strong, small'
    );

    nodes.forEach((el) => {
      if (!el.dataset.origFontPx) {
        const computedPx = parseFloat(window.getComputedStyle(el).fontSize);
        if (Number.isFinite(computedPx) && computedPx > 0) {
          el.dataset.origFontPx = String(computedPx);
        }
      }
      const basePx = parseFloat(el.dataset.origFontPx || '');
      if (!Number.isFinite(basePx) || basePx <= 0) return;
      if (Math.abs(scaleFactor - 1) < 0.005) {
        el.style.removeProperty('font-size');
      } else {
        el.style.fontSize = `${(basePx * scaleFactor).toFixed(2)}px`;
      }
    });
  }, [isOpen, viewMode, prefs.fontScalePercent, activeSavedHtml, children]);

  if (!isOpen) return null;

  const { widthPx: paperWidthPx, widthMm, heightMm } = getPaperPixelDimensions(
    prefs.size,
    prefs.orientation,
    prefs.customWidthMm,
    prefs.customHeightMm
  );

  // Fit paper visually inside screen viewport so mobile users see 100% width with zero cutoff
  const availablePreviewW = Math.max(280, previewViewportWidth - 28);
  const visualFitScale = Math.min(1, availablePreviewW / paperWidthPx);
  const visualOptions = {
    showHeader: prefs.showHeader,
    showLogo: prefs.showLogo,
    showSummary: prefs.showSummary,
    showTotals: prefs.showTotals,
    showAuditTimestamps: prefs.showAuditTimestamps,
    showAddedBy: prefs.showAddedBy,
    showSignatures: prefs.showSignatures
  };
  const hiddenSectionsCount = [
    prefs.showHeader,
    prefs.showLogo,
    prefs.showSummary,
    prefs.showTotals,
    prefs.showAuditTimestamps,
    prefs.showAddedBy,
    prefs.showSignatures
  ].filter((v) => !v).length;

  const scopedThemeCss = buildScopedPrintThemeCss(
    prefs.colorMode,
    prefs.customAccentColor,
    visualOptions
  );
  const activeColorPalette = resolveAccentColors(prefs.colorMode, prefs.customAccentColor);

  const activeTitle = activeSavedHtml ? activeSavedHtml.title : documentTitle;

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 5000);
  };

  const ensureGeneratedPdf = async (): Promise<GeneratedPdfResult | null> => {
    if (pdfResult) return pdfResult;
    if (!captureRef.current) return null;

    setIsGeneratingPdf(true);
    try {
      const cleanPrefix = (fileNamePrefix || 'DIP-BHOLA').replace(/[^a-zA-Z0-9_-]/g, '-');
      const sizeTag =
        prefs.size === 'Custom'
          ? `${Math.round(prefs.customWidthMm)}x${Math.round(prefs.customHeightMm)}mm`
          : prefs.size;
      const colorTag = prefs.colorMode === 'grayscale' ? 'BW' : prefs.colorMode;
      const fileName = `${cleanPrefix}-${sizeTag}-${colorTag}-${prefs.orientation}.pdf`;
      const result = await generatePdfFromElement(captureRef.current, {
        fileName,
        size: prefs.size,
        orientation: prefs.orientation,
        marginMm: prefs.marginMm,
        marginTopMm: prefs.marginTopMm,
        marginRightMm: prefs.marginRightMm,
        marginBottomMm: prefs.marginBottomMm,
        marginLeftMm: prefs.marginLeftMm,
        scalePercent: prefs.scalePercent,
        customWidthMm: prefs.customWidthMm,
        customHeightMm: prefs.customHeightMm,
        colorMode: prefs.colorMode,
        customAccentColor: prefs.customAccentColor,
        visualOptions
      });
      setPdfResult(result);
      return result;
    } catch (err) {
      console.error('PDF generation failed:', err);
      showToast('PDF তৈরিতে সাময়িক সমস্যা হয়েছে — প্রিন্ট বাটন দিয়ে "Save as PDF" ব্যবহার করুন।');
      return null;
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintNow = () => {
    applyDynamicPrintPageRule(
      prefs.size,
      prefs.orientation,
      prefs.marginMm,
      prefs.customWidthMm,
      prefs.customHeightMm,
      {
        top: prefs.marginTopMm,
        right: prefs.marginRightMm,
        bottom: prefs.marginBottomMm,
        left: prefs.marginLeftMm
      }
    );
    savePrintPreferences(prefs);
    if (viewMode !== 'paper') {
      setViewMode('paper');
      setTimeout(() => window.print(), 220);
    } else {
      window.print();
    }
  };

  const handleSaveSettingsAndPreset = () => {
    savePrintPreferences(prefs);
    const label =
      newPresetName.trim() ||
      `${prefs.size === 'Custom' ? `${prefs.customWidthMm}×${prefs.customHeightMm}mm` : prefs.size} · ${
        COLOR_THEMES[prefs.colorMode].label
      }`;
    const updated = savePrintPreset(label, prefs);
    setPresets(updated);
    setNewPresetName('');
    showToast(`সেটিংস ও প্রিসেট "${label}" সেভ হয়েছে — পরবর্তীতে এক ক্লিকেই ব্যবহার করতে পারবেন!`);
  };

  const handleSaveForLaterPrint = async () => {
    if (!contentBodyRef.current) {
      setViewMode('paper');
      showToast('অনুগ্রহ করে পেজ প্রিভিউতে ফিরে আবার সেভ বাটনে ক্লিক করুন।');
      return;
    }
    setIsSavingForLater(true);
    try {
      savePrintPreferences(prefs);
      const saved = await savePrintDocumentForLater({
        title: `${activeTitle} (${prefs.size === 'Custom' ? `${prefs.customWidthMm}×${prefs.customHeightMm}mm` : prefs.size})`,
        fileNamePrefix,
        summaryText,
        htmlSnapshot: contentBodyRef.current.innerHTML,
        prefs
      });
      const updated = await listSavedPrintDocuments();
      setSavedDocs(updated);
      showToast(
        `"${saved.title}" সংরক্ষিত তালিকায় সেভ হয়েছে! 'সংরক্ষিত প্রিন্ট' ট্যাব থেকে যেকোনো সময় প্রিন্ট বা PDF করতে পারবেন।`
      );
    } catch (err) {
      console.error('Failed to save print document:', err);
      showToast('ডকুমেন্ট সেভ করতে সমস্যা হয়েছে।');
    } finally {
      setIsSavingForLater(false);
    }
  };

  const handleLoadSavedDocument = (doc: SavedPrintDocument, autoAction?: 'print' | 'pdf') => {
    setPrefs(doc.prefs);
    setActiveSavedHtml({
      id: doc.id,
      title: doc.title,
      html: doc.htmlSnapshot
    });
    setViewMode('paper');
    applyDynamicPrintPageRule(
      doc.prefs.size,
      doc.prefs.orientation,
      doc.prefs.marginMm,
      doc.prefs.customWidthMm,
      doc.prefs.customHeightMm,
      {
        top: doc.prefs.marginTopMm ?? doc.prefs.marginMm,
        right: doc.prefs.marginRightMm ?? doc.prefs.marginMm,
        bottom: doc.prefs.marginBottomMm ?? doc.prefs.marginMm,
        left: doc.prefs.marginLeftMm ?? doc.prefs.marginMm
      }
    );

    if (autoAction === 'print') {
      setTimeout(() => window.print(), 280);
    } else if (autoAction === 'pdf') {
      setTimeout(async () => {
        const res = await ensureGeneratedPdf();
        if (res) {
          triggerPdfDownload(res.blob, res.fileName);
          showToast(`সংরক্ষিত "${doc.title}" PDF আকারে ডাউনলোড হয়েছে!`);
        }
      }, 280);
    } else {
      showToast(`"${doc.title}" লোড করা হয়েছে — এখন সাইজ/কালার বদলে প্রিন্ট বা সেভ করুন।`);
    }
  };

  const handleDeleteSavedDocument = async (id: string) => {
    await deleteSavedPrintDocument(id);
    const updated = await listSavedPrintDocuments();
    setSavedDocs(updated);
    if (activeSavedHtml?.id === id) {
      setActiveSavedHtml(null);
    }
    showToast('সংরক্ষিত প্রিন্ট তালিকা থেকে মুছে ফেলা হয়েছে।');
  };

  const handleDownloadPdf = async () => {
    if (viewMode !== 'paper') {
      setViewMode('paper');
      setTimeout(async () => {
        const res = await ensureGeneratedPdf();
        if (!res) return;
        triggerPdfDownload(res.blob, res.fileName);
        showToast(`সফলভাবে ${prefs.size} (${Math.round(widthMm)}×${Math.round(heightMm)}mm) PDF সেভ হয়েছে!`);
      }, 220);
      return;
    }
    const res = await ensureGeneratedPdf();
    if (!res) return;
    triggerPdfDownload(res.blob, res.fileName);
    showToast(`সফলভাবে ${prefs.size} PDF (${res.pageCount} পৃষ্ঠা) ডিভাইসে সেভ হয়েছে!`);
  };

  const handleOpenPdfReader = async () => {
    if (viewMode === 'saved_archive') {
      setViewMode('paper');
      setTimeout(async () => {
        const res = await ensureGeneratedPdf();
        if (!res) return;
        setViewMode('pdf_reader');
      }, 200);
      return;
    }
    const res = await ensureGeneratedPdf();
    if (!res) return;
    setViewMode('pdf_reader');
    showToast(`${prefs.size} PDF Reader চালু হয়েছে — ডাউনলোড বা শেয়ার করতে পারবেন।`);
  };

  const handleSharePdfFileDirect = async (targetLabel: string) => {
    const res = await ensureGeneratedPdf();
    if (!res) return;

    const shareState = await sharePdfFileNatively(res.file, activeTitle, summaryText);
    if (shareState === 'shared') {
      showToast(`PDF ফাইল ${targetLabel}-এ শেয়ার করা হয়েছে!`);
      return;
    }
    if (shareState === 'cancelled') return;

    triggerPdfDownload(res.blob, res.fileName);
    showToast(`PDF (${res.fileName}) ডাউনলোড হয়েছে! এখন ${targetLabel}-এ Attach করে পাঠান।`);
  };

  const handleSendWhatsApp = async (mode: 'group' | 'personal' | 'file') => {
    if (mode === 'file') {
      const res = await ensureGeneratedPdf();
      if (!res) return;
      const shared = await sharePdfFileNatively(res.file, activeTitle, summaryText);
      if (shared === 'shared') {
        showToast('PDF ফাইল সরাসরি WhatsApp-এ শেয়ার হয়েছে!');
        return;
      }
      if (shared === 'cancelled') return;
      triggerPdfDownload(res.blob, res.fileName);
      openWhatsAppSummaryMessage(
        `${summaryText}\n\n📄 সংযুক্ত ফাইল: ${res.fileName} (${prefs.size} PDF)`,
        personalWhatsAppPhone || undefined
      );
      showToast('PDF ডাউনলোড হয়েছে এবং WhatsApp খোলা হয়েছে — ডাউনলোড ফাইলটি Attach করুন।');
      return;
    }

    if (mode === 'personal') {
      const clean = personalWhatsAppPhone.replace(/[^\d]/g, '');
      if (clean.length < 10) {
        showToast('পারসোনাল WhatsApp এ পাঠাতে সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন।');
        return;
      }
      const res = await ensureGeneratedPdf();
      if (res) triggerPdfDownload(res.blob, res.fileName);
      openWhatsAppSummaryMessage(
        `${summaryText}\n\n📄 PDF সাইজ: ${prefs.size} (${prefs.orientation})`,
        clean
      );
      showToast('পারসোনাল WhatsApp চ্যাট খোলা হয়েছে (PDF ডাউনলোড সম্পন্ন)।');
      return;
    }

    const res = await ensureGeneratedPdf();
    if (res) triggerPdfDownload(res.blob, res.fileName);
    openWhatsAppSummaryMessage(`${summaryText}\n\n📄 PDF সাইজ: ${prefs.size} (${prefs.orientation})`);
    showToast('WhatsApp গ্রুপ/চ্যাট পিকার খোলা হয়েছে এবং PDF ডাউনলোড হয়েছে।');
  };

  const handleSendGmail = async (useNativeShareFirst: boolean) => {
    const res = await ensureGeneratedPdf();
    if (useNativeShareFirst && res) {
      const shareState = await sharePdfFileNatively(res.file, activeTitle, summaryText);
      if (shareState === 'shared') {
        showToast('Gmail / অ্যাপে PDF ফাইল শেয়ার করা হয়েছে!');
        return;
      }
      if (shareState === 'cancelled') return;
    }
    if (res) {
      triggerPdfDownload(res.blob, res.fileName);
    }
    openGmailComposeSummary(
      `${activeTitle} (${prefs.size} PDF)`,
      `${summaryText}\n\n[বিঃদ্রঃ: ডাউনলোড হওয়া ${res?.fileName || 'PDF'} ফাইলটি ইমেইলে Attach করে পাঠান]`,
      gmailRecipient
    );
    showToast('PDF ডাউনলোড হয়েছে ও Gmail কম্পোজ খোলা হয়েছে — Attach করে Send করুন।');
  };

  const updatePaperSize = (size: PaperSize) => {
    const spec = PAPER_SPECS[size];
    setPrefs((p) => ({
      ...p,
      size,
      ...(size !== 'Custom' ? { customWidthMm: spec.widthMm, customHeightMm: spec.heightMm } : {})
    }));
  };

  const updateOrientation = (orientation: PaperOrientation) => {
    setPrefs((p) => ({ ...p, orientation }));
  };

  const updateScale = (scalePercent: number) => {
    setPrefs((p) => ({ ...p, scalePercent }));
  };

  const updateColorMode = (colorMode: PrintColorMode) => {
    setPrefs((p) => ({
      ...p,
      colorMode,
      ...(colorMode !== 'custom' ? { customAccentColor: COLOR_THEMES[colorMode].accentHex } : {})
    }));
  };

  const complaintGroupUrl = normalizeWhatsAppGroupLink(whatsappGroupConfig?.groupInviteLink);
  const staffGroupUrl = normalizeWhatsAppGroupLink(whatsappGroupConfig?.staffGroupInviteLink);
  const partnerGroupUrl = normalizeWhatsAppGroupLink(whatsappGroupConfig?.partnerGroupInviteLink);

  const studioContent = (
    <div id="print-studio-portal-root" className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex flex-col print:static print:bg-white print:block">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* STUDIO TOOLBAR (Hidden during printing)                         */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-slate-950 text-white border-b border-slate-800 px-3 sm:px-5 py-2.5 space-y-2 shrink-0 print:hidden max-h-[58vh] overflow-y-auto">
        {/* Top Row: Title, View Toggle, Close */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-white/20 shadow-md"
              style={{ backgroundColor: activeColorPalette.accentHex }}
            >
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white truncate">
                  স্মার্ট প্রিন্ট, কালার ও PDF সেভ স্টুডিও — {activeTitle}
                </h3>
                {activeSavedHtml && (
                  <button
                    type="button"
                    onClick={() => setActiveSavedHtml(null)}
                    className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-black shrink-0"
                  >
                    লাইভ রিপোর্টে ফিরুন
                  </button>
                )}
              </div>
              <p className="text-[11px] text-emerald-300 truncate">
                সক্রিয় পেজ: <span className="font-bold text-white">{Math.round(widthMm)}×{Math.round(heightMm)} মিমি ({prefs.size})</span> •{' '}
                কালার: <span className="font-bold text-amber-300">{COLOR_THEMES[prefs.colorMode].label}</span> •{' '}
                {prefs.orientation === 'portrait' ? 'লম্বালম্বি' : 'আড়াআড়ি'} • স্কেল {prefs.scalePercent}% • ফন্ট {prefs.fontScalePercent}%
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('paper')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                viewMode === 'paper'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              পেজ প্রিভিউ
            </button>
            <button
              type="button"
              onClick={handleOpenPdfReader}
              disabled={isGeneratingPdf}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
                viewMode === 'pdf_reader'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>PDF Reader</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('saved_archive')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors border ${
                viewMode === 'saved_archive'
                  ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
                  : 'bg-slate-800 text-amber-200 border-amber-600/40 hover:bg-slate-700'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>সংরক্ষিত প্রিন্ট ({toBengaliNumber(savedDocs.length)})</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white transition-colors"
              aria-label="বন্ধ করুন"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Second Row: Custom Paper Size + Custom mm + Orientation + Scale + Margin */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Paper Sizes */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 px-1 flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3 text-emerald-400" />
                সাইজ:
              </span>
              {PAPER_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updatePaperSize(opt.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                    prefs.size === opt.id
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-xs'
                      : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                  }`}
                  title={opt.sub}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Orientation, Scale & Margin */}
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                <button
                  type="button"
                  onClick={() => updateOrientation('portrait')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    prefs.orientation === 'portrait' ? 'bg-indigo-500 text-white' : 'text-slate-300'
                  }`}
                >
                  লম্বালম্বি
                </button>
                <button
                  type="button"
                  onClick={() => updateOrientation('landscape')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    prefs.orientation === 'landscape' ? 'bg-indigo-500 text-white' : 'text-slate-300'
                  }`}
                >
                  আড়াআড়ি
                </button>
              </div>

              <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1">
                <Maximize2 className="w-3 h-3 text-amber-300" />
                <select
                  value={prefs.scalePercent}
                  onChange={(e) => updateScale(Number(e.target.value))}
                  className="bg-transparent text-[11px] font-bold text-white border-none focus:ring-0 cursor-pointer p-0 pr-4"
                  aria-label="পেজ স্কেল"
                >
                  {SCALE_OPTIONS.map((sc) => (
                    <option key={sc.value} value={sc.value} className="bg-slate-900 text-white">
                      স্কেল: {sc.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px]">
                <span className="text-slate-400">সব মার্জিন:</span>
                <select
                  value={prefs.marginMm}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setPrefs((p) => ({
                      ...p,
                      marginMm: v,
                      marginTopMm: v,
                      marginRightMm: v,
                      marginBottomMm: v,
                      marginLeftMm: v
                    }));
                  }}
                  className="bg-transparent text-[11px] font-bold text-white border-none focus:ring-0 cursor-pointer p-0 pr-4"
                  aria-label="পেজ মার্জিন"
                >
                  {[4, 6, 8, 10, 12, 15, 20].map((m) => (
                    <option key={m} value={m} className="bg-slate-900 text-white">
                      {toBengaliNumber(m)} মিমি
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 4-Side Individual Millimeter Margin Inputs (Ideal for Pre-printed Letterhead Pads) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80 text-[11px]">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-emerald-300">৪-পাশের মার্জিন (মিমি):</span>
              {(
                [
                  { key: 'marginTopMm', label: 'উপর' },
                  { key: 'marginRightMm', label: 'ডান' },
                  { key: 'marginBottomMm', label: 'নিচ' },
                  { key: 'marginLeftMm', label: 'বাম' }
                ] as const
              ).map((side) => (
                <label
                  key={side.key}
                  className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5"
                >
                  <span className="text-[10px] text-slate-400">{side.label}:</span>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={prefs[side.key]}
                    onChange={(e) => {
                      const val = Math.min(60, Math.max(0, Number(e.target.value) || 0));
                      setPrefs((p) => ({ ...p, [side.key]: val }));
                    }}
                    className="w-11 bg-transparent text-white font-bold text-[11px] border-none focus:ring-0 p-0 text-center"
                    aria-label={`${side.label} মার্জিন`}
                  />
                  <span className="text-[9px] text-slate-500">mm</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setPrefs((p) => ({
                    ...p,
                    marginTopMm: 36,
                    marginRightMm: 10,
                    marginBottomMm: 15,
                    marginLeftMm: 10,
                    showHeader: false,
                    showLogo: false
                  }))
                }
                className="px-2 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[10px] font-bold"
                title="ছাপানো অফিসিয়াল প্যাডের উপরের অংশ খালি রেখে প্রিন্ট করুন"
              >
                প্যাড হেডার (৩৬/১০/১৫)
              </button>
              <button
                type="button"
                onClick={() =>
                  setPrefs((p) => ({
                    ...p,
                    marginMm: 8,
                    marginTopMm: 8,
                    marginRightMm: 8,
                    marginBottomMm: 8,
                    marginLeftMm: 8,
                    showHeader: true,
                    showLogo: true
                  }))
                }
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-bold"
              >
                ডিফল্ট (৮ মিমি)
              </button>
            </div>
          </div>

          {/* Custom Paper Width & Height Inputs when 'Custom' is chosen */}
          {prefs.size === 'Custom' && (
            <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-amber-300">নিজের মাপ (মিমি):</span>
                <label className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1">
                  <span className="text-[10px] text-slate-400">প্রস্থ:</span>
                  <input
                    type="number"
                    min={58}
                    max={450}
                    value={prefs.customWidthMm}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        customWidthMm: Math.min(450, Math.max(58, Number(e.target.value) || 210))
                      }))
                    }
                    className="w-14 bg-transparent text-white font-bold text-xs border-none focus:ring-0 p-0 text-center"
                  />
                  <span className="text-[10px] text-slate-500">mm</span>
                </label>
                <span className="text-slate-500 font-bold">×</span>
                <label className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1">
                  <span className="text-[10px] text-slate-400">উচ্চতা:</span>
                  <input
                    type="number"
                    min={80}
                    max={650}
                    value={prefs.customHeightMm}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        customHeightMm: Math.min(650, Math.max(80, Number(e.target.value) || 297))
                      }))
                    }
                    className="w-14 bg-transparent text-white font-bold text-xs border-none focus:ring-0 p-0 text-center"
                  />
                  <span className="text-[10px] text-slate-500">mm</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {CUSTOM_DIMENSION_PRESETS.map((cp) => (
                  <button
                    key={cp.label}
                    type="button"
                    onClick={() =>
                      setPrefs((p) => ({ ...p, customWidthMm: cp.w, customHeightMm: cp.h }))
                    }
                    className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-200 border border-slate-700"
                  >
                    {cp.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color Mode & Custom Color Picker Row */}
          <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 px-1 flex items-center gap-1">
                <Palette className="w-3.5 h-3.5 text-amber-300" />
                কালার পরিবর্তন:
              </span>
              {COLOR_MODE_OPTIONS.map((cm) => {
                const isSelected = prefs.colorMode === cm.id;
                return (
                  <button
                    key={cm.id}
                    type="button"
                    onClick={() => updateColorMode(cm.id)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border transition-all ${
                      isSelected
                        ? 'bg-white text-slate-950 border-white shadow-xs'
                        : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                      style={{
                        backgroundColor: cm.id === 'custom' ? prefs.customAccentColor : cm.swatch
                      }}
                    />
                    <span>{cm.label}</span>
                  </button>
                );
              })}

              {/* Live Custom Color Picker */}
              <label
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg px-2 py-0.5 cursor-pointer text-[11px] font-bold text-amber-200"
                title="আপনার মন মতন যেকোনো রঙ বাছাই করুন"
              >
                <input
                  type="color"
                  value={prefs.customAccentColor}
                  onChange={(e) =>
                    setPrefs((p) => ({
                      ...p,
                      colorMode: 'custom',
                      customAccentColor: e.target.value
                    }))
                  }
                  className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
                />
                <span>কালার বাছাই</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShareDrawerTab((prev) => (prev === 'visual' ? 'none' : 'visual'))}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-colors ${
                  shareDrawerTab === 'visual'
                    ? 'bg-cyan-400 text-slate-950 border-cyan-200 font-black'
                    : 'bg-slate-800 hover:bg-slate-700 text-cyan-200 border-cyan-500/40'
                }`}
                title="হেডার, লোগো, স্বাক্ষর ও ফন্ট সাইজ পরিবর্তন করুন"
              >
                <Type className="w-3.5 h-3.5" />
                <span>
                  ভিজ্যুয়াল কন্ট্রোল
                  {(hiddenSectionsCount > 0 || prefs.fontScalePercent !== 100) && (
                    <span className="ml-1 px-1 py-0.2 rounded bg-cyan-500/30 text-[10px]">
                      {prefs.fontScalePercent}%{hiddenSectionsCount > 0 ? ` · -${hiddenSectionsCount}` : ''}
                    </span>
                  )}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShareDrawerTab((prev) => (prev === 'presets' ? 'none' : 'presets'))}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-colors ${
                  shareDrawerTab === 'presets'
                    ? 'bg-amber-500 text-slate-950 border-amber-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40'
                }`}
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                <span>সেভ করা প্রিসেট ({toBengaliNumber(presets.length)})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Third Row: Save for Later Print + Download PDF + Print + Share */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSaveForLaterPrint}
            disabled={isSavingForLater}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm transition-colors"
            title="সাইজ ও কালারসহ ডকুমেন্টটি অ্যাপে সেভ করে রাখুন যাতে যেকোনো সময় পরে প্রিন্ট করতে পারেন"
          >
            {isSavingForLater ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookmarkPlus className="w-4 h-4" />}
            <span>সেভ করে রাখুন (পরে প্রিন্ট)</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition-colors"
            title="নির্বাচিত সাইজ ও কালারে ডিভাইসে PDF ফাইল সেভ করুন"
          >
            {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>PDF সেভ (.pdf)</span>
          </button>

          <button
            type="button"
            onClick={handlePrintNow}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>প্রিন্ট করুন ({prefs.size})</span>
          </button>

          <button
            type="button"
            onClick={handleOpenPdfReader}
            disabled={isGeneratingPdf}
            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            <span>PDF Reader</span>
          </button>

          <button
            type="button"
            onClick={() => setShareDrawerTab((prev) => (prev === 'whatsapp' ? 'none' : 'whatsapp'))}
            className={`px-3 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-sm transition-colors ${
              shareDrawerTab === 'whatsapp'
                ? 'bg-[#128C7E] text-white ring-2 ring-[#25D366]'
                : 'bg-[#25D366] hover:bg-[#1ebe5d] text-slate-950'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={() => setShareDrawerTab((prev) => (prev === 'gmail' ? 'none' : 'gmail'))}
            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors ${
              shareDrawerTab === 'gmail'
                ? 'bg-rose-700 text-white ring-2 ring-rose-300'
                : 'bg-rose-600 hover:bg-rose-500 text-white'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Gmail</span>
          </button>

          <button
            type="button"
            onClick={() => handleSharePdfFileDirect('অন্য অ্যাপ / PDF Reader')}
            disabled={isGeneratingPdf}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700"
          >
            <Share2 className="w-3.5 h-3.5 text-amber-300" />
            <span>শেয়ার</span>
          </button>
        </div>

        {/* Helpful Mobile PrintSpooler Note */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 flex flex-wrap items-center justify-between gap-2">
          <span>
            💡 মোবাইলে প্রিন্টার অ্যাপ ডিফল্ট Letter/Legal দেখালে, <strong>&quot;PDF সেভ (.pdf)&quot;</strong> বা <strong>&quot;সেভ করে রাখুন&quot;</strong> দিয়ে সেভ করে প্রিন্ট করলে হুবহু আপনার নির্বাচিত <strong>{Math.round(widthMm)}×{Math.round(heightMm)}mm ({prefs.size})</strong> ও কালারে প্রিন্ট হবে।
          </span>
        </div>

        {/* Expandable Visual Controls Panel: Section Toggles & Font Size */}
        {shareDrawerTab === 'visual' && (
          <div className="bg-slate-900 border border-cyan-500/45 rounded-xl p-3 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-black text-cyan-300 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4" />
                <span>ভিজ্যুয়াল কন্ট্রোল — সেকশন লুকান/দেখান ও লেখার ফন্ট সাইজ পরিবর্তন করুন</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPrefs((p) => ({
                    ...p,
                    showHeader: true,
                    showLogo: true,
                    showSummary: true,
                    showTotals: true,
                    showAuditTimestamps: true,
                    showAddedBy: true,
                    showSignatures: true,
                    fontScalePercent: 100
                  }));
                  showToast('ভিজ্যুয়াল সেটিংস ডিফল্ট অবস্থায় (১০০% ফন্ট ও সব সেকশন দৃশ্যমান) রিসেট হয়েছে।');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>রিসেট করুন</span>
              </button>
            </div>

            {/* Section Toggle Switches */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">রিপোর্টের অংশসমূহ:</span>
              {(
                [
                  { key: 'showHeader', label: 'হেডার ও শিরোনাম' },
                  { key: 'showLogo', label: 'লোগো / ছবি' },
                  { key: 'showSummary', label: 'সারসংক্ষেপ ও AI কার্ড' },
                  { key: 'showTotals', label: 'মোট হিসাব (Totals)' },
                  { key: 'showAuditTimestamps', label: 'অডিট ও সময়' },
                  { key: 'showAddedBy', label: 'এন্ট্রিদাতা (Added By)' },
                  { key: 'showSignatures', label: 'সিল ও স্বাক্ষর এলাকা' }
                ] as const
              ).map((sec) => {
                const enabled = prefs[sec.key];
                return (
                  <button
                    key={sec.key}
                    type="button"
                    onClick={() =>
                      setPrefs((p) => ({ ...p, [sec.key]: !p[sec.key] }))
                    }
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border transition-all ${
                      enabled
                        ? 'bg-emerald-600/25 text-emerald-200 border-emerald-400/60 shadow-xs'
                        : 'bg-slate-950 text-slate-400 border-slate-700 line-through opacity-80'
                    }`}
                  >
                    {enabled ? (
                      <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                    )}
                    <span>{sec.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Font Size Stepper, Slider & Presets */}
            <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                  <Type className="w-3.5 h-3.5 text-cyan-300" />
                  ফন্ট সাইজ ({toBengaliNumber(prefs.fontScalePercent)}%):
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setPrefs((p) => ({
                      ...p,
                      fontScalePercent: Math.max(75, p.fontScalePercent - 5)
                    }))
                  }
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-black text-sm flex items-center justify-center"
                  title="ফন্ট ছোট করুন"
                >
                  −
                </button>

                <input
                  type="range"
                  min={75}
                  max={135}
                  step={5}
                  value={prefs.fontScalePercent}
                  onChange={(e) =>
                    setPrefs((p) => ({
                      ...p,
                      fontScalePercent: Number(e.target.value)
                    }))
                  }
                  className="w-32 sm:w-44 accent-cyan-400 cursor-pointer"
                  aria-label="প্রিন্ট ফন্ট সাইজ"
                />

                <button
                  type="button"
                  onClick={() =>
                    setPrefs((p) => ({
                      ...p,
                      fontScalePercent: Math.min(135, p.fontScalePercent + 5)
                    }))
                  }
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-black text-sm flex items-center justify-center"
                  title="ফন্ট বড় করুন"
                >
                  +
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {[
                  { label: 'ছোট (৮৫%)', value: 85 },
                  { label: 'স্বাভাবিক (১০০%)', value: 100 },
                  { label: 'বড় (১১৫%)', value: 115 },
                  { label: 'অতি বড় (১৩০%)', value: 130 }
                ].map((fp) => (
                  <button
                    key={fp.value}
                    type="button"
                    onClick={() =>
                      setPrefs((p) => ({ ...p, fontScalePercent: fp.value }))
                    }
                    className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-colors ${
                      prefs.fontScalePercent === fp.value
                        ? 'bg-cyan-400 text-slate-950 border-cyan-200'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    {fp.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Expandable Presets Drawer */}
        {shareDrawerTab === 'presets' && (
          <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-3 space-y-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-amber-300">
                নিজের সাইজ ও কালার প্রিসেট সেভ করুন (যাতে পরে ১ ক্লিকে প্রিন্ট করা যায়):
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="প্রিসেটের নাম (যেমন: অফিস A4 নীল)"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 w-52"
                />
                <button
                  type="button"
                  onClick={handleSaveSettingsAndPreset}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs"
                >
                  প্রিসেট সেভ করুন
                </button>
              </div>
            </div>

            {presets.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {presets.map((pr) => (
                  <div
                    key={pr.id}
                    className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg pl-2.5 pr-1 py-1"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setPrefs(pr.prefs);
                        showToast(`"${pr.name}" সেটিংস চালু হয়েছে!`);
                      }}
                      className="text-left text-[11px] font-bold text-white hover:text-amber-300 flex items-center gap-1.5"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{
                          backgroundColor: resolveAccentColors(
                            pr.prefs.colorMode,
                            pr.prefs.customAccentColor
                          ).accentHex
                        }}
                      />
                      <span>{pr.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresets(deletePrintPreset(pr.id))}
                      className="p-1 text-slate-400 hover:text-rose-400 rounded"
                      aria-label="মুছুন"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Expandable WhatsApp Share Drawer (Group + Personal) */}
        {shareDrawerTab === 'whatsapp' && (
          <div className="bg-slate-900 border border-[#25D366]/40 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="font-bold text-[#25D366] flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>WhatsApp গ্রুপ ও পারসোনাল নম্বরে PDF পাবলিকেশন</span>
              </div>
              <p className="text-[11px] text-slate-300">
                সরাসরি PDF ফাইল শেয়ার করুন অথবা পারসোনাল WhatsApp নম্বর লিখে পাঠান।
              </p>
              {(complaintGroupUrl || staffGroupUrl || partnerGroupUrl) && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {complaintGroupUrl && (
                    <a
                      href={complaintGroupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded-lg bg-emerald-900/70 hover:bg-emerald-800 text-emerald-200 text-[10px] font-bold flex items-center gap-1 border border-emerald-700"
                    >
                      <ExternalLink className="w-3 h-3" />
                      অভিযোগ গ্রুপ
                    </a>
                  )}
                  {staffGroupUrl && (
                    <a
                      href={staffGroupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded-lg bg-emerald-900/70 hover:bg-emerald-800 text-emerald-200 text-[10px] font-bold flex items-center gap-1 border border-emerald-700"
                    >
                      <ExternalLink className="w-3 h-3" />
                      স্টাফ গ্রুপ
                    </a>
                  )}
                  {partnerGroupUrl && (
                    <a
                      href={partnerGroupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded-lg bg-emerald-900/70 hover:bg-emerald-800 text-emerald-200 text-[10px] font-bold flex items-center gap-1 border border-emerald-700"
                    >
                      <ExternalLink className="w-3 h-3" />
                      পার্টনার গ্রুপ
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5">
                <Smartphone className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
                <input
                  type="tel"
                  value={personalWhatsAppPhone}
                  onChange={(e) => setPersonalWhatsAppPhone(e.target.value)}
                  placeholder="পারসোনাল নম্বর (017...)"
                  className="bg-transparent text-xs text-white placeholder:text-slate-500 border-none focus:ring-0 w-40 p-0"
                />
              </div>

              <button
                type="button"
                onClick={() => handleSendWhatsApp('file')}
                disabled={isGeneratingPdf}
                className="px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-slate-950 font-black text-xs flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>PDF সহ WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendWhatsApp('group')}
                disabled={isGeneratingPdf}
                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs"
              >
                গ্রুপে পাঠান
              </button>

              <button
                type="button"
                onClick={() => handleSendWhatsApp('personal')}
                disabled={isGeneratingPdf}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
              >
                পারসোনাল
              </button>
            </div>
          </div>
        )}

        {/* Expandable Gmail Drawer */}
        {shareDrawerTab === 'gmail' && (
          <div className="bg-slate-900 border border-rose-500/40 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div>
              <div className="font-bold text-rose-300 flex items-center gap-1.5">
                <Mail className="w-4 h-4" />
                <span>Gmail-এ PDF রিপোর্ট ও বিবরণী পাঠান</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                মোবাইলে সরাসরি PDF ফাইল সহ Gmail শেয়ার হবে; ডেস্কটপে PDF ডাউনলোড হয়ে Gmail কম্পোজ চালু হবে।
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <input
                type="email"
                value={gmailRecipient}
                onChange={(e) => setGmailRecipient(e.target.value)}
                placeholder="প্রাপকের Gmail (ঐচ্ছিক)"
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 w-52 focus:ring-1 focus:ring-rose-500"
              />
              <button
                type="button"
                onClick={() => handleSendGmail(true)}
                disabled={isGeneratingPdf}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>PDF সহ Gmail-এ পাঠান</span>
              </button>
            </div>
          </div>
        )}

        {/* Live Status Toast */}
        {statusToast && (
          <div className="bg-emerald-900/90 border border-emerald-500/60 text-emerald-100 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusToast}</span>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PREVIEW / PRINT STAGE, PDF READER, OR SAVED PRINT ARCHIVE       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div
        ref={previewWrapRef}
        className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-800/80 p-3 sm:p-6 flex justify-center items-start print:overflow-visible print:p-0 print:bg-white print:block"
      >
        {viewMode === 'saved_archive' ? (
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-300 overflow-hidden print:hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-amber-400" />
                <div>
                  <h4 className="text-sm font-black">সংরক্ষিত প্রিন্ট তালিকা (পরে প্রিন্ট করার জন্য সেভকৃত)</h4>
                  <p className="text-[11px] text-slate-300">
                    সেভ করা যেকোনো ডকুমেন্টের সাইজ ও কালার পরিবর্তন করে আবার প্রিন্ট বা PDF ডাউনলোড করুন।
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewMode('paper')}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
              >
                বর্তমান প্রিভিউতে ফিরুন
              </button>
            </div>

            {savedDocs.length === 0 ? (
              <div className="p-10 text-center space-y-2 text-slate-500">
                <BookmarkPlus className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">এখনো কোনো ডকুমেন্ট সেভ করা হয়নি</p>
                <p className="text-xs">
                  উপরের <strong>&quot;সেভ করে রাখুন (পরে প্রিন্ট)&quot;</strong> বাটনে ক্লিক করলে আপনার নির্বাচিত সাইজ ও কালারসহ এখানে সেভ হয়ে থাকবে।
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {savedDocs.map((doc) => {
                  const palette = resolveAccentColors(
                    doc.prefs.colorMode,
                    doc.prefs.customAccentColor
                  );
                  return (
                    <div
                      key={doc.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: palette.accentHex }}
                          />
                          <h5 className="text-sm font-bold text-slate-900 truncate">{doc.title}</h5>
                        </div>
                        <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-2">
                          <span>
                            সাইজ:{' '}
                            <strong>
                              {doc.prefs.size === 'Custom'
                                ? `${doc.prefs.customWidthMm}×${doc.prefs.customHeightMm}mm`
                                : doc.prefs.size}
                            </strong>{' '}
                            ({doc.prefs.orientation === 'portrait' ? 'লম্বালম্বি' : 'আড়াআড়ি'})
                          </span>
                          <span>•</span>
                          <span>
                            কালার: <strong>{COLOR_THEMES[doc.prefs.colorMode]?.label || 'রঙিন'}</strong>
                          </span>
                          <span>•</span>
                          <span>সেভ: {new Date(doc.savedAt).toLocaleString('bn-BD')}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleLoadSavedDocument(doc)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300"
                        >
                          খুলুন ও এডিট
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLoadSavedDocument(doc, 'print')}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>প্রিন্ট</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLoadSavedDocument(doc, 'pdf')}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSavedDocument(doc.id)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : viewMode === 'pdf_reader' && pdfResult ? (
          <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-700 print:hidden">
            <div className="bg-slate-100 border-b border-slate-300 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="font-bold text-slate-800 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>{pdfResult.fileName}</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold">
                  {pdfResult.pageCount} পৃষ্ঠা ({prefs.size})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={pdfResult.blobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>আলাদা PDF Reader-এ খুলুন</span>
                </a>
                <button
                  type="button"
                  onClick={() => triggerPdfDownload(pdfResult.blob, pdfResult.fileName)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>সেভ / ডাউনলোড</span>
                </button>
              </div>
            </div>
            <iframe
              src={pdfResult.blobUrl}
              title={pdfResult.fileName}
              className="w-full h-[75vh] bg-slate-200"
            />
          </div>
        ) : (
          /* Visual Scaled Wrapper so even 794px A4/Legal/Custom fits cleanly on a 360px phone screen */
          <div
            className="print:!w-full print:!transform-none print:!m-0"
            style={{
              width: `${Math.round(paperWidthPx * visualFitScale)}px`,
              transition: 'width 150ms ease'
            }}
          >
            <div
              className="origin-top-left print:!transform-none print:!w-full"
              style={{
                width: `${paperWidthPx}px`,
                transform: visualFitScale < 1 ? `scale(${visualFitScale})` : 'none'
              }}
            >
              {/* Scoped dynamic color theme styling for Preview & Print */}
              {scopedThemeCss && <style>{scopedThemeCss}</style>}

              {/* Actual Capture & Print White Paper Surface */}
              <div
                id="print-studio-capture-surface"
                ref={captureRef}
                className="bg-white text-slate-900 shadow-2xl rounded-sm print:shadow-none print:rounded-none print:!p-0 overflow-hidden"
                style={{
                  width: `${paperWidthPx}px`,
                  paddingTop: `${Math.round(prefs.marginTopMm * 3.7795)}px`,
                  paddingRight: `${Math.round(prefs.marginRightMm * 3.7795)}px`,
                  paddingBottom: `${Math.round(prefs.marginBottomMm * 3.7795)}px`,
                  paddingLeft: `${Math.round(prefs.marginLeftMm * 3.7795)}px`,
                  boxSizing: 'border-box'
                }}
              >
                {/* Live Color Accent Top Strip matching user's chosen print color */}
                <div
                  className="print-theme-accent-bar w-full h-1.5 rounded-full mb-3"
                  style={{ backgroundColor: activeColorPalette.accentHex }}
                />

                <div
                  ref={contentBodyRef}
                  data-print-body="true"
                  className="print:w-full"
                  style={{
                    transform: prefs.scalePercent !== 100 ? `scale(${prefs.scalePercent / 100})` : 'none',
                    transformOrigin: 'top left',
                    width: prefs.scalePercent !== 100 ? `${Math.round(10000 / prefs.scalePercent)}%` : '100%'
                  }}
                >
                  {activeSavedHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: activeSavedHtml.html }} />
                  ) : (
                    children
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(studioContent, document.body) : null;
};
