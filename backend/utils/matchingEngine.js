const NotificationEvent = require('../models/NotificationEvent');
const PaymentAttempt = require('../models/PaymentAttempt');
const Transaction = require('../models/Transaction');
const ExpenseTitle = require('../models/ExpenseTitle');
const Space = require('../models/Space');

/**
 * Calculates string similarity between two names/VPAs
 */
function isCounterpartySimilar(name1, name2) {
  if (!name1 || !name2) return false;
  const clean1 = name1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const clean2 = name2.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (clean1.length === 0 || clean2.length === 0) return false;
  if (clean1.includes(clean2) || clean2.includes(clean1)) return true;

  // Simple token overlap
  const tokens1 = name1.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const tokens2 = name2.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const common = tokens1.filter((t) => tokens2.includes(t));
  return common.length > 0;
}

/**
 * Formats canonical title display name
 */
function formatDisplayName(str) {
  return str
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Runs matching engine on a single notification event
 */
async function processNotificationEvent(event) {
  if (event.status === 'LINKED' || event.status === 'DISMISSED') {
    return { matched: false, reason: 'Already resolved' };
  }

  // Find candidate open PaymentAttempts within ±5 minute window
  const eventTime = new Date(event.timestamp).getTime();
  const windowMs = 5 * 60 * 1000;
  const minTime = new Date(eventTime - windowMs);
  const maxTime = new Date(eventTime + windowMs);

  const candidateAttempts = await PaymentAttempt.find({
    userId: event.userId,
    status: { $in: ['PENDING', 'UNKNOWN', 'SUBMITTED'] },
    linkedTransactionId: { $exists: false },
    amount: event.amount,
    initiatedAt: { $gte: minTime, $lte: maxTime },
  });

  if (!candidateAttempts || candidateAttempts.length === 0) {
    event.matchConfidence = 'LOW';
    await event.save();
    return { matched: false, confidence: 'LOW' };
  }

  // Evaluate candidate attempts
  let bestAttempt = null;
  let highestConfidence = 'LOW';

  for (const attempt of candidateAttempts) {
    const attemptTime = new Date(attempt.initiatedAt).getTime();
    const diffMs = Math.abs(eventTime - attemptTime);

    const cpMatch =
      isCounterpartySimilar(event.counterparty, attempt.payeeName) ||
      isCounterpartySimilar(event.counterparty, attempt.payeeVpa);

    // HIGH confidence: exact amount + within 2 mins + counterparty match
    if (diffMs <= 2 * 60 * 1000 && cpMatch) {
      bestAttempt = attempt;
      highestConfidence = 'HIGH';
      break;
    }

    // MEDIUM confidence: exact amount + within 5 mins
    if (diffMs <= 5 * 60 * 1000) {
      if (highestConfidence !== 'HIGH') {
        bestAttempt = attempt;
        highestConfidence = 'MEDIUM';
      }
    }
  }

  if (highestConfidence === 'HIGH' && bestAttempt) {
    // AUTO-MERGE into Transaction
    const defaultSpace =
      (await Space.findOne({ userId: event.userId, isDefault: true })) ||
      (await Space.findOne({ userId: event.userId }));

    if (!defaultSpace) {
      // Space unavailable, mark medium for manual resolution
      event.matchConfidence = 'MEDIUM';
      event.matchedPaymentAttemptId = bestAttempt.paymentAttemptId;
      await event.save();
      return { matched: true, confidence: 'MEDIUM' };
    }

    const titleStr = event.counterparty || bestAttempt.payeeName || 'UPI Payment';
    const normalizedName = titleStr.toLowerCase().trim();

    let canonicalTitle = await ExpenseTitle.findOne({
      spaceId: defaultSpace._id,
      normalizedName,
    });

    if (!canonicalTitle) {
      canonicalTitle = new ExpenseTitle({
        userId: event.userId,
        spaceId: defaultSpace._id,
        normalizedName,
        displayName: formatDisplayName(titleStr),
      });
      await canonicalTitle.save();
    }

    const txType = event.type === 'CREDIT' ? 'income' : 'expense';

    const transaction = new Transaction({
      userId: event.userId,
      spaceId: defaultSpace._id,
      type: txType,
      amount: event.amount,
      titleId: canonicalTitle._id,
      importance: txType === 'expense' ? 'moderate' : undefined,
      date: event.timestamp,
      note: `Auto-matched UPI payment (${event.counterparty || bestAttempt.payeeName || ''})`.trim(),
    });

    await transaction.save();

    // Mark both records as LINKED
    event.status = 'LINKED';
    event.matchConfidence = 'HIGH';
    event.linkedTransactionId = transaction._id;
    event.linkedPaymentAttemptId = bestAttempt.paymentAttemptId;
    await event.save();

    bestAttempt.status = 'SUCCESS';
    bestAttempt.linkedTransactionId = transaction._id;
    await bestAttempt.save();

    return { matched: true, confidence: 'HIGH', transactionId: transaction._id };
  } else if (highestConfidence === 'MEDIUM' && bestAttempt) {
    // Surface as MEDIUM confidence possible match in Inbox
    event.matchConfidence = 'MEDIUM';
    event.matchedPaymentAttemptId = bestAttempt.paymentAttemptId;
    await event.save();
    return { matched: true, confidence: 'MEDIUM', attemptId: bestAttempt.paymentAttemptId };
  } else {
    event.matchConfidence = 'LOW';
    await event.save();
    return { matched: false, confidence: 'LOW' };
  }
}

module.exports = {
  processNotificationEvent,
  isCounterpartySimilar,
};
