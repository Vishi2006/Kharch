import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
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
    const body = await request.json();
    const id = body.id || body.itemId;

    if (!id) {
      return NextResponse.json({ message: 'id is required' }, { status: 400 });
    }

    const objectIdCheck = mongoose.Types.ObjectId.isValid(id)
      ? [{ _id: new mongoose.Types.ObjectId(id) }]
      : [];

    await NotificationEvent.updateMany(
      {
        $or: [
          ...objectIdCheck,
          { notificationId: id },
        ],
        userId: auth.user._id,
      },
      { status: 'DISMISSED' }
    );

    await PaymentAttempt.updateMany(
      {
        $or: [
          { paymentAttemptId: id },
          ...objectIdCheck,
        ],
        userId: auth.user._id,
      },
      { status: 'FAILED' }
    );

    return NextResponse.json({ success: true, message: 'Item dismissed' });
  } catch (error) {
    console.error('Error dismissing inbox item:', error);
    return NextResponse.json({ message: 'Failed to dismiss item', error: error.message }, { status: 500 });
  }
}
