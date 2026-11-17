import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import NotificationEvent from '@/models/NotificationEvent';
import { parseNotification } from '@/lib/parsers/notificationParser';
import { processNotificationEvent } from '@/lib/matchingEngine';

export const dynamic = 'force-dynamic';

/**
 * POST /api/notifications/sync
 * Idempotent batch ingestion of companion notification events
 */
export async function POST(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  await connectDB();

  try {
    const { deviceId, events } = await request.json();

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ message: 'events array is required and must not be empty' }, { status: 400 });
    }

    const operations = events.map((event) => {
      const timestamp = event.timestamp ? new Date(event.timestamp) : new Date();
      const timestampRoundedToMinute = event.timestampRoundedToMinute
        ? new Date(event.timestampRoundedToMinute)
        : new Date(Math.floor(timestamp.getTime() / 60000) * 60000);

      // Server-side parsing fallback/refinement if client couldn't parse or sent rawText
      let parsedType = event.type || 'UNKNOWN';
      let parsedAmount = Number(event.amount) || 0;
      let parsedCounterparty = event.counterparty || '';
      let parsedReferenceId = event.referenceId || null;
      let parseStatus = event.parseStatus || 'parsed';

      if (event.rawText && (parsedAmount <= 0 || parseStatus === 'unparsed')) {
        const serverParsed = parseNotification(event.sourceApp, '', event.rawText, timestamp.getTime());
        if (serverParsed.amount > 0) {
          parsedType = serverParsed.type;
          parsedAmount = serverParsed.amount;
          parsedCounterparty = serverParsed.counterparty || parsedCounterparty;
          parsedReferenceId = serverParsed.referenceId || parsedReferenceId;
          parseStatus = 'parsed';
        }
      }

      return {
        updateOne: {
          filter: { idempotencyKey: event.idempotencyKey },
          update: {
            $setOnInsert: {
              userId: auth.user._id,
              deviceId: deviceId || auth.deviceId || 'default_companion_device',
              idempotencyKey: event.idempotencyKey,
              type: parsedType,
              amount: parsedAmount,
              counterparty: parsedCounterparty,
              referenceId: parsedReferenceId,
              timestamp,
              timestampRoundedToMinute,
              sourceApp: event.sourceApp || 'unknown',
              rawText: event.rawText || '',
              parseStatus,
              status: 'UNMATCHED',
            },
          },
          upsert: true,
        },
      };
    });

    const result = await NotificationEvent.bulkWrite(operations, { ordered: false });

    // Run matching engine on unmatched events
    const idempotencyKeys = events.map((e) => e.idempotencyKey);
    const savedEvents = await NotificationEvent.find({
      idempotencyKey: { $in: idempotencyKeys },
      status: 'UNMATCHED',
    });

    let autoMergedCount = 0;
    for (const savedEvent of savedEvents) {
      try {
        const matchRes = await processNotificationEvent(savedEvent);
        if (matchRes.matched && matchRes.confidence === 'HIGH') {
          autoMergedCount++;
        }
      } catch (err) {
        console.error('Matching engine error on event:', err);
      }
    }

    return NextResponse.json({
      success: true,
      processed: events.length,
      upsertedCount: result.upsertedCount,
      matchedCount: result.matchedCount,
      autoMergedCount,
    });
  } catch (error) {
    console.error('Error syncing notification events:', error);
    return NextResponse.json({ message: 'Sync failed', error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/notifications
 * Fetch notification events for user
 */
export async function GET(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  await connectDB();

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const filter = { userId: auth.user._id };
    if (status) {
      filter.status = status;
    }

    const events = await NotificationEvent.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit);

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error fetching notification events:', error);
    return NextResponse.json({ message: 'Failed to fetch notification events', error: error.message }, { status: 500 });
  }
}
