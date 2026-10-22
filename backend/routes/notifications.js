const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const NotificationEvent = require('../models/NotificationEvent');
const DeviceToken = require('../models/DeviceToken');
const User = require('../models/User');

// Auth middleware: accepts user JWT cookie, user Bearer JWT, or companion DeviceToken
const authenticateSync = async (req, res, next) => {
  let token;

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized: no authentication token provided' });
  }

  // First try checking if it's a long-lived DeviceToken
  try {
    const deviceRecord = await DeviceToken.findOne({ token }).populate('userId');
    if (deviceRecord && deviceRecord.userId) {
      req.user = deviceRecord.userId;
      req.deviceId = deviceRecord.deviceId;
      // Update last active
      deviceRecord.lastUsedAt = new Date();
      await deviceRecord.save();
      return next();
    }
  } catch (err) {
    console.error('Error looking up DeviceToken:', err);
  }

  // Second try standard JWT verification
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
    req.user = await User.findById(decoded.id).select('-googleId');
    if (!req.user) {
      return res.status(401).json({ message: 'User not found' });
    }
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized: invalid token' });
  }
};

/**
 * @route   POST /api/notifications/sync
 * @desc    Idempotent batch ingestion of companion notification events
 */
router.post('/sync', authenticateSync, async (req, res) => {
  try {
    const { deviceId, events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ message: 'events array is required and must not be empty' });
    }

    const operations = events.map((event) => {
      const timestamp = event.timestamp ? new Date(event.timestamp) : new Date();
      const timestampRoundedToMinute = event.timestampRoundedToMinute
        ? new Date(event.timestampRoundedToMinute)
        : new Date(Math.floor(timestamp.getTime() / 60000) * 60000);

      return {
        updateOne: {
          filter: { idempotencyKey: event.idempotencyKey },
          update: {
            $setOnInsert: {
              userId: req.user._id,
              deviceId: deviceId || req.deviceId || 'default_companion_device',
              idempotencyKey: event.idempotencyKey,
              type: event.type || 'UNKNOWN',
              amount: event.amount || 0,
              counterparty: event.counterparty || '',
              referenceId: event.referenceId || null,
              timestamp,
              timestampRoundedToMinute,
              sourceApp: event.sourceApp || 'unknown',
              rawText: event.rawText || '',
              parseStatus: event.parseStatus || 'parsed',
              status: 'UNMATCHED',
            },
          },
          upsert: true,
        },
      };
    });

    const result = await NotificationEvent.bulkWrite(operations, { ordered: false });

    return res.status(200).json({
      success: true,
      processed: events.length,
      upsertedCount: result.upsertedCount,
      matchedCount: result.matchedCount,
    });
  } catch (error) {
    console.error('Error syncing notification events:', error);
    return res.status(500).json({ message: 'Sync failed', error: error.message });
  }
});

/**
 * @route   GET /api/notifications
 * @desc    Fetch notification events for user
 */
router.get('/', authenticateSync, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const filter = { userId: req.user._id };

    if (status) {
      filter.status = status;
    }

    const events = await NotificationEvent.find(filter)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit, 10));

    return res.status(200).json({ events });
  } catch (error) {
    console.error('Error fetching notification events:', error);
    return res.status(500).json({ message: 'Failed to fetch events', error: error.message });
  }
});

module.exports = router;
