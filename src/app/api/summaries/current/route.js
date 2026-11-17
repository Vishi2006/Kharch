import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import { recalculateSummary } from '@/lib/summaryHelper';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  await connectDB();

  try {
    const { searchParams } = new URL(request.url);
    const spaceId = searchParams.get('spaceId');
    const month = searchParams.get('month');

    if (!spaceId || !month) {
      return NextResponse.json({ message: 'spaceId and month are required' }, { status: 400 });
    }

    const summary = await recalculateSummary(auth.user._id, spaceId, month);
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error fetching current month summary:', error);
    return NextResponse.json({ message: 'Server error fetching monthly summary' }, { status: 500 });
  }
}
