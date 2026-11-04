import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import Space from '@/models/Space';
import Transaction from '@/models/Transaction';
import MonthlySummary from '@/models/MonthlySummary';

export const dynamic = 'force-dynamic';

const lockAndSnapshotMonths = async (userId, spaceId, query) => {
  const txs = await Transaction.find(query);
  const monthsToSnapshot = new Set();
  txs.forEach((t) => {
    monthsToSnapshot.add(t.date.toISOString().slice(0, 7)); // "YYYY-MM"
  });

  const spaceObjectId = new mongoose.Types.ObjectId(spaceId);

  for (const monthStr of monthsToSnapshot) {
    const [year, month] = monthStr.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));

    const totals = await Transaction.aggregate([
      {
        $match: {
          spaceId: spaceObjectId,
          date: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
        },
      },
    ]);

    let earned = 0;
    let expenses = 0;
    let investments = 0;
    let savings = 0;

    totals.forEach((item) => {
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
    summary.isLocked = true;

    await summary.save();
  }
};

export async function POST(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  await connectDB();

  try {
    const { spaceId, range, startDate, endDate } = await request.json();

    if (!spaceId || !range) {
      return NextResponse.json({ message: 'spaceId and range are required' }, { status: 400 });
    }

    const space = await Space.findOne({ _id: spaceId, userId: auth.user._id });
    if (!space) {
      return NextResponse.json({ message: 'Space not found' }, { status: 404 });
    }

    const query = { spaceId, userId: auth.user._id };
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
        return NextResponse.json({ message: 'startDate and endDate are required for custom range' }, { status: 400 });
      }
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else {
      return NextResponse.json({ message: 'Invalid range option' }, { status: 400 });
    }

    await lockAndSnapshotMonths(auth.user._id, spaceId, query);
    const deleteResult = await Transaction.deleteMany(query);

    return NextResponse.json({
      message: `Successfully cleaned up ${deleteResult.deletedCount} transaction records while locking and preserving monthly summaries.`,
      deletedCount: deleteResult.deletedCount,
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    return NextResponse.json({ message: 'Server error during cleanup' }, { status: 500 });
  }
}
