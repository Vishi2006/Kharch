import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import NotificationEvent from '@/models/NotificationEvent';
import PaymentAttempt from '@/models/PaymentAttempt';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  await connectDB();

  try {
    const { id, source } = await request.json();

    if (source === 'notification') {
      await NotificationEvent.findOneAndUpdate(
        { _id: id, userId: auth.user._id },
        { status: 'DISMISSED' }
      );
    } else if (source === 'payment_attempt') {
      await PaymentAttempt.findOneAndUpdate(
        { paymentAttemptId: id, userId: auth.user._id },
        { status: 'FAILED' }
      );
    }

    return NextResponse.json({ success: true, message: 'Item dismissed' });
  } catch (error) {
    console.error('Error dismissing inbox item:', error);
    return NextResponse.json({ message: 'Failed to dismiss item', error: error.message }, { status: 500 });
  }
}
