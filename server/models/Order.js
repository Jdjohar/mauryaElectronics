const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema(
  {
    order_no: { type: String, trim: true, default: '' },
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', default: null },
    customer_name: { type: String, default: '' },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
        description: { type: String, default: '' },
        qty: { type: Number, default: 1 },
        price: { type: Number, default: 0 },
      },
    ],
    total_amount: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', OrderSchema);
