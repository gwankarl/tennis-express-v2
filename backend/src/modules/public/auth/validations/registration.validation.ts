import { z } from 'zod';

/**
 * Counts Unicode code points rather than UTF-16 code units.
 * This keeps password length checks aligned with the registration policy.
 */
const countUnicodeCodePoints = (value: string): number =>
  Array.from(value).length;

/**
 * Validates and normalizes the public registration request.
 *
 * Names and email addresses are trimmed, email addresses are lowercased,
 * and passwords are checked for length without being modified.
 * Unknown request properties are rejected.
 */
export const registrationSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, 'First name is required.')
      .max(50, 'First name must not exceed 50 characters.'),

    lastName: z
      .string()
      .trim()
      .min(1, 'Last name is required.')
      .max(50, 'Last name must not exceed 50 characters.'),

    email: z
      .string()
      .trim()
      .email('Enter a valid email address.')
      .transform((value) => value.toLowerCase()),

    password: z
      .string()
      .refine(
        (value) => countUnicodeCodePoints(value) >= 12,
        'Password must contain at least 12 characters.',
      )
      .refine(
        (value) => countUnicodeCodePoints(value) <= 128,
        'Password must not exceed 128 characters.',
      ),
  })
  .strict();

/** Type of the validated registration request after schema transformations. */
export type RegistrationRequest = z.infer<typeof registrationSchema>;
