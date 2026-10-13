import { env } from '../../../config/env.js';
import { createEmailProvider } from '../../email/providers/email-provider.factory.js';
import { EmailService } from '../../email/services/email.service.js';
import { Argon2PasswordHasher } from './argon2-password-hasher.js';
import { PwnedPasswordCompromiseChecker } from './pwned-password-compromise.checker.js';
import { RegistrationService } from './registration.service.js';
import { DefaultVerificationEmailSender } from './verification-email.sender.js';

/**
 * Builds the registration service with application-configured dependencies.
 */
export function createRegistrationService(): RegistrationService {
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
    {
      clientUrl: env.clientUrl,
    },
  );

  return new RegistrationService({
    passwordHasher: new Argon2PasswordHasher(),
    passwordCompromiseChecker: new PwnedPasswordCompromiseChecker(),
    verificationEmailSender,
  });
}
