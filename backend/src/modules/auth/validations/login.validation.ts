import { z } from 'zod';

/**
 * Validates login credentials.
 *
 * Strict validation rejects unexpected fields while preserving the
 * supplied password exactly as entered.
 */
export const loginSchema = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(128),
  })
  .strict();
