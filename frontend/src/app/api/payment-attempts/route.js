import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import PaymentAttempt from '@/models/PaymentAttempt';
import NotificationEvent from '@/models/NotificationEvent';
import { processNotificationEvent } from '@/lib/matchingEngine';

export const dynamic = 'force-dynamic';

async function tryMatchOpenEvents(userId, amount) {
  try {
    const candidateEvents = await NotificationEvent.find({
      userId,
      status: 'UNMATCHED',
      amount,
    });
    for (const event of candidateEvents) {
      await processNotificationEvent(event);
    }
  } catch (err) {
    console.error('Error running matching on payment attempt:', err);
  }
}

export async function GET(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  await connectDB();

  try {
    const attempts = await PaymentAttempt.find({
      userId: auth.user._id,
      status: { $in: ['PENDING', 'UNKNOWN', 'SUBMITTED'] },
    }).sort({ initiatedAt: -1 });

    return NextResponse.json(attempts);
  } catch (error) {
    console.error('Error fetching payment attempts:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  await connectDB();

  try {
    const { paymentAttemptId, type, amount, payeeVpa, payeeName, initiatedAt, status, linkedTransactionId } = await request.json();

    if (!paymentAttemptId || !amount) {
      return NextResponse.json({ message: 'paymentAttemptId and amount are required' }, { status: 400 });
    }

    const attempt = await PaymentAttempt.findOneAndUpdate(
      { paymentAttemptId },
      {
        userId: auth.user._id,
        type: type || 'expense',
        amount,
        payeeVpa,
        payeeName,
        initiatedAt: initiatedAt ? new Date(initiatedAt) : new Date(),
        status: status || 'PENDING',
        linkedTransactionId,
      },
      { new: true, upsert: true }
    );

    if (!linkedTransactionId) {
      await tryMatchOpenEvents(auth.user._id, amount);
    }

    return NextResponse.json(attempt);
  } catch (error) {
    console.error('Error saving payment attempt:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
