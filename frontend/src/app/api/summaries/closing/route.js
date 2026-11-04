import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import MonthlySummary from '@/models/MonthlySummary';
import { recalculateSummary } from '@/lib/summaryHelper';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  await connectDB();

  try {
    const { spaceId, month, amount, isLocked } = await request.json();

    if (!spaceId || !month || amount === undefined) {
      return NextResponse.json({ message: 'spaceId, month, and amount are required' }, { status: 400 });
    }

    let summary = await MonthlySummary.findOne({ spaceId, month, userId: auth.user._id });

    if (summary && summary.isLocked) {
      return NextResponse.json({ message: 'This month is locked and cannot be updated' }, { status: 400 });
    }

    if (!summary) {
      summary = new MonthlySummary({
        userId: auth.user._id,
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

    const updatedSummary = await recalculateSummary(auth.user._id, spaceId, month);
    return NextResponse.json(updatedSummary);
  } catch (error) {
    console.error('Error setting actual closing balance:', error);
    return NextResponse.json({ message: 'Server error setting closing balance' }, { status: 500 });
  }
}
