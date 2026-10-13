import { describe, expect, it, beforeEach } from 'vitest';
import { MockEmailProvider } from '../../../../../src/modules/email/providers/mock-email.provider.js';
import type { EmailMessage } from '../../../../../src/modules/email/types/email.types.js';

describe('MockEmailProvider', () => {
  let provider: MockEmailProvider;

  const message: EmailMessage = {
    to: 'test@example.com',
    subject: 'Verify your email',
    html: '<p>Verification link</p>',
    text: 'Verification link',
  };

  beforeEach(() => {
    provider = new MockEmailProvider();
  });

  it('captures a sent message', async () => {
    const result = await provider.send(message);

    expect(result.messageId).toBe('mock-email-1');
    expect(provider.getMessages()).toEqual([message]);
  });

  it('captures multiple messages in order', async () => {
    await provider.send(message);
    await provider.send({
      ...message,
      to: 'another@example.com',
    });

    expect(provider.getMessages()).toHaveLength(2);
    expect(provider.getMessages()[1].to).toBe('another@example.com');
  });

  it('returns a copy of the captured messages', async () => {
    await provider.send(message);

    const messages = provider.getMessages();
    messages.push({ ...message, to: 'changed@example.com' });

    expect(provider.getMessages()).toHaveLength(1);
  });

  it('clears captured messages', async () => {
    await provider.send(message);
    provider.clearMessages();

    expect(provider.getMessages()).toEqual([]);
  });

  it('rejects messages with a missing recipient', async () => {
    await expect(provider.send({ ...message, to: ' ' })).rejects.toMatchObject({
      code: 'EMAIL_DELIVERY_FAILED',
    });
  });

  it('rejects messages with a missing subject', async () => {
    await expect(
      provider.send({ ...message, subject: ' ' }),
    ).rejects.toMatchObject({
      code: 'EMAIL_DELIVERY_FAILED',
    });
  });
});
