import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import Space from '@/models/Space';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  try {
    await connectDB();
    const defaultSpace =
      (await Space.findOne({ userId: auth.user._id, isDefault: true })) ||
      (await Space.findOne({ userId: auth.user._id }));

    return NextResponse.json({
      user: auth.user,
      defaultSpaceId: defaultSpace ? defaultSpace._id : null,
    });
  } catch (error) {
    console.error('Error fetching current user:', error.message);
    return NextResponse.json({ message: 'Server error fetching user' }, { status: 500 });
  }
}
