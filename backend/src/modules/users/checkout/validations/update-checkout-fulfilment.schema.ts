import { z } from 'zod';

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'A valid store identifier is required.');

export const updateCheckoutFulfilmentSchema = z
  .object({
    expectedRevision: z.number().int().positive().refine(Number.isSafeInteger, {
      message: 'Expected revision must be a safe integer.',
    }),
    sellerGroups: z
      .array(
        z
          .object({
            storeId: objectIdSchema,
            fulfilmentMethod: z.enum(['delivery', 'collection']),
            fulfilmentOptionName: z.string().trim().min(1).max(120),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export type UpdateCheckoutFulfilmentInput = z.infer<
  typeof updateCheckoutFulfilmentSchema
>;
