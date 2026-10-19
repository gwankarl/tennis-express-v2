import mongoose, { Schema } from 'mongoose';

import type { ProductFields, ProductImage } from '../types/product.types.js';

/** Mongoose schema for product gallery images. */
const productImageSchema = new Schema<ProductImage>(
  {
    publicId: {
      type: String,
      required: true,
      trim: true,
    },
    secureUrl: {
      type: String,
      required: true,
      trim: true,
    },
    altText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },
    isPrimary: {
      type: Boolean,
      required: true,
      default: false,
    },
    sortOrder: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    _id: false,
  },
);

/** Mongoose schema for marketplace products. */
const productSchema = new Schema<ProductFields>(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
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
      minlength: 2,
      maxlength: 150,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      maxlength: 180,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 10000,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    brandId: {
      type: Schema.Types.ObjectId,
      ref: 'Brand',
      default: null,
      index: true,
    },
    condition: {
      type: String,
      enum: ['new', 'used'],
      required: true,
    },
    attributes: {
      type: Schema.Types.Mixed,
      default: {},
    },
    images: {
      type: [productImageSchema],
      default: [],
      validate: {
        validator: (images: ProductImage[]) =>
          images.filter((image) => image.isPrimary).length <= 1,
        message: 'A product can have at most one primary image.',
      },
    },
    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      required: true,
      index: true,
    },
    publicationStatus: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      required: true,
      index: true,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/* Allow the same slug in different stores, but not within one store. */
productSchema.index({ storeId: 1, slug: 1 }, { unique: true });

/* Support common product discovery and seller-management queries. */
productSchema.index({
  moderationStatus: 1,
  publicationStatus: 1,
  createdAt: -1,
});

productSchema.index({ sellerId: 1, createdAt: -1 });

/** Product model, reusing the existing model during development reloads. */
export const ProductModel =
  mongoose.models.Product ||
  mongoose.model<ProductFields>('Product', productSchema);
