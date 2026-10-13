import type {
  ActionEmailTemplateInput,
  EmailTemplate,
} from './email-template.types.js';

import {
  escapeHtml,
  getActionButton,
  getEmailLayout,
  getGreeting,
  validateActionUrl,
} from './email-template.utils.js';

export function createPasswordResetEmailTemplate(
  input: ActionEmailTemplateInput,
): EmailTemplate {
  const actionUrl = validateActionUrl(input.actionUrl);
  const greeting = getGreeting(input.recipientName);

  const html = getEmailLayout(`
    <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;">Reset your password</h1>
    <p style="font-size:16px;line-height:1.7;">${escapeHtml(greeting)},</p>
    <p style="font-size:16px;line-height:1.7;">
      We received a request to reset the password for your Tennis-Xpress account.
    </p>
    ${getActionButton('Reset password', actionUrl)}
    <p style="font-size:14px;line-height:1.7;color:#4b5563;">
      If the button does not work, copy and paste this link into your browser:
    </p>
    <p style="font-size:14px;line-height:1.7;overflow-wrap:anywhere;">
      <a href="${escapeHtml(actionUrl)}">${escapeHtml(actionUrl)}</a>
    </p>
    <p style="font-size:14px;line-height:1.7;color:#4b5563;">
      If you did not request a password reset, ignore this email. Your password will not change unless you complete the reset process.
    </p>
  `);

  const text = `${greeting},

We received a request to reset the password for your Tennis-Xpress account.

Reset your password:
${actionUrl}

If you did not request a password reset, ignore this email. Your password will not change unless you complete the reset process.`;

  return {
    subject: 'Reset your Tennis-Xpress password',
    html,
    text,
  };
}
