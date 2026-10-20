import type { Types } from 'mongoose';

/** A qualifying product view used for marketplace popularity ranking. */
export interface ProductViewActivityFields {
  productId: Types.ObjectId;
  visitorHash: string;
  viewDate: string;
  viewedAt: Date;
  identityType: 'anonymous' | 'authenticated';
}
