import mongoose from 'mongoose';

const ConsentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    deviceId: {
      type: String,
      required: false,
      index: true,
    },
    grantedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    allowedPackages: {
      type: [String],
      required: true,
      default: [],
    },
    version: {
      type: String,
      default: '1.0',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    revokedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Consent || mongoose.model('Consent', ConsentSchema);
