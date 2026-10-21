import type { Types } from 'mongoose';

export type InventoryReservationStatus =
  'active' | 'committed' | 'released' | 'expired';

export interface InventoryReservation {
  _id: Types.ObjectId;
  checkoutId: Types.ObjectId;
  userId: Types.ObjectId;
  variantId: Types.ObjectId;
  quantity: number;
  status: InventoryReservationStatus;
  expiresAt: Date;
  releasedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
