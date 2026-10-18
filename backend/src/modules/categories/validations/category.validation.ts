import { z } from 'zod';

import {
  CATEGORY_ATTRIBUTE_TYPES,
  CATEGORY_STATUSES,
} from '../types/category.types.js';

/* -------------------------------------------------------------------------- */
/* Reusable validation schemas                                                */
/* -------------------------------------------------------------------------- */

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid MongoDB ObjectId.');

const categoryAttributeSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Attribute slugs must contain lowercase letters, numbers, and single hyphens.',
      ),
    type: z.enum(CATEGORY_ATTRIBUTE_TYPES),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(100)).default([]),
  })
  .superRefine((attribute, context) => {
    if (attribute.type === 'select' && attribute.options.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Select attributes must have at least one option.',
      });
    }

    if (attribute.type !== 'select' && attribute.options.length > 0) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Only select attributes can define options.',
      });
    }
  });

const categoryFieldsSchema = {
  name: z.string().trim().min(1).max(120),
  parentId: objectIdSchema.nullable(),
  description: z.string().trim().max(2000).nullable(),
  attributes: z.array(categoryAttributeSchema).max(50),
  status: z.enum(CATEGORY_STATUSES),
  sortOrder: z.number().int().min(0).max(1_000_000),
};

/* -------------------------------------------------------------------------- */
/* Create category validation                                                 */
/* -------------------------------------------------------------------------- */

export const createCategorySchema = z
  .object({
    name: categoryFieldsSchema.name,
    parentId: categoryFieldsSchema.parentId.optional(),
    description: categoryFieldsSchema.description.optional(),
    attributes: categoryFieldsSchema.attributes.optional(),
    status: categoryFieldsSchema.status.optional(),
    sortOrder: categoryFieldsSchema.sortOrder.optional(),
  })
  .strict();

export type CreateCategoryRequest = z.infer<typeof createCategorySchema>;

/* -------------------------------------------------------------------------- */
/* Update category validation                                                 */
/* -------------------------------------------------------------------------- */

export const updateCategoryParamsSchema = z
  .object({
    categoryId: objectIdSchema,
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: categoryFieldsSchema.name.optional(),
    parentId: categoryFieldsSchema.parentId.optional(),
    description: categoryFieldsSchema.description.optional(),
    attributes: categoryFieldsSchema.attributes.optional(),
    status: categoryFieldsSchema.status.optional(),
    sortOrder: categoryFieldsSchema.sortOrder.optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    'At least one category field must be provided.',
  );

export type UpdateCategoryRequest = z.infer<typeof updateCategorySchema>;

export type UpdateCategoryParams = z.infer<typeof updateCategoryParamsSchema>;
