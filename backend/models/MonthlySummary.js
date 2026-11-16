const mongoose = require('mongoose');

const MonthlySummarySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  spaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Space',
    required: true,
  },
  month: {
    type: String, // format: "YYYY-MM"
    required: true,
  },
  openingBalance: {
    type: Number,
    default: 0,
  },
  actualClosingBalance: {
    type: Number,
    default: 0,
  },
  expectedClosingBalance: {
    type: Number,
    default: 0,
  },
  reconciliationAdjustment: {
    type: Number,
    default: 0,
  },
  // Sub-totals stored permanently so that when raw transactions are cleaned up,
  // we still preserve this high-level summary.
  earned: {
    type: Number,
    default: 0,
  },
  expenses: {
    type: Number,
    default: 0,
  },
  investments: {
    type: Number,
    default: 0,
  },
  savings: {
    type: Number,
    default: 0,
  },
  isLocked: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// A monthly summary is unique per space and month
MonthlySummarySchema.index({ spaceId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MonthlySummary', MonthlySummarySchema);
