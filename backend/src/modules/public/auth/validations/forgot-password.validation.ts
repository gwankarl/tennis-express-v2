import { z } from 'zod';

/* Accepts only the email address needed to request password recovery. */
export const forgotPasswordSchema = z
  .object({
    email: z.string().trim().email().max(254),
  })
  .strict();
