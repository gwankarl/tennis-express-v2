import { z } from 'zod';

/** Validates search, location filters, and pagination for the public store directory. */
export const storeDirectoryQuerySchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  region: z.string().trim().min(1).max(100).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type StoreDirectoryQuery = z.infer<typeof storeDirectoryQuerySchema>;
