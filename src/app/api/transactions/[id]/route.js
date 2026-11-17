import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import Transaction from '@/models/Transaction';
import ExpenseTitle from '@/models/ExpenseTitle';

export const dynamic = 'force-dynamic';

// Helper to normalize title case
const formatDisplayName = (name) => {
  return name
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export async function PUT(request, { params }) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  const { id } = await params;
  const body = await request.json();
  const { amount, type, title, titleId, importance, date, note } = body;

  try {
    await connectDB();
    let transaction = await Transaction.findOne({ _id: id, userId: auth.user._id });
    if (!transaction) {
      return NextResponse.json({ message: 'Transaction not found' }, { status: 404 });
    }

    if (type) {
      transaction.type = type;
    }
    if (amount !== undefined) {
      transaction.amount = parseFloat(amount);
    }
    if (note !== undefined) {
      transaction.note = note;
    }
    if (date) {
      transaction.date = new Date(date);
    }

    // Resolve title / titleId changes
    if (titleId) {
      const canonicalTitle = await ExpenseTitle.findOne({ _id: titleId, spaceId: transaction.spaceId });
      if (!canonicalTitle) {
        return NextResponse.json({ message: 'Title not found in this space' }, { status: 400 });
      }
      transaction.titleId = canonicalTitle._id;
    } else if (title && title.trim()) {
      const rawTitle = title.trim();
      const normalizedName = rawTitle.toLowerCase();

      let canonicalTitle = await ExpenseTitle.findOne({ spaceId: transaction.spaceId, normalizedName });
      if (!canonicalTitle) {
        canonicalTitle = new ExpenseTitle({
          userId: auth.user._id,
          spaceId: transaction.spaceId,
          normalizedName,
          displayName: formatDisplayName(rawTitle),
        });
        await canonicalTitle.save();
      }
      transaction.titleId = canonicalTitle._id;
    }

    // Conditional logic for importance
    if (transaction.type === 'expense') {
      if (importance) {
        transaction.importance = importance;
      }
    } else {
      transaction.importance = undefined;
    }

    await transaction.save();
    await transaction.populate('titleId');

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Error updating transaction:', error.message);
    return NextResponse.json({ message: 'Server error updating transaction' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  const { id } = await params;

  try {
    await connectDB();
    const transaction = await Transaction.findOneAndDelete({ _id: id, userId: auth.user._id });
    if (!transaction) {
      return NextResponse.json({ message: 'Transaction not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error.message);
    return NextResponse.json({ message: 'Server error deleting transaction' }, { status: 500 });
  }
}
