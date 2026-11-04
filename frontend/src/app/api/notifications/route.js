import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import NotificationEvent from '@/models/NotificationEvent';

export const dynamic = 'force-dynamic';

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
