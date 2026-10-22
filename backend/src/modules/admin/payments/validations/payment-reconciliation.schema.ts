import { z } from 'zod';

export const paymentReconciliationParamsSchema = z
  .object({
    paymentId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, 'A valid payment identifier is required.'),
  })
  .strict();

export const paymentReconciliationDecisionSchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    note: z.string().trim().min(1).max(1000).nullable().optional(),
  })
  .strict();

export type PaymentReconciliationDecisionInput = z.infer<
  typeof paymentReconciliationDecisionSchema
>;
