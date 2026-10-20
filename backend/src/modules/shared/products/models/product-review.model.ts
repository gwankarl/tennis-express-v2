import mongoose, { Schema } from 'mongoose';

import type { ProductReviewFields } from '../types/product-review.types.js';

/** Mongoose schema for verified-purchaser product reviews. */
const productReviewSchema = new Schema<ProductReviewFields>(
  {
    reviewerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be an integer between 1 and 5.',
      },
    },
    text: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      required: true,
      index: true,
    },
  },
  { timestamps: true, versionKey: false },
);

/* Prevent the same customer from reviewing the same product
   more than once for the same order. */
productReviewSchema.index(
  { reviewerId: 1, orderId: 1, productId: 1 },
  { unique: true },
);

/* Support product-rating summaries and approved-review queries. */
productReviewSchema.index({
  productId: 1,
  status: 1,
  createdAt: -1,
});

export const ProductReviewModel =
  mongoose.models.ProductReview ||
  mongoose.model<ProductReviewFields>('ProductReview', productReviewSchema);
