import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* Product update validation                                                  */
/* -------------------------------------------------------------------------- */

/** Validates MongoDB ObjectId strings supplied in update requests. */
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'A valid ObjectId is required.');

/** Parses JSON text submitted through multipart form data. */
function parseJsonField(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** Validates category-specific product attributes. */
const attributesSchema = z.preprocess(
  parseJsonField,
  z.record(z.string(), z.unknown()),
);

/** Validates image IDs selected for removal. */
const removeImagePublicIdsSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === '') {
      return [];
    }

    return parseJsonField(value);
  },
  z.array(z.string().trim().min(1)).default([]),
);

/** Parses an optional primary-image index from multipart form data. */
const primaryImageIndexSchema = z.preprocess((value) => {
  if (value === undefined || value === '') {
    return undefined;
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }

  return value;
}, z.number().int().min(0).optional());

/** Validates editable product fields and image-management instructions. */
export const updateProductSchema = z
  .object({
    name: z.string().trim().min(2).max(150),

    slug: z
      .string()
      .trim()
      .min(1)
      .max(180)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),

    description: z.string().trim().min(10).max(10000),

    categoryId: objectIdSchema,

    brandId: z.preprocess(
      (value) => (value === '' ? null : value),
      objectIdSchema.nullable(),
    ),

    condition: z.enum(['new', 'used']),

    attributes: attributesSchema,

    removeImagePublicIds: removeImagePublicIdsSchema,

    primaryImageIndex: primaryImageIndexSchema,
  })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message:
      'At least one product field or image-management instruction is required.',
  });

/** Inferred input type for updating a product listing. */
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
