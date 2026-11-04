/**
 * Server-side notification parser for UPI apps and bank SMS.
 * Handles all major Indian UPI apps and bank message formats.
 * 
 * Runs on the server (Next.js API route) so regex patterns can be
 * updated by deploying to Vercel without APK re-installation.
 */

const PARSERS = {
  // Google Pay
  'com.google.android.apps.nbu.paisa.user': (title, body) => {
    // "₹500 paid to RAMESH KUMAR" or "You paid ₹500 to UPI ID"
    const debitMatch = body.match(/(?:you paid|paid|sent)\s+(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+(?:to|for)\s+(.+?)(?:\.|$)/i)
      || title.match(/₹([\d,]+(?:\.\d{1,2})?)\s+(?:paid|sent)\s+to\s+(.+?)(?:\s|$)/i);
    if (debitMatch) {
      return { type: 'DEBIT', amount: parseFloat(debitMatch[1].replace(/,/g, '')), counterparty: debitMatch[2]?.trim() };
    }
    // Credit
    const creditMatch = body.match(/(?:received|got)\s+(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+from\s+(.+?)(?:\.|$)/i);
    if (creditMatch) {
      return { type: 'CREDIT', amount: parseFloat(creditMatch[1].replace(/,/g, '')), counterparty: creditMatch[2]?.trim() };
    }
    return null;
  },

  // PhonePe
  'com.phonepe.app': (title, body) => {
    // "Rs. 500.00 Debited to RAMESH on PhonePe" or "Money Sent Successfully!"
    const debitMatch = body.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+(?:debited|paid|sent)(?:\s+(?:to|for)\s+(.+?))?(?:\s+on|\.|$)/i)
      || title.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+(?:debited|sent)/i);
    if (debitMatch) {
      return { type: 'DEBIT', amount: parseFloat(debitMatch[1].replace(/,/g, '')), counterparty: debitMatch[2]?.trim() };
    }
    const creditMatch = body.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+(?:credited|received)/i);
    if (creditMatch) {
      return { type: 'CREDIT', amount: parseFloat(creditMatch[1].replace(/,/g, '')), counterparty: null };
    }
    return null;
  },

  // Paytm
  'net.one97.paytm': (title, body) => {
    // "₹100 sent to SHOP NAME" or "Payment of ₹100 to UPI"
    const debitMatch = body.match(/(?:payment of\s+)?(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+(?:sent|paid|debited)(?:\s+to\s+(.+?))?(?:\s+via|\.|$)/i);
    if (debitMatch) {
      return { type: 'DEBIT', amount: parseFloat(debitMatch[1].replace(/,/g, '')), counterparty: debitMatch[2]?.trim() };
    }
    const creditMatch = body.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+(?:received|credited)/i);
    if (creditMatch) {
      return { type: 'CREDIT', amount: parseFloat(creditMatch[1].replace(/,/g, '')), counterparty: null };
    }
    return null;
  },

  // BHIM
  'in.org.npci.upiapp': (title, body) => {
    const debitMatch = body.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+(?:debited|sent|paid)/i);
    if (debitMatch) {
      return { type: 'DEBIT', amount: parseFloat(debitMatch[1].replace(/,/g, '')), counterparty: null };
    }
    const creditMatch = body.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+(?:credited|received)/i);
    if (creditMatch) {
      return { type: 'CREDIT', amount: parseFloat(creditMatch[1].replace(/,/g, '')), counterparty: null };
    }
    return null;
  },

  // Amazon Pay
  'in.amazon.mShop.android.shopping': (title, body) => {
    const debitMatch = body.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+(?:debited|paid|sent)/i);
    if (debitMatch) return { type: 'DEBIT', amount: parseFloat(debitMatch[1].replace(/,/g, '')), counterparty: null };
    const creditMatch = body.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+(?:credited|received)/i);
    if (creditMatch) return { type: 'CREDIT', amount: parseFloat(creditMatch[1].replace(/,/g, '')), counterparty: null };
    return null;
  },

  // CRED
  'com.dreamplug.androidapp': (title, body) => {
    const debitMatch = body.match(/(?:paid|sent)\s+(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (debitMatch) return { type: 'DEBIT', amount: parseFloat(debitMatch[1].replace(/,/g, '')), counterparty: null };
    return null;
  },

  // Super.money
  'money.super.app': (title, body) => {
    const debitMatch = body.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+(?:debited|paid)/i);
    if (debitMatch) return { type: 'DEBIT', amount: parseFloat(debitMatch[1].replace(/,/g, '')), counterparty: null };
    return null;
  },

  // Navi
  'com.navi.app': (title, body) => {
    const debitMatch = body.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+(?:debited|paid|sent)/i);
    if (debitMatch) return { type: 'DEBIT', amount: parseFloat(debitMatch[1].replace(/,/g, '')), counterparty: null };
    return null;
  },
};

// Generic bank SMS parser for messaging apps (Google Messages, Samsung Messages, Apple SMS)
function parseBankSMS(body) {
  // Debit patterns: "INR 500.00 debited from A/C XX1234 on UPI ref 123456789012"
  const debitPatterns = [
    /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+(?:debited|spent|paid|sent)(?:\s+(?:from|for|to)\s+(?:a\/c|acc|account)?\s*[xX*]{0,10}(\d{4}))?.+?(?:upi|ref(?:\s*no)?\.?|utr)\s*[:.\s]*(\d{12})?/i,
    /(?:debited|paid|spent)\s+(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)(?:.+?(?:upi|ref)\s*[:.\s]*(\d{12})?)?/i,
    /(?:debited\s+by|sent)\s+(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];
  for (const pattern of debitPatterns) {
    const m = body.match(pattern);
    if (m) {
      const amount = parseFloat((m[1] || m[2] || '0').replace(/,/g, ''));
      if (amount > 0) {
        // Try extracting counterparty e.g. "VPA someone@okaxis" or "to MERCHANT"
        const cpMatch = body.match(/(?:to|vpa|info|at)\s+([a-zA-Z0-9.\-_@]+)/i);
        return { type: 'DEBIT', amount, counterparty: cpMatch ? cpMatch[1] : '' };
      }
    }
  }
  // Credit patterns
  const creditMatch = body.match(/(?:credited|received)\s+(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i)
    || body.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+(?:credited|received)/i);
  if (creditMatch) {
    return { type: 'CREDIT', amount: parseFloat(creditMatch[1].replace(/,/g, '')), counterparty: '' };
  }
  return null;
}

// 12-digit UTR extractor
const UTR_REGEX = /\b(\d{12})\b/;

/**
 * Main server-side parse function.
 * @param {string} packageName - Android package name or identifier of the sending app
 * @param {string} rawTitle - Notification title
 * @param {string} rawBody - Notification body text
 * @param {number} eventTimestamp - sbn.notification.when (ms)
 * @returns {{ type: string, amount: number, counterparty: string, referenceId: string|null, parseStatus: string }}
 */
export function parseNotification(packageName, rawTitle = '', rawBody = '', eventTimestamp = Date.now()) {
  const rawText = `${rawTitle} ${rawBody}`.trim();
  const referenceId = UTR_REGEX.exec(rawText)?.[1] || null;

  // Try app-specific parser first
  const appParser = PARSERS[packageName];
  if (appParser) {
    const result = appParser(rawTitle, rawBody);
    if (result && result.amount > 0) {
      return {
        type: result.type || 'UNKNOWN',
        amount: result.amount,
        counterparty: result.counterparty || '',
        referenceId,
        parseStatus: 'parsed',
      };
    }
  }

  // Fallback: generic bank SMS parser (for messaging apps and iOS Shortcuts)
  const isMessagingApp = packageName === 'com.google.android.apps.messaging' 
    || packageName === 'com.samsung.android.messaging'
    || packageName === 'com.apple.sms'
    || packageName === 'iOS_Shortcut';

  if (isMessagingApp || !appParser) {
    const result = parseBankSMS(rawText);
    if (result && result.amount > 0) {
      return {
        type: result.type,
        amount: result.amount,
        counterparty: result.counterparty || '',
        referenceId,
        parseStatus: 'parsed',
      };
    }
  }

  return {
    type: 'UNKNOWN',
    amount: 0,
    counterparty: '',
    referenceId,
    parseStatus: 'unparsed',
  };
}
