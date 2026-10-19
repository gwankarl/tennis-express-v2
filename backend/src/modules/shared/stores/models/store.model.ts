import { model, Schema } from 'mongoose';

import { STORE_STATUSES } from '../types/store.types.js';
import type {
  Store,
  StoreCollectionOption,
  StoreDeliveryOption,
  StoreLocation,
  StoreLogo,
  StoreRatingSummary,
  StoreReturnPolicy,
} from '../types/store.types.js';

const storeLocationSchema = new Schema<StoreLocation>(
  {
    region: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

const storeLogoSchema = new Schema<StoreLogo>(
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

const storeDeliveryOptionSchema = new Schema<StoreDeliveryOption>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    fee: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const storeCollectionOptionSchema = new Schema<StoreCollectionOption>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    fee: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const storeReturnPolicySchema = new Schema<StoreReturnPolicy>(
  {
    summary: {
      type: String,
      required: true,
      trim: true,
    },
    returnWindowDays: {
      type: Number,
      required: true,
      min: 0,
    },
    conditions: {
      type: [String],
      required: true,
      default: [],
    },
  },
  { _id: false },
);

const storeRatingSummarySchema = new Schema<StoreRatingSummary>(
  {
    averageRating: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

const storeSchema = new Schema<Store>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    location: {
      type: storeLocationSchema,
      required: true,
    },
    logo: {
      type: storeLogoSchema,
      default: null,
    },
    status: {
      type: String,
      enum: STORE_STATUSES,
      required: true,
      default: 'paused',
    },
    deliveryOptions: {
      type: [storeDeliveryOptionSchema],
      required: true,
      default: [],
    },
    collectionOptions: {
      type: [storeCollectionOptionSchema],
      required: true,
      default: [],
    },
    returnPolicy: {
      type: storeReturnPolicySchema,
      default: null,
    },
    ratingSummary: {
      type: storeRatingSummarySchema,
      required: true,
      default: () => ({
        averageRating: 0,
        totalReviews: 0,
      }),
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/* A seller can own only one storefront. */
storeSchema.index(
  { sellerId: 1 },
  { unique: true, name: 'unique_store_per_seller' },
);

/* Storefront URLs must be unique across the marketplace. */
storeSchema.index({ slug: 1 }, { unique: true, name: 'unique_store_slug' });

export const StoreModel = model<Store>('Store', storeSchema);
