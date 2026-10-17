import { env } from '../../../config/env.js';
import { createEmailProvider } from '../../email/providers/email-provider.factory.js';
import { EmailService } from '../../email/services/email.service.js';
import { DefaultPasswordResetEmailSender } from './password-reset-email.sender.js';
import { ForgotPasswordService } from './forgot-password.service.js';

/* Builds the password-recovery service using application configuration. */
export function createForgotPasswordService(): ForgotPasswordService {
  const emailProvider = createEmailProvider({
    provider: env.emailProvider,
    resendApiKey: env.resendApiKey,
    from: env.emailFrom,
    replyTo: env.emailReplyTo,
  });

  const emailService = new EmailService(emailProvider, {
    enabled: env.emailEnabled,
  });

  const passwordResetEmailSender = new DefaultPasswordResetEmailSender(
    emailService,
    { clientUrl: env.clientUrl },
  );

  return new ForgotPasswordService({ passwordResetEmailSender });
}
