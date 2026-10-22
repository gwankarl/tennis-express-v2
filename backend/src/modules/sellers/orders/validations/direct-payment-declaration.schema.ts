import { z } from 'zod';

import { DIRECT_PAYMENT_CHANNELS } from '../../../shared/payments/types/payment.types.js';

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'A valid identifier is required.');

export const directPaymentDeclarationParamsSchema = z
  .object({
    orderId: objectIdSchema,
  })
  .strict();

export const directPaymentDeclarationSchema = z
  .object({
    channel: z.enum(DIRECT_PAYMENT_CHANNELS),
    amount: z
      .number()
      .int()
      .positive()
      .refine(Number.isSafeInteger, 'Amount must be a whole XAF amount.'),
    receivedAt: z
      .string()
      .datetime({ offset: true })
      .transform((value) => new Date(value)),
    reference: z.string().trim().min(1).max(128).nullable().optional(),
    evidenceReference: z.string().trim().min(1).max(500).nullable().optional(),
    note: z.string().trim().min(1).max(1000).nullable().optional(),
  })
  .strict();

export type DirectPaymentDeclarationInput = z.infer<
  typeof directPaymentDeclarationSchema
>;
