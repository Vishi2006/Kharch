import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import MerchantMapping from '@/models/MerchantMapping';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  await connectDB();

  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key')?.toLowerCase().trim();

    if (!key) {
      return NextResponse.json({ mapping: null });
    }

    const mapping = await MerchantMapping.findOne({
      userId: auth.user._id,
      identifierKey: key,
    });

    return NextResponse.json({ mapping });
  } catch (error) {
    console.error('Error fetching merchant mapping:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  await connectDB();

  try {
    const { identifierKey, canonicalTitle, spaceId, importance } = await request.json();

    if (!identifierKey || !canonicalTitle || !spaceId) {
      return NextResponse.json({ message: 'identifierKey, canonicalTitle, and spaceId are required' }, { status: 400 });
    }

    const normalizedKey = identifierKey.toLowerCase().trim();

    const mapping = await MerchantMapping.findOneAndUpdate(
      { userId: auth.user._id, identifierKey: normalizedKey },
      {
        $set: {
          canonicalTitle: canonicalTitle.trim(),
          spaceId,
          importance: importance || 'moderate',
          lastUsedAt: new Date(),
        },
        $inc: { usageCount: 1 },
        $setOnInsert: { userId: auth.user._id, identifierKey: normalizedKey },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ mapping });
  } catch (error) {
    console.error('Error saving merchant mapping:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
