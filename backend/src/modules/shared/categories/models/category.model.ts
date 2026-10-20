import mongoose, { Schema } from 'mongoose';

import {
  CATEGORY_ATTRIBUTE_TYPES,
  CATEGORY_STATUSES,
} from '../types/category.types.js';

import type { Category, CategoryAttribute } from '../types/category.types.js';

/* -------------------------------------------------------------------------- */
/* Category attribute schema                                                  */
/* -------------------------------------------------------------------------- */

const categoryAttributeSchema = new Schema<CategoryAttribute>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    type: {
      type: String,
      enum: CATEGORY_ATTRIBUTE_TYPES,
      required: true,
    },
    required: {
      type: Boolean,
      default: false,
      required: true,
    },
    filterable: {
      type: Boolean,
      default: false,
      required: true,
    },
    options: {
      type: [String],
      default: [],
      validate: {
        validator: (value: string[]) =>
          value.every((option) => option.trim().length > 0),
        message: 'Attribute options cannot contain empty values.',
      },
    },
  },
  { _id: false },
);

categoryAttributeSchema.pre('validate', function () {
  if (this.type === 'select' && this.options.length === 0) {
    this.invalidate(
      'options',
      'Select attributes must have at least one option.',
    );
  }

  if (this.type !== 'select' && this.options.length > 0) {
    this.invalidate('options', 'Only select attributes can define options.');
  }
});

/* -------------------------------------------------------------------------- */
/* Category schema                                                            */
/* -------------------------------------------------------------------------- */

const categorySchema = new Schema<Category>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    description: {
      type: String,
      default: null,
      trim: true,
    },
    attributes: {
      type: [categoryAttributeSchema],
      default: [],
    },
    status: {
      type: String,
      enum: CATEGORY_STATUSES,
      default: 'active',
      required: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'categories',
  },
);

/* -------------------------------------------------------------------------- */
/* Indexes                                                                    */
/* -------------------------------------------------------------------------- */

/* Category slugs must be unique across the marketplace. */
categorySchema.index(
  { slug: 1 },
  {
    unique: true,
    name: 'unique_category_slug',
  },
);

/* Supports retrieving the direct children of a category in display order. */
categorySchema.index(
  { parentId: 1, sortOrder: 1, name: 1 },
  { name: 'category_children_display_order' },
);

/* Supports filtering active categories and ordering them for navigation. */
categorySchema.index(
  { status: 1, parentId: 1, sortOrder: 1 },
  { name: 'category_status_hierarchy_order' },
);

/* -------------------------------------------------------------------------- */
/* Model registration                                                         */
/* -------------------------------------------------------------------------- */

export const CategoryModel =
  mongoose.models.Category ??
  mongoose.model<Category>('Category', categorySchema);
