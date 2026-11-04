import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { connectDB } from './mongodb';
import User from '../models/User';
import DeviceToken from '../models/DeviceToken';

export async function getAuthenticatedUser(request) {
  await connectDB();

  let token = null;

  // 1. Try HttpOnly cookie (PWA)
  try {
    const cookieStore = await cookies();
    token = cookieStore.get('token')?.value;
  } catch {}

  // 2. Try Authorization: Bearer header (Android / iOS Shortcuts)
  if (!token) {
    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) return null;

  // 3. Check if it's a DeviceToken (longer opaque string)
  try {
    const deviceRecord = await DeviceToken.findOne({ token }).populate('userId');
    if (deviceRecord?.userId) {
      deviceRecord.lastUsedAt = new Date();
      await deviceRecord.save();
      return { user: deviceRecord.userId, deviceId: deviceRecord.deviceId };
    }
  } catch {}

  // 4. Verify as JWT session token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
    const user = await User.findById(decoded.id).select('-googleId');
    if (user) return { user, deviceId: null };
  } catch {}

  return null;
}

export function unauthorized() {
  return NextResponse.json({ message: 'Not authorized' }, { status: 401 });
}
