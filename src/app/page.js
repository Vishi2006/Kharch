'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Plus, 
  ArrowRightLeft, 
  Sparkles, 
  DollarSign, 
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  Settings,
  Inbox
} from 'lucide-react';
import Link from 'next/link';
import { formatDateDMY, formatDateMY } from '../utils/date';

export default function DashboardPage() {
  const { 
    user, 
    activeSpace, 
    dashboardData, 
    isOffline, 
    apiFetch, 
    refreshDashboard 
  } = useApp();

  const [openingInput, setOpeningInput] = useState('');
  const [isSettingOpening, setIsSettingOpening] = useState(false);
  const [quickAmount, setQuickAmount] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickType, setQuickType] = useState('expense');
  const [quickImportance, setQuickImportance] = useState('essential');
  const [recentTitles, setRecentTitles] = useState([]);
  const [quickMessage, setQuickMessage] = useState({ text: '', type: '' });

  // Get current month representation (local time)
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthFormatted = formatDateMY(new Date());

  // Sync dashboard and load recently used titles on mount/activeSpace changes
  useEffect(() => {
    const initDashboardData = async () => {
      if (activeSpace) {
        // Force refresh of dashboard data
        await refreshDashboard(activeSpace._id);
        
        // Fetch recent titles
        const data = await apiFetch(`/api/titles/recent?spaceId=${activeSpace._id}`);
        if (data && !data.error) {
          setRecentTitles(data.slice(0, 5));
        }
      }
    };
    if (user && activeSpace) {
      initDashboardData();
    }
  }, [activeSpace, user, apiFetch, refreshDashboard]);

  // Set opening balance
  const handleSetOpeningBalance = async (e) => {
    e.preventDefault();
    if (!openingInput || isOffline) return;
    setIsSettingOpening(true);
    const data = await apiFetch('/api/summaries/opening', {
      method: 'POST',
      body: JSON.stringify({
        spaceId: activeSpace._id,
        month: currentMonthStr,
        amount: parseFloat(openingInput),
      }),
    });
    if (data && !data.error) {
      await refreshDashboard();
      setOpeningInput('');
    }
    setIsSettingOpening(false);
  };

  // Submit quick transaction
  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!quickAmount || !quickTitle || isOffline) return;

    setQuickMessage({ text: '', type: '' });
    const data = await apiFetch('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        spaceId: activeSpace._id,
        type: quickType,
        amount: parseFloat(quickAmount),
        title: quickTitle,
        importance: quickType === 'expense' ? quickImportance : undefined,
        date: new Date().toISOString(),
      }),
    });

    if (data && !data.error) {
      setQuickMessage({ text: 'Added successfully!', type: 'success' });
      setQuickAmount('');
      setQuickTitle('');
      await refreshDashboard();
      
      // Update recent titles list
      const updatedTitles = await apiFetch(`/api/titles/recent?spaceId=${activeSpace._id}`);
      if (updatedTitles && !updatedTitles.error) {
        setRecentTitles(updatedTitles.slice(0, 5));
      }
      
      setTimeout(() => setQuickMessage({ text: '', type: '' }), 3000);
    } else {
      setQuickMessage({ text: data.error || 'Failed to add', type: 'error' });
    }
  };

  if (!dashboardData) {
    return (
      <div className="flex flex-col gap-4 animate-pulse mt-4">
        <div className="h-8 bg-slate-800 rounded-lg w-1/3"></div>
        <div className="h-32 bg-slate-800 rounded-2xl"></div>
        <div className="h-48 bg-slate-800 rounded-2xl"></div>
      </div>
    );
  }

  const {
    openingBalance,
    currentBalance,
    monthEarned,
    monthSpent,
    monthInvestments,
    monthSavings,
    todaySpent,
    todayImportance,
    recentTransactions,
    insight
  } = dashboardData;

  const essentialPct = todaySpent ? Math.round((todayImportance.essential / todaySpent) * 100) : 0;
  const moderatePct = todaySpent ? Math.round((todayImportance.moderate / todaySpent) * 100) : 0;
  const lowValuePct = todaySpent ? Math.round((todayImportance.low_value / todaySpent) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 mt-2">
      {/* Top Banner: Welcome Header */}
      <div className="flex justify-between items-center">
        <div>
          <span className="text-xs text-slate-400 font-semibold tracking-wide uppercase">
            {formatDateDMY(new Date())}
          </span>
          <h1 className="text-2xl font-extrabold font-display tracking-tight text-white mt-0.5">
            Hey, {user?.name.split(' ')[0]} 👋
          </h1>
          <Link 
            href="/spaces"
            className="text-xs text-indigo-400 font-semibold flex items-center gap-1 mt-0.5 hover:text-indigo-300 transition-colors cursor-pointer"
            title="Manage and switch spaces"
          >
            Space: <span className="underline">{activeSpace?.name || 'Personal Life'}</span> →
          </Link>
        </div>
        <div className="flex items-center gap-2.5">
          <Link 
            href="/inbox"
            className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-95 text-slate-400 hover:text-indigo-400 rounded-xl transition-all shadow cursor-pointer"
            title="Inbox"
          >
            <Inbox className="w-4.5 h-4.5" />
          </Link>
          <Link 
            href="/settings"
            className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-95 text-slate-400 hover:text-indigo-400 rounded-xl transition-all shadow cursor-pointer"
            title="Settings"
          >
            <Settings className="w-4.5 h-4.5" />
          </Link>
          <div className="w-10 h-10 rounded-full border border-slate-700/60 overflow-hidden shadow">
            {user?.picture ? (
              <img src={user.picture} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-indigo-600 flex items-center justify-center font-bold text-white">
                {user?.name?.charAt(0) || 'U'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conditional Warning: Setup Opening balance if missing */}
      {openingBalance === 0 && (
        <div className="bg-gradient-to-br from-indigo-900/60 to-slate-900/90 border border-indigo-500/30 rounded-2xl p-5 backdrop-blur shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Wallet className="w-16 h-16 text-indigo-400" />
          </div>
          <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-indigo-400 shrink-0" />
            Set {currentMonthFormatted} Opening Balance
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-[280px]">
            To calculate your monthly reconciliation and cashflow, please enter your starting bank balance.
          </p>
          <form onSubmit={handleSetOpeningBalance} className="mt-4 flex gap-2">
            <input
              type="number"
              value={openingInput}
              onChange={(e) => setOpeningInput(e.target.value)}
              placeholder="e.g. ₹25,000"
              disabled={isSettingOpening || isOffline}
              className="bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-semibold text-white w-full outline-none transition-all"
            />
            <button
              type="submit"
              disabled={isSettingOpening || isOffline}
              className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1"
            >
              Save
            </button>
          </form>
        </div>
      )}

      {/* Main Balance Display Card */}
      <div className="bg-gradient-to-tr from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Background visual elements */}
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Expected Current Balance</span>
          <Wallet className="w-5 h-5 text-indigo-400" />
        </div>
        <div className="text-3xl font-black font-display tracking-tight text-white mt-1.5">
          ₹{currentBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </div>
        
        {/* Sub-categories row */}
        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Earned</span>
              <span className="text-xs font-extrabold text-slate-200">
                +₹{monthEarned.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 rounded-xl">
              <TrendingDown className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Spent</span>
              <span className="text-xs font-extrabold text-slate-200">
                -₹{monthSpent.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Investments / Savings Footer row */}
        {(monthInvestments > 0 || monthSavings > 0) && (
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-800/20 text-xs">
            <div className="text-[10px] text-slate-400">
              Invested: <span className="font-bold text-slate-200">₹{monthInvestments.toLocaleString('en-IN')}</span>
            </div>
            <div className="text-[10px] text-slate-400">
              Emergency Savings: <span className="font-bold text-slate-200">₹{monthSavings.toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Today's Spending Overview & AI Insight Card */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 shadow-lg backdrop-blur-sm">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-bold text-slate-300">Today's Spend Overview</h2>
          <span className="text-xs font-extrabold text-indigo-400">
            ₹{todaySpent.toLocaleString('en-IN')}
          </span>
        </div>

        {/* Importance bar indicator */}
        {todaySpent > 0 ? (
          <div className="flex flex-col gap-3">
            {/* Visual stacked bar */}
            <div className="w-full h-3 bg-slate-850 rounded-full overflow-hidden flex">
              <div style={{ width: `${essentialPct}%` }} className="bg-emerald-500" title="Essential" />
              <div style={{ width: `${moderatePct}%` }} className="bg-indigo-500" title="Moderate" />
              <div style={{ width: `${lowValuePct}%` }} className="bg-rose-500" title="Low Value" />
            </div>
            
            {/* Legend label row */}
            <div className="flex justify-between text-[9px] font-bold text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Essential (₹{todayImportance.essential})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                Moderate (₹{todayImportance.moderate})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Low Value (₹{todayImportance.low_value})
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic py-1">No transactions recorded today.</p>
        )}

        {/* Dynamic Insight Banner */}
        <div className="mt-4 p-3.5 bg-indigo-950/20 border border-indigo-900/30 rounded-2xl flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
          <p className="text-[11px] font-medium text-indigo-200/90 leading-relaxed">
            {insight}
          </p>
        </div>
      </div>



      {/* Recent Activity Card */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 shadow-lg mb-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-bold text-slate-300 flex items-center gap-1.5">
            <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
            Recent Activity
          </h2>
          <Link href="/analytics" className="text-xs font-semibold text-indigo-400 hover:underline">
            View All
          </Link>
        </div>

        <div className="flex flex-col gap-3">
          {recentTransactions.length > 0 ? (
            recentTransactions.map((tx) => (
              <div 
                key={tx._id} 
                className="flex justify-between items-center p-3 bg-slate-950/40 border border-slate-850/60 rounded-2xl hover:bg-slate-950/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {/* Visual bullet representing type / importance color */}
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    tx.type === 'income' 
                      ? 'bg-emerald-400' 
                      : tx.type === 'investment'
                      ? 'bg-sky-400'
                      : tx.type === 'savings'
                      ? 'bg-purple-400'
                      : tx.importance === 'essential'
                      ? 'bg-emerald-500'
                      : tx.importance === 'moderate'
                      ? 'bg-indigo-500'
                      : 'bg-rose-500'
                  }`} />
                  <div>
                    <div className="text-xs font-bold text-slate-200">
                      {tx.titleId?.displayName || 'Transaction'}
                    </div>
                    <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                      {formatDateDMY(tx.date)}
                      {tx.note && ` • ${tx.note.substring(0, 15)}...`}
                    </div>
                  </div>
                </div>
                
                <span className={`text-xs font-black ${
                  tx.type === 'income' 
                    ? 'text-emerald-400' 
                    : tx.type === 'expense' 
                    ? 'text-rose-400' 
                    : 'text-slate-300'
                }`}>
                  {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 italic py-4 text-center">No transaction logs recorded.</p>
          )}
        </div>
      </div>
    </div>
  );
}
