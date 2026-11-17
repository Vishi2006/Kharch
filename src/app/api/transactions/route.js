import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import Transaction from '@/models/Transaction';
import ExpenseTitle from '@/models/ExpenseTitle';
import Space from '@/models/Space';

export const dynamic = 'force-dynamic';

// Helper to normalize title case
const formatDisplayName = (name) => {
  return name
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export async function GET(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  const { searchParams } = new URL(request.url);
  const spaceId = searchParams.get('spaceId');
  const type = searchParams.get('type');
  const importance = searchParams.get('importance');
  const search = searchParams.get('search');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const limit = parseInt(searchParams.get('limit') || '20');
  const skip = parseInt(searchParams.get('skip') || '0');

  if (!spaceId) {
    return NextResponse.json({ message: 'spaceId is required' }, { status: 400 });
  }

  try {
    await connectDB();
    const query = { spaceId, userId: auth.user._id };

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

    if (search && search.trim()) {
      const titles = await ExpenseTitle.find({
        spaceId,
        normalizedName: { $regex: search.trim().toLowerCase(), $options: 'i' },
      });
      const titleIds = titles.map(t => t._id);
      query.titleId = { $in: titleIds };
    }

    const transactions = await Transaction.find(query)
      .populate('titleId')
      .sort({ date: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Transaction.countDocuments(query);

    return NextResponse.json({ transactions, total });
  } catch (error) {
    console.error('Error fetching transactions:', error.message);
    return NextResponse.json({ message: 'Server error fetching transactions' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  const body = await request.json();
  const { spaceId, type, amount, title, titleId, importance, date, note } = body;

  if (!spaceId || !type || !amount) {
    return NextResponse.json({ message: 'spaceId, type, and amount are required' }, { status: 400 });
  }

  if (!['income', 'expense', 'investment', 'savings'].includes(type)) {
    return NextResponse.json({ message: 'Invalid transaction type' }, { status: 400 });
  }

  if (type === 'expense' && !['essential', 'moderate', 'low_value'].includes(importance)) {
    return NextResponse.json(
      { message: 'Importance enum (essential | moderate | low_value) required for expenses' },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    // 1. Verify space belongs to user
    const space = await Space.findOne({ _id: spaceId, userId: auth.user._id });
    if (!space) {
      return NextResponse.json({ message: 'Space not found' }, { status: 404 });
    }

    // 2. Resolve titleId
    let finalTitleId;
    if (titleId) {
      const canonicalTitle = await ExpenseTitle.findOne({ _id: titleId, spaceId });
      if (!canonicalTitle) {
        return NextResponse.json({ message: 'Canonical title not found in this space' }, { status: 400 });
      }
      finalTitleId = canonicalTitle._id;
    } else if (title && title.trim()) {
      const rawTitle = title.trim();
      const normalizedName = rawTitle.toLowerCase();

      let canonicalTitle = await ExpenseTitle.findOne({ spaceId, normalizedName });
      if (!canonicalTitle) {
        canonicalTitle = new ExpenseTitle({
          userId: auth.user._id,
          spaceId,
          normalizedName,
          displayName: formatDisplayName(rawTitle),
        });
        await canonicalTitle.save();
      }
      finalTitleId = canonicalTitle._id;
    } else {
      return NextResponse.json({ message: 'title or titleId must be provided' }, { status: 400 });
    }

    // 3. Setup transaction date
    const txnDate = date ? new Date(date) : new Date();

    // 4. Create and save transaction
    const transaction = new Transaction({
      userId: auth.user._id,
      spaceId,
      type,
      amount: parseFloat(amount),
      titleId: finalTitleId,
      importance: type === 'expense' ? importance : undefined,
      date: txnDate,
      note: note || '',
    });

    await transaction.save();
    await transaction.populate('titleId');

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error('Error creating transaction:', error.message);
    return NextResponse.json({ message: 'Server error creating transaction' }, { status: 500 });
  }
}
