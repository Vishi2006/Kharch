import mongoose from 'mongoose';

const SpaceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// A user cannot have duplicate space names
SpaceSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.models.Space || mongoose.model('Space', SpaceSchema);
