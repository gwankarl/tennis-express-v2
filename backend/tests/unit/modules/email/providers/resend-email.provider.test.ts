import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMock, resendConstructorMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  resendConstructorMock: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };

    constructor(apiKey: string) {
      resendConstructorMock(apiKey);
    }
  },
}));

import {
  EmailProviderError,
  type EmailMessage,
} from '../../../../../src/modules/email/types/email.types.js';
import { ResendEmailProvider } from '../../../../../src/modules/email/providers/resend-email.provider.js';

const config = {
  apiKey: 'test-api-key',
  from: 'Tennis-Xpress <onboarding@resend.dev>',
  replyTo: 'support@example.com',
};

const message: EmailMessage = {
  to: 'recipient@example.com',
  subject: 'Verify your email',
  html: '<p>Please verify your email.</p>',
  text: 'Please verify your email.',
};

describe('ResendEmailProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects missing API key or sender configuration', () => {
    expect(
      () =>
        new ResendEmailProvider({
          apiKey: '',
          from: config.from,
        }),
    ).toThrowError(
      expect.objectContaining({
        code: 'EMAIL_CONFIGURATION_ERROR',
      }),
    );

    expect(resendConstructorMock).not.toHaveBeenCalled();
  });

  it('sends an email and returns the provider message ID', async () => {
    sendMock.mockResolvedValue({
      data: { id: 'email-123' },
      error: null,
    });

    const provider = new ResendEmailProvider(config);

    await expect(provider.send(message)).resolves.toEqual({
      messageId: 'email-123',
    });

    expect(sendMock).toHaveBeenCalledWith({
      from: config.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: config.replyTo,
    });
  });

  it('normalizes provider rejection errors', async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: {
        statusCode: 422,
        message: 'Internal provider details',
      },
    });

    const provider = new ResendEmailProvider(config);

    await expect(provider.send(message)).rejects.toMatchObject({
      name: 'EmailProviderError',
      code: 'EMAIL_DELIVERY_FAILED',
    });

    await expect(provider.send(message)).rejects.not.toThrow(
      'Internal provider details',
    );
  });

  it('normalizes network failures', async () => {
    sendMock.mockRejectedValue(new Error('Network details'));

    const provider = new ResendEmailProvider(config);

    try {
      await provider.send(message);
      throw new Error('Expected send to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(EmailProviderError);
      expect(error).toMatchObject({
        code: 'EMAIL_PROVIDER_UNAVAILABLE',
      });
      expect((error as Error).message).not.toContain('Network details');
    }
  });
});
