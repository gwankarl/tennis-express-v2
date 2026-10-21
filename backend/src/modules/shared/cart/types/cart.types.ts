import type { Types } from 'mongoose';

/** A single product variant saved in a customer's cart. */
export interface CartItem {
  variantId: Types.ObjectId;
  quantity: number;
  addedAt: Date;
}

/** Persistent shopping cart belonging to one customer. */
export interface Cart {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  items: CartItem[];
  createdAt: Date;
  updatedAt: Date;
}
