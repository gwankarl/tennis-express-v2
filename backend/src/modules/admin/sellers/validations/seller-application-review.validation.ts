import { z } from 'zod';

/** Validates the seller application ID supplied in the route. */
export const sellerApplicationReviewParamsSchema = z
  .object({
    applicationId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid application ID.'),
  })
  .strict();

/** Validates the reason an administrator provides when rejecting an application. */
export const rejectSellerApplicationSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(10, 'The rejection reason must contain at least 10 characters.')
      .max(1000, 'The rejection reason must not exceed 1000 characters.'),
  })
  .strict();

/** Validates the seller application identifier route parameter. */
export const applicationIdParamsSchema = z
  .object({
    applicationId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid application ID.'),
  })
  .strict();
