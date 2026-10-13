import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DefaultVerificationEmailSender } from '../../../../../src/modules/auth/services/verification-email.sender.js';
import { EmailService } from '../../../../../src/modules/email/services/email.service.js';
import type { EmailMessage } from '../../../../../src/modules/email/types/email.types.js';

describe('DefaultVerificationEmailSender', () => {
  const clientUrl = 'http://localhost:5173';
  const token = 'raw-verification-token';
  let emailService: EmailService;
  let sender: DefaultVerificationEmailSender;
  let send: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    send = vi.fn().mockResolvedValue({});

    emailService = {
      send,
    } as unknown as EmailService;

    sender = new DefaultVerificationEmailSender(emailService, {
      clientUrl,
    });
  });

  it('sends a verification email to the supplied recipient', async () => {
    await sender.sendVerificationEmail({
      to: 'player@example.com',
      recipientName: 'Tennis Player',
      token,
    });

    expect(send).toHaveBeenCalledOnce();

    const message = send.mock.calls[0]?.[0] as EmailMessage;

    expect(message.to).toBe('player@example.com');
    expect(message.subject).toBe('Verify your Tennis-Xpress email address');
    expect(message.html).toContain('Tennis Player');
    expect(message.text).toContain('Tennis Player');

    const verificationUrl = new URL(message.text!.match(/https?:\/\/\S+/)![0]);

    expect(verificationUrl.origin).toBe(clientUrl);
    expect(verificationUrl.pathname).toBe('/verify-email');
    expect(verificationUrl.searchParams.get('token')).toBe(token);
  });

  it('URL-encodes the verification token in the link', async () => {
    const specialToken = 'token with spaces & symbols';

    await sender.sendVerificationEmail({
      to: 'player@example.com',
      recipientName: 'Tennis Player',
      token: specialToken,
    });

    const message = send.mock.calls[0]?.[0] as EmailMessage;
    const urlMatch = message.text!.match(/https?:\/\/\S+/);

    expect(urlMatch).not.toBeNull();

    const verificationUrl = new URL(urlMatch![0]);

    expect(verificationUrl.searchParams.get('token')).toBe(specialToken);
  });

  it('propagates email delivery failures', async () => {
    const failure = new Error('Email delivery failed');
    send.mockRejectedValue(failure);

    await expect(
      sender.sendVerificationEmail({
        to: 'player@example.com',
        recipientName: 'Tennis Player',
        token,
      }),
    ).rejects.toBe(failure);
  });
});
