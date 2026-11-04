import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser } from '@/lib/auth';
import Consent from '@/models/Consent';

export const dynamic = 'force-dynamic';

export async function DELETE(request) {
  const auth = await getAuthenticatedUser(request);
  await connectDB();

  try {
    let deviceId = null;
    try {
      const body = await request.json();
      deviceId = body?.deviceId;
    } catch {}

    if (!deviceId) {
      const { searchParams } = new URL(request.url);
      deviceId = searchParams.get('deviceId');
    }

    const query = {};
    if (auth?.user?._id) {
      query.userId = auth.user._id;
    } else if (deviceId) {
      query.deviceId = deviceId;
    } else {
      query.deviceId = 'default_companion_device';
    }

    await Consent.deleteMany(query);
    return NextResponse.json({ success: true, message: 'Companion data deleted successfully' });
  } catch (error) {
    console.error('Error deleting companion data:', error);
    return NextResponse.json({ message: 'Failed to delete companion data', error: error.message }, { status: 500 });
  }
}
