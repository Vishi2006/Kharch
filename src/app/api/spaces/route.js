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
    const spaces = await Space.find({ userId: auth.user._id }).sort({ createdAt: 1 });
    return NextResponse.json(spaces);
  } catch (error) {
    console.error('Error fetching spaces:', error.message);
    return NextResponse.json({ message: 'Server error fetching spaces' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  const body = await request.json();
  const { name } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ message: 'Space name is required' }, { status: 400 });
  }

  try {
    await connectDB();
    const trimmedName = name.trim();

    const existingSpace = await Space.findOne({
      userId: auth.user._id,
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
    });
    if (existingSpace) {
      return NextResponse.json({ message: 'A space with this name already exists' }, { status: 400 });
    }

    const space = new Space({
      userId: auth.user._id,
      name: trimmedName,
      isDefault: false,
    });

    await space.save();
    return NextResponse.json(space, { status: 201 });
  } catch (error) {
    console.error('Error creating space:', error.message);
    return NextResponse.json({ message: 'Server error creating space' }, { status: 500 });
  }
}
