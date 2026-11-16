const mongoose = require('mongoose');
// Ensure ExpenseTitle and Space models are registered for populate references
require('./ExpenseTitle');
require('./Space');
require('./User');

const TransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  spaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Space',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['income', 'expense', 'investment', 'savings'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  titleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExpenseTitle',
    required: true, // Every transaction (income or expense) should have a canonical title
  },
  importance: {
    type: String,
    enum: ['essential', 'moderate', 'low_value'],
    // Required only for expenses
    required: function() { return this.type === 'expense'; }
  },
  date: {
    type: Date,
    required: true,
  },
  note: {
    type: String,
    default: '',
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for high performance querying
TransactionSchema.index({ spaceId: 1, date: -1 });
TransactionSchema.index({ spaceId: 1, type: 1, date: -1 });
TransactionSchema.index({ spaceId: 1, titleId: 1 });

module.exports = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);
