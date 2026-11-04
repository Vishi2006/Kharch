import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import MonthlySummary from '@/models/MonthlySummary';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  await connectDB();

  try {
    const { searchParams } = new URL(request.url);
    const spaceId = searchParams.get('spaceId');

    if (!spaceId) {
      return NextResponse.json({ message: 'spaceId is required' }, { status: 400 });
    }

    const summaries = await MonthlySummary.find({ spaceId, userId: auth.user._id }).sort({ month: -1 });
    return NextResponse.json(summaries);
  } catch (error) {
    console.error('Error fetching summaries:', error);
    return NextResponse.json({ message: 'Server error fetching monthly summaries' }, { status: 500 });
  }
}
