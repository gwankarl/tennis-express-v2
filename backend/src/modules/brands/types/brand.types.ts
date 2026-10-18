import type { Types } from 'mongoose';

/* -------------------------------------------------------------------------- */
/* Brand constants                                                            */
/* -------------------------------------------------------------------------- */

export const BRAND_STATUSES = ['active', 'inactive'] as const;

export type BrandStatus = (typeof BRAND_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/* Brand image reference                                                      */
/* -------------------------------------------------------------------------- */

export interface BrandImage {
  publicId: string;
  secureUrl: string;
}

/* -------------------------------------------------------------------------- */
/* Brand document                                                             */
/* -------------------------------------------------------------------------- */

export interface Brand {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string | null;
  logo: BrandImage | null;
  status: BrandStatus;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
