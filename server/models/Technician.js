const mongoose = require('mongoose');

const TechnicianSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    address: { type: String, default: '' },
    is_active: { type: Boolean, default: true },
    // services will be an array of ObjectId references or kept in technician_services collection
    services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
    user_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Technician', TechnicianSchema);
