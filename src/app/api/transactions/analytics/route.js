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
  const timezone = searchParams.get('timezone') || 'UTC';

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
    let startDate = new Date();

    if (period === 'day') {
      startDate.setDate(now.getDate() - 60);
    } else if (period === 'week') {
      startDate.setDate(now.getDate() - 180);
    } else if (period === 'month') {
      startDate.setMonth(now.getMonth() - 24);
    } else if (period === 'year') {
      startDate.setFullYear(now.getFullYear() - 10);
    } else {
      startDate.setMonth(now.getMonth() - 24);
    }

    let groupFormat = '%Y-%m-%d';
    if (period === 'week') groupFormat = '%Y-W%V';
    if (period === 'month') groupFormat = '%Y-%m';
    if (period === 'year') groupFormat = '%Y';

    // 1. Trends aggregation
    const trends = await Transaction.aggregate([
      {
        $match: {
          spaceId: spaceMatch,
          $or: [
            { date: { $gte: startDate } },
            { date: { $gte: startDate.toISOString() } },
          ],
        },
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
                    onNull: new Date(),
                  },
                },
                timezone: timezone || 'UTC',
              },
            },
            type: '$type',
          },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.period': 1 } },
    ]);

    const trendMap = {};
    trends.forEach((item) => {
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

    // 2. Importance Distribution for expenses
    const importanceAgg = await Transaction.aggregate([
      {
        $match: {
          spaceId: spaceMatch,
          type: 'expense',
          $or: [
            { date: { $gte: startDate } },
            { date: { $gte: startDate.toISOString() } },
          ],
        },
      },
      {
        $group: {
          _id: '$importance',
          value: { $sum: '$amount' },
        },
      },
    ]);

    const importanceData = [
      { name: 'Essential', value: 0, key: 'essential' },
      { name: 'Moderate', value: 0, key: 'moderate' },
      { name: 'Low Value', value: 0, key: 'low_value' },
    ];

    importanceAgg.forEach((item) => {
      const target = importanceData.find((i) => i.key === item._id);
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
            { date: { $gte: startDate.toISOString() } },
          ],
        },
      },
      {
        $group: {
          _id: '$titleId',
          total: { $sum: '$amount' },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 20 },
    ]);

    const topTitleIds = topTitlesAgg
      .map((t) => t._id)
      .filter(Boolean)
      .map((id) => (mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id));

    let topTitles = await ExpenseTitle.find({ _id: { $in: topTitleIds } });
    const topSpendingTitles = topTitlesAgg.map((item) => {
      const match = topTitles.find((t) => t._id.toString() === item._id?.toString());
      return {
        name: match ? match.displayName : 'Other Expense',
        amount: item.total,
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
            { date: { $gte: startDate.toISOString() } },
          ],
        },
      },
      {
        $group: {
          _id: '$titleId',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 20 },
    ]);

    const wastefulTitleIds = wastefulAgg
      .map((w) => w._id)
      .filter(Boolean)
      .map((id) => (mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id));

    let wastefulTitles = await ExpenseTitle.find({ _id: { $in: wastefulTitleIds } });
    const repeatedWasteful = wastefulAgg.map((item) => {
      const match = wastefulTitles.find((t) => t._id.toString() === item._id?.toString());
      return {
        name: match ? match.displayName : 'Unspecified Low-Value',
        amount: item.total,
        count: item.count,
      };
    });

    return NextResponse.json({
      trends: trendData,
      importance: importanceData.filter((i) => i.value > 0),
      topSpendingTitles,
      repeatedWasteful,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error.message);
    return NextResponse.json(
      { message: 'Server error compiling analytics charts', error: error.message },
      { status: 500 }
    );
  }
}
