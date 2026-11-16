const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const ExpenseTitle = require('../models/ExpenseTitle');
const MonthlySummary = require('../models/MonthlySummary');
const Space = require('../models/Space');
const { protect } = require('../middleware/auth');

// Helper to get start/end dates of a month
const getMonthDateRange = (monthStr) => {
  // monthStr is "YYYY-MM"
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0)); // Start of next month
  return { start, end };
};

// Helper to normalize title case
const formatDisplayName = (name) => {
  return name
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// @route   POST /api/transactions
// @desc    Create a transaction (income, expense, investment, savings)
// @access  Private
router.post('/', protect, async (req, res) => {
  const { spaceId, type, amount, title, titleId, importance, date, note } = req.body;

  if (!spaceId || !type || !amount) {
    return res.status(400).json({ message: 'spaceId, type, and amount are required' });
  }

  if (!['income', 'expense', 'investment', 'savings'].includes(type)) {
    return res.status(400).json({ message: 'Invalid transaction type' });
  }

  if (type === 'expense' && !['essential', 'moderate', 'low_value'].includes(importance)) {
    return res.status(400).json({ message: 'Importance enum (essential | moderate | low_value) required for expenses' });
  }

  try {
    const spaceObjectId = mongoose.Types.ObjectId.isValid(spaceId) ? new mongoose.Types.ObjectId(spaceId) : null;
    const spaceMatch = spaceObjectId ? { $in: [spaceObjectId, spaceId.toString()] } : spaceId;

    // 1. Verify space belongs to user
    const space = await Space.findOne({ _id: spaceObjectId || spaceId, userId: req.user._id });
    if (!space) {
      return res.status(404).json({ message: 'Space not found' });
    }

    // 2. Resolve titleId
    let finalTitleId;
    if (titleId) {
      const canonicalTitle = await ExpenseTitle.findOne({ _id: titleId, spaceId: spaceMatch });
      if (!canonicalTitle) {
        return res.status(400).json({ message: 'Canonical title not found in this space' });
      }
      finalTitleId = canonicalTitle._id;
    } else if (title && title.trim()) {
      const rawTitle = title.trim();
      const normalizedName = rawTitle.toLowerCase();
      
      let canonicalTitle = await ExpenseTitle.findOne({ spaceId: spaceMatch, normalizedName });
      if (!canonicalTitle) {
        canonicalTitle = new ExpenseTitle({
          userId: req.user._id,
          spaceId: space._id,
          normalizedName,
          displayName: formatDisplayName(rawTitle)
        });
        await canonicalTitle.save();
      }
      finalTitleId = canonicalTitle._id;
    } else {
      return res.status(400).json({ message: 'title or titleId must be provided' });
    }

    // 3. Setup transaction date
    const txnDate = date ? new Date(date) : new Date();

    // 4. Create and save transaction
    const transaction = new Transaction({
      userId: req.user._id,
      spaceId: space._id,
      type,
      amount: parseFloat(amount),
      titleId: finalTitleId,
      importance: type === 'expense' ? importance : undefined,
      date: txnDate,
      note: note || '',
    });

    await transaction.save();
    
    // Explicitly populate titleId details with ExpenseTitle model
    await transaction.populate({ path: 'titleId', model: ExpenseTitle });

    res.status(201).json(transaction);
  } catch (error) {
    console.error('Error creating transaction:', error.message);
    res.status(500).json({ message: 'Server error creating transaction' });
  }
});

// @route   GET /api/transactions
// @desc    Get transactions in a space with pagination, filter, and search
// @access  Private
router.get('/', protect, async (req, res) => {
  const { spaceId, type, importance, search, startDate, endDate, limit = 20, skip = 0 } = req.query;

  if (!spaceId) {
    return res.status(400).json({ message: 'spaceId is required' });
  }

  try {
    const spaceObjectId = mongoose.Types.ObjectId.isValid(spaceId) ? new mongoose.Types.ObjectId(spaceId) : null;
    const spaceMatch = spaceObjectId ? { $in: [spaceObjectId, spaceId.toString()] } : spaceId;
    const query = { spaceId: spaceMatch, userId: req.user._id };

    if (type) {
      query.type = type;
    }

    if (importance && type === 'expense') {
      query.importance = importance;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Search filter based on ExpenseTitle names
    if (search && search.trim()) {
      const titles = await ExpenseTitle.find({
        spaceId: spaceMatch,
        normalizedName: { $regex: search.trim().toLowerCase(), $options: 'i' }
      });
      const titleIds = titles.map(t => t._id);
      query.titleId = { $in: titleIds };
    }

    const transactions = await Transaction.find(query)
      .populate({ path: 'titleId', model: ExpenseTitle })
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Transaction.countDocuments(query);

    res.json({ transactions, total });
  } catch (error) {
    console.error('Error fetching transactions:', error.message);
    res.status(500).json({ message: 'Server error fetching transactions' });
  }
});

// @route   PUT /api/transactions/:id
// @desc    Update a transaction
// @access  Private
router.put('/:id', protect, async (req, res) => {
  const { amount, title, titleId, importance, date, note, type } = req.body;

  try {
    const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.user._id });
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    const spaceObjectId = mongoose.Types.ObjectId.isValid(transaction.spaceId) ? new mongoose.Types.ObjectId(transaction.spaceId) : null;
    const spaceMatch = spaceObjectId ? { $in: [spaceObjectId, transaction.spaceId.toString()] } : transaction.spaceId;

    if (amount !== undefined) {
      transaction.amount = parseFloat(amount);
    }

    if (type && ['income', 'expense', 'investment', 'savings'].includes(type)) {
      transaction.type = type;
    }

    // Resolve title if updating
    if (titleId) {
      const canonicalTitle = await ExpenseTitle.findOne({ _id: titleId, spaceId: spaceMatch });
      if (!canonicalTitle) {
        return res.status(400).json({ message: 'Canonical title not found' });
      }
      transaction.titleId = canonicalTitle._id;
    } else if (title && title.trim()) {
      const rawTitle = title.trim();
      const normalizedName = rawTitle.toLowerCase();
      
      let canonicalTitle = await ExpenseTitle.findOne({ spaceId: spaceMatch, normalizedName });
      if (!canonicalTitle) {
        canonicalTitle = new ExpenseTitle({
          userId: req.user._id,
          spaceId: transaction.spaceId,
          normalizedName,
          displayName: formatDisplayName(rawTitle)
        });
        await canonicalTitle.save();
      }
      transaction.titleId = canonicalTitle._id;
    }

    if (date) {
      transaction.date = new Date(date);
    }

    if (note !== undefined) {
      transaction.note = note;
    }

    if (transaction.type === 'expense') {
      if (importance) {
        transaction.importance = importance;
      }
    } else {
      transaction.importance = undefined;
    }

    await transaction.save();
    await transaction.populate({ path: 'titleId', model: ExpenseTitle });

    res.json(transaction);
  } catch (error) {
    console.error('Error updating transaction:', error.message);
    res.status(500).json({ message: 'Server error updating transaction' });
  }
});

// @route   DELETE /api/transactions/:id
// @desc    Delete a transaction
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json({ message: 'Transaction removed successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error.message);
    res.status(500).json({ message: 'Server error deleting transaction' });
  }
});

// @route   GET /api/transactions/dashboard
// @desc    Retrieve real-time stats for the mobile home page
// @access  Private
router.get('/dashboard', protect, async (req, res) => {
  const { spaceId, timezone = 'UTC' } = req.query;

  if (!spaceId) {
    return res.status(400).json({ message: 'spaceId is required' });
  }

  try {
    const spaceObjectId = mongoose.Types.ObjectId.isValid(spaceId) ? new mongoose.Types.ObjectId(spaceId) : null;
    const spaceMatch = spaceObjectId ? { $in: [spaceObjectId, spaceId.toString()] } : spaceId;

    // 1. Get current month representation (local time according to user's timezone)
    const now = new Date();
    let localYearMonth = now.toISOString().slice(0, 7); // Default fallback
    
    if (timezone) {
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit'
        });
        const parts = formatter.formatToParts(now);
        const m = parts.find(p => p.type === 'month').value;
        const y = parts.find(p => p.type === 'year').value;
        localYearMonth = `${y}-${m}`;
      } catch (err) {
        console.error('Timezone parsing error, falling back to UTC:', err.message);
      }
    }
    
    // 2. Fetch the monthly summary to extract Opening Balance
    let summary = await MonthlySummary.findOne({ spaceId: spaceMatch, month: localYearMonth });
    if (!summary) {
      // Create a default monthly summary if one doesn't exist yet
      summary = new MonthlySummary({
        userId: req.user._id,
        spaceId: spaceObjectId || spaceId,
        month: localYearMonth,
        openingBalance: 0,
        actualClosingBalance: 0,
        expectedClosingBalance: 0,
        reconciliationAdjustment: 0,
      });
      await summary.save();
    }

    // 3. Aggregate transaction totals for the active month to compute real-time expected balance
    const dateRange = getMonthDateRange(localYearMonth);
    const monthTxTotals = await Transaction.aggregate([
      { 
        $match: { 
          spaceId: spaceMatch,
          $or: [
            { date: { $gte: dateRange.start, $lt: dateRange.end } },
            { date: { $gte: dateRange.start.toISOString(), $lt: dateRange.end.toISOString() } }
          ]
        } 
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' }
        }
      }
    ]);

    const monthStats = {
      income: 0,
      expense: 0,
      investment: 0,
      savings: 0
    };

    monthTxTotals.forEach(item => {
      monthStats[item._id] = item.total;
    });

    const expectedClosing = summary.openingBalance + monthStats.income - monthStats.expense - monthStats.investment - monthStats.savings;
    const currentBalance = expectedClosing; // At active month, opening + net movements is current expected balance

    // 4. Calculate today's spending (respecting user timezone boundary)
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone }); // e.g. "2026-11-16"

    const todayExpenses = await Transaction.aggregate([
      {
        $match: {
          spaceId: spaceMatch,
          type: 'expense'
        }
      },
      {
        $project: {
          amount: 1,
          importance: 1,
          titleId: 1,
          dateStr: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: {
                $convert: {
                  input: '$date',
                  to: 'date',
                  onError: new Date(),
                  onNull: new Date()
                }
              },
              timezone: timezone || 'UTC'
            }
          }
        }
      },
      {
        $match: {
          dateStr: todayStr
        }
      }
    ]);

    let todayTotalSpent = 0;
    const todayImportanceBreakdown = { essential: 0, moderate: 0, low_value: 0 };
    
    // Explicitly resolve today's transactions details with ExpenseTitle model
    const populatedTodayExpenses = await Transaction.populate(todayExpenses, { 
      path: 'titleId', 
      model: ExpenseTitle 
    });

    populatedTodayExpenses.forEach(tx => {
      todayTotalSpent += tx.amount;
      if (todayImportanceBreakdown[tx.importance] !== undefined) {
        todayImportanceBreakdown[tx.importance] += tx.amount;
      }
    });

    // 5. Get recent transactions (limit 10)
    const recentTransactions = await Transaction.find({ spaceId: spaceMatch })
      .populate({ path: 'titleId', model: ExpenseTitle })
      .sort({ date: -1 })
      .limit(10);

    // 6. Generate dynamic financial insight for today
    let insight = '';
    if (todayTotalSpent > 0) {
      const essentialPct = todayTotalSpent ? Math.round((todayImportanceBreakdown.essential / todayTotalSpent) * 100) : 0;
      const lowValuePct = todayTotalSpent ? Math.round((todayImportanceBreakdown.low_value / todayTotalSpent) * 100) : 0;

      // Find lowest value spending item today
      const lowValueItems = populatedTodayExpenses.filter(tx => tx.importance === 'low_value');
      let lowestValueSpendText = '';
      if (lowValueItems.length > 0) {
        const lowestItem = lowValueItems.reduce((prev, current) => (prev.amount < current.amount) ? prev : current);
        lowestValueSpendText = ` Your ₹${lowestItem.amount} ${lowestItem.titleId?.displayName || 'spend'} was your lowest-value spend today.`;
      }

      insight = `Today you spent ₹${todayTotalSpent}. ${essentialPct}% was essential, ${todayImportanceBreakdown.moderate ? 'some moderate,' : ''} and ${lowValuePct}% low-value.${lowestValueSpendText}`;
    } else {
      insight = 'You have not recorded any expenses today. Keep up the good work!';
    }

    res.json({
      month: localYearMonth,
      openingBalance: summary.openingBalance,
      currentBalance,
      monthEarned: monthStats.income,
      monthSpent: monthStats.expense,
      monthInvestments: monthStats.investment,
      monthSavings: monthStats.savings,
      todaySpent: todayTotalSpent,
      todayImportance: todayImportanceBreakdown,
      recentTransactions,
      insight
    });
  } catch (error) {
    console.error('Error compiling dashboard data:', error.message);
    res.status(500).json({ message: 'Server error compiling dashboard data' });
  }
});

// @route   GET /api/transactions/analytics
// @desc    Retrieve statistics for charts
// @access  Private
router.get('/analytics', protect, async (req, res) => {
  const { spaceId, period = 'month', timezone = 'UTC' } = req.query; // period can be: 'day', 'week', 'month', 'year'

  if (!spaceId) {
    return res.status(400).json({ message: 'spaceId is required' });
  }

  try {
    const spaceObjectId = mongoose.Types.ObjectId.isValid(spaceId) ? new mongoose.Types.ObjectId(spaceId) : null;
    const spaceMatch = spaceObjectId ? { $in: [spaceObjectId, spaceId.toString()] } : spaceId;
    
    // Date cutoff helper
    const now = new Date();
    let startDate = new Date();
    
    if (period === 'day') {
      // Show every day of current month or at least 35 days back so earlier-month txns are fully included
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const thirtyFiveDaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
      startDate = thirtyFiveDaysAgo < currentMonthStart ? thirtyFiveDaysAgo : currentMonthStart;
    } else if (period === 'week') {
      // Last 12 weeks
      startDate = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      // Last 12 months
      startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    } else if (period === 'year') {
      // Last 5 years
      startDate = new Date(now.getFullYear() - 4, 0, 1);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1); // fallback
    }

    // 1. Earned vs Spent vs Investment vs Savings trends
    let groupFormat = '%Y-%m-%d';
    if (period === 'week') groupFormat = '%Y-W%V';
    if (period === 'month' || period === 'year') groupFormat = '%Y-%m';

    const trends = await Transaction.aggregate([
      { 
        $match: { 
          spaceId: spaceMatch,
          $or: [
            { date: { $gte: startDate } },
            { date: { $gte: startDate.toISOString() } }
          ]
        } 
      },
      {
        $group: {
          _id: {
            period: {
              $dateToString: {
                format: groupFormat,
                date: {
                  $convert: {
                    input: '$date',
                    to: 'date',
                    onError: new Date(),
                    onNull: new Date()
                  }
                },
                timezone: timezone || 'UTC'
              }
            },
            type: '$type'
          },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.period': 1 } }
    ]);

    // Reshape trends for chart intake
    const trendMap = {};
    trends.forEach(item => {
      const periodLabel = item._id.period;
      const type = item._id.type;
      
      if (!trendMap[periodLabel]) {
        trendMap[periodLabel] = { label: periodLabel, earned: 0, spent: 0, investments: 0, savings: 0 };
      }

      if (type === 'income') trendMap[periodLabel].earned += item.total;
      if (type === 'expense') trendMap[periodLabel].spent += item.total;
      if (type === 'investment') trendMap[periodLabel].investments += item.total;
      if (type === 'savings') trendMap[periodLabel].savings += item.total;
    });

    const trendData = Object.values(trendMap);

    // 2. Importance Distribution (essential vs moderate vs low_val) for expenses
    const importanceAgg = await Transaction.aggregate([
      {
        $match: {
          spaceId: spaceMatch,
          type: 'expense',
          $or: [
            { date: { $gte: startDate } },
            { date: { $gte: startDate.toISOString() } }
          ]
        }
      },
      {
        $group: {
          _id: '$importance',
          value: { $sum: '$amount' }
        }
      }
    ]);

    const importanceData = [
      { name: 'Essential', value: 0, key: 'essential' },
      { name: 'Moderate', value: 0, key: 'moderate' },
      { name: 'Low Value', value: 0, key: 'low_value' }
    ];

    importanceAgg.forEach(item => {
      const target = importanceData.find(i => i.key === item._id);
      if (target) {
        target.value = item.value;
      }
    });

    // 3. Top Spending Titles
    const topTitlesAgg = await Transaction.aggregate([
      {
        $match: {
          spaceId: spaceMatch,
          type: 'expense',
          $or: [
            { date: { $gte: startDate } },
            { date: { $gte: startDate.toISOString() } }
          ]
        }
      },
      {
        $group: {
          _id: '$titleId',
          total: { $sum: '$amount' }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 20 }
    ]);

    // Populate titles display name with explicit model
    const topTitleIds = topTitlesAgg
      .map(t => t._id)
      .filter(Boolean)
      .map(id => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id);

    let topTitles = await ExpenseTitle.find({ _id: { $in: topTitleIds } });
    const topSpendingTitles = topTitlesAgg.map(item => {
      const match = topTitles.find(t => t._id.toString() === item._id?.toString());
      return {
        name: match ? match.displayName : 'Other Expense',
        amount: item.total
      };
    });

    // 4. Repeated Low-Value / Wasteful Spending
    const wastefulAgg = await Transaction.aggregate([
      {
        $match: {
          spaceId: spaceMatch,
          type: 'expense',
          importance: 'low_value',
          $or: [
            { date: { $gte: startDate } },
            { date: { $gte: startDate.toISOString() } }
          ]
        }
      },
      {
        $group: {
          _id: '$titleId',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 20 }
    ]);

    const wastefulTitleIds = wastefulAgg
      .map(w => w._id)
      .filter(Boolean)
      .map(id => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id);

    let wastefulTitles = await ExpenseTitle.find({ _id: { $in: wastefulTitleIds } });
    const repeatedWasteful = wastefulAgg.map(item => {
      const match = wastefulTitles.find(t => t._id.toString() === item._id?.toString());
      return {
        name: match ? match.displayName : 'Unspecified Low-Value',
        amount: item.total,
        count: item.count
      };
    });

    res.json({
      trends: trendData,
      importance: importanceData.filter(i => i.value > 0),
      topSpendingTitles,
      repeatedWasteful
    });
  } catch (error) {
    console.error('Error fetching analytics:', error.message);
    res.status(500).json({ message: 'Server error compiling analytics charts' });
  }
});

module.exports = router;
