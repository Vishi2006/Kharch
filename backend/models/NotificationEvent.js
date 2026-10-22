const mongoose = require('mongoose');

const NotificationEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      default: 'default_companion_device',
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['CREDIT', 'DEBIT', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    counterparty: {
      type: String,
      trim: true,
      default: '',
    },
    referenceId: {
      type: String,
      trim: true,
    },
    timestamp: {
      type: Date,
      required: true,
    },
    timestampRoundedToMinute: {
      type: Date,
      required: true,
    },
    sourceApp: {
      type: String,
      required: true,
    },
    rawText: {
      type: String,
      required: true,
    },
    parseStatus: {
      type: String,
      enum: ['parsed', 'unparsed'],
      default: 'parsed',
    },
    status: {
      type: String,
      enum: ['UNMATCHED', 'LINKED', 'DISMISSED'],
      default: 'UNMATCHED',
      index: true,
    },
    linkedTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    linkedPaymentAttemptId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('NotificationEvent', NotificationEventSchema);
