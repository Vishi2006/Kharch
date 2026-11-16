const mongoose = require('mongoose');

const PaymentAttemptSchema = new mongoose.Schema({
  paymentAttemptId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['expense', 'income', 'investment', 'savings'],
    default: 'expense'
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  payeeVpa: {
    type: String,
    trim: true,
  },
  payeeName: {
    type: String,
    trim: true,
  },
  initiatedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'UNKNOWN', 'SUBMITTED'],
    default: 'PENDING',
  },
  linkedTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
  },
}, { timestamps: true });

module.exports = mongoose.model('PaymentAttempt', PaymentAttemptSchema);
