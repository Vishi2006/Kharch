import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import Transaction from '@/models/Transaction';
import ExpenseTitle from '@/models/ExpenseTitle';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  const { searchParams } = new URL(request.url);
  const spaceId = searchParams.get('spaceId');
  const period = searchParams.get('period') || 'month';

  if (!spaceId) {
    return NextResponse.json({ message: 'spaceId is required' }, { status: 400 });
  }

  try {
    await connectDB();
    const spaceObjectId = mongoose.Types.ObjectId.isValid(spaceId)
      ? new mongoose.Types.ObjectId(spaceId)
      : spaceId;
    const spaceMatch = mongoose.Types.ObjectId.isValid(spaceId)
      ? { $in: [spaceObjectId, spaceId.toString()] }
      : spaceId;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    let startDate;
    let endDate;

    if (period === 'year') {
      startDate = new Date(currentYear, 0, 1, 0, 0, 0, 0);
      endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);
    } else {
      // 'day', 'week', 'month' strictly scope to the CURRENT MONTH
      startDate = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
      endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    }

    // Fetch transactions for the scoped period
    const transactions = await Transaction.find({
      spaceId: spaceMatch,
      $or: [
        { date: { $gte: startDate, $lte: endDate } },
        { date: { $gte: startDate.toISOString(), $lte: endDate.toISOString() } },
      ],
    }).populate({ path: 'titleId', model: ExpenseTitle }).lean();

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // 1. Build Trends
    let trendData = [];

    if (period === 'week') {
      // Exactly 4 weeks of the current month
      const weekBuckets = {
        'Week 1': { label: 'Week 1', spent: 0, earned: 0, investments: 0, savings: 0 },
        'Week 2': { label: 'Week 2', spent: 0, earned: 0, investments: 0, savings: 0 },
        'Week 3': { label: 'Week 3', spent: 0, earned: 0, investments: 0, savings: 0 },
        'Week 4': { label: 'Week 4', spent: 0, earned: 0, investments: 0, savings: 0 },
      };

      for (const tx of transactions) {
        const d = new Date(tx.date);
        const dayOfMonth = d.getDate();
        let weekKey = 'Week 1';
        if (dayOfMonth <= 7) weekKey = 'Week 1';
        else if (dayOfMonth <= 14) weekKey = 'Week 2';
        else if (dayOfMonth <= 21) weekKey = 'Week 3';
        else weekKey = 'Week 4';

        const amt = tx.amount || 0;
        if (tx.type === 'expense') weekBuckets[weekKey].spent += amt;
        else if (tx.type === 'income') weekBuckets[weekKey].earned += amt;
        else if (tx.type === 'investment') weekBuckets[weekKey].investments += amt;
        else if (tx.type === 'savings') weekBuckets[weekKey].savings += amt;
      }

      trendData = Object.values(weekBuckets);
    } else if (period === 'year') {
      // 12 months of the current year
      const yearBuckets = {};
      for (let m = 0; m < 12; m++) {
        const key = monthNames[m];
        yearBuckets[key] = { label: key, spent: 0, earned: 0, investments: 0, savings: 0 };
      }

      for (const tx of transactions) {
        const d = new Date(tx.date);
        const mKey = monthNames[d.getMonth()];
        if (yearBuckets[mKey]) {
          const amt = tx.amount || 0;
          if (tx.type === 'expense') yearBuckets[mKey].spent += amt;
          else if (tx.type === 'income') yearBuckets[mKey].earned += amt;
          else if (tx.type === 'investment') yearBuckets[mKey].investments += amt;
          else if (tx.type === 'savings') yearBuckets[mKey].savings += amt;
        }
      }

      trendData = Object.values(yearBuckets);
    } else {
      // 'month' or 'day': Daily breakdown of current month
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const dayBuckets = {};
      for (let day = 1; day <= daysInMonth; day++) {
        const label = `${day} ${monthNames[currentMonth]}`;
        dayBuckets[label] = { label, spent: 0, earned: 0, investments: 0, savings: 0 };
      }

      for (const tx of transactions) {
        const d = new Date(tx.date);
        const label = `${d.getDate()} ${monthNames[d.getMonth()]}`;
        if (dayBuckets[label]) {
          const amt = tx.amount || 0;
          if (tx.type === 'expense') dayBuckets[label].spent += amt;
          else if (tx.type === 'income') dayBuckets[label].earned += amt;
          else if (tx.type === 'investment') dayBuckets[label].investments += amt;
          else if (tx.type === 'savings') dayBuckets[label].savings += amt;
        }
      }

      // Filter to days that have activity or up to today
      const todayDay = now.getDate();
      trendData = Object.values(dayBuckets).slice(0, Math.max(todayDay, 7));
    }

    // 2. Importance Distribution (Current Period Only)
    const importanceMap = {
      essential: 0,
      moderate: 0,
      low_value: 0,
    };

    for (const tx of transactions) {
      if (tx.type === 'expense' && tx.importance) {
        const key = tx.importance.toLowerCase();
        if (importanceMap[key] !== undefined) {
          importanceMap[key] += tx.amount || 0;
        }
      }
    }

    const importanceData = [
      { name: 'Essential', value: importanceMap.essential, key: 'essential' },
      { name: 'Moderate', value: importanceMap.moderate, key: 'moderate' },
      { name: 'Low Value', value: importanceMap.low_value, key: 'low_value' },
    ];

    // 3. Top Spending Titles (Current Period Only)
    const titleSpendMap = {};
    for (const tx of transactions) {
      if (tx.type === 'expense') {
        const name = tx.titleId?.displayName || tx.titleId?.normalizedName || 'Other Expense';
        titleSpendMap[name] = (titleSpendMap[name] || 0) + (tx.amount || 0);
      }
    }

    const topSpendingTitles = Object.entries(titleSpendMap)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 15);

    // 4. Repeated Low-Value / Wasteful Spending (Current Period Only)
    const wastefulMap = {};
    for (const tx of transactions) {
      if (tx.type === 'expense' && tx.importance === 'low_value') {
        const name = tx.titleId?.displayName || tx.titleId?.normalizedName || 'Low-Value Expense';
        if (!wastefulMap[name]) {
          wastefulMap[name] = { name, amount: 0, count: 0 };
        }
        wastefulMap[name].amount += tx.amount || 0;
        wastefulMap[name].count += 1;
      }
    }

    const repeatedWasteful = Object.values(wastefulMap)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 15);

    // Day transaction count
    const todayDay = now.getDate();
    const dayTransactions = transactions.filter(tx => {
      const d = new Date(tx.date);
      return d.getDate() === todayDay && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    return NextResponse.json({
      trends: trendData,
      importance: importanceData.filter((i) => i.value > 0),
      topSpendingTitles,
      repeatedWasteful,
      totalTransactions: transactions.length,
      dayTransactionCount: dayTransactions.length,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error.message);
    return NextResponse.json({ message: 'Server error compiling analytics charts', error: error.message }, { status: 500 });
  }
}
