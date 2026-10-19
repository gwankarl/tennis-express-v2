import {
  EmailProviderError,
  type EmailDeliveryResult,
  type EmailMessage,
  type EmailProvider,
} from '../types/email.types.js';

export class MockEmailProvider implements EmailProvider {
  private readonly messages: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    if (!message.to.trim() || !message.subject.trim()) {
      throw new EmailProviderError(
        'EMAIL_DELIVERY_FAILED',
        'The email recipient and subject are required.',
      );
    }

    this.messages.push({ ...message });

    return {
      messageId: `mock-email-${this.messages.length}`,
    };
  }

  getMessages(): EmailMessage[] {
    return this.messages.map((message) => ({ ...message }));
  }

  clearMessages(): void {
    this.messages.length = 0;
  }
}
