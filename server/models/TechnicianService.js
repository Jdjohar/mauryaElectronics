const mongoose = require('mongoose');

const TechnicianServiceSchema = new mongoose.Schema(
  {
    technician: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    // you can add additional fields like cost override, active flag etc.
    is_active: { type: Boolean, default: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

TechnicianServiceSchema.index({ technician: 1, service: 1 }, { unique: true });

module.exports = mongoose.model('TechnicianService', TechnicianServiceSchema);
