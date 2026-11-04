'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useRouter } from 'next/navigation';
import { 
  Calendar, 
  FileText, 
  ChevronLeft, 
  Check, 
  Tag, 
  Folder,
  Delete,
  AlertCircle
} from 'lucide-react';

export default function AddTransactionPage() {
  const router = useRouter();
  const { spaces, activeSpaceId, apiFetch, offlineSafeFetch, refreshDashboard, isOffline } = useApp();

  // Selected space and inputs
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [txnType, setTxnType] = useState('expense'); // 'income' | 'expense' | 'investment' | 'savings'
  const [importance, setImportance] = useState('essential'); // 'essential' | 'moderate' | 'low_value'
  const [amountStr, setAmountStr] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA')); // YYYY-MM-DD local format
  
  // Title selection
  const [titleQuery, setTitleQuery] = useState('');
  const [recentTitles, setRecentTitles] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedTitle, setSelectedTitle] = useState(null); // { _id, displayName }
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [customTitleName, setCustomTitleName] = useState('');
  const [visibleTitlesLimit, setVisibleTitlesLimit] = useState(8);
  
  // Status feedback
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize selected space
  useEffect(() => {
    if (activeSpaceId) {
      setSelectedSpaceId(activeSpaceId);
    } else if (spaces.length > 0) {
      setSelectedSpaceId(spaces[0]._id);
    }
  }, [activeSpaceId, spaces]);

  // Load recent titles when space changes
  useEffect(() => {
    const loadTitles = async () => {
      if (selectedSpaceId) {
        const data = await apiFetch(`/api/titles/recent?spaceId=${selectedSpaceId}`);
        if (data && !data.error) {
          setRecentTitles(data);
          // Auto select first recent title as a smart default
          if (data.length > 0) {
            setSelectedTitle(data[0]);
            setShowOtherInput(false);
          } else {
            setSelectedTitle(null);
            setShowOtherInput(true);
          }
        }
      }
    };
    loadTitles();
  }, [selectedSpaceId, apiFetch]);

  // Search titles when search input changes
  useEffect(() => {
    const searchTitles = async () => {
      if (!titleQuery.trim() || !selectedSpaceId) {
        setSearchResults([]);
        return;
      }
      const data = await apiFetch(`/api/titles?spaceId=${selectedSpaceId}&q=${titleQuery}`);
      if (data && !data.error) {
        setSearchResults(data);
      }
    };
    
    const timeout = setTimeout(searchTitles, 300);
    return () => clearTimeout(timeout);
  }, [titleQuery, selectedSpaceId, apiFetch]);

  // Keyboard press handler
  const handleKeyPress = (val) => {
    // Basic vibration haptic feedback (10ms click vibration)
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      try {
        window.navigator.vibrate(10);
      } catch (err) {}
    }

    if (val === 'back') {
      setAmountStr(prev => prev.slice(0, -1));
    } else if (val === '.') {
      if (!amountStr.includes('.')) {
        setAmountStr(prev => prev === '' ? '0.' : prev + '.');
      }
    } else {
      // Limit to 2 decimal places
      if (amountStr.includes('.')) {
        const [, decimals] = amountStr.split('.');
        if (decimals && decimals.length >= 2) return;
      }
      // Avoid leading zeros
      if (amountStr === '0' && val !== '.') {
        setAmountStr(val);
      } else {
        setAmountStr(prev => prev + val);
      }
    }
  };

  // Submit action
  const handleSubmit = async () => {
    const amountVal = parseFloat(amountStr);
    if (isNaN(amountVal) || amountVal <= 0) {
      setMessage({ text: 'Please enter a valid amount greater than 0', type: 'error' });
      return;
    }

    let finalTitle = '';
    let finalTitleId = '';

    if (showOtherInput) {
      if (!customTitleName.trim()) {
        setMessage({ text: 'Please specify a title for this transaction', type: 'error' });
        return;
      }
      finalTitle = customTitleName.trim();
    } else {
      if (!selectedTitle) {
        setMessage({ text: 'Please select a category title', type: 'error' });
        return;
      }
      finalTitleId = selectedTitle._id;
    }



    setIsSubmitting(true);
    setMessage({ text: '', type: '' });

    // Combine selected calendar date (YYYY-MM-DD) with current local time (Hours/Mins/Secs)
    const [yr, mo, dy] = date.split('-').map(Number);
    const targetDate = new Date();
    targetDate.setFullYear(yr, mo - 1, dy);

    const payload = {
      spaceId: selectedSpaceId,
      type: txnType,
      amount: amountVal,
      date: targetDate.toISOString(),
      note: note.trim(),
    };

    if (finalTitleId) {
      payload.titleId = finalTitleId;
    } else {
      payload.title = finalTitle;
    }

    if (txnType === 'expense') {
      payload.importance = importance;
    }

    const res = await offlineSafeFetch('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res && (!res.error || res.offlineQueued)) {
      await refreshDashboard(selectedSpaceId);
      router.push('/');
    } else {
      setMessage({ text: res.error || 'Server error saving transaction', type: 'error' });
    }
    setIsSubmitting(false);
  };

  const displayedTitles = recentTitles.slice(0, visibleTitlesLimit);

  return (
    <div className="flex flex-col gap-5 mt-1 pb-10">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => router.back()}
          className="p-2 bg-slate-900 border border-slate-800 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 text-slate-300" />
        </button>
        <h1 className="text-lg font-bold text-white font-display">Add Money Movement</h1>
        <button
          onClick={() => router.push('/pay')}
          className="p-2 bg-indigo-600 border border-indigo-500 rounded-full hover:bg-indigo-500 transition-colors cursor-pointer flex items-center justify-center shadow shadow-indigo-500/20"
          title="Scan & Pay via UPI"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><rect x="7" y="7" width="10" height="10" rx="1"></rect></svg>
        </button>
      </div>

      {/* Error banner */}
      {message.text && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-200 p-3 rounded-2xl flex items-start gap-2 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Large Amount Screen */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-center flex flex-col justify-center items-center relative overflow-hidden">
        <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Enter Amount</span>
        <div className="flex items-center text-4xl font-black font-display text-white">
          <span className="text-indigo-400 mr-1.5">₹</span>
          <span>{amountStr || '0'}</span>
          <span className="w-1.5 h-8 bg-indigo-500 ml-1 animate-pulse" />
        </div>
      </div>

      {/* Numeric Tapping Keypad (Moved to Top) */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-3xl p-5 shadow-xl select-none">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num.toString())}
              className="py-4 bg-slate-950 border border-slate-800 hover:bg-slate-850 active:scale-95 text-lg font-extrabold rounded-2xl text-slate-200 transition-all flex items-center justify-center cursor-pointer"
            >
              {num}
            </button>
          ))}
          
          {/* Backspace */}
          <button
            type="button"
            onClick={() => handleKeyPress('back')}
            className="py-4 bg-slate-950 border border-slate-800 hover:bg-rose-950/20 hover:border-rose-900/40 active:scale-95 rounded-2xl text-slate-400 flex items-center justify-center transition-all cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="flex flex-col gap-4">
        {/* Space and Type selectors */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col gap-1.5">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
              <Folder className="w-3 h-3 text-slate-400" /> Space
            </span>
            <select
              value={selectedSpaceId}
              onChange={(e) => setSelectedSpaceId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-300 outline-none w-full cursor-pointer"
            >
              {spaces.map(s => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col gap-1.5">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Type</span>
            <select
              value={txnType}
              onChange={(e) => setTxnType(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-300 outline-none w-full cursor-pointer"
            >
              <option value="expense">Spent</option>
              <option value="income">Earned</option>
              <option value="investment">Investment</option>
              <option value="savings">Savings</option>
            </select>
          </div>
        </div>

        {/* Dynamic Category Title Select */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 flex flex-col gap-3">
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
            <Tag className="w-3 h-3 text-slate-400" /> Category Title
          </span>

          {/* Toggle between Recent Title or Custom Other */}
          <div className="grid grid-cols-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setShowOtherInput(false)}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${!showOtherInput ? 'bg-slate-800 text-indigo-300' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Recently Used
            </button>
            <button
              type="button"
              onClick={() => {
                setShowOtherInput(true);
                setSelectedTitle(null);
              }}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${showOtherInput ? 'bg-slate-800 text-indigo-300' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Other (New)
            </button>
          </div>

          {!showOtherInput ? (
            <div className="flex flex-col gap-2">
              {recentTitles.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                  <div className="grid grid-cols-4 gap-1.5">
                    {displayedTitles.map(t => (
                      <button
                        key={t._id}
                        type="button"
                        onClick={() => setSelectedTitle(t)}
                        className={`py-2 px-1 rounded-xl border text-[10px] font-black text-center truncate transition-all duration-200 cursor-pointer ${selectedTitle?._id === t._id ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300 scale-[1.02]' : 'bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-900 active:scale-95'}`}
                        title={t.displayName}
                      >
                        {t.displayName}
                      </button>
                    ))}
                  </div>

                  {recentTitles.length > 8 && (
                    <div className="flex gap-4 justify-center mt-1">
                      {recentTitles.length > visibleTitlesLimit && (
                        <button
                          type="button"
                          onClick={() => setVisibleTitlesLimit(prev => prev + 8)}
                          className="text-[10px] font-extrabold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
                        >
                          View More
                        </button>
                      )}
                      {visibleTitlesLimit > 8 && (
                        <button
                          type="button"
                          onClick={() => setVisibleTitlesLimit(8)}
                          className="text-[10px] font-extrabold text-slate-500 hover:text-slate-400 hover:underline cursor-pointer"
                        >
                          Show Less
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic text-center py-2">No recent titles. Tap 'Other' to create one.</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={customTitleName}
                onChange={(e) => {
                  setCustomTitleName(e.target.value);
                  setTitleQuery(e.target.value);
                }}
                placeholder="Title Name (e.g. Cookie, Recharge)"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white outline-none transition-all"
              />

              {/* Autocomplete suggestion popover list */}
              {searchResults.length > 0 && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl max-h-36 overflow-y-auto no-scrollbar p-1.5 flex flex-col gap-1 shadow-lg">
                  <span className="text-[9px] text-slate-500 font-bold block px-2 uppercase tracking-wide">Matching Existing:</span>
                  {searchResults.map(t => (
                    <button
                      key={t._id}
                      type="button"
                      onClick={() => {
                        setSelectedTitle(t);
                        setCustomTitleName(t.displayName);
                        setShowOtherInput(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-900 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      {t.displayName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Conditional: Importance selection (Spent only) */}
        {txnType === 'expense' && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 flex flex-col gap-3">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Importance Priority</span>
            <div className="grid grid-cols-3 gap-2">
              {['essential', 'moderate', 'low_value'].map((imp) => (
                <button
                  key={imp}
                  type="button"
                  onClick={() => setImportance(imp)}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    importance === imp
                      ? imp === 'essential'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300'
                        : imp === 'moderate'
                        ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300'
                        : 'bg-rose-500/10 border-rose-500 text-rose-300'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  {imp === 'essential' ? 'Essential' : imp === 'moderate' ? 'Moderate' : 'Low Value'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date and Note details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col gap-1.5">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" /> Date
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-xs text-slate-300 font-bold outline-none cursor-pointer"
            />
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col gap-1.5">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
              <FileText className="w-3 h-3 text-slate-400" /> Note (Opt)
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Friend help, etc."
              className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-xs text-slate-300 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Large submit check trigger (Moved to bottom of page) */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className={`w-full py-4 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-2xl text-white font-black text-sm tracking-wide shadow-lg shadow-indigo-500/20 active:scale-98 hover:from-indigo-600 hover:to-violet-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Check className="w-5 h-5 stroke-[3]" /> Confirm Money Movement
      </button>
    </div>
  );
}
