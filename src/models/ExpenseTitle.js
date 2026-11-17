import mongoose from 'mongoose';

const ExpenseTitleSchema = new mongoose.Schema({
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
  normalizedName: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Avoid duplicate titles per space
ExpenseTitleSchema.index({ spaceId: 1, normalizedName: 1 }, { unique: true });

export default mongoose.models.ExpenseTitle || mongoose.model('ExpenseTitle', ExpenseTitleSchema);
