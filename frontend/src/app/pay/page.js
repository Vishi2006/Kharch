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
  HelpCircle,
  Folder,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PayPage() {
  const router = useRouter();
  const { spaces, activeSpaceId, apiFetch, refreshDashboard, isOffline } = useApp();

  const [formData, setFormData] = useState({ pa: '', pn: '', am: '', cu: 'INR', rawPayload: '' });
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [importance, setImportance] = useState('moderate');
  const [note, setNote] = useState('');
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [paymentState, setPaymentState] = useState('SCANNING'); // SCANNING, FORM, PROCESSING, RETURNED, SUCCESS, UNKNOWN
  const [activeAttempt, setActiveAttempt] = useState(null);

  // Sync default space
  useEffect(() => {
    if (activeSpaceId) {
      setSelectedSpaceId(activeSpaceId);
    } else if (spaces && spaces.length > 0) {
      setSelectedSpaceId(spaces[0]._id);
    }
  }, [activeSpaceId, spaces]);

  // Check for pending payments on mount or visibility change
  const checkPendingPayments = useCallback(async () => {
    try {
      const pending = await db.paymentAttempts.where('status').equals('PENDING').first();
      if (pending) {
        setActiveAttempt(pending);
        setPaymentState('RETURNED');
        
        // Wait 15 seconds before marking as UNKNOWN if no callback returned
        setTimeout(async () => {
          const stillPending = await db.paymentAttempts.get(pending.paymentAttemptId);
          if (stillPending && stillPending.status === 'PENDING') {
            await db.paymentAttempts.update(pending.paymentAttemptId, { status: 'UNKNOWN' });
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
    try {
      let upiString = decodedText;
      // Handle standard upi://pay URI
      if (upiString.startsWith('upi://pay?')) {
        const queryParams = new URLSearchParams(upiString.replace('upi://pay?', ''));
        setFormData({
          pa: queryParams.get('pa') || '',
          pn: queryParams.get('pn') || '',
          am: queryParams.get('am') || '',
          cu: queryParams.get('cu') || 'INR',
          rawPayload: decodedText,
        });
      } else {
        // Fallback standard URL parser
        const url = new URL(decodedText);
        const params = url.searchParams;
        setFormData({
          pa: params.get('pa') || '',
          pn: params.get('pn') || '',
          am: params.get('am') || '',
          cu: params.get('cu') || 'INR',
          rawPayload: decodedText,
        });
      }
      setPaymentState('FORM');
    } catch {
      // If parsing fails, fall back to showing raw payload
      setFormData((prev) => ({ ...prev, rawPayload: decodedText }));
      setPaymentState('FORM');
    }
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
      payeeName: formData.pn.trim(),
      amount: amountVal,
      status: 'PENDING',
      initiatedAt: Date.now(),
      rawPayload: formData.rawPayload,
      spaceId: selectedSpaceId,
      importance,
      note: note.trim(),
    };

    // 1. Persist to IndexedDB before launching intent
    await db.paymentAttempts.add(attempt);

    // 2. Also notify backend of pending attempt
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

    // 3. Deep link to UPI Intent
    const params = new URLSearchParams({
      pa: formData.pa.trim(),
      pn: formData.pn.trim() || formData.pa.trim(),
      am: String(amountVal),
      cu: 'INR',
      tr: paymentAttemptId,
    });

    const upiUrl = `upi://pay?${params.toString()}`;
    window.location.href = upiUrl;
  };

  const handleSaveTransaction = async (isSuccess) => {
    if (!activeAttempt) return;

    if (!isSuccess) {
      await db.paymentAttempts.update(activeAttempt.paymentAttemptId, { status: 'FAILED' });
      await apiFetch(`/api/payment-attempts/${activeAttempt.paymentAttemptId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'FAILED' }),
      });
      setPaymentState('SCANNING');
      setActiveAttempt(null);
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
              if (paymentState === 'FORM') setPaymentState('SCANNING');
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
      </div>

      {/* 1. SCANNING STATE */}
      {paymentState === 'SCANNING' && (
        <div className="flex flex-col gap-4 items-center">
          <QRScanner onScanSuccess={handleScanSuccess} />
          <p className="text-center text-xs text-slate-400 font-medium">
            Point your camera at any UPI QR code or upload a QR image from your gallery.
          </p>
        </div>
      )}

      {/* 2. FORM STATE (Theme-consistent dark input form) */}
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

          {/* Payee Name */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" /> Payee Name
            </span>
            <input
              type="text"
              placeholder="e.g. Chai Point"
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
              placeholder="merchant@okhdfcbank"
              value={formData.pa}
              onChange={(e) => setFormData({ ...formData, pa: e.target.value })}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-sm font-mono text-indigo-300 outline-none transition-colors"
              required
            />
          </div>

          {/* Space Selection */}
          <div className="grid grid-cols-2 gap-3 mt-1">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Folder className="w-3 h-3 text-slate-400" /> Target Space
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

            {/* Importance Category */}
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
              placeholder="e.g. Coffee with team"
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

          {/* Proceed Button */}
          <button
            type="submit"
            className="w-full py-4 mt-2 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-2xl text-white font-black text-sm tracking-wide shadow-lg shadow-indigo-500/20 active:scale-98 hover:from-indigo-600 hover:to-violet-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Proceed to UPI App</span>
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
                Most UPI apps do not return payment results to browsers.
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

          <p className="text-xs text-slate-300 font-medium">
            Did this payment succeed in your UPI app?
          </p>

          <div className="grid grid-cols-2 gap-3 mt-1">
            <button
              type="button"
              onClick={() => handleSaveTransaction(false)}
              className="py-3 px-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
            >
              No, Payment Failed
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
            The transaction has been logged and applied to your balances.
          </p>

          <div className="flex gap-3 w-full max-w-xs mt-3">
            <button
              onClick={() => setPaymentState('SCANNING')}
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
