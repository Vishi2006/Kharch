'use client';

import { useState, useEffect, useCallback } from 'react';
import QRScanner from '../../components/QRScanner';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../utils/db';
import { Camera, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PayPage() {
  const router = useRouter();
  const [scanResult, setScanResult] = useState(null);
  const [formData, setFormData] = useState({ pa: '', pn: '', am: '', cu: 'INR', rawPayload: '' });
  const [paymentState, setPaymentState] = useState('SCANNING'); // SCANNING, FORM, PROCESSING, RETURNED, SUCCESS, UNKNOWN
  const [activeAttempt, setActiveAttempt] = useState(null);

  // Check for pending payments on mount or visibility change
  const checkPendingPayments = useCallback(async () => {
    try {
      const pending = await db.paymentAttempts.where('status').equals('PENDING').first();
      if (pending) {
        // We returned from the UPI app!
        setActiveAttempt(pending);
        
        // Wait briefly, then mark as UNKNOWN if no explicit callback
        setTimeout(async () => {
          const stillPending = await db.paymentAttempts.get(pending.paymentAttemptId);
          if (stillPending && stillPending.status === 'PENDING') {
            await db.paymentAttempts.update(pending.paymentAttemptId, { status: 'UNKNOWN' });
            setPaymentState('UNKNOWN');
          }
        }, 3000); // Wait 3s before concluding UNKNOWN
        
        setPaymentState('RETURNED');
      }
    } catch (err) {
      console.error("Error checking pending payments:", err);
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
    // Parse UPI URI
    try {
      const url = new URL(decodedText);
      if (url.protocol !== 'upi:') throw new Error('Not a UPI URI');
      
      const params = url.searchParams;
      setFormData({
        pa: params.get('pa') || '',
        pn: params.get('pn') || '',
        am: params.get('am') || '',
        cu: params.get('cu') || 'INR',
        rawPayload: decodedText
      });
      setPaymentState('FORM');
    } catch (e) {
      // If parsing fails, fall back to showing raw payload
      setFormData(prev => ({ ...prev, rawPayload: decodedText }));
      setPaymentState('FORM');
    }
  };

  const handlePayClick = async (e) => {
    e.preventDefault();
    if (!formData.pa) return alert('Payee VPA is required');
    if (!formData.am) return alert('Amount is required');

    const paymentAttemptId = uuidv4();
    const attempt = {
      paymentAttemptId,
      payeeVpa: formData.pa,
      payeeName: formData.pn,
      amount: parseFloat(formData.am),
      status: 'PENDING',
      initiatedAt: Date.now(),
      rawPayload: formData.rawPayload
    };

    // Save to IndexedDB
    await db.paymentAttempts.add(attempt);

    // Deep link to UPI
    const upiUrl = `upi://pay?pa=${formData.pa}&pn=${formData.pn}&am=${formData.am}&cu=${formData.cu}&tr=${paymentAttemptId}`;
    window.location.href = upiUrl;
  };

  const handleCompleteTransaction = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const category = form.get('category');
    const note = form.get('note');

    // In a real app, this would POST to /api/transactions
    // and /api/payment-attempts to update status to SUCCESS
    try {
      const response = await fetch('/api/payment-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentAttemptId: activeAttempt.paymentAttemptId,
          type: 'expense',
          amount: activeAttempt.amount,
          payeeVpa: activeAttempt.payeeVpa,
          payeeName: activeAttempt.payeeName,
          status: 'SUCCESS',
          // normally would include transaction details too or link to a created transaction
        })
      });

      if (response.ok) {
        await db.paymentAttempts.update(activeAttempt.paymentAttemptId, { status: 'SUCCESS' });
        setPaymentState('SUCCESS');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save transaction');
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Pay via UPI</h1>
      
      {paymentState === 'SCANNING' && (
        <div className="space-y-4">
          <QRScanner onScanSuccess={handleScanSuccess} />
          <p className="text-center text-sm text-gray-500">Scan any UPI QR Code</p>
        </div>
      )}

      {paymentState === 'FORM' && (
        <form onSubmit={handlePayClick} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Payee VPA</label>
            <input type="text" value={formData.pa} onChange={e => setFormData({...formData, pa: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium">Payee Name</label>
            <input type="text" value={formData.pn} onChange={e => setFormData({...formData, pn: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">Amount (INR)</label>
            <input type="number" step="0.01" value={formData.am} onChange={e => setFormData({...formData, am: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 text-xl" required />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-md font-medium">Proceed to Pay</button>
          
          <div className="mt-4 text-xs text-gray-500 break-all">
            Raw Payload: {formData.rawPayload}
          </div>
        </form>
      )}

      {paymentState === 'RETURNED' && (
        <div className="text-center py-8">
          <Loader className="w-12 h-12 animate-spin mx-auto text-blue-500 mb-4" />
          <h2 className="text-lg font-medium">Awaiting UPI response...</h2>
          <p className="text-sm text-gray-500">Please wait while we confirm your payment status.</p>
        </div>
      )}

      {paymentState === 'UNKNOWN' && activeAttempt && (
        <form onSubmit={handleCompleteTransaction} className="space-y-4 p-4 border rounded-lg bg-gray-50">
          <div className="flex items-center text-yellow-600 mb-4">
            <AlertCircle className="w-6 h-6 mr-2" />
            <h2 className="text-lg font-medium">Payment Status Unknown</h2>
          </div>
          <p className="text-sm">We couldn't automatically verify the status of your payment to <b>{activeAttempt.payeeName || activeAttempt.payeeVpa}</b> for <b>₹{activeAttempt.amount}</b>.</p>
          <p className="text-sm mb-4">Did the payment succeed?</p>
          
          <div>
            <label className="block text-sm font-medium">Category</label>
            <select name="category" className="mt-1 block w-full rounded-md border p-2">
              <option value="essential">Essential</option>
              <option value="moderate">Moderate</option>
              <option value="low_value">Low Value</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Note</label>
            <input type="text" name="note" className="mt-1 block w-full rounded-md border p-2" placeholder="Optional" />
          </div>
          <button type="submit" className="w-full bg-green-600 text-white p-3 rounded-md font-medium">Yes, Save as Successful Transaction</button>
          <button type="button" onClick={async () => {
            await db.paymentAttempts.update(activeAttempt.paymentAttemptId, { status: 'FAILED' });
            setPaymentState('SCANNING');
          }} className="w-full bg-red-100 text-red-600 p-3 rounded-md font-medium mt-2">No, Payment Failed</button>
        </form>
      )}

      {paymentState === 'SUCCESS' && (
        <div className="text-center py-8">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold">Transaction Saved!</h2>
          <button onClick={() => setPaymentState('SCANNING')} className="mt-6 text-blue-600">Make another payment</button>
        </div>
      )}
    </div>
  );
}
