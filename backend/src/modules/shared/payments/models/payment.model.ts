import mongoose, { Schema } from 'mongoose';

import {
  DIRECT_PAYMENT_CHANNELS,
  MOCK_PAYMENT_SCENARIOS,
  PAYMENT_METHODS,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
} from '../types/payment.types.js';
import type {
  DirectPaymentDeclaration,
  Payment,
  PaymentReconciliation,
  PaymentSimulation,
  SellerOrderPaymentAllocation,
} from '../types/payment.types.js';

const sellerOrderPaymentAllocationSchema =
  new Schema<SellerOrderPaymentAllocation>(
    {
      sellerOrderId: {
        type: Schema.Types.ObjectId,
        ref: 'Order',
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
      amount: {
        type: Number,
        required: true,
        min: 1,
        validate: {
          validator: Number.isSafeInteger,
          message: 'Payment allocation must be a whole XAF amount.',
        },
      },
      refundedAmount: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
        validate: {
          validator: Number.isSafeInteger,
          message: 'Refunded amount must be a whole XAF amount.',
        },
      },
    },
    { _id: false },
  );

const directPaymentDeclarationSchema = new Schema<DirectPaymentDeclaration>(
  {
    declaredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    declaredAt: { type: Date, required: true },
    channel: {
      type: String,
      enum: DIRECT_PAYMENT_CHANNELS,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Declared amount must be a whole XAF amount.',
      },
    },
    receivedAt: { type: Date, required: true },
    reference: { type: String, default: null, trim: true },
    evidenceReference: { type: String, default: null, trim: true },
    note: { type: String, default: null, trim: true, maxlength: 1000 },
  },
  { _id: false },
);

const paymentReconciliationSchema = new Schema<PaymentReconciliation>(
  {
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    decision: {
      type: String,
      enum: ['approved', 'rejected'],
      default: null,
    },
    note: { type: String, default: null, trim: true, maxlength: 1000 },
  },
  { _id: false },
);

const paymentSimulationSchema = new Schema<PaymentSimulation>(
  {
    scenario: {
      type: String,
      enum: MOCK_PAYMENT_SCENARIOS,
      required: true,
    },
    reportedAmount: {
      type: Number,
      default: null,
      validate: {
        validator: (value: number | null) =>
          value === null || Number.isSafeInteger(value),
        message: 'Reported payment amount must be a whole number.',
      },
    },
    reportedCurrency: {
      type: String,
      default: null,
      trim: true,
    },
    scheduledAt: { type: Date, default: null },
    processedAt: { type: Date, default: null },
  },
  { _id: false },
);

/** Stores one integrated payment attempt or one direct seller-order payment. */
const paymentSchema = new Schema<Payment>(
  {
    checkoutId: {
      type: Schema.Types.ObjectId,
      ref: 'CheckoutSession',
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    method: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
    },
    provider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      default: null,
    },
    providerTransactionId: {
      type: String,
      default: null,
      trim: true,
    },
    reference: {
      type: String,
      required: true,
      trim: true,
      maxlength: 128,
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 128,
    },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      required: true,
      default: 'pending',
    },
    isSimulated: {
      type: Boolean,
      required: true,
      default: false,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Payment amount must be a whole XAF amount.',
      },
    },
    currency: {
      type: String,
      enum: ['XAF'],
      required: true,
      default: 'XAF',
    },
    sellerOrderAllocations: {
      type: [sellerOrderPaymentAllocationSchema],
      required: true,
      validate: {
        validator: (allocations: SellerOrderPaymentAllocation[]) =>
          allocations.length > 0,
        message: 'A payment must be allocated to at least one seller order.',
      },
    },
    directPaymentDeclaration: {
      type: directPaymentDeclarationSchema,
      default: null,
    },
    reconciliation: {
      type: paymentReconciliationSchema,
      required: true,
      default: () => ({}),
    },
    simulation: {
      type: paymentSimulationSchema,
      default: null,
    },
    paymentDeadlineAt: {
      type: Date,
      required: true,
    },
    confirmedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    expiredAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'payments',
  },
);

/* Keep internal references unique across payment attempts. */
paymentSchema.index(
  { reference: 1 },
  { unique: true, name: 'unique_payment_reference' },
);

/* A customer may safely retry the same request with the same key. */
paymentSchema.index(
  { customerId: 1, idempotencyKey: 1 },
  { unique: true, name: 'unique_payment_idempotency_key_per_customer' },
);

/* Provider transaction IDs are optional and unique when present. */
paymentSchema.index(
  { providerTransactionId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      providerTransactionId: { $type: 'string' },
    },
    name: 'unique_payment_provider_transaction',
  },
);

/* Support checkout history and payment-deadline processing. */
paymentSchema.index({ checkoutId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, paymentDeadlineAt: 1 });

/* Support payment lookup for seller-order reconciliation. */
paymentSchema.index({
  'sellerOrderAllocations.sellerOrderId': 1,
  status: 1,
});

/* Prevent concurrent integrated attempts while a checkout is unpaid. */
paymentSchema.index(
  { checkoutId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      method: 'integrated',
      status: {
        $in: ['pending', 'simulated_success', 'reconciliation_required'],
      },
    },
    name: 'one_active_integrated_payment_per_checkout',
  },
);

/* Keep at most one pending direct-payment declaration per seller order. */
paymentSchema.index(
  { 'sellerOrderAllocations.sellerOrderId': 1 },
  {
    unique: true,
    partialFilterExpression: {
      method: 'direct',
      status: { $in: ['pending', 'reconciliation_required'] },
    },
    name: 'one_pending_direct_payment_per_order',
  },
);

/* Find mock outcomes that are ready for processing. */
paymentSchema.index(
  {
    status: 1,
    isSimulated: 1,
    'simulation.scheduledAt': 1,
    'simulation.processedAt': 1,
  },
  { name: 'mock_payment_processing_lookup' },
);

export const PaymentModel =
  mongoose.models.Payment ?? mongoose.model<Payment>('Payment', paymentSchema);
