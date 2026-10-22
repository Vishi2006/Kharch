const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { protect } = require('../middleware/auth');
const DeviceToken = require('../models/DeviceToken');

/**
 * @route   POST /api/companion/token
 * @desc    Generate or retrieve a long-lived companion pairing token
 */
router.post('/token', protect, async (req, res) => {
  try {
    const { deviceName = 'Android Companion' } = req.body;
    
    // Generate secure random token
    const token = 'kharch_dev_' + crypto.randomBytes(24).toString('hex');

    const deviceRecord = await DeviceToken.create({
      token,
      userId: req.user._id,
      deviceName,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    });

    const protocol = req.protocol;
    const host = req.get('host');
    const serverUrl = `${protocol}://${host}`;

    return res.status(200).json({
      success: true,
      token: deviceRecord.token,
      pairingPayload: {
        serverUrl,
        token: deviceRecord.token,
        userId: req.user._id,
      },
    });
  } catch (error) {
    console.error('Error generating companion token:', error);
    return res.status(500).json({ message: 'Failed to generate companion token', error: error.message });
  }
});

/**
 * @route   GET /api/companion/download
 * @desc    Direct APK download for sideloading on Android devices
 */
router.get('/download', (req, res) => {
  const apkPath = path.resolve(__dirname, '../../android/app/build/outputs/apk/debug/app-debug.apk');

  if (!fs.existsSync(apkPath)) {
    return res.status(404).json({
      message: 'Companion APK not found. Please run `gradlew assembleDebug` in the android/ directory first.',
    });
  }

  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="KharchCompanion.apk"');
  return res.sendFile(apkPath);
});

module.exports = router;
