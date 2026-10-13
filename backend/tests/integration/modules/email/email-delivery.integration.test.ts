import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmailProvider } from '../../../../src/modules/email/providers/email-provider.factory.js';
import { MockEmailProvider } from '../../../../src/modules/email/providers/mock-email.provider.js';
import { EmailService } from '../../../../src/modules/email/services/email.service.js';
import type { EmailMessage } from '../../../../src/modules/email/types/email.types.js';

describe('Email delivery integration', () => {
  const message: EmailMessage = {
    to: 'test@example.com',
    subject: 'Verify your email',
    html: '<p>Verify your email</p>',
    text: 'Verify your email',
  };

  let provider: MockEmailProvider;
  let service: EmailService;

  beforeEach(() => {
    provider = new MockEmailProvider();
    service = new EmailService(provider, { enabled: true });
  });

  it('selects the mock provider when configured', () => {
    expect(createEmailProvider({ provider: 'mock' })).toBeInstanceOf(
      MockEmailProvider,
    );
  });

  it('delivers a message through the configured provider', async () => {
    await service.send(message);

    expect(provider.getMessages()).toEqual([message]);
  });

  it('does not invoke the provider when email is disabled', async () => {
    const sendSpy = vi.spyOn(provider, 'send');
    service = new EmailService(provider, { enabled: false });

    await expect(service.send(message)).resolves.toEqual({});

    expect(sendSpy).not.toHaveBeenCalled();
    expect(provider.getMessages()).toEqual([]);
  });

  it('propagates delivery errors to the caller', async () => {
    const failure = new Error('Delivery failed');
    vi.spyOn(provider, 'send').mockRejectedValue(failure);

    await expect(service.send(message)).rejects.toBe(failure);
  });

  it('keeps the provider selection explicit', () => {
    expect(() =>
      createEmailProvider({
        provider: 'resend',
        resendApiKey: '',
        from: '',
      }),
    ).toThrow();
  });
});
