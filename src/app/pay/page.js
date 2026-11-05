'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import QRScanner from '../../components/QRScanner';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../utils/db';
import { useApp } from '../../context/AppContext';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  IndianRupee,
  User,
  AtSign,
  ArrowRight,
  Folder,
  Layers,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  RotateCcw,
  Copy,
  Check,
  ShieldAlert,
  Zap,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ─── Platform detection ───────────────────────────────────────────────────────
const isIOS = () =>
  typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
const isAndroid = () =>
  typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

// Supported UPI applications for direct app launching & iOS scheme rewrites
const IOS_APP_KEY = 'kharch_preferred_upi_app';
const UPI_APPS = [
  { id: 'gpay', name: 'Google Pay', short: 'GPay', scheme: 'tez://', iosDeepLinkPrefix: 'tez://upi/pay?', color: 'border-blue-500/30 bg-blue-500/10 text-blue-300' },
  { id: 'phonepe', name: 'PhonePe', short: 'PhonePe', scheme: 'phonepe://', iosDeepLinkPrefix: 'phonepe://pay?', color: 'border-purple-500/30 bg-purple-500/10 text-purple-300' },
  { id: 'paytm', name: 'Paytm', short: 'Paytm', scheme: 'paytmmp://', iosDeepLinkPrefix: 'paytmmp://pay?', color: 'border-sky-500/30 bg-sky-500/10 text-sky-300' },
  { id: 'bhim', name: 'BHIM', short: 'BHIM', scheme: 'bhim://', iosDeepLinkPrefix: 'bhim://upi/pay?', color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
];

// ─── Exact UPI QR Parser & Verification Checker ──────────────────────────────
/**
 * Rule 1: Never Rebuild the upi://pay URI from Scratch
 * Parse pa, pn, am, mc, and sign using new URL(rawPayload) ONLY to display
 * the merchant name and check verification status in the UI.
 * NEVER overwrite or add &tr=<paymentAttemptId> to the upi://pay URL.
 * NEVER strip mc, orgid, sign, tid, or mode from rawPayload.
 *
 * Rule 2: Detect Verified Merchant (P2M) vs Unverified Personal (P2P) QR
 * const urlObj = new URL(rawPayload);
 * const mc = urlObj.searchParams.get('mc');
 * const sign = urlObj.searchParams.get('sign');
 * const isVerifiedMerchant = Boolean(mc && mc !== '0000' && sign);
 */
function parseUPIPayload(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return {
      pa: '',
      pn: '',
      am: '',
      cu: 'INR',
      mc: '',
      sign: '',
      rawPayload: '',
      isVerifiedMerchant: false,
    };
  }

  const trimmed = rawText.trim();

  // 1. Standard UPI URI parsing via new URL
  try {
    let urlToParse = trimmed;
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(urlToParse)) {
      urlToParse = trimmed.includes('?')
        ? `upi://pay${trimmed.substring(trimmed.indexOf('?'))}`
        : `upi://pay?pa=${trimmed}`;
    }

    const urlObj = new URL(urlToParse);
    const pa = urlObj.searchParams.get('pa') || urlObj.searchParams.get('PA') || '';
    let pn = urlObj.searchParams.get('pn') || urlObj.searchParams.get('PN') || '';
    const tn = urlObj.searchParams.get('tn') || urlObj.searchParams.get('TN') || '';
    const am = urlObj.searchParams.get('am') || urlObj.searchParams.get('AM') || '';
    const cu = urlObj.searchParams.get('cu') || urlObj.searchParams.get('CU') || 'INR';
    const mc = urlObj.searchParams.get('mc') || urlObj.searchParams.get('MC') || '';
    const sign = urlObj.searchParams.get('sign') || urlObj.searchParams.get('SIGN') || '';

    // If pn is generic processor name but trade name (tn) is present, use tn
    if ((!pn || ['paytm', 'paytm merchant', 'upi', 'google pay', 'phonepe'].includes(pn.toLowerCase())) && tn) {
      pn = tn;
    }

    // Exact Rule 2:
    const isVerifiedMerchant = Boolean(mc && mc !== '0000' && sign);

    return {
      pa: pa.trim(),
      pn: (pn || pa).trim(),
      am: am.trim(),
      cu: (cu || 'INR').trim(),
      mc: mc.trim(),
      sign: sign.trim(),
      rawPayload: trimmed,
      isVerifiedMerchant,
    };
  } catch (err) {
    console.warn('URL parsing failed, checking fallback formats:', err);
  }

  // 2. BharatQR / EMVCo TLV Format fallback (starts with "000201")
  if (trimmed.startsWith('000201')) {
    try {
      let i = 0;
      const tags = {};
      while (i < trimmed.length - 4) {
        const tag = trimmed.substring(i, i + 2);
        const len = parseInt(trimmed.substring(i + 2, i + 4), 10);
        if (isNaN(len)) break;
        const val = trimmed.substring(i + 4, i + 4 + len);
        tags[tag] = val;
        i += 4 + len;
      }
      let pn = tags['59'] || '';
      let am = tags['54'] || '';
      let pa = '';
      const merchantInfo = tags['26'] || tags['27'] || tags['28'] || '';
      if (merchantInfo) {
        const vpaMatch = merchantInfo.match(/[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/);
        if (vpaMatch) pa = vpaMatch[0];
      }
      const mc = tags['52'] || '';
      return {
        pa: pa.trim(),
        pn: (pn || pa).trim(),
        am: am.trim(),
        cu: 'INR',
        mc: mc.trim(),
        sign: '',
        rawPayload: trimmed,
        isVerifiedMerchant: false,
      };
    } catch (e) {
      console.warn('EMVCo decode issue:', e);
    }
  }

  // 3. Raw VPA fallback
  const vpaMatch = trimmed.match(/[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/);
  if (vpaMatch) {
    return {
      pa: vpaMatch[0],
      pn: vpaMatch[0],
      am: '',
      cu: 'INR',
      mc: '',
      sign: '',
      rawPayload: `upi://pay?pa=${vpaMatch[0]}`,
      isVerifiedMerchant: false,
    };
  }

  return {
    pa: '',
    pn: '',
    am: '',
    cu: 'INR',
    mc: '',
    sign: '',
    rawPayload: trimmed,
    isVerifiedMerchant: false,
  };
}

// ─── Rule 3: Deep Link Launcher for Verified Merchants ───────────────────────
/**
 * If isVerifiedMerchant === true:
 * - If original QR did not already include an am parameter and user typed an amount,
 *   append &am=${Number(amount).toFixed(2)}&cu=INR to the end of rawPayload.
 * - On iOS, rewrite only the scheme prefix (tez://upi/pay?, phonepe://pay?, paytmmp://pay?, bhim://upi/pay?)
 *   while keeping all query parameters untouched.
 * - On Android, launch the rawPayload URI directly with upi://pay scheme untouched.
 * - NEVER add &tr=<paymentAttemptId>.
 */
function buildVerifiedPaymentUrl({ rawPayload, amount, preferredIosApp }) {
  let finalUri = rawPayload.trim();

  // If the original QR did not already include an am parameter and user typed an amount:
  const hasAmParam = /[?&]am=/i.test(finalUri);
  if (!hasAmParam && amount && Number(amount) > 0) {
    const separator = finalUri.includes('?') ? '&' : '?';
    finalUri = `${finalUri}${separator}am=${Number(amount).toFixed(2)}&cu=INR`;
  }

  // On iOS: rewrite only the scheme prefix while keeping all original parameters untouched
  if (isIOS()) {
    const selectedApp = UPI_APPS.find((a) => a.id === preferredIosApp) || UPI_APPS[0];
    const targetPrefix = selectedApp.iosDeepLinkPrefix;

    if (/^upi:\/\/pay\?/i.test(finalUri)) {
      return finalUri.replace(/^upi:\/\/pay\?/i, targetPrefix);
    }
    if (/^upi:\/\/pay/i.test(finalUri)) {
      return finalUri.replace(/^upi:\/\/pay/i, targetPrefix.replace(/\?$/, ''));
    }
    if (finalUri.includes('?')) {
      return `${targetPrefix}${finalUri.substring(finalUri.indexOf('?') + 1)}`;
    }
  }

  // On Android / Desktop:
  // Fire the preserved raw URI with standard upi://pay scheme
  if (/^upi:\/\/pay/i.test(finalUri)) {
    return finalUri;
  }
  if (finalUri.includes('?')) {
    return `upi://pay${finalUri.substring(finalUri.indexOf('?'))}`;
  }

  return finalUri;
}

// ─── Merchant Memory Helpers ──────────────────────────────────────────────────
async function lookupMerchantMapping(apiFetch, identifierKey) {
  if (!identifierKey) return null;
  try {
    const res = await apiFetch(`/api/merchant-mappings?key=${encodeURIComponent(identifierKey.toLowerCase().trim())}`);
    return res?.mapping || null;
  } catch {
    return null;
  }
}

async function saveMerchantMapping(apiFetch, { identifierKey, canonicalTitle, spaceId, importance }) {
  if (!identifierKey || !canonicalTitle || !spaceId) return;
  try {
    await apiFetch('/api/merchant-mappings', {
      method: 'POST',
      body: JSON.stringify({ identifierKey: identifierKey.toLowerCase().trim(), canonicalTitle, spaceId, importance }),
    });
  } catch {}
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PayPage() {
  const router = useRouter();
  const { spaces, activeSpaceId, apiFetch, refreshDashboard } = useApp();

  const [formData, setFormData] = useState({
    pa: '',
    pn: '',
    am: '',
    cu: 'INR',
    mc: '',
    sign: '',
    rawPayload: '',
  });
  const [isVerifiedMerchant, setIsVerifiedMerchant] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [importance, setImportance] = useState('moderate');
  const [note, setNote] = useState('');
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [showDefaultAppHelp, setShowDefaultAppHelp] = useState(false);
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [paymentState, setPaymentState] = useState('SCANNING'); // SCANNING | FORM | RETURNED | SUCCESS | UNKNOWN
  const [activeAttempt, setActiveAttempt] = useState(null);
  const [merchantSuggestion, setMerchantSuggestion] = useState(null);
  const [preferredIosApp, setPreferredIosApp] = useState('gpay');
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const showToast = (msg, duration = 3500) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), duration);
  };

  // Load iOS preferred app from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(IOS_APP_KEY);
      if (saved) setPreferredIosApp(saved);
    }
  }, []);

  const setAndSavePreferredIosApp = (appId) => {
    setPreferredIosApp(appId);
    if (typeof window !== 'undefined') localStorage.setItem(IOS_APP_KEY, appId);
  };

  // Sync default space
  useEffect(() => {
    if (activeSpaceId) {
      setSelectedSpaceId(activeSpaceId);
    } else if (spaces?.length > 0) {
      setSelectedSpaceId(spaces[0]._id);
    }
  }, [activeSpaceId, spaces]);

  // Clean stale pending attempts (> 90s) and detect active PENDING state on return
  const checkPendingPayments = useCallback(async () => {
    try {
      const now = Date.now();
      const cutoffTime = now - 90 * 1000;

      const stale = await db.paymentAttempts
        .where('status').equals('PENDING')
        .filter((a) => a.initiatedAt < cutoffTime)
        .toArray();
      for (const s of stale) {
        await db.paymentAttempts.update(s.paymentAttemptId, { status: 'UNKNOWN' });
      }

      const activePending = await db.paymentAttempts
        .where('status').equals('PENDING')
        .filter((a) => a.initiatedAt >= cutoffTime)
        .first();

      if (activePending) {
        setActiveAttempt(activePending);
        if (activePending.spaceId) setSelectedSpaceId(activePending.spaceId);
        if (activePending.importance) setImportance(activePending.importance);
        setPaymentState('RETURNED');
      }
    } catch (err) {
      console.error('Error checking pending payments:', err);
    }
  }, []);

  useEffect(() => {
    checkPendingPayments();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkPendingPayments();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkPendingPayments]);

  const handleScanSuccess = useCallback(async (decodedText) => {
    const parsed = parseUPIPayload(decodedText);

    setIsVerifiedMerchant(parsed.isVerifiedMerchant);
    setFormData(parsed);

    // Look up merchant memory in Dexie + server
    if (parsed.pa) {
      try {
        const localMapping = await db.merchantMappings
          .where('identifierKey')
          .equals(parsed.pa.toLowerCase().trim())
          .first();

        if (localMapping) {
          setMerchantSuggestion({
            canonicalTitle: localMapping.canonicalTitle,
            spaceId: localMapping.spaceId,
            importance: localMapping.importance,
          });
          setImportance(localMapping.importance || 'moderate');
          if (localMapping.spaceId) setSelectedSpaceId(localMapping.spaceId);
          if (!parsed.pn && localMapping.canonicalTitle) {
            setFormData((prev) => ({ ...prev, pn: localMapping.canonicalTitle }));
          }
        } else {
          const serverMapping = await lookupMerchantMapping(apiFetch, parsed.pa);
          if (serverMapping) {
            setMerchantSuggestion({
              canonicalTitle: serverMapping.canonicalTitle,
              spaceId: serverMapping.spaceId,
              importance: serverMapping.importance,
            });
            setImportance(serverMapping.importance || 'moderate');
            if (serverMapping.spaceId) setSelectedSpaceId(serverMapping.spaceId);
            if (!parsed.pn) setFormData((prev) => ({ ...prev, pn: serverMapping.canonicalTitle }));

            await db.merchantMappings.put({
              identifierKey: parsed.pa.toLowerCase().trim(),
              canonicalTitle: serverMapping.canonicalTitle,
              spaceId: serverMapping.spaceId,
              importance: serverMapping.importance,
              usageCount: serverMapping.usageCount || 1,
              lastUsedAt: Date.now(),
            });
          } else {
            setMerchantSuggestion(null);
          }
        }
      } catch {}
    }

    setPaymentState('FORM');
  }, [apiFetch]);

  const handleResetScan = () => {
    setFormData({ pa: '', pn: '', am: '', cu: 'INR', mc: '', sign: '', rawPayload: '' });
    setActiveAttempt(null);
    setIsVerifiedMerchant(false);
    setMerchantSuggestion(null);
    setPaymentState('SCANNING');
  };

  // ── Save merchant memory after payment completion ────────────────────────────
  const persistMerchantMemory = useCallback(async () => {
    const vpa = formData.pa?.trim();
    const title = formData.pn?.trim() || note?.trim();
    if (!vpa || !title || !selectedSpaceId) return;

    const identifierKey = vpa.toLowerCase();

    try {
      const existing = await db.merchantMappings.where('identifierKey').equals(identifierKey).first();
      if (existing) {
        await db.merchantMappings.update(existing.id, {
          canonicalTitle: title,
          spaceId: selectedSpaceId,
          importance,
          usageCount: (existing.usageCount || 0) + 1,
          lastUsedAt: Date.now(),
        });
      } else {
        await db.merchantMappings.add({
          identifierKey,
          canonicalTitle: title,
          spaceId: selectedSpaceId,
          importance,
          usageCount: 1,
          lastUsedAt: Date.now(),
        });
      }
    } catch {}

    saveMerchantMapping(apiFetch, { identifierKey, canonicalTitle: title, spaceId: selectedSpaceId, importance });
  }, [formData, note, selectedSpaceId, importance, apiFetch]);

  // ── Rule 3: Proceed to Pay Handler ───────────────────────────────────────────
  const handleProceedToPay = async (e) => {
    if (e?.preventDefault) e.preventDefault();

    if (!formData.pa) {
      alert('Payee UPI ID (VPA) is required');
      return;
    }
    if (!formData.am || parseFloat(formData.am) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const amountVal = parseFloat(formData.am);
    const paymentAttemptId = uuidv4();

    const attempt = {
      paymentAttemptId,
      payeeVpa: formData.pa.trim(),
      payeeName: formData.pn.trim() || formData.pa.trim(),
      amount: amountVal,
      status: 'PENDING',
      initiatedAt: Date.now(),
      rawPayload: formData.rawPayload,
      spaceId: selectedSpaceId,
      importance,
      note: note.trim(),
      isVerifiedMerchant,
    };

    // 1. Save PaymentAttempt to Dexie.js
    await db.paymentAttempts.add(attempt);
    setActiveAttempt(attempt);

    // 2. Sync to backend (fire-and-forget)
    apiFetch('/api/payment-attempts', {
      method: 'POST',
      body: JSON.stringify({
        paymentAttemptId,
        type: 'expense',
        amount: amountVal,
        payeeVpa: formData.pa.trim(),
        payeeName: formData.pn.trim() || formData.pa.trim(),
        initiatedAt: new Date(attempt.initiatedAt),
        status: 'PENDING',
      }),
    }).catch(() => {});

    // ── CASE 1: Verified Merchant (P2M) ───────────────────────────────────────
    if (isVerifiedMerchant) {
      const finalUrl = buildVerifiedPaymentUrl({
        rawPayload: formData.rawPayload,
        amount: amountVal,
        preferredIosApp,
      });

      // Launch preserved raw URI
      window.location.href = finalUrl;
      return;
    }

    // ── CASE 2: Unverified Personal / Street Vendor QR (P2P) ──────────────────
    // Because NPCI blocks upi://pay deep links to unverified personal UPI IDs across all apps,
    // do NOT fire upi://pay?pa=... directly.
    try {
      await navigator.clipboard.writeText(formData.pa.trim());
      setCopiedVpa(true);
      setTimeout(() => setCopiedVpa(false), 3000);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }

    showToast(`Unverified shop QR: Copied UPI ID (${formData.pa.trim()})! Paste it inside your UPI app to pay.`, 4500);

    // Launch preferred app scheme without upi://pay parameters
    const targetScheme = isIOS()
      ? (UPI_APPS.find((a) => a.id === preferredIosApp)?.scheme || 'tez://')
      : 'phonepe://';

    setTimeout(() => {
      window.location.href = targetScheme;
    }, 500);
  };

  // ── Quick App Button Handler for Unverified QRs ──────────────────────────────
  const handleLaunchApp = async (appScheme, appName) => {
    if (!formData.pa) return;
    if (!formData.am || parseFloat(formData.am) <= 0) {
      alert('Please enter a valid amount first');
      return;
    }

    const amountVal = parseFloat(formData.am);
    const paymentAttemptId = uuidv4();

    const attempt = {
      paymentAttemptId,
      payeeVpa: formData.pa.trim(),
      payeeName: formData.pn.trim() || formData.pa.trim(),
      amount: amountVal,
      status: 'PENDING',
      initiatedAt: Date.now(),
      rawPayload: formData.rawPayload,
      spaceId: selectedSpaceId,
      importance,
      note: note.trim(),
      isVerifiedMerchant: false,
    };

    await db.paymentAttempts.add(attempt);
    setActiveAttempt(attempt);

    apiFetch('/api/payment-attempts', {
      method: 'POST',
      body: JSON.stringify({
        paymentAttemptId,
        type: 'expense',
        amount: amountVal,
        payeeVpa: formData.pa.trim(),
        payeeName: formData.pn.trim() || formData.pa.trim(),
        initiatedAt: new Date(attempt.initiatedAt),
        status: 'PENDING',
      }),
    }).catch(() => {});

    try {
      await navigator.clipboard.writeText(formData.pa.trim());
      setCopiedVpa(true);
      setTimeout(() => setCopiedVpa(false), 3000);
    } catch {}

    showToast(`Unverified shop QR: Copied UPI ID (${formData.pa.trim()})! Opening ${appName}...`, 4000);

    setTimeout(() => {
      window.location.href = appScheme;
    }, 400);
  };

  // ── Copy VPA Only Helper ─────────────────────────────────────────────────────
  const handleCopyVpaOnly = async () => {
    if (!formData.pa) return;
    try {
      await navigator.clipboard.writeText(formData.pa.trim());
      setCopiedVpa(true);
      setTimeout(() => setCopiedVpa(false), 3000);
      showToast(`Copied ${formData.pa.trim()} to clipboard!`);
    } catch {}
  };

  // ── Confirm payment returned from UPI app ────────────────────────────────────
  const handleSaveTransaction = async (isSuccess) => {
    if (!activeAttempt) return;

    if (!isSuccess) {
      await db.paymentAttempts.update(activeAttempt.paymentAttemptId, { status: 'FAILED' });
      apiFetch(`/api/payment-attempts/${activeAttempt.paymentAttemptId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'FAILED' }),
      }).catch(() => {});
      handleResetScan();
      return;
    }

    // Save as successful transaction
    try {
      const targetSpace = selectedSpaceId || activeAttempt.spaceId || activeSpaceId;
      const titleName = formData.pn?.trim() || activeAttempt.payeeName || activeAttempt.payeeVpa || 'UPI Payment';

      const res = await apiFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
          spaceId: targetSpace,
          type: 'expense',
          amount: activeAttempt.amount,
          title: titleName,
          importance: importance || activeAttempt.importance || 'moderate',
          date: new Date().toISOString(),
          note: note || activeAttempt.note || `Paid to ${activeAttempt.payeeName || activeAttempt.payeeVpa}`,
        }),
      });

      if (res && !res.error) {
        const txId = res._id || res.transaction?._id;
        await db.paymentAttempts.update(activeAttempt.paymentAttemptId, {
          status: 'SUCCESS',
          linkedTransactionId: txId,
        });
        apiFetch(`/api/payment-attempts/${activeAttempt.paymentAttemptId}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'SUCCESS', linkedTransactionId: txId }),
        }).catch(() => {});

        await persistMerchantMemory();
        await refreshDashboard(targetSpace);
        setPaymentState('SUCCESS');
      } else {
        alert(res?.error || 'Could not save transaction to ledger');
      }
    } catch (err) {
      console.error('Failed to finalize transaction:', err);
      alert('Could not save transaction to ledger');
    }
  };

  const ios = isIOS();

  return (
    <div className="flex flex-col gap-5 mt-2">
      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-xl animate-fade-in max-w-xs text-center pointer-events-none">
          {toast}
        </div>
      )}

      {/* Top Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (paymentState === 'FORM') handleResetScan();
              else router.push('/add');
            }}
            className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white cursor-pointer active:scale-95 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-white font-display tracking-tight flex items-center gap-2">
              <Camera className="w-5 h-5 text-indigo-400" />
              Scan &amp; Pay via UPI
            </h1>
            <span className="text-[11px] text-slate-400">Scan UPI QR and log payment automatically</span>
          </div>
        </div>

        {paymentState === 'FORM' && (
          <button
            onClick={handleResetScan}
            className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-indigo-400 flex items-center gap-1 text-xs font-bold transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── 1. SCANNING STATE ───────────────────────────────────────────────── */}
      {paymentState === 'SCANNING' && (
        <div className="flex flex-col gap-4 items-center">
          <QRScanner onScanSuccess={handleScanSuccess} />
          <p className="text-center text-xs text-slate-400 font-medium">
            Point camera at any UPI QR code or upload a screenshot from your gallery.
          </p>
        </div>
      )}

      {/* ── 2. FORM STATE ───────────────────────────────────────────────────── */}
      {paymentState === 'FORM' && (
        <form onSubmit={handleProceedToPay} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 animate-fade-in">

          {/* Verification Status Banner */}
          {isVerifiedMerchant ? (
            <div className="flex items-center gap-2.5 p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-[11px] font-bold text-emerald-200">Verified Merchant QR (P2M)</p>
                <p className="text-[10px] text-emerald-400/90 leading-tight">
                  Cryptographically signed merchant QR ({formData.mc || 'Merchant'}). Direct 1-tap checkout enabled.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-amber-200">Unverified Shop / Personal QR (P2P)</p>
                <p className="text-[10px] text-amber-300/90 mt-0.5 leading-relaxed">
                  NPCI blocks direct browser payment links to unverified personal UPI IDs across all apps. Tapping <strong>Proceed to Pay</strong> copies the UPI ID and opens your UPI app to paste and pay safely.
                </p>
              </div>
            </div>
          )}

          {/* Merchant Auto-Memory Banner */}
          {merchantSuggestion && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
              <Zap className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <p className="text-[11px] text-indigo-200">
                <strong>Remembered:</strong> Auto-filled &ldquo;{merchantSuggestion.canonicalTitle}&rdquo; from your previous payment.
              </p>
            </div>
          )}

          {/* iOS App Selector (shown only on iOS) */}
          {ios && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-indigo-400" /> Open With (iPhone)
              </span>
              <div className="flex gap-2">
                {UPI_APPS.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => setAndSavePreferredIosApp(app.id)}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-xl border transition-all cursor-pointer ${
                      preferredIosApp === app.id
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    {app.short}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Amount */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <IndianRupee className="w-3.5 h-3.5 text-indigo-400" /> Amount (INR)
            </span>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-2xl font-black text-indigo-400">₹</span>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.am}
                onChange={(e) => setFormData({ ...formData, am: e.target.value })}
                className="w-full pl-9 pr-4 py-3.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-2xl text-2xl font-black text-white outline-none transition-colors"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Payee Name */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" /> Payee Name
              </span>
              <span className="text-[9px] text-indigo-400 font-semibold">Editable</span>
            </div>
            <input
              type="text"
              placeholder="Merchant or Friend's Name"
              value={formData.pn}
              onChange={(e) => setFormData({ ...formData, pn: e.target.value })}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-sm font-bold text-white outline-none transition-colors"
            />
          </div>

          {/* VPA */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <AtSign className="w-3.5 h-3.5 text-slate-400" /> Payee UPI ID (VPA)
            </span>
            <input
              type="text"
              placeholder="e.g. merchant@upi"
              value={formData.pa}
              onChange={(e) => setFormData({ ...formData, pa: e.target.value })}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-sm font-mono text-indigo-300 outline-none transition-colors"
              required
            />
          </div>

          {/* Space & Importance */}
          <div className="grid grid-cols-2 gap-3 mt-1">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Folder className="w-3 h-3 text-slate-400" /> Space
              </span>
              <select
                value={selectedSpaceId}
                onChange={(e) => setSelectedSpaceId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 outline-none cursor-pointer"
              >
                {spaces.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3 text-slate-400" /> Importance
              </span>
              <select
                value={importance}
                onChange={(e) => setImportance(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 outline-none cursor-pointer"
              >
                <option value="essential">Essential</option>
                <option value="moderate">Moderate</option>
                <option value="low_value">Low Value</option>
              </select>
            </div>
          </div>

          {/* Note */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Optional Note</span>
            <input
              type="text"
              placeholder="e.g. Chai / Groceries / Dinner"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-slate-200 outline-none transition-colors"
            />
          </div>

          {/* Raw Payload Accordion */}
          {formData.rawPayload && (
            <div className="border border-slate-800 rounded-xl overflow-hidden mt-1">
              <button
                type="button"
                onClick={() => setShowRawPayload(!showRawPayload)}
                className="w-full px-3 py-2 bg-slate-950 flex items-center justify-between text-[10px] font-bold text-slate-400 hover:text-slate-300 cursor-pointer"
              >
                <span>Raw QR Payload</span>
                {showRawPayload ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showRawPayload && (
                <div className="p-3 bg-slate-950/60 font-mono text-[9px] text-slate-500 break-all select-all border-t border-slate-800">
                  {formData.rawPayload}
                </div>
              )}
            </div>
          )}

          {/* Quick App Buttons for Unverified Street Vendor QRs */}
          {!isVerifiedMerchant && (
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-indigo-400" /> Quick Open App &amp; Pay
                </span>
                <span className="text-[9px] text-indigo-400/90 font-semibold">Auto-copies UPI ID</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {UPI_APPS.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => handleLaunchApp(app.scheme, app.name)}
                    className={`py-2.5 px-1 bg-slate-950 hover:bg-slate-800 border rounded-xl text-center text-[11px] font-bold transition-all cursor-pointer active:scale-95 flex flex-col items-center justify-center gap-1 shadow-sm ${app.color}`}
                  >
                    <span>{app.short}</span>
                    <span className="text-[9px] text-slate-400">Open ↗</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Primary Action Button */}
          {isVerifiedMerchant ? (
            <button
              type="submit"
              className="w-full py-4 mt-2 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-2xl text-white font-black text-sm tracking-wide shadow-lg shadow-indigo-500/20 active:scale-98 hover:from-indigo-600 hover:to-violet-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {formData.am && parseFloat(formData.am) > 0
                  ? `Pay ₹${parseFloat(formData.am).toFixed(2)} (Verified)`
                  : 'Proceed to Pay'}
              </span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          ) : (
            <button
              type="submit"
              className="w-full py-4 mt-2 bg-gradient-to-tr from-amber-600 to-indigo-600 rounded-2xl text-white font-black text-sm tracking-wide shadow-lg shadow-indigo-500/20 active:scale-98 hover:from-amber-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              <span>
                {formData.am && parseFloat(formData.am) > 0
                  ? `Copy UPI ID & Pay ₹${parseFloat(formData.am).toFixed(2)}`
                  : 'Copy UPI ID & Open App'}
              </span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}

          {/* Standalone Copy UPI ID Button */}
          <button
            type="button"
            onClick={handleCopyVpaOnly}
            className="w-full py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl font-bold text-xs text-slate-300 hover:text-white flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            {copiedVpa ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
            <span>{copiedVpa ? 'UPI ID Copied!' : `Copy ${formData.pa || 'UPI ID'}`}</span>
          </button>

          {/* Android chooser help */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowDefaultAppHelp(!showDefaultAppHelp)}
              className="mx-auto text-[11px] text-slate-500 hover:text-indigo-400 flex items-center justify-center gap-1 cursor-pointer transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Phone always opens Paytm without asking?</span>
            </button>

            {showDefaultAppHelp && (
              <div className="mt-2 p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-[11px] text-slate-300 leading-relaxed space-y-1.5 text-left">
                <p className="font-semibold text-white">Reset Android&apos;s default app:</p>
                <ol className="list-decimal pl-4 space-y-1 text-slate-400">
                  <li>Settings → <strong>Apps</strong> → find <strong>Paytm</strong>.</li>
                  <li>Tap <strong>Open by default</strong>.</li>
                  <li>Tap <strong>Clear default preferences</strong>.</li>
                </ol>
                <p className="text-indigo-300 pt-1">Android will then show all installed UPI apps (GPay, PhonePe, Paytm, BHIM…) every time.</p>
              </div>
            )}
          </div>
        </form>
      )}

      {/* ── 3. RETURNED STATE — instant confirmation sheet ──────────────────── */}
      {paymentState === 'RETURNED' && activeAttempt && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 animate-fade-in">
          {/* Amount summary */}
          <div className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-800">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Paid to</p>
              <p className="text-sm font-bold text-white mt-0.5">
                {activeAttempt.payeeName || activeAttempt.payeeVpa}
              </p>
              <p className="text-[10px] font-mono text-slate-500">{activeAttempt.payeeVpa}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Amount</p>
              <p className="text-2xl font-black text-white mt-0.5">₹{activeAttempt.amount}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-white text-center mb-1">
              Did the payment succeed?
            </p>
            <p className="text-[11px] text-slate-400 text-center mb-4">
              UPI apps don&apos;t send callbacks to browsers. Confirm it here to log the expense.
            </p>
          </div>

          {/* Quick space / importance select before confirming */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Space</span>
              <select
                value={selectedSpaceId}
                onChange={(e) => setSelectedSpaceId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 outline-none cursor-pointer"
              >
                {spaces.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Importance</span>
              <select
                value={importance}
                onChange={(e) => setImportance(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 outline-none cursor-pointer"
              >
                <option value="essential">Essential</option>
                <option value="moderate">Moderate</option>
                <option value="low_value">Low Value</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleSaveTransaction(false)}
              className="py-3 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
            >
              No, Cancelled
            </button>
            <button
              type="button"
              onClick={() => handleSaveTransaction(true)}
              className="py-3 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/20 cursor-pointer text-center"
            >
              ✅ Yes, Log Expense
            </button>
          </div>

          <button
            type="button"
            onClick={() => setPaymentState('UNKNOWN')}
            className="text-[11px] text-slate-500 hover:text-slate-300 text-center cursor-pointer"
          >
            ⏳ Not Sure / Check Later
          </button>
        </div>
      )}

      {/* ── 4. UNKNOWN STATE ───────────────────────────────────────────────── */}
      {paymentState === 'UNKNOWN' && activeAttempt && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-2xl border border-amber-500/20">
              <AlertCircle className="w-6 h-6 text-amber-400 shrink-0" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Payment Status Unconfirmed</h2>
              <p className="text-[11px] text-slate-400">Did your payment complete in your UPI app?</p>
            </div>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 flex justify-between items-center text-xs">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold">Payee</span>
              <div className="font-bold text-slate-200">{activeAttempt.payeeName || activeAttempt.payeeVpa}</div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Amount</span>
              <div className="text-sm font-black text-white">₹{activeAttempt.amount}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleSaveTransaction(false)}
              className="py-3 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
            >
              No, Cancelled
            </button>
            <button
              type="button"
              onClick={() => handleSaveTransaction(true)}
              className="py-3 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/20 cursor-pointer text-center"
            >
              Yes, Save to Ledger
            </button>
          </div>
        </div>
      )}

      {/* ── 5. SUCCESS STATE ───────────────────────────────────────────────── */}
      {paymentState === 'SUCCESS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center flex flex-col items-center justify-center gap-3 animate-fade-in shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-1">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-lg font-bold text-white">Payment Recorded!</h2>
          <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
            The transaction has been saved to your balances and ledger.
          </p>

          <div className="flex gap-3 w-full max-w-xs mt-3">
            <button
              onClick={handleResetScan}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Scan Another
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
