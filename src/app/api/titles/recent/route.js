import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import ExpenseTitle from '@/models/ExpenseTitle';
import Transaction from '@/models/Transaction';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  await connectDB();

  try {
    const { searchParams } = new URL(request.url);
    const spaceId = searchParams.get('spaceId');

    if (!spaceId) {
      return NextResponse.json({ message: 'spaceId query parameter is required' }, { status: 400 });
    }

    const recentTx = await Transaction.aggregate([
      { $match: { spaceId: new mongoose.Types.ObjectId(spaceId) } },
      { $sort: { date: -1 } },
      { $group: { _id: '$titleId', lastUsed: { $first: '$date' } } },
      { $sort: { lastUsed: -1 } },
      { $limit: 30 },
    ]);

    const titleIds = recentTx.map((tx) => tx._id);

    let titles = await ExpenseTitle.find({ _id: { $in: titleIds } });
    titles = titleIds.map((id) => titles.find((t) => t._id.toString() === id.toString())).filter(Boolean);

    if (titles.length < 5) {
      const existingIds = titles.map((t) => t._id);
      const fills = await ExpenseTitle.find({
        spaceId,
        userId: auth.user._id,
        _id: { $nin: existingIds },
      }).limit(5 - titles.length);
      titles = [...titles, ...fills];
    }

    return NextResponse.json(titles);
  } catch (error) {
    console.error('Error fetching recent titles:', error);
    return NextResponse.json({ message: 'Server error fetching recent titles' }, { status: 500 });
  }
}
