import { describe, expect, it } from 'vitest';

import { createPasswordResetEmailTemplate } from '../../../../../src/modules/email/templates/password-reset-email.template.js';

describe('createPasswordResetEmailTemplate', () => {
  const input = {
    recipientName: 'Alex',
    actionUrl: 'https://example.com/reset-password?token=test-token',
  };

  it('returns a subject, HTML, and plain-text body', () => {
    const result = createPasswordResetEmailTemplate(input);

    expect(result.subject).toBe('Reset your Tennis-Xpress password');
    expect(result.html).toContain('Reset your password');
    expect(result.text).toContain(input.actionUrl);
  });

  it('escapes recipient names in HTML', () => {
    const result = createPasswordResetEmailTemplate({
      ...input,
      recipientName: '<img src=x onerror=alert(1)>',
    });

    expect(result.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(result.html).not.toContain('<img src=x onerror=alert(1)>');
  });

  it('rejects invalid action URLs', () => {
    expect(() =>
      createPasswordResetEmailTemplate({
        ...input,
        actionUrl: 'not-a-url',
      }),
    ).toThrow('A valid action URL is required.');
  });

  it('includes the warning for an unrequested reset', () => {
    const result = createPasswordResetEmailTemplate(input);

    expect(result.html).toContain(
      'Your password will not change unless you complete the reset process.',
    );
    expect(result.text).toContain(
      'Your password will not change unless you complete the reset process.',
    );
  });
});
