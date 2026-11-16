const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const NotificationEvent = require('../models/NotificationEvent');
const PaymentAttempt = require('../models/PaymentAttempt');
const Transaction = require('../models/Transaction');
const ExpenseTitle = require('../models/ExpenseTitle');
const Space = require('../models/Space');

// Helper to format title display name
function formatDisplayName(str) {
  return str
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * @route   GET /api/inbox
 * @desc    Fetch unresolved notifications and UNKNOWN payment attempts
 */
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Fetch unmatched notification events
    const allUnmatchedEvents = await NotificationEvent.find({
      userId,
      status: 'UNMATCHED',
    }).sort({ timestamp: -1 });

    const mediumMatches = [];
    const unmatchedEvents = [];

    for (const event of allUnmatchedEvents) {
      if (event.matchConfidence === 'MEDIUM' && event.matchedPaymentAttemptId) {
        const attempt = await PaymentAttempt.findOne({
          userId,
          paymentAttemptId: event.matchedPaymentAttemptId,
          linkedTransactionId: { $exists: false },
        });

        if (attempt) {
          mediumMatches.push({
            event,
            suggestedAttempt: attempt,
          });
          continue;
        }
      }
      unmatchedEvents.push(event);
    }

    // 2. Fetch UNKNOWN payment attempts (or stale PENDING > 15m) without linked transactions
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const unknownAttempts = await PaymentAttempt.find({
      userId,
      $or: [
        { status: 'UNKNOWN' },
        { status: 'PENDING', initiatedAt: { $lte: fifteenMinsAgo } },
      ],
      linkedTransactionId: { $exists: false },
    }).sort({ initiatedAt: -1 });

    const unreadCount = mediumMatches.length + unmatchedEvents.length + unknownAttempts.length;

    return res.status(200).json({
      mediumMatches,
      unmatchedEvents,
      unknownAttempts,
      unreadCount,
    });
  } catch (error) {
    console.error('Error fetching inbox:', error);
    return res.status(500).json({ message: 'Failed to fetch inbox', error: error.message });
  }
});

/**
 * @route   POST /api/inbox/accept-match
 * @desc    Accept a suggested match and merge into a finalized Transaction
 */
router.post('/accept-match', protect, async (req, res) => {
  try {
    const { notificationEventId, paymentAttemptId, spaceId, importance, note, title } = req.body;

    const event = await NotificationEvent.findOne({
      _id: notificationEventId,
      userId: req.user._id,
    });

    const attempt = await PaymentAttempt.findOne({
      paymentAttemptId,
      userId: req.user._id,
    });

    if (!event || !attempt) {
      return res.status(404).json({ message: 'Matching records not found' });
    }

    // Find target Space
    let targetSpaceId = spaceId;
    if (!targetSpaceId) {
      const defaultSpace =
        (await Space.findOne({ userId: req.user._id, isDefault: true })) ||
        (await Space.findOne({ userId: req.user._id }));
      targetSpaceId = defaultSpace?._id;
    }

    if (!targetSpaceId) {
      return res.status(400).json({ message: 'No valid Space found for this user' });
    }

    const titleStr = title || event.counterparty || attempt.payeeName || 'UPI Payment';
    const normalizedName = titleStr.toLowerCase().trim();

    let canonicalTitle = await ExpenseTitle.findOne({
      spaceId: targetSpaceId,
      normalizedName,
    });

    if (!canonicalTitle) {
      canonicalTitle = new ExpenseTitle({
        userId: req.user._id,
        spaceId: targetSpaceId,
        normalizedName,
        displayName: formatDisplayName(titleStr),
      });
      await canonicalTitle.save();
    }

    const txType = event.type === 'CREDIT' ? 'income' : 'expense';

    const transaction = new Transaction({
      userId: req.user._id,
      spaceId: targetSpaceId,
      type: txType,
      amount: event.amount,
      titleId: canonicalTitle._id,
      importance: txType === 'expense' ? (importance || 'moderate') : undefined,
      date: event.timestamp || attempt.initiatedAt || new Date(),
      note: note || `Matched UPI payment (${event.counterparty || attempt.payeeName || ''})`.trim(),
    });

    await transaction.save();

    // Link records
    event.status = 'LINKED';
    event.matchConfidence = 'HIGH';
    event.linkedTransactionId = transaction._id;
    event.linkedPaymentAttemptId = attempt.paymentAttemptId;
    await event.save();

    attempt.status = 'SUCCESS';
    attempt.linkedTransactionId = transaction._id;
    await attempt.save();

    return res.status(200).json({ success: true, transaction });
  } catch (error) {
    console.error('Error accepting match:', error);
    return res.status(500).json({ message: 'Failed to accept match', error: error.message });
  }
});

/**
 * @route   POST /api/inbox/convert
 * @desc    Convert an unmatched NotificationEvent or PaymentAttempt to Transaction
 */
router.post('/convert', protect, async (req, res) => {
  try {
    const { id, source, spaceId, title, importance, type, note, date } = req.body;

    if (!id || !source) {
      return res.status(400).json({ message: 'id and source are required' });
    }

    let targetSpaceId = spaceId;
    if (!targetSpaceId) {
      const defaultSpace =
        (await Space.findOne({ userId: req.user._id, isDefault: true })) ||
        (await Space.findOne({ userId: req.user._id }));
      targetSpaceId = defaultSpace?._id;
    }

    if (!targetSpaceId) {
      return res.status(400).json({ message: 'No valid Space found for this user' });
    }

    let amount = 0;
    let resolvedDate = date ? new Date(date) : new Date();
    let defaultTitle = 'Payment';
    let txType = type || 'expense';

    let eventRecord = null;
    let attemptRecord = null;

    if (source === 'notification') {
      eventRecord = await NotificationEvent.findOne({ _id: id, userId: req.user._id });
      if (!eventRecord) return res.status(404).json({ message: 'Notification event not found' });
      amount = eventRecord.amount;
      resolvedDate = eventRecord.timestamp;
      defaultTitle = eventRecord.counterparty || 'UPI Transaction';
      txType = eventRecord.type === 'CREDIT' ? 'income' : 'expense';
    } else if (source === 'payment_attempt') {
      attemptRecord = await PaymentAttempt.findOne({ paymentAttemptId: id, userId: req.user._id });
      if (!attemptRecord) return res.status(404).json({ message: 'Payment attempt not found' });
      amount = attemptRecord.amount;
      resolvedDate = attemptRecord.initiatedAt;
      defaultTitle = attemptRecord.payeeName || 'UPI Payment';
      txType = attemptRecord.type || 'expense';
    }

    const titleStr = title || defaultTitle;
    const normalizedName = titleStr.toLowerCase().trim();

    let canonicalTitle = await ExpenseTitle.findOne({
      spaceId: targetSpaceId,
      normalizedName,
    });

    if (!canonicalTitle) {
      canonicalTitle = new ExpenseTitle({
        userId: req.user._id,
        spaceId: targetSpaceId,
        normalizedName,
        displayName: formatDisplayName(titleStr),
      });
      await canonicalTitle.save();
    }

    const transaction = new Transaction({
      userId: req.user._id,
      spaceId: targetSpaceId,
      type: txType,
      amount,
      titleId: canonicalTitle._id,
      importance: txType === 'expense' ? (importance || 'moderate') : undefined,
      date: resolvedDate,
      note: note || '',
    });

    await transaction.save();

    if (eventRecord) {
      eventRecord.status = 'LINKED';
      eventRecord.linkedTransactionId = transaction._id;
      await eventRecord.save();
    }

    if (attemptRecord) {
      attemptRecord.status = 'SUCCESS';
      attemptRecord.linkedTransactionId = transaction._id;
      await attemptRecord.save();
    }

    return res.status(200).json({ success: true, transaction });
  } catch (error) {
    console.error('Error converting inbox item:', error);
    return res.status(500).json({ message: 'Failed to convert item', error: error.message });
  }
});

/**
 * @route   POST /api/inbox/dismiss
 * @desc    Dismiss an event or attempt without creating a transaction
 */
router.post('/dismiss', protect, async (req, res) => {
  try {
    const { id, source } = req.body;

    if (source === 'notification') {
      await NotificationEvent.findOneAndUpdate(
        { _id: id, userId: req.user._id },
        { status: 'DISMISSED' }
      );
    } else if (source === 'payment_attempt') {
      await PaymentAttempt.findOneAndUpdate(
        { paymentAttemptId: id, userId: req.user._id },
        { status: 'FAILED' }
      );
    }

    return res.status(200).json({ success: true, message: 'Item dismissed' });
  } catch (error) {
    console.error('Error dismissing inbox item:', error);
    return res.status(500).json({ message: 'Failed to dismiss item', error: error.message });
  }
});

module.exports = router;
