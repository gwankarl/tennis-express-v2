import { Router } from 'express';

import { validateRequest } from '../../../middleware/validate-request.js';
import { createEmailVerificationController } from '../controllers/email-verification.controller.js';
import { createRegistrationController } from '../controllers/registration.controller.js';
import type { EmailVerificationService } from '../services/email-verification.service.js';
import { EmailVerificationService as EmailVerificationServiceClass } from '../services/email-verification.service.js';
import type { RegistrationService } from '../services/registration.service.js';
import { createRegistrationService } from '../services/registration-service.factory.js';
import { emailVerificationSchema } from '../validations/email-verification.validation.js';
import { registrationSchema } from '../validations/registration.validation.js';
import { createResendVerificationController } from '../controllers/resend-verification.controller.js';
import type { ResendVerificationService } from '../services/resend-verification.service.js';
import { createResendVerificationService } from '../services/resend-verification-service.factory.js';
import { resendVerificationSchema } from '../validations/resend-verification.validation.js';
import { createResendVerificationRateLimit } from '../middleware/resend-verification-rate-limit.js';
import { createLoginController } from '../controllers/login.controller.js';
import { AuthTokenService } from '../services/auth-token.service.js';
import type { LoginService } from '../services/login.service.js';
import { createLoginService } from '../services/login-service.factory.js';
import { loginSchema } from '../validations/login.validation.js';
import { RefreshTokenController } from '../controllers/refresh-token.controller.js';
import { refreshTokenSchema } from '../validations/refresh-token.validation.js';

/**
 * Optional dependencies for constructing the authentication router.
 *
 * Injected services allow integration tests to control individual
 * authentication workflows without replacing the production implementations.
 */
export interface AuthRouterDependencies {
  /** Service used to process registration requests. */
  registrationService?: RegistrationService;

  /** Service used to verify email addresses. */
  emailVerificationService?: EmailVerificationService;

  /** Service used to resend verification email. */
  resendVerificationService?: ResendVerificationService;

  /** Service used to authenticate login credentials. */
  loginService?: LoginService;

  /** Service used to issue authentication tokens and sessions. */
  authTokenService?: AuthTokenService;
}

/**
 * Creates authentication routes using injected or default services.
 *
 * Request validation runs before each controller so malformed requests
 * are rejected before application services execute.
 *
 * @param dependencies - Optional services required by the router.
 * @returns The configured authentication router.
 */
export function createAuthRouter(
  dependencies: AuthRouterDependencies = {},
): Router {
  const router = Router();

  const resendVerificationRateLimit = createResendVerificationRateLimit();

  const registrationService =
    dependencies.registrationService ?? createRegistrationService();

  const emailVerificationService =
    dependencies.emailVerificationService ??
    new EmailVerificationServiceClass();

  const resendVerificationService =
    dependencies.resendVerificationService ?? createResendVerificationService();

  const loginService = dependencies.loginService ?? createLoginService();

  const authTokenService =
    dependencies.authTokenService ?? new AuthTokenService();

  const refreshTokenController = new RefreshTokenController(authTokenService);

  router.post(
    '/register',
    validateRequest('body', registrationSchema),
    createRegistrationController(registrationService),
  );

  router.post(
    '/verify-email',
    validateRequest('body', emailVerificationSchema),
    createEmailVerificationController(emailVerificationService),
  );

  router.post(
    '/resend-verification',
    resendVerificationRateLimit,
    validateRequest('body', resendVerificationSchema),
    createResendVerificationController(resendVerificationService),
  );

  router.post(
    '/login',
    validateRequest('body', loginSchema),
    createLoginController(loginService, authTokenService),
  );

  router.post(
    '/refresh-token',
    validateRequest('body', refreshTokenSchema),
    refreshTokenController.refresh.bind(refreshTokenController),
  );

  return router;
}
