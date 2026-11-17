import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import Transaction from '@/models/Transaction';
import MonthlySummary from '@/models/MonthlySummary';

export const dynamic = 'force-dynamic';

// Helper to get start/end dates of a month
const getMonthDateRange = (monthStr) => {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  return { start, end };
};

export async function GET(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  const { searchParams } = new URL(request.url);
  const spaceId = searchParams.get('spaceId');
  const timezone = searchParams.get('timezone') || 'UTC';

  if (!spaceId) {
    return NextResponse.json({ message: 'spaceId is required' }, { status: 400 });
  }

  try {
    await connectDB();
    const spaceObjectId = new mongoose.Types.ObjectId(spaceId);

    // 1. Get current month in user's timezone
    const now = new Date();
    let localYearMonth = now.toISOString().slice(0, 7);

    if (timezone) {
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
        });
        const parts = formatter.formatToParts(now);
        const m = parts.find(p => p.type === 'month').value;
        const y = parts.find(p => p.type === 'year').value;
        localYearMonth = `${y}-${m}`;
      } catch (err) {
        console.error('Timezone parsing error, falling back to UTC:', err.message);
      }
    }

    // 2. Fetch or create monthly summary
    let summary = await MonthlySummary.findOne({ spaceId, month: localYearMonth });
    if (!summary) {
      summary = new MonthlySummary({
        userId: auth.user._id,
        spaceId,
        month: localYearMonth,
        openingBalance: 0,
        actualClosingBalance: 0,
        expectedClosingBalance: 0,
        reconciliationAdjustment: 0,
      });
      await summary.save();
    }

    // 3. Aggregate transaction totals for the active month
    const dateRange = getMonthDateRange(localYearMonth);
    const monthTxTotals = await Transaction.aggregate([
      {
        $match: {
          spaceId: spaceObjectId,
          date: { $gte: dateRange.start, $lt: dateRange.end },
        },
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
        },
      },
    ]);

    const monthStats = { income: 0, expense: 0, investment: 0, savings: 0 };
    monthTxTotals.forEach(item => {
      monthStats[item._id] = item.total;
    });

    const expectedClosing =
      summary.openingBalance +
      monthStats.income -
      monthStats.expense -
      monthStats.investment -
      monthStats.savings;
    const currentBalance = expectedClosing;

    // 4. Calculate today's spending (respecting user timezone)
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone });

    const todayExpenses = await Transaction.aggregate([
      {
        $match: {
          spaceId: spaceObjectId,
          type: 'expense',
        },
      },
      {
        $project: {
          amount: 1,
          importance: 1,
          titleId: 1,
          dateStr: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$date',
              timezone: timezone,
            },
          },
        },
      },
      {
        $match: {
          dateStr: todayStr,
        },
      },
    ]);

    let todayTotalSpent = 0;
    const todayImportanceBreakdown = { essential: 0, moderate: 0, low_value: 0 };

    const populatedTodayExpenses = await Transaction.populate(todayExpenses, { path: 'titleId' });

    populatedTodayExpenses.forEach(tx => {
      todayTotalSpent += tx.amount;
      if (todayImportanceBreakdown[tx.importance] !== undefined) {
        todayImportanceBreakdown[tx.importance] += tx.amount;
      }
    });

    // 5. Get recent transactions (limit 5)
    const recentTransactions = await Transaction.find({ spaceId })
      .populate('titleId')
      .sort({ date: -1 })
      .limit(5);

    // 6. Generate dynamic financial insight for today
    let insight = '';
    if (todayTotalSpent > 0) {
      const essentialPct = todayTotalSpent
        ? Math.round((todayImportanceBreakdown.essential / todayTotalSpent) * 100)
        : 0;
      const lowValuePct = todayTotalSpent
        ? Math.round((todayImportanceBreakdown.low_value / todayTotalSpent) * 100)
        : 0;

      const lowValueItems = populatedTodayExpenses.filter(tx => tx.importance === 'low_value');
      let lowestValueSpendText = '';
      if (lowValueItems.length > 0) {
        const lowestItem = lowValueItems.reduce((prev, current) =>
          prev.amount < current.amount ? prev : current
        );
        lowestValueSpendText = ` Your ₹${lowestItem.amount} ${lowestItem.titleId?.displayName || 'spend'} was your lowest-value spend today.`;
      }

      insight = `Today you spent ₹${todayTotalSpent}. ${essentialPct}% was essential, ${todayImportanceBreakdown.moderate ? 'some moderate,' : ''} and ${lowValuePct}% low-value.${lowestValueSpendText}`;
    } else {
      insight = 'You have not recorded any expenses today. Keep up the good work!';
    }

    return NextResponse.json({
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
      insight,
    });
  } catch (error) {
    console.error('Error compiling dashboard data:', error.message);
    return NextResponse.json({ message: 'Server error compiling dashboard data' }, { status: 500 });
  }
}
