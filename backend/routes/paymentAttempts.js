const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const PaymentAttempt = require('../models/PaymentAttempt');

// POST /api/payment-attempts - Create or sync a payment attempt
router.post('/', protect, async (req, res) => {
  try {
    const { paymentAttemptId, type, amount, payeeVpa, payeeName, initiatedAt, status, linkedTransactionId } = req.body;

    if (!paymentAttemptId || !amount) {
      return res.status(400).json({ message: 'paymentAttemptId and amount are required' });
    }

    const attempt = await PaymentAttempt.findOneAndUpdate(
      { paymentAttemptId },
      {
        userId: req.user._id,
        type,
        amount,
        payeeVpa,
        payeeName,
        initiatedAt: initiatedAt || Date.now(),
        status: status || 'PENDING',
        linkedTransactionId
      },
      { new: true, upsert: true }
    );

    res.status(200).json(attempt);
  } catch (error) {
    console.error('Error saving payment attempt:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/payment-attempts - Get pending/unknown attempts
router.get('/', protect, async (req, res) => {
  try {
    const attempts = await PaymentAttempt.find({
      userId: req.user._id,
      status: { $in: ['PENDING', 'UNKNOWN', 'SUBMITTED'] }
    }).sort({ initiatedAt: -1 });
    
    res.json(attempts);
  } catch (error) {
    console.error('Error fetching payment attempts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/payment-attempts/:id - Update status/link
router.put('/:id', protect, async (req, res) => {
  try {
    const { status, linkedTransactionId } = req.body;
    const attempt = await PaymentAttempt.findOneAndUpdate(
      { paymentAttemptId: req.params.id, userId: req.user._id },
      { status, linkedTransactionId },
      { new: true }
    );

    if (!attempt) {
      return res.status(404).json({ message: 'Payment attempt not found' });
    }

    res.json(attempt);
  } catch (error) {
    console.error('Error updating payment attempt:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
