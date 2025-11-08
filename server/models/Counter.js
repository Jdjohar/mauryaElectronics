// server/models/Counter.js  (patch)
const mongoose = require('mongoose');
const { Schema } = mongoose;

const CounterSchema = new Schema({
  _id: { type: String }, // e.g. "complaint_seq_20251107"
  seq: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// expire counter docs after 30 days (30*24*60*60 seconds)
CounterSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);
