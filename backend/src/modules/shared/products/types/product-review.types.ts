import type { Types } from 'mongoose';

/** Moderation states for product reviews. */
export type ProductReviewStatus = 'pending' | 'approved' | 'rejected';

/** Fields stored for a verified-purchaser product review. */
export interface ProductReviewFields {
  reviewerId: Types.ObjectId;
  orderId: Types.ObjectId;
  productId: Types.ObjectId;
  rating: number;
  text?: string;
  status: ProductReviewStatus;
}
