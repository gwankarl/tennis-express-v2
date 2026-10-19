/**
 * Content and recipient details required to send an email.
 */
export interface EmailMessage {
  /** Email address of the intended recipient. */
  to: string;

  /** Subject displayed by the recipient's email client. */
  subject: string;

  /** HTML version of the email body. */
  html: string;

  /** Optional plain-text version of the email body. */
  text?: string;

  /** Optional address for replies to this message. */
  replyTo?: string;
}

/**
 * Result returned by an email provider after a delivery request.
 */
export interface EmailDeliveryResult {
  /** Provider-assigned identifier for tracking the message, when available. */
  messageId?: string;
}

/**
 * Contract implemented by email delivery providers.
 *
 * Provider-specific implementations handle the communication with
 * the underlying email service.
 */
export interface EmailProvider {
  /**
   * Submits an email message to the configured provider.
   *
   * @param message - Recipient details and email content.
   * @returns Provider delivery metadata when the request succeeds.
   * @throws An error if the provider cannot process the request.
   */
  send(message: EmailMessage): Promise<EmailDeliveryResult>;
}

/**
 * Error codes used to classify email-provider failures.
 */
export type EmailProviderErrorCode =
  /** Required email-provider configuration is missing or invalid. */
  | 'EMAIL_CONFIGURATION_ERROR'
  /** The provider is unavailable or cannot be reached. */
  | 'EMAIL_PROVIDER_UNAVAILABLE'
  /** The provider rejects or fails to process the delivery request. */
  | 'EMAIL_DELIVERY_FAILED';

/**
 * Represents a classified failure during email delivery.
 *
 * The error code allows callers to distinguish configuration,
 * availability, and delivery failures without inspecting the message.
 */
export class EmailProviderError extends Error {
  constructor(
    public readonly code: EmailProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'EmailProviderError';
  }
}
