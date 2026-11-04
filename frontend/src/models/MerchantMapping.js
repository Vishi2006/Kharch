import mongoose from 'mongoose';

const MerchantMappingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  identifierKey: { type: String, required: true, trim: true, lowercase: true },
  canonicalTitle: { type: String, required: true, trim: true },
  spaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Space', required: true },
  importance: { type: String, enum: ['essential', 'moderate', 'low_value'], default: 'moderate' },
  usageCount: { type: Number, default: 1 },
  lastUsedAt: { type: Date, default: Date.now },
}, { timestamps: true });

MerchantMappingSchema.index({ userId: 1, identifierKey: 1 }, { unique: true });

export default mongoose.models.MerchantMapping || mongoose.model('MerchantMapping', MerchantMappingSchema);
