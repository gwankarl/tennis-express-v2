import { z } from 'zod';

import { PAYMENT_PROVIDERS } from '../../../shared/payments/types/payment.types.js';

/** Validates the provider selected for an integrated checkout payment. */
export const createIntegratedPaymentSchema = z
  .object({
    provider: z.enum(PAYMENT_PROVIDERS),
  })
  .strict();

export type CreateIntegratedPaymentInput = z.infer<
  typeof createIntegratedPaymentSchema
>;
