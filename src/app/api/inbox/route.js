import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import NotificationEvent from '@/models/NotificationEvent';
import PaymentAttempt from '@/models/PaymentAttempt';
import MerchantMapping from '@/models/MerchantMapping';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  await connectDB();

  try {
    const userId = auth.user._id;

    // 1. Fetch unmatched notification events
    const allUnmatchedEvents = await NotificationEvent.find({
      userId,
      status: 'UNMATCHED',
    }).sort({ timestamp: -1 });

    const mediumMatches = [];
    const unmatchedEvents = [];

    for (const event of allUnmatchedEvents) {
      if (event.matchConfidence === 'MEDIUM' && event.matchedPaymentAttemptId) {
        const attempt = await PaymentAttempt.findOne({
          userId,
          paymentAttemptId: event.matchedPaymentAttemptId,
          linkedTransactionId: { $exists: false },
        });

        if (attempt) {
          mediumMatches.push({
            event,
            suggestedAttempt: attempt,
          });
          continue;
        }
      }

      // Phase 3: Check MerchantMapping to provide instant 1-tap categorization
      let enrichedEvent = event.toObject();
      const cpKey = (event.counterparty || '').toLowerCase().trim();
      if (cpKey) {
        const mapping = await MerchantMapping.findOne({
          userId,
          identifierKey: cpKey,
        });
        if (mapping) {
          enrichedEvent.suggestedTitle = mapping.canonicalTitle;
          enrichedEvent.suggestedSpaceId = mapping.spaceId;
          enrichedEvent.suggestedImportance = mapping.importance;
        }
      }

      unmatchedEvents.push(enrichedEvent);
    }

    // 2. Fetch UNKNOWN payment attempts without linked transactions
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const unknownAttempts = await PaymentAttempt.find({
      userId,
      $or: [
        { status: 'UNKNOWN' },
        { status: 'PENDING', initiatedAt: { $lte: fifteenMinsAgo } },
      ],
      linkedTransactionId: { $exists: false },
    }).sort({ initiatedAt: -1 });

    const unreadCount = mediumMatches.length + unmatchedEvents.length + unknownAttempts.length;

    return NextResponse.json({
      mediumMatches,
      unmatchedEvents,
      unknownAttempts,
      unreadCount,
    });
  } catch (error) {
    console.error('Error fetching inbox:', error);
    return NextResponse.json({ message: 'Failed to fetch inbox', error: error.message }, { status: 500 });
  }
}
