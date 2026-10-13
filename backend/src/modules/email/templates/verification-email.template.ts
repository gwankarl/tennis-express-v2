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

/**
 * Creates the email used to verify a newly registered user's email address.
 *
 * Produces both HTML and plain-text versions so the message can be read
 * by email clients that do not support HTML.
 *
 * @param input - Recipient details and the verification action URL.
 * @returns The verification email subject and message bodies.
 */
export function createVerificationEmailTemplate(
  input: ActionEmailTemplateInput,
): EmailTemplate {
  /* Validate the destination before including it in the email. */
  const actionUrl = validateActionUrl(input.actionUrl);
  const greeting = getGreeting(input.recipientName);

  /*
   * Escape dynamic text before inserting it into HTML.
   * The shared layout and button helpers provide consistent email styling.
   */
  const html = getEmailLayout(`
    <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;">Verify your email address</h1>
    <p style="font-size:16px;line-height:1.7;">${escapeHtml(greeting)},</p>
    <p style="font-size:16px;line-height:1.7;">
      Thanks for joining Tennis-Xpress. Please verify your email address to complete your registration.
    </p>
    ${getActionButton('Verify email address', actionUrl)}
    <p style="font-size:14px;line-height:1.7;color:#4b5563;">
      If the button does not work, copy and paste this link into your browser:
    </p>
    <p style="font-size:14px;line-height:1.7;overflow-wrap:anywhere;">
      <a href="${escapeHtml(actionUrl)}">${escapeHtml(actionUrl)}</a>
    </p>
  `);

  /* Provide equivalent instructions for plain-text email clients. */
  const text = `${greeting},

Thanks for joining Tennis-Xpress. Please verify your email address to complete your registration.

Verify your email address:
${actionUrl}

If you did not create a Tennis-Xpress account, you can safely ignore this email.`;

  return {
    subject: 'Verify your Tennis-Xpress email address',
    html,
    text,
  };
}
