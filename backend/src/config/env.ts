import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),

    PORT: z.coerce.number().int().min(1).max(65535).default(5000),

    MONGODB_URI: z
      .string()
      .min(1, 'MONGODB_URI is required')
      .refine(
        (value) => /^mongodb(\+srv)?:\/\//.test(value),
        'MONGODB_URI must be a MongoDB connection URI',
      ),

    CLIENT_URL: z.string().url('CLIENT_URL must be a valid URL'),

    EMAIL_PROVIDER: z.enum(['mock', 'resend']).default('mock'),

    EMAIL_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),

    RESEND_API_KEY: z.string().default(''),

    EMAIL_FROM: z.string().default(''),

    EMAIL_REPLY_TO: z.string().default(''),
  })
  .superRefine((config, context) => {
    if (
      config.NODE_ENV === 'test' &&
      /\/tennis_xpress_v2(?:\?|$)/.test(config.MONGODB_URI)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['MONGODB_URI'],
        message: 'Tests must use a dedicated test database',
      });
    }
  });

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues
    .map(
      (issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`,
    )
    .join('\n');

  throw new Error(`Invalid backend environment configuration:\n${details}`);
}

export const env = Object.freeze({
  nodeEnv: result.data.NODE_ENV,
  port: result.data.PORT,
  mongodbUri: result.data.MONGODB_URI,
  clientUrl: result.data.CLIENT_URL,
  emailProvider: result.data.EMAIL_PROVIDER,
  emailEnabled: result.data.EMAIL_ENABLED,
  resendApiKey: result.data.RESEND_API_KEY,
  emailFrom: result.data.EMAIL_FROM,
  emailReplyTo: result.data.EMAIL_REPLY_TO,
});
