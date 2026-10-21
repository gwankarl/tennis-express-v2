import mongoose, { Schema } from 'mongoose';

import type { InventoryReservation } from '../types/inventory-reservation.types.js';

/** Mongoose schema for a temporary reservation against a product variant. */
const inventoryReservationSchema = new Schema<InventoryReservation>(
  {
    checkoutId: {
      type: Schema.Types.ObjectId,
      ref: 'CheckoutSession',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductVariant',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Reservation quantity must be a whole number.',
      },
    },
    status: {
      type: String,
      enum: ['active', 'committed', 'released', 'expired'],
      required: true,
      default: 'active',
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    releasedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'inventory_reservations',
  },
);

/* Keep at most one reservation per variant in each checkout. */
inventoryReservationSchema.index(
  { checkoutId: 1, variantId: 1 },
  {
    unique: true,
    name: 'unique_reservation_per_checkout_variant',
  },
);

/* Find expired active reservations for the periodic cleanup. */
inventoryReservationSchema.index(
  { status: 1, expiresAt: 1 },
  { name: 'active_reservation_expiry_lookup' },
);

/* Support user reservation history and checkout lookups. */
inventoryReservationSchema.index(
  { userId: 1, status: 1, createdAt: -1 },
  { name: 'user_reservation_history' },
);

export const InventoryReservationModel =
  mongoose.models.InventoryReservation ??
  mongoose.model<InventoryReservation>(
    'InventoryReservation',
    inventoryReservationSchema,
  );
