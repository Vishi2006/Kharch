import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import NotificationEvent from '@/models/NotificationEvent';
import PaymentAttempt from '@/models/PaymentAttempt';
import Transaction from '@/models/Transaction';
import ExpenseTitle from '@/models/ExpenseTitle';
import Space from '@/models/Space';
import MerchantMapping from '@/models/MerchantMapping';

export const dynamic = 'force-dynamic';

function formatDisplayName(str) {
  return str
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export async function POST(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  await connectDB();

  try {
    const { notificationEventId, paymentAttemptId, spaceId, importance, note, title } = await request.json();

    const event = await NotificationEvent.findOne({
      _id: notificationEventId,
      userId: auth.user._id,
    });

    const attempt = await PaymentAttempt.findOne({
      paymentAttemptId,
      userId: auth.user._id,
    });

    if (!event || !attempt) {
      return NextResponse.json({ message: 'Matching records not found' }, { status: 404 });
    }

    let targetSpaceId = spaceId;
    if (!targetSpaceId) {
      const defaultSpace =
        (await Space.findOne({ userId: auth.user._id, isDefault: true })) ||
        (await Space.findOne({ userId: auth.user._id }));
      targetSpaceId = defaultSpace?._id;
    }

    if (!targetSpaceId) {
      return NextResponse.json({ message: 'No valid Space found for this user' }, { status: 400 });
    }

    const titleStr = title || event.counterparty || attempt.payeeName || 'UPI Payment';
    const normalizedName = titleStr.toLowerCase().trim();

    let canonicalTitle = await ExpenseTitle.findOne({
      spaceId: targetSpaceId,
      normalizedName,
    });

    if (!canonicalTitle) {
      canonicalTitle = new ExpenseTitle({
        userId: auth.user._id,
        spaceId: targetSpaceId,
        normalizedName,
        displayName: formatDisplayName(titleStr),
      });
      await canonicalTitle.save();
    }

    const txType = event.type === 'CREDIT' ? 'income' : 'expense';

    const transaction = new Transaction({
      userId: auth.user._id,
      spaceId: targetSpaceId,
      type: txType,
      amount: event.amount || attempt.amount,
      titleId: canonicalTitle._id,
      importance: txType === 'expense' ? (importance || 'moderate') : undefined,
      date: event.timestamp || attempt.initiatedAt || new Date(),
      note: note || `Matched UPI payment (${event.counterparty || attempt.payeeName || ''})`.trim(),
    });

    await transaction.save();

    event.status = 'LINKED';
    event.matchConfidence = 'HIGH';
    event.linkedTransactionId = transaction._id;
    event.linkedPaymentAttemptId = attempt.paymentAttemptId;
    await event.save();

    attempt.status = 'SUCCESS';
    attempt.linkedTransactionId = transaction._id;
    await attempt.save();

    // Phase 3: Auto-learn MerchantMapping
    const vpaKey = (attempt.payeeVpa || '').toLowerCase().trim();
    const cpKey = (event.counterparty || '').toLowerCase().trim();
    const keysToUpsert = [vpaKey, cpKey].filter(Boolean);

    for (const key of keysToUpsert) {
      await MerchantMapping.findOneAndUpdate(
        { userId: auth.user._id, identifierKey: key },
        {
          $set: {
            canonicalTitle: titleStr,
            spaceId: targetSpaceId,
            importance: importance || 'moderate',
            lastUsedAt: new Date(),
          },
          $inc: { usageCount: 1 },
          $setOnInsert: { userId: auth.user._id, identifierKey: key },
        },
        { upsert: true, new: true }
      ).catch(() => {});
    }

    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    console.error('Error accepting match:', error);
    return NextResponse.json({ message: 'Failed to accept match', error: error.message }, { status: 500 });
  }
}
