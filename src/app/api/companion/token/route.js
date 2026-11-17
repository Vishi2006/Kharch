import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import DeviceToken from '@/models/DeviceToken';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  await connectDB();

  try {
    let deviceName = 'Android Companion';
    let deviceId = null;

    try {
      const body = await request.json();
      if (body?.deviceName) deviceName = body.deviceName;
      if (body?.deviceId) deviceId = body.deviceId;
    } catch {}

    const token = crypto.randomBytes(32).toString('hex');

    const deviceRecord = new DeviceToken({
      token,
      userId: auth.user._id,
      deviceId: deviceId || `device_${Date.now()}`,
      deviceName,
      lastUsedAt: new Date(),
    });

    await deviceRecord.save();

    // Determine public server URL
    const host = request.headers.get('host') || 'localhost:3000';
    const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const publicUrl = `${proto}://${host}`;

    const pairingPayload = {
      v: '1.0',
      serverUrl: publicUrl,
      token,
      userId: auth.user._id.toString(),
      deviceId: deviceRecord.deviceId,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      token,
      deviceId: deviceRecord.deviceId,
      pairingPayload,
    });
  } catch (error) {
    console.error('Error issuing companion token:', error);
    return NextResponse.json({ message: 'Failed to generate companion token', error: error.message }, { status: 500 });
  }
}
