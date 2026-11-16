const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Space = require('../models/Space');
const Transaction = require('../models/Transaction');
const ExpenseTitle = require('../models/ExpenseTitle');
const MonthlySummary = require('../models/MonthlySummary');
const { protect } = require('../middleware/auth');

// Helper to snapshot totals for months before cleaning up raw transactions
const lockAndSnapshotMonths = async (userId, spaceId, query) => {
  // Find distinct months in the transactions matching query
  const txs = await Transaction.find(query);
  const monthsToSnapshot = new Set();
  txs.forEach(t => {
    monthsToSnapshot.add(t.date.toISOString().slice(0, 7)); // "YYYY-MM"
  });

  const mongoose = require('mongoose');
  const spaceObjectId = new mongoose.Types.ObjectId(spaceId);

  for (const monthStr of monthsToSnapshot) {
    const [year, month] = monthStr.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));

    // Aggregate values
    const totals = await Transaction.aggregate([
      {
        $match: {
          spaceId: spaceObjectId,
          date: { $gte: start, $lt: end }
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' }
        }
      }
    ]);

    let earned = 0;
    let expenses = 0;
    let investments = 0;
    let savings = 0;

    totals.forEach(item => {
      if (item._id === 'income') earned = item.total;
      if (item._id === 'expense') expenses = item.total;
      if (item._id === 'investment') investments = item.total;
      if (item._id === 'savings') savings = item.total;
    });

    let summary = await MonthlySummary.findOne({ userId, spaceId, month: monthStr });
    if (!summary) {
      summary = new MonthlySummary({
        userId,
        spaceId,
        month: monthStr,
        openingBalance: 0,
        actualClosingBalance: 0,
      });
    }

    summary.earned = earned;
    summary.expenses = expenses;
    summary.investments = investments;
    summary.savings = savings;
    summary.expectedClosingBalance = summary.openingBalance + earned - expenses - investments - savings;
    summary.reconciliationAdjustment = summary.actualClosingBalance - summary.expectedClosingBalance;
    summary.isLocked = true; // Lock it permanently

    await summary.save();
  }
};

// @route   POST /api/settings/cleanup
// @desc    Selective cleanup of transaction history
// @access  Private
router.post('/cleanup', protect, async (req, res) => {
  const { spaceId, range, startDate, endDate } = req.body;

  if (!spaceId || !range) {
    return res.status(400).json({ message: 'spaceId and range are required' });
  }

  try {
    const space = await Space.findOne({ _id: spaceId, userId: req.user._id });
    if (!space) {
      return res.status(404).json({ message: 'Space not found' });
    }

    const query = { spaceId, userId: req.user._id };
    const now = new Date();

    if (range === '6months') {
      const cutDate = new Date();
      cutDate.setMonth(now.getMonth() - 6);
      query.date = { $lt: cutDate };
    } else if (range === '1year') {
      const cutDate = new Date();
      cutDate.setFullYear(now.getFullYear() - 1);
      query.date = { $lt: cutDate };
    } else if (range === 'custom') {
      if (!startDate || !endDate) {
        return res.status(400).json({ message: 'startDate and endDate are required for custom range' });
      }
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (range === 'all') {
      // Do nothing extra, matches all txs in space
    } else {
      return res.status(400).json({ message: 'Invalid range option' });
    }

    // 1. Snapshot month aggregates into monthly_summaries and lock them
    await lockAndSnapshotMonths(req.user._id, spaceId, query);

    // 2. Delete raw transactions
    const deleteResult = await Transaction.deleteMany(query);

    res.json({ 
      message: `Cleaned up ${deleteResult.deletedCount} raw transaction records. High-level summaries were locked and preserved.`,
      deletedCount: deleteResult.deletedCount
    });
  } catch (error) {
    console.error('Error during data cleanup:', error.message);
    res.status(500).json({ message: 'Server error during data cleanup' });
  }
});

// @route   DELETE /api/settings/delete-account
// @desc    Completely wipe user account and all space history
// @access  Private
router.delete('/delete-account', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Cascade delete everything
    await Transaction.deleteMany({ userId });
    await ExpenseTitle.deleteMany({ userId });
    await MonthlySummary.deleteMany({ userId });
    await Space.deleteMany({ userId });
    await User.findByIdAndDelete(userId);

    // 2. Clear Cookie
    res.clearCookie('token');
    res.json({ message: 'Your account and all associated financial data have been permanently deleted.' });
  } catch (error) {
    console.error('Error deleting account:', error.message);
    res.status(500).json({ message: 'Server error deleting account' });
  }
});

module.exports = router;
