import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import NotificationEvent from '@/models/NotificationEvent';
import { parseNotification } from '@/lib/parsers/notificationParser';
import { processNotificationEvent } from '@/lib/matchingEngine';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  await connectDB();

  try {
    const { rawText, sourceApp = 'iOS_Shortcut', timestamp } = await request.json();

    if (!rawText || typeof rawText !== 'string') {
      return NextResponse.json({ message: 'rawText is required' }, { status: 400 });
    }

    const eventTimestamp = timestamp ? Number(timestamp) : Date.now();
    const packageName = sourceApp === 'iOS_Shortcut' ? 'com.apple.sms' : sourceApp;

    // Parse notification through server-side regex parser
    const parsed = parseNotification(packageName, '', rawText, eventTimestamp);

    if (parsed.amount <= 0 && parsed.parseStatus === 'unparsed') {
      return NextResponse.json(
        {
          message: 'Could not detect a UPI/bank transaction in the provided text',
          parseStatus: 'unparsed',
        },
        { status: 422 }
      );
    }

    // Generate stable idempotency key
    const baseKey = parsed.referenceId
      ? `${sourceApp}_${parsed.referenceId}_${parsed.amount}`
      : `${sourceApp}_${Math.floor(eventTimestamp / 10000)}_${rawText.trim().slice(0, 80)}`;

    const idempotencyKey = crypto.createHash('sha256').update(baseKey).digest('hex');
    const timestampRoundedToMinute = new Date(Math.floor(eventTimestamp / 60000) * 60000);

    // Upsert into NotificationEvent
    const result = await NotificationEvent.findOneAndUpdate(
      { idempotencyKey },
      {
        $setOnInsert: {
          userId: auth.user._id,
          deviceId: auth.deviceId || 'ios_shortcut',
          idempotencyKey,
          type: parsed.type,
          amount: parsed.amount,
          counterparty: parsed.counterparty || '',
          referenceId: parsed.referenceId || null,
          timestamp: new Date(eventTimestamp),
          timestampRoundedToMinute,
          sourceApp,
          rawText,
          parseStatus: parsed.parseStatus,
          status: 'UNMATCHED',
        },
      },
      { upsert: true, new: true }
    );

    // Trigger matching engine if unmatched
    if (result.status === 'UNMATCHED') {
      try {
        await processNotificationEvent(result);
      } catch (err) {
        console.warn('Matching engine error on iOS Shortcut event:', err);
      }
    }

    return NextResponse.json({
      success: true,
      parseStatus: parsed.parseStatus,
      amount: parsed.amount,
      type: parsed.type,
      counterparty: parsed.counterparty,
      idempotencyKey,
    });
  } catch (error) {
    console.error('iOS shortcut sync error:', error);
    return NextResponse.json({ message: 'Failed to process', error: error.message }, { status: 500 });
  }
}
