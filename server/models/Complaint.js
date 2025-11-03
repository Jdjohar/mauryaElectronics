// server/models/Complaint.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Complaint model
 * - stores technician_price_charged & service_base_price_charged so invoice/reporting stays stable
 * - safer pushStatusHistory (markModified)
 * - findOneAndUpdate pre-hook that transforms top-level status updates into $set/$push (attempts atomic ops)
 * - changeStatus static uses transactions to avoid races (requires replica set)
 */

const STATUS_ENUM = ['open', 'closed', 'cancelled', 'pending_parts'];

const StatusHistorySchema = new Schema(
  {
    status: { type: String, enum: STATUS_ENUM, required: true },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const ComplaintSchema = new Schema(
  {
    complaint_no: { type: String, trim: true, index: true, default: '' },
    customer_name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    phone2: { type: String, trim: true, default: '' },
    pin_code: { type: String, trim: true, default: '' },
    address: { type: String, required: true },
    service_id: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    problem_description: { type: String, default: '' },
    technician_id: { type: Schema.Types.ObjectId, ref: 'Technician', default: null },
    remarks: { type: String, default: '' },
    status: { type: String, enum: STATUS_ENUM, default: 'open' },

    opened_at: { type: Date, default: null },
    closed_at: { type: Date, default: null },
    time_to_close_ms: { type: Number, default: null },

    status_history: { type: [StatusHistorySchema], default: [] },

    created_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    scheduled_at: { type: Date, default: null },
    group_id: { type: String, default: '' },

    // store effective prices used for this complaint (so historical records remain valid)
    technician_price_charged: { type: Number, default: null },
    service_base_price_charged: { type: Number, default: null },

    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

/**
 * Compute time to close (ms)
 */
ComplaintSchema.statics._computeTimeToClose = function (openedAt, closedAt) {
  if (!openedAt || !closedAt) return null;
  const diff = new Date(closedAt).getTime() - new Date(openedAt).getTime();
  return diff >= 0 ? diff : null;
};

/**
 * Push status history helper - markModified to ensure Mongoose persists changes
 */
ComplaintSchema.methods.pushStatusHistory = function ({ status, by = null, at = new Date(), note = '' }) {
  this.status_history = this.status_history || [];
  this.status_history.push({ status, at, by, note });
  this.markModified('status_history');
};

/**
 * pre('save') hook - initialize opened_at/closed_at/time_to_close appropriately for new docs and status changes
 */
ComplaintSchema.pre('save', function (next) {
  const isNew = this.isNew;

  if (isNew) {
    if (!this.opened_at && this.status === 'open') {
      this.opened_at = new Date();
      this.pushStatusHistory({ status: 'open', at: this.opened_at, by: this.created_by || null });
    }
    if (this.status === 'closed' && !this.closed_at) {
      this.closed_at = new Date();
      this.opened_at = this.opened_at || new Date();
      this.time_to_close_ms = mongoose.model('Complaint')._computeTimeToClose(this.opened_at, this.closed_at);
      this.pushStatusHistory({ status: 'closed', at: this.closed_at, by: this.created_by || null });
    }
    return next();
  }

  if (this.isModified('status')) {
    const newStatus = this.status;

    if (newStatus === 'open') {
      this.opened_at = this.opened_at || new Date();
      this.closed_at = null;
      this.time_to_close_ms = null;
      this.pushStatusHistory({ status: 'open', at: this.opened_at });
    } else if (newStatus === 'closed') {
      this.closed_at = this.closed_at || new Date();
      this.opened_at = this.opened_at || this.createdAt || new Date();
      this.time_to_close_ms = mongoose.model('Complaint')._computeTimeToClose(this.opened_at, this.closed_at);
      this.pushStatusHistory({ status: 'closed', at: this.closed_at });
    } else {
      this.pushStatusHistory({ status: newStatus, at: new Date() });
    }
  }

  return next();
});

/**
 * pre('findOneAndUpdate') - transform top-level status updates into atomic $set/$push
 * This tries to keep $push for status_history and $set for fields. It still reads current doc to compute times.
 * For absolute correctness under concurrent updates, prefer transactions or using changeStatus static below.
 */
ComplaintSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate() || {};
  const newStatus = (update.status || (update.$set && update.$set.status)) || null;
  if (!newStatus) return next();

  try {
    const docToUpdate = await this.model.findOne(this.getQuery()).lean().exec();
    if (!docToUpdate) return next();

    // if status unchanged, nothing to do
    if (String(docToUpdate.status) === String(newStatus)) return next();

    const ops = {};
    ops.$set = { ...(update.$set || {}) };
    ops.$push = { ...(update.$push || {}) };

    if (newStatus === 'open') {
      const openedAt = docToUpdate.opened_at || new Date();
      ops.$set.opened_at = openedAt;
      ops.$set.closed_at = null;
      ops.$set.time_to_close_ms = null;
      ops.$push.status_history = { $each: [{ status: 'open', at: openedAt }] };
    } else if (newStatus === 'closed') {
      const closedAt = new Date();
      const openedAt = docToUpdate.opened_at || docToUpdate.createdAt || new Date();
      const duration = mongoose.model('Complaint')._computeTimeToClose(openedAt, closedAt);

      ops.$set.closed_at = closedAt;
      ops.$set.opened_at = docToUpdate.opened_at || docToUpdate.createdAt || openedAt;
      ops.$set.time_to_close_ms = duration;
      ops.$push.status_history = { $each: [{ status: 'closed', at: closedAt }] };
    } else {
      const at = new Date();
      ops.$push.status_history = { $each: [{ status: newStatus, at }] };
    }

    // Move any direct top-level fields (like status) into $set if present directly
    Object.keys(update).forEach((k) => {
      if (k.startsWith('$')) return; // skip operators
      ops.$set[k] = update[k];
    });

    this.setUpdate(ops);
  } catch (err) {
    return next(err);
  }
  return next();
});

/**
 * Transactional status change helper - performs atomic find + update + push within a session to avoid races.
 * Requires MongoDB replica set or server that supports transactions.
 */
ComplaintSchema.statics.changeStatus = async function (complaintId, newStatus, { by = null, note = '' } = {}) {
  const Complaint = this;
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const now = new Date();
    const doc = await Complaint.findById(complaintId).session(session).exec();
    if (!doc) {
      await session.abortTransaction();
      session.endSession();
      throw new Error('Complaint not found');
    }

    if (String(doc.status) === String(newStatus)) {
      // push history but don't change status
      doc.pushStatusHistory({ status: newStatus, by, at: now, note });
      await doc.save({ session });
      await session.commitTransaction();
      session.endSession();
      return doc;
    }

    const set = {};
    const pushEntries = [{ status: newStatus, by, at: now, note }];

    if (newStatus === 'open') {
      set.opened_at = doc.opened_at || now;
      set.closed_at = null;
      set.time_to_close_ms = null;
    } else if (newStatus === 'closed') {
      set.closed_at = now;
      set.opened_at = doc.opened_at || doc.createdAt || now;
      set.time_to_close_ms = Complaint._computeTimeToClose(set.opened_at, set.closed_at);
    }

    set.status = newStatus;

    const updated = await Complaint.findByIdAndUpdate(
      complaintId,
      { $set: set, $push: { status_history: { $each: pushEntries } } },
      { new: true, session, runValidators: true }
    ).exec();

    await session.commitTransaction();
    session.endSession();
    return updated;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

/**
 * readable virtual for time_to_close
 */
ComplaintSchema.virtual('time_to_close_readable').get(function () {
  if (this.time_to_close_ms == null) return null;
  const ms = this.time_to_close_ms;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
});

ComplaintSchema.set('toObject', { virtuals: true });
ComplaintSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.models.Complaint || mongoose.model('Complaint', ComplaintSchema);
