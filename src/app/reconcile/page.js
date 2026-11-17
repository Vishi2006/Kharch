'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { formatDateMY } from '../../utils/date';
import { 
  AlertCircle, 
  Scale, 
  CheckSquare,
  Coins
} from 'lucide-react';

export default function ReconcilePage() {
  const { activeSpace, apiFetch, refreshDashboard, isOffline } = useApp();

  const [summary, setSummary] = useState(null);
  const [closingInput, setClosingInput] = useState('');
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showClosingForm, setShowClosingForm] = useState(false);

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // "YYYY-MM"
  const currentMonthFormatted = formatDateMY(new Date());

  // Load monthly summary data
  const loadSummary = useCallback(async () => {
    if (activeSpace) {
      const data = await apiFetch(`/api/summaries/current?spaceId=${activeSpace._id}&month=${currentMonthStr}`);
      if (data && !data.error) {
        setSummary(data);
        if (data.actualClosingBalance) {
          setClosingInput(data.actualClosingBalance.toString());
        }
      }
    }
  }, [activeSpace, apiFetch, currentMonthStr]);

  useEffect(() => {
    if (activeSpace) {
      loadSummary();
    }
  }, [activeSpace, loadSummary]);

  // Submit actual closing balance to finalize month
  const handleFinalizeMonth = async (e) => {
    e.preventDefault();
    if (!closingInput || isOffline) return;
    setIsFinalizing(true);
    
    const data = await apiFetch('/api/closing', {
      method: 'POST',
      body: JSON.stringify({
        spaceId: activeSpace._id,
        month: currentMonthStr,
        amount: parseFloat(closingInput),
        isLocked: true // Lock to make it permanent
      }),
    });

    if (data && !data.error) {
      setSummary(data);
      setShowClosingForm(false);
      await refreshDashboard();
    }
    setIsFinalizing(false);
  };

  return (
    <div className="flex flex-col gap-6 mt-1 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold tracking-tight font-display text-white">
          Monthly Reconciliation
        </h1>
        <span className="text-xs text-slate-400 font-semibold mt-0.5 block">
          Record month-end closing balance to audit your ledger records in <span className="text-indigo-400 underline">{activeSpace?.name}</span>
        </span>
      </div>

      {/* Monthly Reconciliation Card */}
      {summary ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {currentMonthFormatted} Reconciliation
            </h3>
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${summary.isLocked ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
              {summary.isLocked ? 'Reconciled & Locked' : 'Pending Verification'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Opening Balance</span>
              <span className="text-slate-200">₹{summary.openingBalance.toLocaleString('en-IN')}</span>
            </div>
            
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Expected Balance</span>
              <span className="text-slate-200">₹{summary.expectedClosingBalance.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Actual Closing</span>
              <span className="text-slate-200">
                {summary.actualClosingBalance > 0 ? `₹${summary.actualClosingBalance.toLocaleString('en-IN')}` : 'Not recorded'}
              </span>
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Discrepancy</span>
              <span className={`font-black ${summary.reconciliationAdjustment === 0 ? 'text-slate-400' : summary.reconciliationAdjustment > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {summary.reconciliationAdjustment > 0 ? '+' : ''}
                ₹{summary.reconciliationAdjustment.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Alert explaining discrepancy if exists */}
          {summary.reconciliationAdjustment !== 0 && summary.actualClosingBalance > 0 && (
            <div className="mt-4 p-3 bg-slate-950/60 border border-slate-850 rounded-2xl flex items-start gap-2.5 text-[11px] leading-relaxed text-slate-400">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                Your actual closing balance differs from expected ledger records by <span className="font-bold text-slate-200">₹{Math.abs(summary.reconciliationAdjustment)}</span>. This is recorded as a miscellaneous adjustment.
              </div>
            </div>
          )}

          {/* Subtotals breakdown */}
          <div className="mt-4 pt-4 border-t border-slate-800/60 grid grid-cols-4 gap-2 text-center text-[9px] text-slate-500 font-bold uppercase">
            <div className="flex flex-col gap-0.5">
              <span>Earned</span>
              <span className="text-emerald-400">₹{summary.earned}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span>Spent</span>
              <span className="text-rose-400">₹{summary.expenses}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span>Invested</span>
              <span className="text-sky-400">₹{summary.investments}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span>Saved</span>
              <span className="text-purple-400">₹{summary.savings}</span>
            </div>
          </div>

          {/* Trigger to finalize Month end balance */}
          {!summary.isLocked && (
            <div className="mt-4 pt-4 border-t border-slate-800/40">
              {!showClosingForm ? (
                <button
                  onClick={() => setShowClosingForm(true)}
                  disabled={isOffline}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 active:scale-98 text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 border border-slate-700/50 shadow transition-all duration-200"
                >
                  <Scale className="w-4 h-4 text-indigo-400" />
                  Record Closing Balance & Verify
                </button>
              ) : (
                <form onSubmit={handleFinalizeMonth} className="flex flex-col gap-2">
                  <span className="text-[10px] text-slate-400 font-bold block mb-1">Enter actual bank balance at month-end:</span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={closingInput}
                      onChange={(e) => setClosingInput(e.target.value)}
                      placeholder="Actual bank balance (₹)"
                      required
                      disabled={isOffline}
                      className="bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-semibold text-white w-full outline-none transition-all"
                    />
                    <button
                      type="submit"
                      disabled={isOffline || isFinalizing}
                      className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all"
                    >
                      Lock
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowClosingForm(false)}
                      className="bg-slate-950 border border-slate-800 text-slate-400 font-bold text-xs px-3 py-2 rounded-xl"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center flex flex-col items-center justify-center">
          <Coins className="w-10 h-10 text-slate-600 mb-2.5 animate-pulse" />
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Summary Unavailable</h3>
          <p className="text-[11px] text-slate-500 mt-1 max-w-[200px] leading-relaxed">
            Record a cashflow movement or configure your opening balance to initialize active month reconciliation!
          </p>
        </div>
      )}
    </div>
  );
}
