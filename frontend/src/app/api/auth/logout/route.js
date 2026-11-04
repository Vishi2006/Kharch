import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  const isProduction = process.env.NODE_ENV === 'production';
  const cookieStore = await cookies();
  cookieStore.set('token', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return NextResponse.json({ message: 'Successfully logged out' });
}
