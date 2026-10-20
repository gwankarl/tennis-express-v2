import type { Types } from 'mongoose';

/** Supported seller-funded discount types. */
export type VariantDiscountType = 'percentage' | 'fixed_price';

/** Availability state of a product variant. */
export type ProductVariantStatus = 'active' | 'inactive';

/** Discount configuration attached to a product variant. */
export interface VariantDiscount {
  type: VariantDiscountType;
  value: number;
  startsAt: Date | null;
  endsAt: Date | null;
}

/** Category-specific attributes describing a product variant. */
export type ProductVariantAttributes = Record<string, unknown>;

/** Fields defining a separately stored purchasable product variant. */
export interface ProductVariantFields {
  productId: Types.ObjectId;
  sellerId: Types.ObjectId;
  name: string;
  attributes: ProductVariantAttributes;
  sku: string | null;
  price: number;
  stockQuantity: number;
  reservedQuantity: number;
  status: ProductVariantStatus;
  discount: VariantDiscount | null;
}
