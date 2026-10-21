import { z } from 'zod';

export const revalidateCheckoutSessionSchema = z
  .object({
    expectedRevision: z.number().int().positive().refine(Number.isSafeInteger, {
      message: 'Expected revision must be a safe integer.',
    }),
  })
  .strict();

export type RevalidateCheckoutSessionInput = z.infer<
  typeof revalidateCheckoutSessionSchema
>;
