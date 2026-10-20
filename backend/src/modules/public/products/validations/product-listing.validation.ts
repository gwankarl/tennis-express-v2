import { z } from 'zod';

const positiveIntegerString = (message: string) =>
  z.string().regex(/^[1-9]\d*$/, message);

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Must be a valid ID.');

const attributeFiltersSchema = z
  .record(
    z
      .string()
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Attribute keys must be valid slugs.',
      ),
    z.string().trim().min(1).max(100),
  )
  .optional()
  .default({});

/** Validates filters, sorting, and pagination for public product listings. */
export const productListingQuerySchema = z
  .object({
    page: positiveIntegerString('Page must be a positive integer.')
      .optional()
      .default('1'),

    limit: positiveIntegerString('Limit must be a positive integer.')
      .optional()
      .default('20'),

    categoryId: objectIdSchema.optional(),
    brandId: objectIdSchema.optional(),
    sellerId: objectIdSchema.optional(),
    storeId: objectIdSchema.optional(),

    search: z.string().trim().min(1).max(100).optional(),

    condition: z.enum(['new', 'used']).optional(),

    minPrice: z
      .string()
      .regex(/^\d+(?:\.\d{1,2})?$/, 'Minimum price must be a valid amount.')
      .optional(),

    maxPrice: z
      .string()
      .regex(/^\d+(?:\.\d{1,2})?$/, 'Maximum price must be a valid amount.')
      .optional(),

    inStock: z.enum(['true', 'false']).optional().default('false'),

    minRating: z.enum(['4']).optional(),

    sort: z
      .enum(['newest', 'priceAsc', 'priceDesc', 'rating'])
      .optional()
      .default('newest'),

    attributes: attributeFiltersSchema,
  })
  .strict()
  .transform(
    ({
      page,
      limit,
      minPrice,
      maxPrice,
      inStock,
      minRating,
      attributes,
      ...filters
    }) => ({
      ...filters,
      page: Number(page),
      limit: Number(limit),
      minPrice: minPrice === undefined ? undefined : Number(minPrice),
      maxPrice: maxPrice === undefined ? undefined : Number(maxPrice),
      inStock: inStock === 'true',
      minRating: minRating === undefined ? undefined : Number(minRating),
      attributes,
    }),
  )
  .refine(({ page }) => Number.isSafeInteger(page), {
    path: ['page'],
    message: 'Page must be a safe integer.',
  })
  .refine(({ limit }) => Number.isSafeInteger(limit) && limit <= 100, {
    path: ['limit'],
    message: 'Limit must be between 1 and 100.',
  })
  .refine(
    ({ minPrice, maxPrice }) =>
      minPrice === undefined || maxPrice === undefined || minPrice <= maxPrice,
    {
      path: ['maxPrice'],
      message: 'Maximum price must be greater than or equal to minimum price.',
    },
  )
  .refine(
    ({ minPrice, maxPrice }) =>
      [minPrice, maxPrice].every(
        (price) => price === undefined || Number.isFinite(price),
      ),
    {
      path: ['minPrice'],
      message: 'Price must be a finite number.',
    },
  );

export type ProductListingQuery = z.infer<typeof productListingQuerySchema>;
