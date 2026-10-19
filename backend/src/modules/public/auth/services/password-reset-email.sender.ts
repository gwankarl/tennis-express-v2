import { EmailService } from '../../email/services/email.service.js';
import { createPasswordResetEmailTemplate } from '../../email/templates/password-reset-email.template.js';
import type { PasswordResetEmailSender } from '../types/registration.types.js';

/* Configuration required to construct password-reset links. */
export interface PasswordResetEmailSenderConfig {
  clientUrl: string;
}

/**
 * Sends password-reset emails through the shared email infrastructure.
 *
 * The raw token is included only in the emailed link, never in the database
 * or the API response.
 */
export class DefaultPasswordResetEmailSender implements PasswordResetEmailSender {
  constructor(
    private readonly emailService: EmailService,
    private readonly config: PasswordResetEmailSenderConfig,
  ) {}

  async sendPasswordResetEmail(input: {
    to: string;
    recipientName: string;
    token: string;
  }): Promise<void> {
    const resetUrl = new URL('/reset-password', this.config.clientUrl);
    resetUrl.searchParams.set('token', input.token);

    const template = createPasswordResetEmailTemplate({
      recipientName: input.recipientName,
      actionUrl: resetUrl.toString(),
    });

    await this.emailService.send({
      to: input.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }
}
