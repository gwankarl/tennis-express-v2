import mongoose, { Schema } from 'mongoose';

import type { ProductViewActivityFields } from '../types/product-view-activity.types.js';

/** Stores deduplicated product views for popularity calculations. */
const productViewActivitySchema = new Schema<ProductViewActivityFields>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    visitorHash: {
      type: String,
      required: true,
    },
    viewDate: {
      type: String,
      required: true,
    },
    viewedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    identityType: {
      type: String,
      enum: ['anonymous', 'authenticated'],
      required: true,
    },
  },
  {
    versionKey: false,
  },
);

/* Allow only one recorded view per visitor, product, and UTC day. */
productViewActivitySchema.index(
  { productId: 1, visitorHash: 1, viewDate: 1 },
  { unique: true },
);

/* Support rolling-window popularity aggregation. */
productViewActivitySchema.index({ viewedAt: 1, productId: 1 });

/* Retain view activity for 31 days; MongoDB performs TTL cleanup asynchronously. */
productViewActivitySchema.index(
  { viewedAt: 1 },
  { expireAfterSeconds: 31 * 24 * 60 * 60 },
);

/** Product-view activity model. */
export const ProductViewActivityModel =
  mongoose.models.ProductViewActivity ||
  mongoose.model<ProductViewActivityFields>(
    'ProductViewActivity',
    productViewActivitySchema,
  );
