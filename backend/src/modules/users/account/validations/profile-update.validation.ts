import { z } from 'zod';

/**
 * Validates and normalizes profile updates.
 *
 * Every field is optional so clients can update only the information
 * they intend to change. Unknown properties are rejected.
 */
export const profileUpdateSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, 'First name must not be empty.')
      .max(50, 'First name must not exceed 50 characters.')
      .optional(),

    lastName: z
      .string()
      .trim()
      .min(1, 'Last name must not be empty.')
      .max(50, 'Last name must not exceed 50 characters.')
      .optional(),

    contactDetails: z
      .object({
        phoneNumber: z
          .string()
          .trim()
          .min(1, 'Phone number must not be empty.')
          .max(25, 'Phone number must not exceed 25 characters.')
          .optional(),

        preferredContactMethod: z.enum(['email', 'phone']).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.firstName !== undefined ||
      value.lastName !== undefined ||
      value.contactDetails !== undefined,
    {
      message: 'At least one profile field must be provided.',
    },
  );

/** Type of the validated profile-update request. */
export type ProfileUpdateRequest = z.infer<typeof profileUpdateSchema>;
