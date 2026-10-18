import mongoose, { Schema } from 'mongoose';

import { BRAND_STATUSES } from '../types/brand.types.js';

import type { Brand, BrandImage } from '../types/brand.types.js';

/* -------------------------------------------------------------------------- */
/* Brand image schema                                                         */
/* -------------------------------------------------------------------------- */

const brandImageSchema = new Schema<BrandImage>(
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
  },
  { _id: false },
);

/* -------------------------------------------------------------------------- */
/* Brand schema                                                               */
/* -------------------------------------------------------------------------- */

const brandSchema = new Schema<Brand>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: null,
      trim: true,
    },
    logo: {
      type: brandImageSchema,
      default: null,
    },
    status: {
      type: String,
      enum: BRAND_STATUSES,
      default: 'active',
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'brands',
  },
);

/* -------------------------------------------------------------------------- */
/* Indexes                                                                    */
/* -------------------------------------------------------------------------- */

/* Brand slugs must be unique across the marketplace. */
brandSchema.index(
  { slug: 1 },
  {
    unique: true,
    name: 'unique_brand_slug',
  },
);

/* Supports retrieving brands by status and name. */
brandSchema.index({ status: 1, name: 1 }, { name: 'brand_status_name' });

/* -------------------------------------------------------------------------- */
/* Model registration                                                         */
/* -------------------------------------------------------------------------- */

export const BrandModel =
  mongoose.models.Brand ?? mongoose.model<Brand>('Brand', brandSchema);
