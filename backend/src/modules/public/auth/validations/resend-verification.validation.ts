import { z } from 'zod';

/**
 * Validates requests to resend an email-verification link.
 *
 * Strict validation prevents unexpected fields from being accepted.
 */
export const resendVerificationSchema = z
  .object({
    email: z.string().trim().email().max(254),
  })
  .strict();
