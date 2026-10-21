import type { Types } from 'mongoose';

export type FulfilmentMethod = 'delivery' | 'collection';

export type CheckoutSessionStatus =
  'active' | 'expired' | 'completed' | 'cancelled' | 'invalidated';

export interface CheckoutSessionItem {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  sellerId: Types.ObjectId;
  storeId: Types.ObjectId;
  productName: string;
  variantName: string;
  sku: string | null;
  quantity: number;
  regularUnitPrice: number;
  unitPrice: number;
  discountAmount: number;
  discount: {
    type: 'percentage' | 'fixed_price';
    value: number;
  } | null;
}

export interface CheckoutSellerGroup {
  sellerId: Types.ObjectId;
  storeId: Types.ObjectId;
  storeName: string;
  fulfilmentMethod: FulfilmentMethod;
  fulfilmentOptionName: string;
  fulfilmentDescription: string;
  deliveryFee: number;
  itemSubtotal: number;
  discountTotal: number;
}

export interface CheckoutSession {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  status: CheckoutSessionStatus;
  items: CheckoutSessionItem[];
  sellerGroups: CheckoutSellerGroup[];
  subtotal: number;
  discountTotal: number;
  deliveryTotal: number;
  processingFee: number;
  revision: number;
  total: number;
  reservationExpiresAt: Date | null;
  orderIds: Types.ObjectId[];
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}
