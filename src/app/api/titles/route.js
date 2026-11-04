import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import ExpenseTitle from '@/models/ExpenseTitle';

export const dynamic = 'force-dynamic';

const formatDisplayName = (name) => {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export async function GET(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  await connectDB();

  try {
    const { searchParams } = new URL(request.url);
    const spaceId = searchParams.get('spaceId');
    const q = searchParams.get('q');

    if (!spaceId) {
      return NextResponse.json({ message: 'spaceId query parameter is required' }, { status: 400 });
    }

    const query = { spaceId, userId: auth.user._id };
    if (q && q.trim()) {
      query.normalizedName = { $regex: q.trim().toLowerCase(), $options: 'i' };
    }

    const titles = await ExpenseTitle.find(query).limit(50).sort({ displayName: 1 });
    return NextResponse.json(titles);
  } catch (error) {
    console.error('Error fetching titles:', error);
    return NextResponse.json({ message: 'Server error fetching titles' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  await connectDB();

  try {
    const { spaceId, name } = await request.json();

    if (!spaceId || !name || !name.trim()) {
      return NextResponse.json({ message: 'spaceId and name are required' }, { status: 400 });
    }

    const rawName = name.trim();
    const normalizedName = rawName.toLowerCase();

    let title = await ExpenseTitle.findOne({ spaceId, normalizedName });

    if (!title) {
      const displayName = formatDisplayName(rawName);
      title = new ExpenseTitle({
        userId: auth.user._id,
        spaceId,
        normalizedName,
        displayName,
      });
      await title.save();
    }

    return NextResponse.json(title, { status: 201 });
  } catch (error) {
    console.error('Error creating canonical title:', error);
    return NextResponse.json({ message: 'Server error creating title' }, { status: 500 });
  }
}
