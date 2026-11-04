import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import Space from '@/models/Space';

export const dynamic = 'force-dynamic';

// Create Google OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || 'dummy_client_id');

export async function POST(request) {
  const body = await request.json();
  const { credential } = body;

  if (!credential) {
    return NextResponse.json({ message: 'Google credential (ID Token) is required' }, { status: 400 });
  }

  let userPayload;

  // Development mock bypass helper
  const isDev = process.env.NODE_ENV !== 'production';
  const isMockToken = credential.startsWith('mock_token_');

  if (isDev && (isMockToken || !process.env.GOOGLE_CLIENT_ID)) {
    console.log('Using Development/Mock authentication bypass...');
    if (isMockToken) {
      const email = credential.split('_')[2] || 'testuser@kharch.com';
      const name = email.split('@')[0].toUpperCase();
      userPayload = {
        sub: `mock_google_id_${email}`,
        email: email,
        name: name,
        picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      };
    } else {
      try {
        const decoded = jwt.decode(credential);
        if (decoded) {
          userPayload = {
            sub: decoded.sub,
            email: decoded.email,
            name: decoded.name || decoded.email.split('@')[0],
            picture: decoded.picture,
          };
        }
      } catch (err) {
        // Fallback mock
      }

      if (!userPayload) {
        userPayload = {
          sub: 'mock_google_id_default',
          email: 'guest@kharch.com',
          name: 'Guest User',
          picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        };
      }
    }
  } else {
    // Standard Google Verification
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      userPayload = ticket.getPayload();
    } catch (error) {
      console.error('Google token verification failed:', error.message);
      return NextResponse.json({ message: 'Invalid Google token' }, { status: 401 });
    }
  }

  try {
    await connectDB();
    const { sub: googleId, email, name, picture } = userPayload;

    // 1. Find or create user
    let user = await User.findOne({ googleId });
    let isNewUser = false;

    if (!user) {
      user = new User({ googleId, email, name, picture });
      await user.save();
      isNewUser = true;
      console.log(`Created new user: ${email}`);
    } else {
      user.name = name;
      user.picture = picture;
      await user.save();
    }

    // 2. Ensure default "Personal Life" space exists for user
    let defaultSpace = await Space.findOne({ userId: user._id, isDefault: true });
    if (!defaultSpace) {
      defaultSpace = await Space.findOne({ userId: user._id, name: 'Personal Life' });
      if (!defaultSpace) {
        defaultSpace = new Space({
          userId: user._id,
          name: 'Personal Life',
          isDefault: true,
        });
        await defaultSpace.save();
        console.log(`Created default 'Personal Life' space for user: ${email}`);
      } else if (!defaultSpace.isDefault) {
        defaultSpace.isDefault = true;
        await defaultSpace.save();
      }
    }

    // 3. Issue Session JWT Token
    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key';
    const sessionToken = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: '30d' });

    // 4. Set HttpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieStore = await cookies();
    cookieStore.set('token', sessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    return NextResponse.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
      defaultSpaceId: defaultSpace._id,
    });
  } catch (error) {
    console.error('Server error during Google auth:', error.message);
    return NextResponse.json({ message: 'Server error during authentication' }, { status: 500 });
  }
}
