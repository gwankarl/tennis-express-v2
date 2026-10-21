import { z } from 'zod';

export const confirmCheckoutSessionSchema = z
  .object({
    expectedRevision: z.number().int().positive().refine(Number.isSafeInteger, {
      message: 'Expected revision must be a safe integer.',
    }),
  })
  .strict();

export type ConfirmCheckoutSessionInput = z.infer<
  typeof confirmCheckoutSessionSchema
>;
