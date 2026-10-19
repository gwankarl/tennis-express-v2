import { z } from 'zod';

/** Validates MongoDB ObjectId strings supplied in listing requests. */
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'A valid ObjectId is required.');

/** Parses JSON text submitted through multipart form data. */
const attributesSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}, z.record(z.string(), z.unknown()).default({}));

/** Accepts an optional image index supplied as a multipart form string. */
const primaryImageIndexSchema = z.preprocess((value) => {
  if (value === undefined || value === '') {
    return undefined;
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }

  return value;
}, z.number().int().min(0).optional());

/** Validates the product fields submitted during listing creation. */
export const createProductSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(180)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    description: z.string().trim().min(10).max(10000),
    categoryId: objectIdSchema,
    brandId: z.preprocess(
      (value) => (value === '' ? undefined : value),
      objectIdSchema.nullable().optional(),
    ),
    condition: z.enum(['new', 'used']),
    attributes: attributesSchema,
    primaryImageIndex: primaryImageIndexSchema,
  })
  .strict();

/** Inferred input type for creating a product listing. */
export type CreateProductInput = z.infer<typeof createProductSchema>;
