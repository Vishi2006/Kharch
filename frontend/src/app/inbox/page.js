'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../context/AppContext';
import { 
  Inbox, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Sparkles, 
  Smartphone, 
  QrCode, 
  ChevronLeft, 
  AlertCircle,
  Tag,
  ArrowRight,
  Layers,
  X
} from 'lucide-react';
import { formatDateDMY } from '../../utils/date';

export default function InboxPage() {
  const router = useRouter();
  const { user, spaces, activeSpace, apiFetch, isOffline } = useApp();

  const [loading, setLoading] = useState(true);
  const [inboxData, setInboxData] = useState({
    mediumMatches: [],
    unmatchedEvents: [],
    unknownAttempts: [],
    unreadCount: 0,
  });

  const [activeTab, setActiveTab] = useState('matches'); // 'matches' | 'unmatched'

  // Modal / Form state for classification & conversion
  const [selectedItem, setSelectedItem] = useState(null);
  const [actionType, setActionType] = useState('accept_match'); // 'accept_match' | 'convert_notification' | 'convert_attempt'
  const [formSpaceId, setFormSpaceId] = useState('');
  const [formImportance, setFormImportance] = useState('moderate');
  const [formTitle, setFormTitle] = useState('');
  const [formNote, setFormNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchInbox = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/inbox');
      if (data && !data.error) {
        setInboxData(data);
      }
    } catch (err) {
      console.error('Failed to load inbox:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
  }, []);

  useEffect(() => {
    if (activeSpace) {
      setFormSpaceId(activeSpace._id);
    } else if (spaces && spaces.length > 0) {
      setFormSpaceId(spaces[0]._id);
    }
  }, [activeSpace, spaces]);

  // Open Accept Match Modal
  const openAcceptModal = (match) => {
    setSelectedItem(match);
    setActionType('accept_match');
    setFormTitle(match.event.counterparty || match.suggestedAttempt.payeeName || 'UPI Payment');
    setFormImportance('moderate');
    setFormNote('');
  };

  // Open Convert Modal for standalone items
  const openConvertModal = (item, source) => {
    setSelectedItem(item);
    setActionType(source === 'notification' ? 'convert_notification' : 'convert_attempt');
    if (source === 'notification') {
      setFormTitle(item.counterparty || 'UPI Transaction');
    } else {
      setFormTitle(item.payeeName || 'UPI Payment');
    }
    setFormImportance('moderate');
    setFormNote('');
  };

  // Submit Accept Match
  const handleAcceptMatchSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/inbox/accept-match', {
        method: 'POST',
        body: JSON.stringify({
          notificationEventId: selectedItem.event._id,
          paymentAttemptId: selectedItem.suggestedAttempt.paymentAttemptId,
          spaceId: formSpaceId,
          importance: formImportance,
          title: formTitle,
          note: formNote,
        }),
      });

      if (res && res.success) {
        setSuccessMsg('Match accepted & recorded to ledger!');
        setTimeout(() => setSuccessMsg(''), 3000);
        setSelectedItem(null);
        fetchInbox();
      }
    } catch (err) {
      console.error('Error accepting match:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Convert to Transaction
  const handleConvertSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem || isSubmitting) return;

    setIsSubmitting(true);
    const isNotification = actionType === 'convert_notification';

    try {
      const res = await apiFetch('/api/inbox/convert', {
        method: 'POST',
        body: JSON.stringify({
          id: isNotification ? selectedItem._id : selectedItem.paymentAttemptId,
          source: isNotification ? 'notification' : 'payment_attempt',
          spaceId: formSpaceId,
          importance: formImportance,
          title: formTitle,
          note: formNote,
          type: isNotification
            ? (selectedItem.type === 'CREDIT' ? 'income' : 'expense')
            : (selectedItem.type || 'expense'),
        }),
      });

      if (res && res.success) {
        setSuccessMsg('Converted & added to ledger!');
        setTimeout(() => setSuccessMsg(''), 3000);
        setSelectedItem(null);
        fetchInbox();
      }
    } catch (err) {
      console.error('Error converting item:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1-Tap Confirm for events with merchant memory suggestion
  const handleOneTapConfirm = async (event) => {
    try {
      const res = await apiFetch('/api/inbox/convert', {
        method: 'POST',
        body: JSON.stringify({
          id: event._id,
          source: 'notification',
          spaceId: event.suggestedSpaceId || formSpaceId || (activeSpace?._id || spaces?.[0]?._id),
          title: event.suggestedTitle,
          importance: event.suggestedImportance || 'moderate',
          type: event.type === 'CREDIT' ? 'income' : 'expense',
          date: event.timestamp,
        }),
      });

      if (res && res.success) {
        setSuccessMsg(`Logged ₹${event.amount} as "${event.suggestedTitle}"!`);
        setTimeout(() => setSuccessMsg(''), 3000);
        fetchInbox();
      }
    } catch (err) {
      console.error('Error confirming suggested event:', err);
    }
  };

  // Dismiss / Reject
  const handleDismiss = async (id, source) => {
    if (!confirm('Dismiss this item without adding it to your ledger?')) return;

    try {
      await apiFetch('/api/inbox/dismiss', {
        method: 'POST',
        body: JSON.stringify({ id, source }),
      });
      fetchInbox();
    } catch (err) {
      console.error('Failed to dismiss:', err);
    }
  };

  const getSourceAppBadge = (sourceApp) => {
    if (!sourceApp) return 'UPI';
    const lower = sourceApp.toLowerCase();
    if (lower.includes('phonepe')) return 'PhonePe';
    if (lower.includes('paisa') || lower.includes('google')) return 'Google Pay';
    if (lower.includes('paytm')) return 'Paytm';
    if (lower.includes('npci') || lower.includes('bhim')) return 'BHIM';
    return 'Bank / SMS';
  };

  return (
    <div className="flex flex-col gap-5 mt-2">
      {/* Top Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-white font-display tracking-tight flex items-center gap-2">
              <Inbox className="w-5 h-5 text-indigo-400" />
              Inbox
            </h1>
            <span className="text-[11px] text-slate-400">
              Reconcile captured UPI receipts and pending payments
            </span>
          </div>
        </div>

        {inboxData.unreadCount > 0 && (
          <span className="px-2.5 py-1 text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
            {inboxData.unreadCount} pending
          </span>
        )}
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800">
        <button
          onClick={() => setActiveTab('matches')}
          className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'matches'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Possible Matches
          {inboxData.mediumMatches.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-white/20 text-white text-[10px] rounded-full">
              {inboxData.mediumMatches.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('unmatched')}
          className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'unmatched'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Unmatched &amp; Unknown
          {(inboxData.unmatchedEvents.length + inboxData.unknownAttempts.length) > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-white/20 text-white text-[10px] rounded-full">
              {inboxData.unmatchedEvents.length + inboxData.unknownAttempts.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col gap-3 py-10 items-center justify-center">
          <div className="w-8 h-8 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          <span className="text-xs text-slate-400">Loading inbox items...</span>
        </div>
      ) : (
        <>
          {/* TAB 1: MEDIUM CONFIDENCE POSSIBLE MATCHES */}
          {activeTab === 'matches' && (
            <div className="flex flex-col gap-4">
              {inboxData.mediumMatches.length > 0 ? (
                inboxData.mediumMatches.map((match) => (
                  <div
                    key={match.event._id}
                    className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-5 shadow-lg relative overflow-hidden flex flex-col gap-3"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                        Medium Match Candidate
                      </span>
                      <span className="text-base font-black text-white">
                        ₹{match.event.amount.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* Matched Details Comparison */}
                    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs">
                      {/* Left: Companion Notification */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                          <Smartphone className="w-3 h-3 text-indigo-400" />
                          {getSourceAppBadge(match.event.sourceApp)} Alert
                        </span>
                        <span className="font-bold text-slate-200 truncate">
                          {match.event.counterparty || 'Unknown Payee'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {formatDateDMY(match.event.timestamp)}
                        </span>
                      </div>

                      {/* Right: PWA QR Scan Attempt */}
                      <div className="flex flex-col gap-1 border-l border-slate-800 pl-3">
                        <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                          <QrCode className="w-3 h-3 text-violet-400" />
                          PWA QR Scan
                        </span>
                        <span className="font-bold text-slate-200 truncate">
                          {match.suggestedAttempt.payeeName || match.suggestedAttempt.payeeVpa || 'UPI Scan'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {formatDateDMY(match.suggestedAttempt.initiatedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        onClick={() => handleDismiss(match.event._id, 'notification')}
                        className="py-2.5 px-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <XCircle className="w-4 h-4 text-slate-400" /> Reject
                      </button>

                      <button
                        onClick={() => openAcceptModal(match)}
                        className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-colors shadow-md shadow-indigo-600/20 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Accept Match
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-6 h-6 text-indigo-400" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">No pending matches</h3>
                  <p className="text-xs text-slate-500 max-w-xs">
                    All high-confidence events are auto-merged directly to your ledger, and no medium-confidence suggestions are pending.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: UNMATCHED & UNKNOWN STANDALONE ITEMS */}
          {activeTab === 'unmatched' && (
            <div className="flex flex-col gap-4">
              {/* Unmatched notifications */}
              {inboxData.unmatchedEvents.length > 0 && (
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Unmatched Bank / UPI Alerts ({inboxData.unmatchedEvents.length})
                  </span>

                  {inboxData.unmatchedEvents.map((event) => (
                    <div
                      key={event._id}
                      className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg flex flex-col gap-2.5"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-slate-800 text-indigo-300 rounded-full border border-slate-700">
                            {getSourceAppBadge(event.sourceApp)}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            {formatDateDMY(event.timestamp)}
                          </span>
                        </div>
                        <span className={`text-sm font-black ${event.type === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {event.type === 'CREDIT' ? '+' : '-'}₹{event.amount.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="text-xs text-slate-200 font-medium line-clamp-2">
                        {event.counterparty || event.rawText}
                      </div>

                      <div className="flex justify-end items-center gap-2 mt-1 flex-wrap">
                        <button
                          onClick={() => handleDismiss(event._id, 'notification')}
                          className="px-3 py-1.5 text-xs text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          Dismiss
                        </button>

                        {/* Phase 3: 1-Tap Confirm button for events with auto-memory suggestions */}
                        {event.suggestedTitle && (
                          <button
                            onClick={() => handleOneTapConfirm(event)}
                            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
                          >
                            <Sparkles className="w-3.5 h-3.5" /> Confirm &ldquo;{event.suggestedTitle}&rdquo;
                          </button>
                        )}

                        <button
                          onClick={() => openConvertModal(event, 'notification')}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                        >
                          Convert to Transaction <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Unknown Payment Attempts */}
              {inboxData.unknownAttempts.length > 0 && (
                <div className="flex flex-col gap-3 mt-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Unconfirmed QR Payments ({inboxData.unknownAttempts.length})
                  </span>

                  {inboxData.unknownAttempts.map((attempt) => (
                    <div
                      key={attempt.paymentAttemptId}
                      className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg flex flex-col gap-2.5"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-amber-500/10 text-amber-300 rounded-full border border-amber-500/20">
                            Status: UNKNOWN
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            {formatDateDMY(attempt.initiatedAt)}
                          </span>
                        </div>
                        <span className="text-sm font-black text-white">
                          ₹{attempt.amount.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="text-xs text-slate-200 font-medium">
                        Payee: <strong className="text-white">{attempt.payeeName || attempt.payeeVpa || 'Unknown'}</strong>
                      </div>

                      <div className="flex justify-end items-center gap-2 mt-1">
                        <button
                          onClick={() => handleDismiss(attempt.paymentAttemptId, 'payment_attempt')}
                          className="px-3 py-1.5 text-xs text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => openConvertModal(attempt, 'payment_attempt')}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                        >
                          Save as Transaction <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {inboxData.unmatchedEvents.length === 0 && inboxData.unknownAttempts.length === 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">Inbox Zero 🎉</h3>
                  <p className="text-xs text-slate-500 max-w-xs">
                    No unmatched notifications or open payment attempts are waiting for review.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Reusable Classification Modal (for Accept Match and Convert) */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full relative shadow-2xl flex flex-col text-left">
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-white mb-1">
              {actionType === 'accept_match' ? 'Reconcile Match' : 'Add to Ledger'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Select category and space to record this transaction permanently.
            </p>

            <form onSubmit={actionType === 'accept_match' ? handleAcceptMatchSubmit : handleConvertSubmit} className="flex flex-col gap-3.5">
              {/* Space Selection */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Space</label>
                <select
                  value={formSpaceId}
                  onChange={(e) => setFormSpaceId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                  required
                >
                  {spaces.map((s) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Title / Payee</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                  required
                />
              </div>

              {/* Importance (Essential / Moderate / Low Value) */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Expense Importance</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormImportance('essential')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      formImportance === 'essential'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-850 text-slate-400'
                    }`}
                  >
                    Essential
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormImportance('moderate')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      formImportance === 'moderate'
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950 border-slate-850 text-slate-400'
                    }`}
                  >
                    Moderate
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormImportance('low_value')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      formImportance === 'low_value'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'bg-slate-950 border-slate-850 text-slate-400'
                    }`}
                  >
                    Low Value
                  </button>
                </div>
              </div>

              {/* Note */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Optional Note</label>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="e.g. Lunch with team"
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                {isSubmitting ? 'Saving...' : 'Save to Ledger'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
