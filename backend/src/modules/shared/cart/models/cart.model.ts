import mongoose, { Schema } from 'mongoose';

import type { Cart, CartItem } from '../types/cart.types.js';

/* -------------------------------------------------------------------------- */
/* Cart item schema                                                           */
/* -------------------------------------------------------------------------- */

const cartItemSchema = new Schema<CartItem>(
  {
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
        message: 'Cart item quantity must be a whole number.',
      },
    },

    addedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    _id: false,
  },
);

/* -------------------------------------------------------------------------- */
/* Cart schema                                                                */
/* -------------------------------------------------------------------------- */

const cartSchema = new Schema<Cart>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    items: {
      type: [cartItemSchema],
      default: [],
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'carts',
  },
);

/* Enforce one persistent cart per customer. */
cartSchema.index(
  { userId: 1 },
  {
    unique: true,
    name: 'unique_cart_per_user',
  },
);

/* Support lookups of carts containing a particular variant. */
cartSchema.index(
  { 'items.variantId': 1 },
  {
    name: 'cart_variant_lookup',
  },
);

/* -------------------------------------------------------------------------- */
/* Model registration                                                         */
/* -------------------------------------------------------------------------- */

export const CartModel =
  mongoose.models.Cart ?? mongoose.model<Cart>('Cart', cartSchema);
