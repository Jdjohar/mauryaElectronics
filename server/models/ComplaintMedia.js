const mongoose = require('mongoose');

const ComplaintMediaSchema = new mongoose.Schema(
  {
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
    media_type: { type: String, enum: ['image', 'video', 'other'], default: 'image' },
    media_url: { type: String, required: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// ensure index (redundant if index: true above but safe)
ComplaintMediaSchema.index({ complaint: 1 });

module.exports = mongoose.model('ComplaintMedia', ComplaintMediaSchema);
