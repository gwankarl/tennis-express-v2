import { z } from 'zod';

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'A valid identifier is required.');

export const paymentStatusParamsSchema = z
  .object({
    checkoutId: objectIdSchema,
    paymentId: objectIdSchema,
  })
  .strict();
