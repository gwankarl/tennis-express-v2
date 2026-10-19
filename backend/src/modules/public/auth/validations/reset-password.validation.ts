import { z } from 'zod';

const countUnicodeCodePoints = (value: string): number =>
  Array.from(value).length;

export const resetPasswordSchema = z
  .object({
    token: z
      .string()
      .regex(/^[a-f\d]{64}$/i, 'Invalid or expired reset token.'),
    password: z
      .string()
      .refine(
        (value) => countUnicodeCodePoints(value) >= 12,
        'Password must contain at least 12 characters.',
      )
      .refine(
        (value) => countUnicodeCodePoints(value) <= 128,
        'Password must not exceed 128 characters.',
      ),
  })
  .strict();
