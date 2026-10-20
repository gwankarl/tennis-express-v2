import { z } from 'zod';

/** Parses JSON text supplied through form data. */
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

/** Validates category-specific variant attributes. */
const attributesSchema = z.preprocess(
  parseJsonField,
  z.record(z.string(), z.unknown()).default({}),
);

/** Validates optional seller-funded discount configuration. */
const discountSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === '' || value === null) {
      return null;
    }

    return parseJsonField(value);
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
    .superRefine((discount, context) => {
      if (discount.type === 'percentage' && discount.value > 100) {
        context.addIssue({
          code: 'custom',
          path: ['value'],
          message: 'A percentage discount cannot exceed 100%.',
        });
      }

      if (
        discount.startsAt &&
        discount.endsAt &&
        new Date(discount.endsAt).getTime() <=
          new Date(discount.startsAt).getTime()
      ) {
        context.addIssue({
          code: 'custom',
          path: ['endsAt'],
          message: 'The discount end time must be after its start time.',
        });
      }
    })
    .nullable(),
);

/** Validates fields required to create a product variant. */
export const createProductVariantSchema = z
  .object({
    name: z.string().trim().min(1).max(120),

    attributes: attributesSchema,

    sku: z.preprocess((value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const normalized = value.trim().toUpperCase();

      return normalized === '' ? null : normalized;
    }, z.string().min(1).max(100).nullable().optional()),

    price: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),

    stockQuantity: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),

    discount: discountSchema.optional(),
  })
  .strict()
  .superRefine((variant, context) => {
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
  });

/** Validates optional fields for updating a product variant. */
export const updateProductVariantSchema = z
  .object({
    name: z.string().trim().min(1).max(120),

    attributes: attributesSchema,

    sku: z.preprocess((value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const normalized = value.trim().toUpperCase();

      return normalized === '' ? null : normalized;
    }, z.string().min(1).max(100).nullable()),

    price: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),

    stockQuantity: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),

    status: z.enum(['active', 'inactive']),

    discount: discountSchema,
  })
  .partial()
  .strict()
  .superRefine((variant, context) => {
    if (
      variant.price !== undefined &&
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
  })
  .refine((variant) => Object.keys(variant).length > 0, {
    message: 'At least one variant field must be provided.',
  });

/** Inferred input types for variant creation and updates. */
export type CreateProductVariantInput = z.infer<
  typeof createProductVariantSchema
>;

export type UpdateProductVariantInput = z.infer<
  typeof updateProductVariantSchema
>;

/** Validates requests to activate or deactivate a product variant. */
export const updateProductVariantStatusSchema = z
  .object({
    status: z.enum(['active', 'inactive']),
  })
  .strict();

export type UpdateProductVariantStatusInput = z.infer<
  typeof updateProductVariantStatusSchema
>;
