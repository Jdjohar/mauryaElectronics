const mongoose = require('mongoose');

const MissingPartSchema = new mongoose.Schema(
  {
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
    brand: { type: String, default: '' },
    model: { type: String, default: '' },
    part_name: { type: String, default: '' },
    qty: { type: Number, default: 1 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

MissingPartSchema.index({ complaint: 1 });

module.exports = mongoose.model('MissingPart', MissingPartSchema);
