import type { Types } from 'mongoose';

/** Allowed product conditions. */
export type ProductCondition = 'new' | 'used';

/** Product moderation states managed by the platform. */
export type ProductModerationStatus = 'pending' | 'approved' | 'rejected';

/** Product publication lifecycle states. */
export type ProductPublicationStatus = 'draft' | 'published' | 'archived';

/** Category-specific product specifications. */
export type ProductAttributes = Record<string, unknown>;

/** Image reference stored in a product's gallery. */
export interface ProductImage {
  publicId: string;
  secureUrl: string;
  altText: string;
  isPrimary: boolean;
  sortOrder: number;
}

/** Fields defining a product record. */
export interface ProductFields {
  storeId: Types.ObjectId;
  sellerId: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  categoryId: Types.ObjectId;
  brandId: Types.ObjectId | null;
  condition: ProductCondition;
  attributes: ProductAttributes;
  images: ProductImage[];
  moderationStatus: ProductModerationStatus;
  publicationStatus: ProductPublicationStatus;
  publishedAt: Date | null;
  submittedAt: Date | null;
}
