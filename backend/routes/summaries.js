const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const MonthlySummary = require('../models/MonthlySummary');
const Transaction = require('../models/Transaction');
const Space = require('../models/Space');
const { protect } = require('../middleware/auth');

// Helper to get start/end dates of a month
const getMonthDateRange = (monthStr) => {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  return { start, end };
};

// Helper function to update/recalculate a month's expected closing balance, reconciliation, and sub-totals
const recalculateSummary = async (userId, spaceId, monthStr) => {
  const spaceObjectId = new mongoose.Types.ObjectId(spaceId);
  const dateRange = getMonthDateRange(monthStr);

  // 1. Fetch current MonthlySummary
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

  // 2. Fetch total sum of transactions by type for this month
  const totals = await Transaction.aggregate([
    {
      $match: {
        spaceId: spaceObjectId,
        date: { $gte: dateRange.start, $lt: dateRange.end }
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

  // Preserve these totals inside the summary so they don't disappear if raw logs are purged later
  summary.earned = earned;
  summary.expenses = expenses;
  summary.investments = investments;
  summary.savings = savings;

  // ExpectedClosing = Opening + Earned - Expenses - Investments - Savings
  summary.expectedClosingBalance = summary.openingBalance + earned - expenses - investments - savings;
  
  // Adjustment = Actual - Expected
  summary.reconciliationAdjustment = summary.actualClosingBalance - summary.expectedClosingBalance;

  await summary.save();
  return summary;
};

// @route   GET /api/summaries
// @desc    Get monthly summaries list (e.g. for yearly overview)
// @access  Private
router.get('/', protect, async (req, res) => {
  const { spaceId } = req.query;

  if (!spaceId) {
    return res.status(400).json({ message: 'spaceId is required' });
  }

  try {
    const summaries = await MonthlySummary.find({ spaceId, userId: req.user._id }).sort({ month: -1 });
    res.json(summaries);
  } catch (error) {
    console.error('Error fetching summaries:', error.message);
    res.status(500).json({ message: 'Server error fetching monthly summaries' });
  }
});

// @route   GET /api/summaries/current
// @desc    Get monthly summary for a specific space and month
// @access  Private
router.get('/current', protect, async (req, res) => {
  const { spaceId, month } = req.query;

  if (!spaceId || !month) {
    return res.status(400).json({ message: 'spaceId and month are required' });
  }

  try {
    // Perform update/recalculation to ensure real-time accuracy
    const summary = await recalculateSummary(req.user._id, spaceId, month);
    res.json(summary);
  } catch (error) {
    console.error('Error fetching current month summary:', error.message);
    res.status(500).json({ message: 'Server error fetching monthly summary' });
  }
});

// @route   POST /api/summaries/opening
// @desc    Set or update opening balance for a month
// @access  Private
router.post('/opening', protect, async (req, res) => {
  const { spaceId, month, amount } = req.body;

  if (!spaceId || !month || amount === undefined) {
    return res.status(400).json({ message: 'spaceId, month, and amount are required' });
  }

  try {
    let summary = await MonthlySummary.findOne({ spaceId, month, userId: req.user._id });
    
    if (summary && summary.isLocked) {
      return res.status(400).json({ message: 'This month is locked and cannot be updated' });
    }

    if (!summary) {
      summary = new MonthlySummary({
        userId: req.user._id,
        spaceId,
        month,
        openingBalance: parseFloat(amount),
      });
      await summary.save();
    } else {
      summary.openingBalance = parseFloat(amount);
      await summary.save();
    }

    // Recalculate
    const updatedSummary = await recalculateSummary(req.user._id, spaceId, month);
    res.json(updatedSummary);
  } catch (error) {
    console.error('Error setting opening balance:', error.message);
    res.status(500).json({ message: 'Server error setting opening balance' });
  }
});

// @route   POST /api/summaries/closing
// @desc    Set or update actual closing balance for a month
// @access  Private
router.post('/closing', protect, async (req, res) => {
  const { spaceId, month, amount, isLocked } = req.body;

  if (!spaceId || !month || amount === undefined) {
    return res.status(400).json({ message: 'spaceId, month, and amount are required' });
  }

  try {
    let summary = await MonthlySummary.findOne({ spaceId, month, userId: req.user._id });

    if (summary && summary.isLocked) {
      return res.status(400).json({ message: 'This month is locked and cannot be updated' });
    }

    if (!summary) {
      summary = new MonthlySummary({
        userId: req.user._id,
        spaceId,
        month,
        actualClosingBalance: parseFloat(amount),
      });
      await summary.save();
    } else {
      summary.actualClosingBalance = parseFloat(amount);
      if (isLocked !== undefined) {
        summary.isLocked = isLocked;
      }
      await summary.save();
    }

    // Recalculate
    const updatedSummary = await recalculateSummary(req.user._id, spaceId, month);
    res.json(updatedSummary);
  } catch (error) {
    console.error('Error setting actual closing balance:', error.message);
    res.status(500).json({ message: 'Server error setting closing balance' });
  }
});

module.exports = router;
