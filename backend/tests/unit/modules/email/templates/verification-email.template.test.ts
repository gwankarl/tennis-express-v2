import { describe, expect, it } from 'vitest';

import { createVerificationEmailTemplate } from '../../../../../src/modules/email/templates/verification-email.template.js';

describe('createVerificationEmailTemplate', () => {
  const input = {
    recipientName: 'Alex',
    actionUrl: 'https://example.com/verify?token=test-token',
  };

  it('returns a subject, HTML, and plain-text body', () => {
    const result = createVerificationEmailTemplate(input);

    expect(result.subject).toBe('Verify your Tennis-Xpress email address');
    expect(result.html).toContain('Verify your email address');
    expect(result.text).toContain(input.actionUrl);
  });

  it('escapes recipient names in HTML', () => {
    const result = createVerificationEmailTemplate({
      ...input,
      recipientName: '<script>alert(1)</script>',
    });

    expect(result.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(result.html).not.toContain('<script>alert(1)</script>');
  });

  it('rejects non-HTTP(S) action URLs', () => {
    expect(() =>
      createVerificationEmailTemplate({
        ...input,
        actionUrl: 'javascript:alert(1)',
      }),
    ).toThrow('The action URL must use HTTP or HTTPS.');
  });

  it('uses a generic greeting when the name is blank', () => {
    const result = createVerificationEmailTemplate({
      ...input,
      recipientName: '  ',
    });

    expect(result.html).toContain('Hello,');
    expect(result.text).toContain('Hello,');
  });
});
