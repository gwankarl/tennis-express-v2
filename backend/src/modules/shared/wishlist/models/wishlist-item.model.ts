import { model, Schema, Types } from 'mongoose';

export interface WishlistItem {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const wishlistItemSchema = new Schema<WishlistItem>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/* Prevent the same product from appearing more than once
   in a customer's wishlist. */
wishlistItemSchema.index(
  { userId: 1, productId: 1 },
  {
    unique: true,
    name: 'unique_wishlist_user_product',
  },
);

export const WishlistItemModel = model<WishlistItem>(
  'WishlistItem',
  wishlistItemSchema,
);
