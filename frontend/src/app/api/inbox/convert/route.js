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
    const { id, source, spaceId, title, importance, type, note, date } = await request.json();

    if (!id || !source) {
      return NextResponse.json({ message: 'id and source are required' }, { status: 400 });
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

    let amount = 0;
    let resolvedDate = date ? new Date(date) : new Date();
    let defaultTitle = 'Payment';
    let txType = type || 'expense';

    let eventRecord = null;
    let attemptRecord = null;

    if (source === 'notification') {
      eventRecord = await NotificationEvent.findOne({ _id: id, userId: auth.user._id });
      if (!eventRecord) return NextResponse.json({ message: 'Notification event not found' }, { status: 404 });
      amount = eventRecord.amount;
      resolvedDate = eventRecord.timestamp;
      defaultTitle = eventRecord.counterparty || 'UPI Transaction';
      txType = eventRecord.type === 'CREDIT' ? 'income' : 'expense';
    } else if (source === 'payment_attempt') {
      attemptRecord = await PaymentAttempt.findOne({ paymentAttemptId: id, userId: auth.user._id });
      if (!attemptRecord) return NextResponse.json({ message: 'Payment attempt not found' }, { status: 404 });
      amount = attemptRecord.amount;
      resolvedDate = attemptRecord.initiatedAt;
      defaultTitle = attemptRecord.payeeName || 'UPI Payment';
      txType = attemptRecord.type || 'expense';
    }

    const titleStr = title || defaultTitle;
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

    const transaction = new Transaction({
      userId: auth.user._id,
      spaceId: targetSpaceId,
      type: txType,
      amount,
      titleId: canonicalTitle._id,
      importance: txType === 'expense' ? (importance || 'moderate') : undefined,
      date: resolvedDate,
      note: note || '',
    });

    await transaction.save();

    if (eventRecord) {
      eventRecord.status = 'LINKED';
      eventRecord.linkedTransactionId = transaction._id;
      await eventRecord.save();
    }

    if (attemptRecord) {
      attemptRecord.status = 'SUCCESS';
      attemptRecord.linkedTransactionId = transaction._id;
      await attemptRecord.save();
    }

    // Phase 3: Auto-learn MerchantMapping
    const keysToUpsert = [];
    if (eventRecord?.counterparty) keysToUpsert.push(eventRecord.counterparty.toLowerCase().trim());
    if (attemptRecord?.payeeVpa) keysToUpsert.push(attemptRecord.payeeVpa.toLowerCase().trim());
    if (attemptRecord?.payeeName) keysToUpsert.push(attemptRecord.payeeName.toLowerCase().trim());

    for (const key of keysToUpsert.filter(Boolean)) {
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
    console.error('Error converting inbox item:', error);
    return NextResponse.json({ message: 'Failed to convert item', error: error.message }, { status: 500 });
  }
}
