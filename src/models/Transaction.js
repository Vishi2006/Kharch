import mongoose from 'mongoose';

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

// Compound indexes for history sorting and search filters
TransactionSchema.index({ spaceId: 1, date: -1 });

export default mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);
