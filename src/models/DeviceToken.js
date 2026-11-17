import mongoose from 'mongoose';

const DeviceTokenSchema = new mongoose.Schema(
  {
    token: {
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
    deviceId: {
      type: String,
    },
    deviceName: {
      type: String,
      default: 'Android Companion',
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.DeviceToken || mongoose.model('DeviceToken', DeviceTokenSchema);
