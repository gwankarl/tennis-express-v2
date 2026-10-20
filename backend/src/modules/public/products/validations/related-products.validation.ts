import { z } from 'zod';

/** Validates related-product result limits. */
export const relatedProductsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export type RelatedProductsQuery = z.infer<typeof relatedProductsQuerySchema>;
