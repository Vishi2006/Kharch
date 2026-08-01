'use client';

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  LogOut, 
  Trash2, 
  ShieldAlert, 
  Database, 
  Calendar, 
  Info,
  UserCheck,
  AlertOctagon
} from 'lucide-react';
import { formatDateDMY } from '../../utils/date';

export default function SettingsPage() {
  const { user, activeSpace, logout, apiFetch, isOffline } = useApp();

  // Selective cleanup states
  const [cleanupRange, setCleanupRange] = useState('6months'); // '6months' | '1year' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState('');

  // Danger zone account deletion state
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Trigger history cleanup
  const handleHistoryCleanup = async (e) => {
    e.preventDefault();
    if (isOffline) return;

    let confirmMsg = '';
    if (cleanupRange === '6months') {
      confirmMsg = `Are you sure you want to delete detailed transactions older than 6 months in "${activeSpace?.name}"?\n\nHigh-level monthly summaries and locked balances will be preserved.`;
    } else if (cleanupRange === '1year') {
      confirmMsg = `Are you sure you want to delete detailed transactions older than 1 year in "${activeSpace?.name}"?\n\nHigh-level monthly summaries and locked balances will be preserved.`;
    } else {
      if (!startDate || !endDate) {
        alert('Please select start and end dates.');
        return;
      }
      const formattedStart = formatDateDMY(new Date(startDate));
      const formattedEnd = formatDateDMY(new Date(endDate));
      confirmMsg = `Are you sure you want to delete detailed transactions between ${formattedStart} and ${formattedEnd} in "${activeSpace?.name}"?\n\nHigh-level monthly summaries and locked balances will be preserved.`;
    }

    if (!confirm(confirmMsg)) return;

    setIsCleaning(true);
    setCleanupResult('');
    
    const payload = {
      spaceId: activeSpace._id,
      range: cleanupRange
    };

    if (cleanupRange === 'custom') {
      payload.startDate = new Date(startDate).toISOString();
      payload.endDate = new Date(endDate).toISOString();
    }

    const data = await apiFetch('/api/settings/cleanup', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (data && !data.error) {
      setCleanupResult(data.message || 'Cleanup completed.');
      setStartDate('');
      setEndDate('');
    } else {
      alert(data.error || 'Failed to complete cleanup');
    }
    setIsCleaning(false);
  };

  // Trigger account deletion
  const handleDeleteAccount = async () => {
    if (isOffline) return;

    const firstConfirm = confirm('DANGER: Are you absolutely sure you want to delete your Kharch account?\n\nThis will permanently delete your Google account link, all isolated spaces, all transactions, and all locked monthly summaries. This cannot be undone.');
    if (!firstConfirm) return;

    const secondConfirm = confirm('FINAL CONFIRMATION: This will erase your entire database record. Do you want to proceed?');
    if (!secondConfirm) return;

    setIsDeletingAccount(true);
    const data = await apiFetch('/api/settings/delete-account', {
      method: 'DELETE'
    });

    if (data && !data.error) {
      alert('Your account has been deleted. Goodbye!');
      window.location.reload(); // Wipes context and routes to /login
    } else {
      alert(data.error || 'Failed to delete account');
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 mt-1 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold tracking-tight font-display text-white">
          Settings & Retention
        </h1>
        <span className="text-xs text-slate-400 font-semibold mt-0.5 block">
          Manage your login session, data storage, and cleanup rules.
        </span>
      </div>

      {/* User profile card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg relative overflow-hidden flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl border border-slate-700/60 overflow-hidden shadow">
            {user?.picture ? (
              <img src={user.picture} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-indigo-600 flex items-center justify-center font-bold text-lg text-white">
                {user?.name.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200">{user?.name}</h3>
            <span className="text-xs text-slate-500 font-semibold block mt-0.5">{user?.email}</span>
            <span className="text-[10px] text-indigo-400 font-extrabold flex items-center gap-1 mt-1 uppercase tracking-wider">
              <UserCheck className="w-3.5 h-3.5" /> Authenticated via Google
            </span>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full py-3 bg-slate-950 border border-slate-800 hover:bg-slate-850 active:scale-98 rounded-xl font-bold text-xs text-slate-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-rose-500" /> Google Logout
        </button>
      </div>

      {/* Selective Cleanup Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <Database className="w-4 h-4 text-indigo-400" /> Database Storage Cleanup
        </h3>
        <p className="text-[10px] text-slate-500 leading-normal mb-4">
          To fit comfortably within the MongoDB Atlas Free 512MB tier, clear raw log lists periodically.
        </p>

        {/* Safety banner */}
        <div className="p-3.5 bg-indigo-950/20 border border-indigo-900/30 rounded-2xl flex items-start gap-2.5 mb-5 text-[11px] leading-relaxed text-indigo-200">
          <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold uppercase text-[9px] block text-indigo-400 tracking-wider mb-0.5">Permanent Summaries Guard</span>
            Daily item logs are purged, but your high-level monthly summaries (Earned, Spent, Closing balance, Reconciliation adjustments) are locked and permanently preserved for annual reports.
          </div>
        </div>

        {cleanupResult && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold rounded-xl">
            {cleanupResult}
          </div>
        )}

        <form onSubmit={handleHistoryCleanup} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase">Purge Date Range</label>
            <select
              value={cleanupRange}
              onChange={(e) => {
                setCleanupRange(e.target.value);
                setCleanupResult('');
              }}
              disabled={isCleaning || isOffline}
              className="bg-slate-950 border border-slate-850 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-300 outline-none cursor-pointer"
            >
              <option value="6months">Older than 6 Months</option>
              <option value="1year">Older than 1 Year</option>
              <option value="custom">Custom Date Range...</option>
            </select>
          </div>

          {/* Custom Date selection inputs */}
          {cleanupRange === 'custom' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 border border-slate-850 rounded-2xl animate-fade-in">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" /> Start Date
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" /> End Date
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-white"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isCleaning || isOffline}
            className={`w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${isOffline ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Trash2 className="w-4 h-4" /> Purge Raw Transactions Log
          </button>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg border-rose-500/20 mb-4">
        <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" /> Danger Zone
        </h3>
        <p className="text-[10px] text-slate-500 leading-normal mb-4">
          Completely reset your footprint. Once executed, all records will be deleted permanently.
        </p>

        <button
          onClick={handleDeleteAccount}
          disabled={isDeletingAccount || isOffline}
          className={`w-full py-3 bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500/25 active:scale-98 text-rose-200 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${isOffline ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" /> Wipe Entire Account & History
        </button>
      </div>
    </div>
  );
}
