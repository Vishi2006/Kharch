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
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ─── Platform detection ───────────────────────────────────────────────────────
const isIOS = () =>
  typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
const isAndroid = () =>
  typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

// iOS preferred app stored in localStorage
const IOS_APP_KEY = 'kharch_preferred_upi_app';
const IOS_APPS = [
  { id: 'gpay', label: 'GPay', scheme: 'tez://upi/pay?' },
  { id: 'phonepe', label: 'PhonePe', scheme: 'phonepe://pay?' },
  { id: 'paytm', label: 'Paytm', scheme: 'paytmmp://pay?' },
  { id: 'bhim', label: 'BHIM', scheme: 'bhim://upi/pay?' },
];

// ─── UPI QR Payload Parser ────────────────────────────────────────────────────
/**
 * Parse UPI QR payloads preserving ALL original parameters including
 * mc, sign, orgid, tid — only extract displayable fields for the UI.
 */
function parseUPIPayload(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { pa: '', pn: '', am: '', cu: 'INR', mc: '', sign: '', rawPayload: '' };
  }

  const trimmed = rawText.trim();

  // 1. EMVCo / BharatQR TLV Format (starts with "000201")
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
      if (pa || pn) {
        return { pa: pa || '', pn: pn || '', am: am || '', cu: 'INR', mc: '', sign: '', rawPayload: trimmed };
      }
    } catch (e) {
      console.warn('EMVCo decode issue:', e);
    }
  }

  // 2. Query string parsing — extract display fields but KEEP rawPayload untouched
  let queryString = '';
  if (trimmed.includes('?')) {
    queryString = trimmed.substring(trimmed.indexOf('?') + 1);
  } else if (trimmed.toLowerCase().startsWith('upi://')) {
    queryString = trimmed.substring(6);
  }

  if (queryString) {
    try {
      const params = new URLSearchParams(queryString);
      const getDecoded = (key) => {
        const val = params.get(key) || params.get(key.toLowerCase()) || params.get(key.toUpperCase());
        if (!val) return '';
        try { return decodeURIComponent(val.replace(/\+/g, ' ')).trim(); } catch { return val.trim(); }
      };

      const pa = getDecoded('pa');
      let pn = getDecoded('pn');
      const tn = getDecoded('tn');
      const am = getDecoded('am');
      const cu = getDecoded('cu') || 'INR';
      const mc = getDecoded('mc');     // Merchant Category Code — keep for P2M detection
      const sign = getDecoded('sign'); // Cryptographic signature — keep intact

      // If pn is a generic processor name but trade name is available, use it
      if ((!pn || ['paytm', 'paytm merchant', 'upi', 'google pay'].includes(pn.toLowerCase())) && tn) {
        pn = tn;
      }

      return { pa: pa || '', pn: pn || '', am: am || '', cu: cu || 'INR', mc, sign, rawPayload: trimmed };
    } catch (e) {
      console.warn('Query string decode issue:', e);
    }
  }

  // 3. Raw VPA fallback
  const vpaMatch = trimmed.match(/[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/);
  if (vpaMatch) {
    return { pa: vpaMatch[0], pn: '', am: '', cu: 'INR', mc: '', sign: '', rawPayload: trimmed };
  }

  return { pa: '', pn: '', am: '', cu: 'INR', mc: '', sign: '', rawPayload: trimmed };
}

/**
 * Build the UPI payment URL.
 * - Android: uses standard upi:// (Chrome intent chooser) or rawPayload with updated am= if modified
 * - iOS: rewrites scheme prefix to the preferred app, keeps all params
 */
function buildPaymentUrl({ rawPayload, pa, pn, am, cu, paymentAttemptId, preferredIosApp }) {
  const on_ios = isIOS();

  // If we have a valid raw UPI payload, use it and only patch am= if changed
  if (rawPayload && rawPayload.includes('?')) {
    const qsStart = rawPayload.indexOf('?');
    const prefix = rawPayload.substring(0, qsStart + 1);
    const qs = rawPayload.substring(qsStart + 1);

    try {
      const params = new URLSearchParams(qs);
      // Update amount if user changed it
      if (am) params.set('am', am);
      // DO NOT overwrite tr — it's merchant-signed. We track via our own paymentAttemptId separately.

      const updatedQs = params.toString();

      if (on_ios) {
        const app = IOS_APPS.find((a) => a.id === preferredIosApp) || IOS_APPS[0];
        // Keep all original params but change URL scheme
        return `${app.scheme}${updatedQs}`;
      }

      // Android: use standard upi:// — OS will show chooser
      return `upi://pay?${updatedQs}`;
    } catch {}
  }

  // Fallback: build fresh URL (P2P or manual entry)
  const queryParams = new URLSearchParams({ pa, pn: pn || pa, am, cu: cu || 'INR', tr: paymentAttemptId }).toString();

  if (on_ios) {
    const app = IOS_APPS.find((a) => a.id === preferredIosApp) || IOS_APPS[0];
    return `${app.scheme}${queryParams}`;
  }

  // Android: Chrome Intent without package — shows OS chooser
  return `intent://pay?${queryParams}#Intent;scheme=upi;end`;
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

  const [formData, setFormData] = useState({ pa: '', pn: '', am: '', cu: 'INR', mc: '', sign: '', rawPayload: '' });
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [importance, setImportance] = useState('moderate');
  const [note, setNote] = useState('');
  const [isUnverifiedP2P, setIsUnverifiedP2P] = useState(false);
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [showDefaultAppHelp, setShowDefaultAppHelp] = useState(false);
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [paymentState, setPaymentState] = useState('SCANNING'); // SCANNING | FORM | RETURNED | SUCCESS | UNKNOWN
  const [activeAttempt, setActiveAttempt] = useState(null);
  const [merchantSuggestion, setMerchantSuggestion] = useState(null); // { canonicalTitle, spaceId, importance }
  const [preferredIosApp, setPreferredIosApp] = useState('gpay');
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const showToast = (msg, duration = 2500) => {
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

  // Clean stale pending attempts (> 90s) and detect active PENDING state
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
        // Restore selected space and importance from attempt
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

    // Detect P2M vs P2P: P2M has mc= and/or sign=
    const hasP2MMarkers = !!(parsed.mc || parsed.sign);
    setIsUnverifiedP2P(!hasP2MMarkers);

    setFormData(parsed);

    // Phase 3: Look up merchant memory in Dexie + server
    if (parsed.pa) {
      try {
        // Dexie local lookup first
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
          // Auto-apply suggestion
          setImportance(localMapping.importance || 'moderate');
          if (localMapping.spaceId) setSelectedSpaceId(localMapping.spaceId);
          if (!parsed.pn && localMapping.canonicalTitle) {
            setFormData((prev) => ({ ...prev, pn: localMapping.canonicalTitle }));
          }
        } else {
          // Try server if Dexie misses
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

            // Cache in Dexie for next time
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
    setIsUnverifiedP2P(false);
    setMerchantSuggestion(null);
    setPaymentState('SCANNING');
  };

  // ── Save merchant memory after a successful or attempted payment ──────────
  const persistMerchantMemory = useCallback(async () => {
    const vpa = formData.pa?.trim();
    const title = formData.pn?.trim() || note?.trim();
    if (!vpa || !title || !selectedSpaceId) return;

    const identifierKey = vpa.toLowerCase();

    // Dexie upsert
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

    // Server upsert (non-blocking)
    saveMerchantMapping(apiFetch, { identifierKey, canonicalTitle: title, spaceId: selectedSpaceId, importance });
  }, [formData, note, selectedSpaceId, importance, apiFetch]);

  // ── Primary Pay button handler ───────────────────────────────────────────
  const handlePayClick = async (e) => {
    e.preventDefault();
    if (!formData.pa) return alert('Payee UPI ID (VPA) is required');
    if (!formData.am || parseFloat(formData.am) <= 0) return alert('Please enter a valid amount');

    const paymentAttemptId = uuidv4();
    const amountVal = parseFloat(formData.am);

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
    };

    // 1. Persist to IndexedDB immediately (before deep-link navigation)
    await db.paymentAttempts.add(attempt);

    // 2. Fire-and-forget backend sync
    apiFetch('/api/payment-attempts', {
      method: 'POST',
      body: JSON.stringify({
        paymentAttemptId,
        type: 'expense',
        amount: amountVal,
        payeeVpa: formData.pa.trim(),
        payeeName: formData.pn.trim(),
        initiatedAt: new Date(attempt.initiatedAt),
        status: 'PENDING',
      }),
    }).catch(() => {});

    // 3. Build platform-aware URL (preserving merchant signatures)
    const finalUrl = buildPaymentUrl({
      rawPayload: formData.rawPayload,
      pa: formData.pa.trim(),
      pn: formData.pn.trim() || formData.pa.trim(),
      am: String(amountVal),
      cu: 'INR',
      paymentAttemptId,
      preferredIosApp,
    });

    window.location.href = finalUrl;
  };

  // ── P2P Fallback: Copy VPA & open app ────────────────────────────────────
  const handleCopyAndOpen = async () => {
    if (!formData.pa) return;
    if (!formData.am || parseFloat(formData.am) <= 0) return alert('Please enter the amount first');

    const paymentAttemptId = uuidv4();
    const amountVal = parseFloat(formData.am);

    // Save attempt
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
    };
    await db.paymentAttempts.add(attempt);
    apiFetch('/api/payment-attempts', {
      method: 'POST',
      body: JSON.stringify({ ...attempt, type: 'expense', initiatedAt: new Date(attempt.initiatedAt) }),
    }).catch(() => {});

    // Copy VPA to clipboard
    try {
      await navigator.clipboard.writeText(formData.pa.trim());
      setCopiedVpa(true);
      setTimeout(() => setCopiedVpa(false), 2500);
      showToast(`Copied ${formData.pa.trim()}! Paste in your UPI app.`);
    } catch {}

    // Open preferred UPI app (no payment params — user pastes manually)
    const appScheme = IOS_APPS.find((a) => a.id === preferredIosApp)?.scheme || 'upi://pay?';
    setTimeout(() => {
      window.location.href = appScheme.split('?')[0]; // Open app without params
    }, 400);
  };

  // ── Confirm payment returned from UPI app ────────────────────────────────
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

        // Phase 3: Persist merchant memory
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

      {/* ── 1. SCANNING STATE ─────────────────────────────────────────────── */}
      {paymentState === 'SCANNING' && (
        <div className="flex flex-col gap-4 items-center">
          <QRScanner onScanSuccess={handleScanSuccess} />
          <p className="text-center text-xs text-slate-400 font-medium">
            Point camera at any UPI QR code or upload a screenshot from your gallery.
          </p>
        </div>
      )}

      {/* ── 2. FORM STATE ─────────────────────────────────────────────────── */}
      {paymentState === 'FORM' && (
        <form onSubmit={handlePayClick} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 animate-fade-in">

          {/* P2P Warning Banner */}
          {isUnverifiedP2P && (
            <div className="flex items-start gap-3 p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-amber-200">Unverified P2P QR Code</p>
                <p className="text-[10px] text-amber-400/90 mt-0.5 leading-relaxed">
                  This QR has no merchant signature. Some UPI apps may block payment. Use <strong>&ldquo;Copy &amp; Open App&rdquo;</strong> below if payment fails.
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
                {IOS_APPS.map((app) => (
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
                    {app.label}
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

          {/* Raw Payload */}
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

          {/* Primary button */}
          <button
            type="submit"
            className="w-full py-4 mt-2 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-2xl text-white font-black text-sm tracking-wide shadow-lg shadow-indigo-500/20 active:scale-98 hover:from-indigo-600 hover:to-violet-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>
              {formData.am && parseFloat(formData.am) > 0
                ? `Pay ₹${parseFloat(formData.am).toFixed(2)}`
                : 'Proceed to Pay'}
            </span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>

          {/* P2P Fallback / Copy UPI ID button */}
          <button
            type="button"
            onClick={handleCopyAndOpen}
            className={`w-full py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all border ${
              isUnverifiedP2P
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-200 hover:bg-amber-500/25'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {copiedVpa ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copiedVpa ? 'Copied!' : 'Copy UPI ID & Open App'}
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

      {/* ── 3. RETURNED STATE — instant confirmation sheet ────────────────── */}
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

          {/* Quick note / category before confirming */}
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

      {/* ── 4. UNKNOWN STATE ─────────────────────────────────────────────── */}
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

      {/* ── 5. SUCCESS STATE ─────────────────────────────────────────────── */}
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
