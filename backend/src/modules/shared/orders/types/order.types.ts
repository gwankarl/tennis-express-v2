import type { Types } from 'mongoose';

import type { FulfilmentMethod } from '../../checkout/types/checkout-session.types.js';

export type OrderStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'processing'
  | 'ready_for_collection'
  | 'dispatched'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export type OrderPaymentStatus =
  'pending' | 'paid' | 'failed' | 'partially_refunded' | 'refunded';

export interface OrderItemDiscount {
  type: 'percentage' | 'fixed_price';
  value: number;
}

export interface OrderItemSnapshot {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  productName: string;
  variantName: string;
  sku: string | null;
  quantity: number;
  regularUnitPrice: number;
  unitPrice: number;
  discountAmount: number;
  discount: OrderItemDiscount | null;
}

export interface OrderDeliveryAddress {
  recipientName: string;
  phoneNumber: string;
  region: string;
  city: string;
  address: string;
}

export interface OrderFulfilment {
  method: FulfilmentMethod;
  optionName: string;
  description: string;
  storeName: string;
  storeLocation: {
    region: string;
    city: string;
    address: string;
  };
  deliveryAddress: OrderDeliveryAddress | null;
}

export interface OrderCancellationRequest {
  reason: string;
  requestedBy: 'customer' | 'seller';
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: Date;
  resolvedAt: Date | null;
  resolutionNote: string | null;
}

export interface OrderFulfilmentDetails {
  trackingNumber: string | null;
  carrier: string | null;
  dispatchedAt: Date | null;
  deliveredAt: Date | null;
  collectedAt: Date | null;
}

export interface Order {
  _id: Types.ObjectId;
  checkoutId: Types.ObjectId;
  customerId: Types.ObjectId;
  sellerId: Types.ObjectId;
  storeId: Types.ObjectId;
  items: OrderItemSnapshot[];
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  fulfilment: OrderFulfilment;
  subtotal: number;
  deliveryCharge: number;
  processingFeeAllocation: number;
  total: number;
  cancellationRequest: OrderCancellationRequest | null;
  fulfilmentDetails: OrderFulfilmentDetails;
  receiptConfirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
