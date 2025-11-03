// server/models/Product.js  (use singular Product.js to avoid duplicates)
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ProductSchema = new Schema(
  {
    brand_name: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    category_id: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    sku: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    is_active: { type: Boolean, default: true },
    price: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ProductSchema.index({ brand_name: 1, model: 1 });
ProductSchema.index({ sku: 1 });

// Guard: if model already compiled, use it; otherwise compile it.
module.exports = mongoose.models.Product || mongoose.model('Product', ProductSchema);
