import mongoose, { Schema } from 'mongoose';

import type {
  Order,
  OrderCancellationRequest,
  OrderDeliveryAddress,
  OrderFulfilment,
  OrderFulfilmentDetails,
  OrderItemDiscount,
  OrderItemSnapshot,
} from '../types/order.types.js';

const orderItemDiscountSchema = new Schema<OrderItemDiscount>(
  {
    type: {
      type: String,
      enum: ['percentage', 'fixed_price'],
      required: true,
    },
    value: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const orderItemSchema = new Schema<OrderItemSnapshot>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductVariant',
      required: true,
    },
    productName: { type: String, required: true },
    variantName: { type: String, required: true },
    sku: { type: String, default: null },
    quantity: { type: Number, required: true, min: 1 },
    regularUnitPrice: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, min: 0 },
    discount: { type: orderItemDiscountSchema, default: null },
  },
  { _id: false },
);

const deliveryAddressSchema = new Schema<OrderDeliveryAddress>(
  {
    recipientName: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    region: { type: String, required: true },
    city: { type: String, required: true },
    address: { type: String, required: true },
  },
  { _id: false },
);

const orderFulfilmentSchema = new Schema<OrderFulfilment>(
  {
    method: {
      type: String,
      enum: ['delivery', 'collection'],
      required: true,
    },
    optionName: { type: String, required: true },
    description: { type: String, required: true },
    storeName: { type: String, required: true },
    storeLocation: {
      region: { type: String, required: true },
      city: { type: String, required: true },
      address: { type: String, required: true },
    },
    deliveryAddress: { type: deliveryAddressSchema, default: null },
  },
  { _id: false },
);

const cancellationRequestSchema = new Schema<OrderCancellationRequest>(
  {
    reason: { type: String, required: true },
    requestedBy: {
      type: String,
      enum: ['customer', 'seller'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      required: true,
    },
    requestedAt: { type: Date, required: true },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: null },
  },
  { _id: false },
);

const fulfilmentDetailsSchema = new Schema<OrderFulfilmentDetails>(
  {
    trackingNumber: { type: String, default: null },
    carrier: { type: String, default: null },
    dispatchedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    collectedAt: { type: Date, default: null },
  },
  { _id: false },
);

/** Stores one seller's portion of a confirmed customer checkout. */
const orderSchema = new Schema<Order>(
  {
    checkoutId: {
      type: Schema.Types.ObjectId,
      ref: 'CheckoutSession',
      required: true,
    },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    items: { type: [orderItemSchema], required: true },
    status: {
      type: String,
      enum: [
        'pending_payment',
        'confirmed',
        'processing',
        'ready_for_collection',
        'dispatched',
        'delivered',
        'completed',
        'cancelled',
      ],
      required: true,
      default: 'pending_payment',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'partially_refunded', 'refunded'],
      required: true,
      default: 'pending',
    },
    fulfilment: { type: orderFulfilmentSchema, required: true },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryCharge: { type: Number, required: true, min: 0 },
    processingFeeAllocation: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    cancellationRequest: { type: cancellationRequestSchema, default: null },
    fulfilmentDetails: {
      type: fulfilmentDetailsSchema,
      required: true,
      default: () => ({}),
    },
    receiptConfirmedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'orders',
  },
);

/* Ensure a checkout can create only one order for a seller/store pair. */
orderSchema.index(
  { checkoutId: 1, sellerId: 1, storeId: 1 },
  { unique: true, name: 'unique_order_per_checkout_seller_store' },
);

/* Support customer and seller order-history queries. */
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ sellerId: 1, status: 1, createdAt: -1 });

export const OrderModel =
  mongoose.models.Order ?? mongoose.model<Order>('Order', orderSchema);
