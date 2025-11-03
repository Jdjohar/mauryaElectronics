const mongoose = require('mongoose');

const PinCodeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // area name
    pin_code: { type: String, required: true, trim: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PinCode', PinCodeSchema);
