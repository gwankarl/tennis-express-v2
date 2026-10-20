import { z } from 'zod';

export const popularProductsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export type PopularProductsQuery = z.infer<typeof popularProductsQuerySchema>;
