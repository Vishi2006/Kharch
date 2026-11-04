import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser } from '@/lib/auth';
import Consent from '@/models/Consent';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await getAuthenticatedUser(request);
  await connectDB();

  try {
    const { deviceId, allowedPackages, version, grantedAt } = await request.json();

    if (!Array.isArray(allowedPackages)) {
      return NextResponse.json({ message: 'allowedPackages must be an array of package names' }, { status: 400 });
    }

    const query = {};
    if (auth?.user?._id) {
      query.userId = auth.user._id;
    } else if (deviceId) {
      query.deviceId = deviceId;
    } else {
      query.deviceId = 'default_companion_device';
    }

    const consent = await Consent.findOneAndUpdate(
      query,
      {
        userId: auth?.user?._id || undefined,
        deviceId: deviceId || 'default_companion_device',
        allowedPackages,
        version: version || '1.0',
        grantedAt: grantedAt ? new Date(grantedAt) : new Date(),
        isActive: true,
        revokedAt: null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ success: true, consent });
  } catch (error) {
    console.error('Error saving consent:', error);
    return NextResponse.json({ message: 'Failed to record consent', error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  const auth = await getAuthenticatedUser(request);
  await connectDB();

  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const query = { isActive: true };

    if (auth?.user?._id) {
      query.userId = auth.user._id;
    } else if (deviceId) {
      query.deviceId = deviceId;
    } else {
      query.deviceId = 'default_companion_device';
    }

    const consent = await Consent.findOne(query).sort({ updatedAt: -1 });
    return NextResponse.json({ consent: consent || null });
  } catch (error) {
    console.error('Error fetching consent:', error);
    return NextResponse.json({ message: 'Failed to fetch consent', error: error.message }, { status: 500 });
  }
}

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

    await Consent.updateMany(query, {
      isActive: false,
      revokedAt: new Date(),
    });

    return NextResponse.json({ success: true, message: 'Consent revoked successfully' });
  } catch (error) {
    console.error('Error revoking consent:', error);
    return NextResponse.json({ message: 'Failed to revoke consent', error: error.message }, { status: 500 });
  }
}
