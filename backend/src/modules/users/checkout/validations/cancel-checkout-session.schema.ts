import { z } from 'zod';

export const cancelCheckoutSessionSchema = z
  .object({
    expectedRevision: z.number().int().positive().refine(Number.isSafeInteger, {
      message: 'Expected revision must be a safe integer.',
    }),
  })
  .strict();

export type CancelCheckoutSessionInput = z.infer<
  typeof cancelCheckoutSessionSchema
>;
