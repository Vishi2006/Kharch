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

export async function PUT(request, { params }) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  await connectDB();

  try {
    const { id } = await params;
    const { status, linkedTransactionId } = await request.json();

    const attempt = await PaymentAttempt.findOneAndUpdate(
      { paymentAttemptId: id, userId: auth.user._id },
      { status, linkedTransactionId },
      { new: true }
    );

    if (!attempt) {
      return NextResponse.json({ message: 'Payment attempt not found' }, { status: 404 });
    }

    if (!linkedTransactionId && attempt.status === 'UNKNOWN') {
      await tryMatchOpenEvents(auth.user._id, attempt.amount);
    }

    return NextResponse.json(attempt);
  } catch (error) {
    console.error('Error updating payment attempt:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
