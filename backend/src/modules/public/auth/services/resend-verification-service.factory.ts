import { env } from '../../../../config/env.js';
import { createEmailProvider } from '../../email/providers/email-provider.factory.js';
import { EmailService } from '../../email/services/email.service.js';
import { DefaultVerificationEmailSender } from './verification-email.sender.js';
import { ResendVerificationService } from './resend-verification.service.js';

/**
 * Creates the resend-verification service using the configured email provider.
 */
export function createResendVerificationService(): ResendVerificationService {
  const emailProvider = createEmailProvider({
    provider: env.emailProvider,
    resendApiKey: env.resendApiKey,
    from: env.emailFrom,
    replyTo: env.emailReplyTo,
  });

  const emailService = new EmailService(emailProvider, {
    enabled: env.emailEnabled,
  });

  const verificationEmailSender = new DefaultVerificationEmailSender(
    emailService,
    { clientUrl: env.clientUrl },
  );

  return new ResendVerificationService({ verificationEmailSender });
}
