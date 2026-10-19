import { EmailService } from '../../email/services/email.service.js';
import { createVerificationEmailTemplate } from '../../email/templates/verification-email.template.js';
import type { VerificationEmailSender } from '../types/registration.types.js';

/** Configuration required to construct account-verification links. */
export interface VerificationEmailSenderConfig {
  /** Base URL of the frontend application. */
  clientUrl: string;
}

/**
 * Sends account-verification emails using the configured email service.
 *
 * Builds the frontend verification URL, renders the email template,
 * and delegates delivery to EmailService.
 */
export class DefaultVerificationEmailSender implements VerificationEmailSender {
  constructor(
    private readonly emailService: EmailService,
    private readonly config: VerificationEmailSenderConfig,
  ) {}

  /**
   * Builds and sends a verification email to the user.
   *
   * @param input - Recipient details and the raw verification token.
   * @returns A promise that resolves when the email service completes.
   */
  async sendVerificationEmail(input: {
    to: string;
    recipientName: string;
    token: string;
  }): Promise<void> {
    /* Build the frontend URL and safely encode the token as a query parameter. */
    const verificationUrl = new URL('/verify-email', this.config.clientUrl);
    verificationUrl.searchParams.set('token', input.token);

    /* Render both HTML and plain-text versions of the verification message. */
    const template = createVerificationEmailTemplate({
      recipientName: input.recipientName,
      actionUrl: verificationUrl.toString(),
    });

    /* Delegate provider-specific email delivery to the shared email service. */
    await this.emailService.send({
      to: input.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }
}
