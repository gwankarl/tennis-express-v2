import { z } from 'zod';

export const googleAuthSchema = z
  .object({
    idToken: z.string().trim().min(1, 'Google ID token is required.'),
  })
  .strict();
