import type { Types } from 'mongoose';

/* -------------------------------------------------------------------------- */
/* Category constants                                                         */
/* -------------------------------------------------------------------------- */

export const CATEGORY_STATUSES = ['active', 'inactive'] as const;

export type CategoryStatus = (typeof CATEGORY_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/* Category attribute constants                                               */
/* -------------------------------------------------------------------------- */

export const CATEGORY_ATTRIBUTE_TYPES = [
  'text',
  'number',
  'boolean',
  'select',
] as const;

export type CategoryAttributeType = (typeof CATEGORY_ATTRIBUTE_TYPES)[number];

/* -------------------------------------------------------------------------- */
/* Category attribute definition                                              */
/* -------------------------------------------------------------------------- */

export interface CategoryAttribute {
  name: string;
  slug: string;
  type: CategoryAttributeType;
  required: boolean;
  options: string[];
}

/* -------------------------------------------------------------------------- */
/* Category document                                                          */
/* -------------------------------------------------------------------------- */

export interface Category {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  parentId: Types.ObjectId | null;
  description?: string | null;
  attributes: CategoryAttribute[];
  status: CategoryStatus;
  sortOrder: number;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
