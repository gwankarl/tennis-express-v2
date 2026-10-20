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

/** Validates the initial purchasable variant submitted with a product. */
const initialVariantSchema = z
  .object({
    name: z.string().trim().min(1).max(120).default('Standard'),
    attributes: z.preprocess((value) => {
      if (typeof value !== 'string') {
        return value;
      }

      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }, z.record(z.string(), z.unknown()).default({})),
    sku: z.preprocess((value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const normalized = value.trim().toUpperCase();

      return normalized === '' ? null : normalized;
    }, z.string().min(1).max(100).nullable().optional()),
    price: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    stockQuantity: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    discount: z
      .preprocess(
        (value) => {
          if (value === undefined || value === '' || value === null) {
            return null;
          }

          if (typeof value !== 'string') {
            return value;
          }

          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        },
        z
          .object({
            type: z.enum(['percentage', 'fixed_price']),
            value: z.number().int().positive(),
            startsAt: z
              .string()
              .datetime({ offset: true })
              .nullable()
              .optional()
              .default(null),
            endsAt: z
              .string()
              .datetime({ offset: true })
              .nullable()
              .optional()
              .default(null),
          })
          .strict()
          .nullable(),
      )
      .optional(),
  })
  .strict()
  .superRefine((variant, context) => {
    if (
      variant.discount?.type === 'percentage' &&
      variant.discount.value >= 100
    ) {
      context.addIssue({
        code: 'custom',
        path: ['discount', 'value'],
        message: 'A percentage discount must be below 100%.',
      });
    }

    if (
      variant.discount?.type === 'fixed_price' &&
      variant.discount.value >= variant.price
    ) {
      context.addIssue({
        code: 'custom',
        path: ['discount', 'value'],
        message:
          'A fixed discounted price must be lower than the regular price.',
      });
    }

    if (
      variant.discount?.startsAt &&
      variant.discount.endsAt &&
      new Date(variant.discount.endsAt).getTime() <=
        new Date(variant.discount.startsAt).getTime()
    ) {
      context.addIssue({
        code: 'custom',
        path: ['discount', 'endsAt'],
        message: 'The discount end time must be after its start time.',
      });
    }
  });

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
    initialVariant: initialVariantSchema,
    primaryImageIndex: primaryImageIndexSchema,
  })
  .strict();

/** Inferred input type for creating a product listing. */
export type CreateProductInput = z.infer<typeof createProductSchema>;
