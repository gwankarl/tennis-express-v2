import { z } from 'zod';

export const checkoutSessionParamsSchema = z.object({
  checkoutId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'A valid checkout identifier is required.'),
});
