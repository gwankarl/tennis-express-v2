import { z } from 'zod';

export const cartItemParamsSchema = z.object({
  variantId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'A valid variant identifier is required.'),
});

export const updateCartItemQuantitySchema = z.object({
  quantity: z
    .number()
    .int('Quantity must be a whole number.')
    .positive('Quantity must be greater than zero.')
    .refine(Number.isSafeInteger, {
      message: 'Quantity must be a safe integer.',
    }),
});

export type UpdateCartItemQuantityInput = z.infer<
  typeof updateCartItemQuantitySchema
>;
