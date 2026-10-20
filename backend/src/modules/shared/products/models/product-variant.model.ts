import mongoose, { Schema } from 'mongoose';

import type {
  ProductVariantFields,
  VariantDiscount,
} from '../types/product-variant.types.js';

/** Mongoose schema for seller-funded variant discounts. */
const variantDiscountSchema = new Schema<VariantDiscount>(
  {
    type: {
      type: String,
      enum: ['percentage', 'fixed_price'],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Discount value must be a whole number.',
      },
    },
    startsAt: {
      type: Date,
      default: null,
    },
    endsAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  },
);

/** Mongoose schema for separately stored product variants. */
const productVariantSchema = new Schema<ProductVariantFields>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    attributes: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    price: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Price must be a whole XAF amount.',
      },
    },
    stockQuantity: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Stock quantity must be a whole number.',
      },
    },
    reservedQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Reserved quantity must be a whole number.',
      },
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      required: true,
      default: 'active',
    },
    discount: {
      type: variantDiscountSchema,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/* Enforce SKU uniqueness per seller when a SKU is provided. */
productVariantSchema.index(
  { sellerId: 1, sku: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sku: { $type: 'string' },
    },
  },
);

/* Support variant retrieval by product and availability status. */
productVariantSchema.index({ productId: 1, status: 1 });

/** Variant model, reusing the existing model during development reloads. */
export const ProductVariantModel =
  mongoose.models.ProductVariant ||
  mongoose.model<ProductVariantFields>('ProductVariant', productVariantSchema);
