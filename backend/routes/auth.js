const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Space = require('../models/Space');
const { protect } = require('../middleware/auth');

// Create Google OAuth client
// We will tolerate missing clientId in development to allow mock login bypass
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || 'dummy_client_id');

// @route   POST /api/auth/google
// @desc    Authenticate user with Google ID Token
// @access  Public
router.post('/google', async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ message: 'Google credential (ID Token) is required' });
  }

  let userPayload;

  // Development mock bypass helper
  const isDev = process.env.NODE_ENV !== 'production';
  const isMockToken = credential.startsWith('mock_token_');

  if (isDev && (isMockToken || !process.env.GOOGLE_CLIENT_ID)) {
    console.log('Using Development/Mock authentication bypass...');
    // Determine info based on token or fallback mock info
    if (isMockToken) {
      const email = credential.split('_')[2] || 'testuser@kharch.com';
      const name = email.split('@')[0].toUpperCase();
      userPayload = {
        sub: `mock_google_id_${email}`,
        email: email,
        name: name,
        picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', // Mock avatar
      };
    } else {
      // Decode credential without verifying if it's a JWT payload or just use a default
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
    // Standard Google Verification (supports both ID Token and Access Token fallback)
    try {
      const allowedAudiences = [
        process.env.GOOGLE_CLIENT_ID,
        '804504560516-0g5l1kbk9qr0lpgps8aq4t2ji7q3mkit.apps.googleusercontent.com',
        '804504560516-4bggeumofelo18bbn7stct4lnama7otn.apps.googleusercontent.com',
      ].filter(Boolean);

      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: allowedAudiences,
      });
      userPayload = ticket.getPayload();
    } catch (error) {
      console.warn('Google ID token verification failed, trying Google userinfo endpoint...', error.message);
      try {
        const fetch = globalThis.fetch || require('node-fetch');
        const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${credential}` },
        });
        if (userinfoRes.ok) {
          const info = await userinfoRes.json();
          userPayload = {
            sub: info.sub,
            email: info.email,
            name: info.name || info.email.split('@')[0],
            picture: info.picture,
          };
        } else {
          console.error('Google userinfo fetch failed with status:', userinfoRes.status);
          return res.status(401).json({ message: 'Invalid Google token' });
        }
      } catch (fetchErr) {
        console.error('Google token verification failed completely:', fetchErr.message);
        return res.status(401).json({ message: 'Invalid Google token' });
      }
    }
  }

  try {
    const { sub: googleId, email, name, picture } = userPayload;

    // 1. Find or create user (Search by BOTH googleId and email to link existing accounts)
    let user = await User.findOne({
      $or: [{ googleId }, { email: email.toLowerCase() }],
    });
    let isNewUser = false;

    if (user) {
      // Existing user: Link googleId and sync profile
      user.googleId = googleId;
      if (name) user.name = name;
      if (picture) user.picture = picture;
      await user.save();
      console.log(`Linked existing user: ${user.email} (ID: ${user._id})`);
    } else {
      user = new User({
        googleId,
        email: email.toLowerCase(),
        name,
        picture,
      });
      await user.save();
      isNewUser = true;
      console.log(`Created new user: ${email}`);
    }

    // 2. Ensure default space exists for user
    let defaultSpace = await Space.findOne({ userId: user._id, isDefault: true });
    if (!defaultSpace) {
      defaultSpace = await Space.findOne({ userId: user._id, name: 'Personal Life' });
      if (!defaultSpace) {
        const anySpace = await Space.findOne({ userId: user._id });
        if (anySpace) {
          defaultSpace = anySpace;
        } else {
          defaultSpace = new Space({
            userId: user._id,
            name: 'Personal Life',
            isDefault: true,
          });
          await defaultSpace.save();
          console.log(`Created default 'Personal Life' space for user: ${email}`);
        }
      } else if (!defaultSpace.isDefault) {
        defaultSpace.isDefault = true;
        await defaultSpace.save();
      }
    }

    // 3. Issue Session JWT Token
    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key';
    const sessionToken = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: '30d' });

    // 4. Set HttpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
    res.cookie('token', sessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({
      success: true,
      token: sessionToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
      defaultSpaceId: defaultSpace ? defaultSpace._id : null,
    });
  } catch (error) {
    console.error('Server error during Google auth:', error.message);
    res.status(500).json({ message: 'Server error during authentication' });
  }
});

// @route   POST /api/auth/logout
// @desc    Clear Auth Cookie / Logout
// @access  Private
router.post('/logout', protect, (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
  });
  res.json({ message: 'Successfully logged out' });
});

// @route   GET /api/auth/me
// @desc    Get current user profile & active/default space
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const defaultSpace = await Space.findOne({ userId: req.user._id, isDefault: true }) 
      || await Space.findOne({ userId: req.user._id });
    
    res.json({
      user: req.user,
      defaultSpaceId: defaultSpace ? defaultSpace._id : null,
    });
  } catch (error) {
    console.error('Error fetching current user:', error.message);
    res.status(500).json({ message: 'Server error fetching user' });
  }
});

module.exports = router;
