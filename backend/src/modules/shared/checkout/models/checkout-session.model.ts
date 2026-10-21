import mongoose, { Schema } from 'mongoose';

import type {
  CheckoutSellerGroup,
  CheckoutSession,
  CheckoutSessionItem,
} from '../types/checkout-session.types.js';

/** Stores a price and product snapshot for one reserved checkout item. */
const checkoutItemSchema = new Schema<CheckoutSessionItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductVariant',
      required: true,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
    },
    productName: { type: String, required: true },
    variantName: { type: String, required: true },
    sku: { type: String, default: null },
    quantity: { type: Number, required: true, min: 1 },
    regularUnitPrice: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, min: 0 },
    discount: {
      type: new Schema(
        {
          type: {
            type: String,
            enum: ['percentage', 'fixed_price'],
          },
          value: { type: Number, min: 1 },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { _id: false },
);

/** Stores the fulfilment selection and totals for one seller's store. */
const sellerGroupSchema = new Schema<CheckoutSellerGroup>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
    },
    storeName: { type: String, required: true },
    fulfilmentMethod: {
      type: String,
      enum: ['delivery', 'collection'],
      required: true,
    },
    fulfilmentOptionName: { type: String, required: true },
    fulfilmentDescription: { type: String, required: true },
    deliveryFee: { type: Number, required: true, min: 0 },
    itemSubtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

/** Mongoose schema for a temporary checkout and its stock reservations. */
const checkoutSessionSchema = new Schema<CheckoutSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'completed', 'cancelled', 'invalidated'],
      required: true,
      default: 'active',
    },
    revision: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Checkout revision must be a whole number.',
      },
    },
    items: { type: [checkoutItemSchema], required: true },
    sellerGroups: { type: [sellerGroupSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, required: true, min: 0 },
    deliveryTotal: { type: Number, required: true, min: 0 },
    processingFee: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    reservationExpiresAt: { type: Date, default: null },
    orderIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Order' }],
      required: true,
      default: [],
    },
    idempotencyKey: {
      type: String,
      required: true,
      maxlength: 128,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'checkout_sessions',
  },
);

/* A customer can use an idempotency key only once. */
checkoutSessionSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    name: 'unique_checkout_idempotency_key_per_user',
  },
);

/* Support periodic lookup of active sessions whose reservations expired. */
checkoutSessionSchema.index(
  { status: 1, reservationExpiresAt: 1 },
  { name: 'active_checkout_expiry_lookup' },
);

export const CheckoutSessionModel =
  mongoose.models.CheckoutSession ??
  mongoose.model<CheckoutSession>('CheckoutSession', checkoutSessionSchema);
