import { Resend } from 'resend';

import {
  EmailProviderError,
  type EmailDeliveryResult,
  type EmailMessage,
  type EmailProvider,
} from '../types/email.types.js';

export interface ResendEmailProviderConfig {
  apiKey: string;
  from: string;
  replyTo?: string;
}

export class ResendEmailProvider implements EmailProvider {
  private readonly resend: Resend;
  private readonly from: string;
  private readonly replyTo?: string;

  constructor(config: ResendEmailProviderConfig) {
    const apiKey = config.apiKey.trim();
    const from = config.from.trim();
    const replyTo = config.replyTo?.trim();

    if (!apiKey || !from) {
      throw new EmailProviderError(
        'EMAIL_CONFIGURATION_ERROR',
        'Resend email configuration is incomplete.',
      );
    }

    this.resend = new Resend(apiKey);
    this.from = from;
    this.replyTo = replyTo || undefined;
  }

  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        ...(message.text !== undefined && { text: message.text }),
        ...((message.replyTo || this.replyTo) && {
          replyTo: message.replyTo || this.replyTo,
        }),
      });

      if (error) {
        throw new EmailProviderError(
          error.statusCode === null
            ? 'EMAIL_PROVIDER_UNAVAILABLE'
            : 'EMAIL_DELIVERY_FAILED',
          error.statusCode === null
            ? 'The email provider is temporarily unavailable.'
            : 'The email provider rejected the message.',
        );
      }

      if (!data?.id) {
        throw new EmailProviderError(
          'EMAIL_DELIVERY_FAILED',
          'The email provider did not confirm message acceptance.',
        );
      }

      return { messageId: data.id };
    } catch (error) {
      if (error instanceof EmailProviderError) {
        throw error;
      }

      throw new EmailProviderError(
        'EMAIL_PROVIDER_UNAVAILABLE',
        'The email provider could not be reached.',
      );
    }
  }
}
