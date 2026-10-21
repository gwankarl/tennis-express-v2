import { z } from 'zod';

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'A valid identifier is required.');

export const createCheckoutSessionSchema = z
  .object({
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

export type CreateCheckoutSessionInput = z.infer<
  typeof createCheckoutSessionSchema
>;
