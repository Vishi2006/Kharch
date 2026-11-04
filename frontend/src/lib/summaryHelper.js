import mongoose from 'mongoose';
import MonthlySummary from '@/models/MonthlySummary';
import Transaction from '@/models/Transaction';

export const getMonthDateRange = (monthStr) => {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  return { start, end };
};

export const recalculateSummary = async (userId, spaceId, monthStr) => {
  const spaceObjectId = new mongoose.Types.ObjectId(spaceId);
  const dateRange = getMonthDateRange(monthStr);

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

  const totals = await Transaction.aggregate([
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

  summary.earned = earned;
  summary.expenses = expenses;
  summary.investments = investments;
  summary.savings = savings;

  summary.expectedClosingBalance = summary.openingBalance + earned - expenses - investments - savings;
  summary.reconciliationAdjustment = summary.actualClosingBalance - summary.expectedClosingBalance;

  await summary.save();
  return summary;
};
