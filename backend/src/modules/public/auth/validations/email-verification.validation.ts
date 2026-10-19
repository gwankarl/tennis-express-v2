import { z } from 'zod';

/** Validates the raw hexadecimal token generated during registration. */
export const emailVerificationSchema = z
  .object({
    token: z
      .string()
      .regex(/^[a-f0-9]{64}$/, 'A valid verification token is required.'),
  })
  .strict();
