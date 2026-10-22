const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Consent = require('../models/Consent');
const User = require('../models/User');

// Optional auth helper to associate user if bearer token is provided
const optionalAuth = async (req, res, next) => {
  let token;
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
      req.user = await User.findById(decoded.id).select('-googleId');
    } catch {
      // Ignore token parse failure for optional auth
    }
  }
  next();
};

/**
 * @route   POST /api/consent
 * @desc    Record or update notification access consent
 */
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { deviceId, allowedPackages, version, grantedAt } = req.body;

    if (!Array.isArray(allowedPackages)) {
      return res.status(400).json({ message: 'allowedPackages must be an array of package names' });
    }

    const query = {};
    if (req.user?._id) {
      query.userId = req.user._id;
    } else if (deviceId) {
      query.deviceId = deviceId;
    } else {
      query.deviceId = 'default_companion_device';
    }

    const consent = await Consent.findOneAndUpdate(
      query,
      {
        userId: req.user?._id || undefined,
        deviceId: deviceId || 'default_companion_device',
        allowedPackages,
        version: version || '1.0',
        grantedAt: grantedAt ? new Date(grantedAt) : new Date(),
        isActive: true,
        revokedAt: null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ success: true, consent });
  } catch (error) {
    console.error('Error saving consent:', error);
    return res.status(500).json({ message: 'Failed to record consent', error: error.message });
  }
});

/**
 * @route   GET /api/consent
 * @desc    Retrieve active consent record
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { deviceId } = req.query;
    const query = { isActive: true };

    if (req.user?._id) {
      query.userId = req.user._id;
    } else if (deviceId) {
      query.deviceId = deviceId;
    } else {
      query.deviceId = 'default_companion_device';
    }

    const consent = await Consent.findOne(query).sort({ updatedAt: -1 });
    return res.status(200).json({ consent: consent || null });
  } catch (error) {
    console.error('Error fetching consent:', error);
    return res.status(500).json({ message: 'Failed to fetch consent', error: error.message });
  }
});

/**
 * @route   DELETE /api/consent
 * @desc    Revoke notification access consent
 */
router.delete('/', optionalAuth, async (req, res) => {
  try {
    const { deviceId } = req.body || req.query;
    const query = {};

    if (req.user?._id) {
      query.userId = req.user._id;
    } else if (deviceId) {
      query.deviceId = deviceId;
    } else {
      query.deviceId = 'default_companion_device';
    }

    await Consent.updateMany(query, {
      isActive: false,
      revokedAt: new Date(),
    });

    return res.status(200).json({ success: true, message: 'Consent revoked successfully' });
  } catch (error) {
    console.error('Error revoking consent:', error);
    return res.status(500).json({ message: 'Failed to revoke consent', error: error.message });
  }
});

/**
 * @route   DELETE /api/consent/my-data
 * @desc    Wipe user companion notification data
 */
router.delete('/my-data', optionalAuth, async (req, res) => {
  try {
    const { deviceId } = req.body || req.query;
    const query = {};

    if (req.user?._id) {
      query.userId = req.user._id;
    } else if (deviceId) {
      query.deviceId = deviceId;
    } else {
      query.deviceId = 'default_companion_device';
    }

    await Consent.deleteMany(query);

    return res.status(200).json({ success: true, message: 'Companion data deleted successfully' });
  } catch (error) {
    console.error('Error deleting companion data:', error);
    return res.status(500).json({ message: 'Failed to delete companion data', error: error.message });
  }
});

module.exports = router;
