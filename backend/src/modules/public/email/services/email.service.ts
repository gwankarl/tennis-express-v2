import type {
  EmailDeliveryResult,
  EmailMessage,
  EmailProvider,
} from '../types/email.types.js';

export interface EmailServiceConfig {
  enabled: boolean;
}

export class EmailService {
  constructor(
    private readonly provider: EmailProvider,
    private readonly config: EmailServiceConfig,
  ) {}

  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    if (!this.config.enabled) {
      return {};
    }

    return this.provider.send(message);
  }
}
