import type { EmailProvider } from '../types/email.types.js';
import { MockEmailProvider } from './mock-email.provider.js';
import { ResendEmailProvider } from './resend-email.provider.js';

/**
 * Configuration used to select and initialize an email provider.
 */
export interface EmailProviderConfig {
  /** Provider implementation to use for email delivery. */
  provider: 'mock' | 'resend';

  /** API key required by the Resend provider. */
  resendApiKey?: string;

  /** Sender address used for outgoing emails. */
  from?: string;

  /** Optional address that receives replies to outgoing emails. */
  replyTo?: string;
}

/**
 * Creates the email provider selected by the application configuration.
 *
 * The mock provider supports development and testing without external
 * email delivery. The Resend provider handles delivery through Resend's API.
 *
 * @param config - Provider selection and provider-specific settings.
 * @returns An implementation of the EmailProvider contract.
 * @throws Error if the configured provider is unsupported.
 */
export function createEmailProvider(
  config: EmailProviderConfig,
): EmailProvider {
  switch (config.provider) {
    case 'mock':
      return new MockEmailProvider();

    case 'resend':
      return new ResendEmailProvider({
        apiKey: config.resendApiKey ?? '',
        from: config.from ?? '',
        replyTo: config.replyTo,
      });

    default: {
      /* Ensure every supported provider is handled as the union expands. */
      const unsupportedProvider: never = config.provider;
      throw new Error(`Unsupported email provider: ${unsupportedProvider}`);
    }
  }
}
