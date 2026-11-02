'use client';

import React, { useState, useEffect, useCallback } from 'react';
import QRScanner from '../../components/QRScanner';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../utils/db';
import { useApp } from '../../context/AppContext';
import { 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ChevronLeft, 
  IndianRupee, 
  User, 
  AtSign, 
  ArrowRight, 
  Folder, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  Smartphone,
  ExternalLink,
  HelpCircle,
  RotateCcw
} from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * Robust parser for UPI QR codes (standard UPI, BharatQR/EMVCo, and deep links)
 */
function parseUPIPayload(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { pa: '', pn: '', am: '', cu: 'INR', rawPayload: '' };
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

      // Tag 59 is Payee / Merchant Name
      let pn = tags['59'] || '';
      // Tag 54 is Amount
      let am = tags['54'] || '';
      // Tag 26 or 27 contains Merchant Account Information / VPA
      let pa = '';
      const merchantInfo = tags['26'] || tags['27'] || tags['28'] || '';
      if (merchantInfo) {
        const vpaMatch = merchantInfo.match(/[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/);
        if (vpaMatch) pa = vpaMatch[0];
      }

      if (pa || pn) {
        return {
          pa: pa || '',
          pn: pn || '',
          am: am || '',
          cu: 'INR',
          rawPayload: trimmed,
        };
      }
    } catch (e) {
      console.warn('EMVCo decode issue:', e);
    }
  }

  // 2. Query string parameter parsing (upi://pay?, paytmmp://, https://, etc.)
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
        try {
          return decodeURIComponent(val.replace(/\+/g, ' ')).trim();
        } catch {
          return val.trim();
        }
      };

      const pa = getDecoded('pa');
      let pn = getDecoded('pn');
      const tn = getDecoded('tn');
      const am = getDecoded('am');
      const cu = getDecoded('cu') || 'INR';

      // If pn is generic or blank but note (tn) has a trade name, suggest it
      if ((!pn || pn.toLowerCase() === 'paytm' || pn.toLowerCase() === 'paytm merchant' || pn.toLowerCase() === 'upi') && tn) {
        pn = tn;
      }

      return {
        pa: pa || '',
        pn: pn || '',
        am: am || '',
        cu: cu || 'INR',
        rawPayload: trimmed,
      };
    } catch (e) {
      console.warn('Query string decode issue:', e);
    }
  }

  // 3. Raw VPA fallback (e.g. text is simply "someone@upi")
  const vpaMatch = trimmed.match(/[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/);
  if (vpaMatch) {
    return {
      pa: vpaMatch[0],
      pn: '',
      am: '',
      cu: 'INR',
      rawPayload: trimmed,
    };
  }

  return {
    pa: '',
    pn: '',
    am: '',
    cu: 'INR',
    rawPayload: trimmed,
  };
}

// Available UPI Payment App definitions
const UPI_APPS = [
  { id: 'any', name: 'All Apps / Chooser', color: 'from-indigo-600 to-violet-600', badge: 'System' },
  { id: 'gpay', name: 'Google Pay', color: 'from-blue-600 to-indigo-600', badge: 'GPay' },
  { id: 'phonepe', name: 'PhonePe', color: 'from-purple-600 to-indigo-600', badge: 'PhonePe' },
  { id: 'paytm', name: 'Paytm', color: 'from-sky-600 to-blue-600', badge: 'Paytm' },
  { id: 'bhim', name: 'BHIM UPI', color: 'from-emerald-600 to-teal-600', badge: 'BHIM' },
  { id: 'cred', name: 'CRED', color: 'from-slate-700 to-slate-900', badge: 'CRED' },
];

export default function PayPage() {
  const router = useRouter();
  const { spaces, activeSpaceId, apiFetch, refreshDashboard } = useApp();

  const [formData, setFormData] = useState({ pa: '', pn: '', am: '', cu: 'INR', rawPayload: '' });
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [importance, setImportance] = useState('moderate');
  const [note, setNote] = useState('');
  const [selectedUpiApp, setSelectedUpiApp] = useState('any');
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [showDefaultAppHelp, setShowDefaultAppHelp] = useState(false);
  const [paymentState, setPaymentState] = useState('SCANNING'); // SCANNING, FORM, RETURNED, SUCCESS, UNKNOWN
  const [activeAttempt, setActiveAttempt] = useState(null);

  // Sync default space
  useEffect(() => {
    if (activeSpaceId) {
      setSelectedSpaceId(activeSpaceId);
    } else if (spaces && spaces.length > 0) {
      setSelectedSpaceId(spaces[0]._id);
    }
  }, [activeSpaceId, spaces]);

  // Clean stale pending attempts older than 90 seconds
  const checkPendingPayments = useCallback(async () => {
    try {
      const now = Date.now();
      const cutoffTime = now - 90 * 1000; // 90 seconds window

      // Clean up any old abandoned pending attempts so they don't hijack the UI
      const staleAttempts = await db.paymentAttempts
        .where('status')
        .equals('PENDING')
        .filter((a) => a.initiatedAt < cutoffTime)
        .toArray();

      for (const stale of staleAttempts) {
        await db.paymentAttempts.update(stale.paymentAttemptId, { status: 'UNKNOWN' });
      }

      // Look for a recently initiated pending payment attempt
      const activePending = await db.paymentAttempts
        .where('status')
        .equals('PENDING')
        .filter((a) => a.initiatedAt >= cutoffTime)
        .first();

      if (activePending) {
        setActiveAttempt(activePending);
        setPaymentState('RETURNED');

        // Give the user 15s to confirm before transitioning to UNKNOWN
        setTimeout(async () => {
          const check = await db.paymentAttempts.get(activePending.paymentAttemptId);
          if (check && check.status === 'PENDING') {
            await db.paymentAttempts.update(activePending.paymentAttemptId, { status: 'UNKNOWN' });
            setPaymentState('UNKNOWN');
          }
        }, 15000);
      }
    } catch (err) {
      console.error('Error checking pending payments:', err);
    }
  }, []);

  useEffect(() => {
    checkPendingPayments();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkPendingPayments();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkPendingPayments]);

  const handleScanSuccess = (decodedText) => {
    const parsed = parseUPIPayload(decodedText);
    setFormData(parsed);
    setPaymentState('FORM');
  };

  const handleResetScan = () => {
    setFormData({ pa: '', pn: '', am: '', cu: 'INR', rawPayload: '' });
    setActiveAttempt(null);
    setPaymentState('SCANNING');
  };

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

    // 1. Persist to IndexedDB before deep-linking
    await db.paymentAttempts.add(attempt);

    // 2. Notify backend of attempt
    try {
      await apiFetch('/api/payment-attempts', {
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
      });
    } catch (err) {
      console.warn('Could not sync pending attempt to server immediately:', err);
    }

    // 3. Construct URL tailored to selected app or system chooser
    const queryParams = new URLSearchParams({
      pa: formData.pa.trim(),
      pn: formData.pn.trim() || formData.pa.trim(),
      am: String(amountVal),
      cu: 'INR',
      tr: paymentAttemptId,
    }).toString();

    let finalIntentUrl = `upi://pay?${queryParams}`;

    if (selectedUpiApp === 'gpay') {
      finalIntentUrl = `tez://upi/pay?${queryParams}`;
    } else if (selectedUpiApp === 'phonepe') {
      finalIntentUrl = `phonepe://pay?${queryParams}`;
    } else if (selectedUpiApp === 'paytm') {
      finalIntentUrl = `paytmmp://pay?${queryParams}`;
    } else if (selectedUpiApp === 'bhim') {
      finalIntentUrl = `bhim://pay?${queryParams}`;
    } else if (selectedUpiApp === 'cred') {
      finalIntentUrl = `credpay://upi/pay?${queryParams}`;
    } else {
      // "any" - Android Intent URL targeting UPI scheme to trigger system chooser
      const isAndroid = /Android/i.test(navigator.userAgent || '');
      if (isAndroid) {
        finalIntentUrl = `intent://pay?${queryParams}#Intent;scheme=upi;action=android.intent.action.VIEW;end`;
      } else {
        finalIntentUrl = `upi://pay?${queryParams}`;
      }
    }

    // Trigger navigation
    window.location.href = finalIntentUrl;
  };

  const handleSaveTransaction = async (isSuccess) => {
    if (!activeAttempt) return;

    if (!isSuccess) {
      await db.paymentAttempts.update(activeAttempt.paymentAttemptId, { status: 'FAILED' });
      await apiFetch(`/api/payment-attempts/${activeAttempt.paymentAttemptId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'FAILED' }),
      });
      handleResetScan();
      return;
    }

    // Save as successful transaction
    try {
      const targetSpace = selectedSpaceId || activeAttempt.spaceId || activeSpaceId;
      const titleName = activeAttempt.payeeName || activeAttempt.payeeVpa || 'UPI Payment';

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
        await apiFetch(`/api/payment-attempts/${activeAttempt.paymentAttemptId}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'SUCCESS', linkedTransactionId: txId }),
        });

        await refreshDashboard(targetSpace);
        setPaymentState('SUCCESS');
      }
    } catch (err) {
      console.error('Failed to finalize transaction:', err);
      alert('Could not save transaction to ledger');
    }
  };

  return (
    <div className="flex flex-col gap-5 mt-2">
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
            <span className="text-[11px] text-slate-400">
              Scan UPI QR code and log payment automatically
            </span>
          </div>
        </div>

        {paymentState === 'FORM' && (
          <button
            onClick={handleResetScan}
            className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-indigo-400 flex items-center gap-1 text-xs font-bold transition-all cursor-pointer"
            title="Scan different QR"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 1. SCANNING STATE */}
      {paymentState === 'SCANNING' && (
        <div className="flex flex-col gap-4 items-center">
          <QRScanner onScanSuccess={handleScanSuccess} />
          <p className="text-center text-xs text-slate-400 font-medium">
            Point camera at any UPI QR code or upload a screenshot from your gallery.
          </p>
        </div>
      )}

      {/* 2. FORM STATE */}
      {paymentState === 'FORM' && (
        <form onSubmit={handlePayClick} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 animate-fade-in">
          {/* Amount Input */}
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

          {/* Payee Name (Editable) */}
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

          {/* Payee UPI ID (VPA) */}
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

          {/* UPI App Selection (Fix for Android defaulting to Paytm) */}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-indigo-400" /> Pay Using App
              </span>
              <button
                type="button"
                onClick={() => setShowDefaultAppHelp(!showDefaultAppHelp)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer"
              >
                <HelpCircle className="w-3 h-3" />
                <span>Why Paytm opens?</span>
              </button>
            </div>

            {/* Help callout explaining Android default app settings */}
            {showDefaultAppHelp && (
              <div className="p-3 bg-indigo-950/40 border border-indigo-900/50 rounded-2xl text-[11px] text-indigo-200/90 leading-relaxed animate-fade-in">
                If your phone always opens Paytm directly, Android has set Paytm as your default UPI app.
                <br /><br />
                <strong>How to choose other apps:</strong>
                <ol className="list-decimal pl-4 mt-1 space-y-0.5">
                  <li>Select <strong>Google Pay</strong> or <strong>PhonePe</strong> below to launch them directly.</li>
                  <li>Or go to phone Settings → Apps → Paytm → <em>Open by default</em> → tap <em>Clear default preferences</em>.</li>
                </ol>
              </div>
            )}

            {/* Grid of Apps to Pay With */}
            <div className="grid grid-cols-3 gap-2 mt-1">
              {UPI_APPS.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => setSelectedUpiApp(app.id)}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    selectedUpiApp === app.id
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30 scale-[1.02]'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="text-[11px]">{app.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Space & Category Selection */}
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
                <Layers className="w-3 h-3 text-slate-400" /> Category
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

          {/* Note Input */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Optional Note
            </span>
            <input
              type="text"
              placeholder="e.g. Chai / Groceries"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-slate-200 outline-none transition-colors"
            />
          </div>

          {/* Collapsible Raw Payload for Transparency */}
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
                <div className="p-3 bg-slate-950/60 font-mono text-[9px] text-slate-500 break-all select-all border-t border-slate-850">
                  {formData.rawPayload}
                </div>
              )}
            </div>
          )}

          {/* Launch Button */}
          <button
            type="submit"
            className="w-full py-4 mt-2 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-2xl text-white font-black text-sm tracking-wide shadow-lg shadow-indigo-500/20 active:scale-98 hover:from-indigo-600 hover:to-violet-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>
              {selectedUpiApp === 'any' ? 'Open in UPI App' : `Pay via ${UPI_APPS.find((a) => a.id === selectedUpiApp)?.name}`}
            </span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </form>
      )}

      {/* 3. RETURNED STATE */}
      {paymentState === 'RETURNED' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center flex flex-col items-center justify-center gap-3 animate-fade-in shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-1">
            <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
          </div>
          <h2 className="text-base font-bold text-white">Awaiting UPI Confirmation...</h2>
          <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
            Please wait while Kharch checks for a confirmation callback from your UPI app.
          </p>
        </div>
      )}

      {/* 4. UNKNOWN STATUS CONFIRMATION */}
      {paymentState === 'UNKNOWN' && activeAttempt && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-2xl border border-amber-500/20">
              <AlertCircle className="w-6 h-6 text-amber-400 shrink-0" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Payment Status Unconfirmed</h2>
              <p className="text-[11px] text-slate-400">
                Did your payment complete in your UPI app?
              </p>
            </div>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 flex justify-between items-center text-xs">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Payee</span>
              <span className="font-bold text-slate-200">
                {activeAttempt.payeeName || activeAttempt.payeeVpa}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Amount</span>
              <div className="text-sm font-black text-white">₹{activeAttempt.amount}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-1">
            <button
              type="button"
              onClick={() => handleSaveTransaction(false)}
              className="py-3 px-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
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

      {/* 5. SUCCESS STATE */}
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
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
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
