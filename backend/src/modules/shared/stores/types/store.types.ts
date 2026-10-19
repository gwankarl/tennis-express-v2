import type { Types } from 'mongoose';

export const STORE_STATUSES = ['active', 'paused'] as const;

export type StoreStatus = (typeof STORE_STATUSES)[number];

export interface StoreLocation {
  region: string;
  city: string;
  address: string;
}

export interface StoreLogo {
  publicId: string;
  secureUrl: string;
}

export interface StoreDeliveryOption {
  name: string;
  description: string;
  fee: number;
}

export interface StoreCollectionOption {
  name: string;
  description: string;
  fee: number;
}

export interface StoreReturnPolicy {
  summary: string;
  returnWindowDays: number;
  conditions: string[];
}

export interface StoreRatingSummary {
  averageRating: number;
  totalReviews: number;
}

export interface Store {
  _id: Types.ObjectId;
  sellerId: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  location: StoreLocation;
  logo: StoreLogo | null;
  status: StoreStatus;
  deliveryOptions: StoreDeliveryOption[];
  collectionOptions: StoreCollectionOption[];
  returnPolicy: StoreReturnPolicy | null;
  ratingSummary: StoreRatingSummary;
  createdAt: Date;
  updatedAt: Date;
}
