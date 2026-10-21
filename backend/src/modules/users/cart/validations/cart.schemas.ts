import { z } from 'zod';

export const addCartItemSchema = z.object({
  variantId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'A valid variant identifier is required.'),

  quantity: z
    .number()
    .int('Quantity must be a whole number.')
    .positive('Quantity must be greater than zero.')
    .refine(Number.isSafeInteger, {
      message: 'Quantity must be a safe integer.',
    }),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
