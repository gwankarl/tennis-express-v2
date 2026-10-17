import { Router } from 'express';

import { createAuthRouter } from '../../modules/auth/routes/auth.routes.js';
import type { EmailVerificationService } from '../../modules/auth/services/email-verification.service.js';
import type { RegistrationService } from '../../modules/auth/services/registration.service.js';
import type { ResendVerificationService } from '../../modules/auth/services/resend-verification.service.js';
import type { GoogleAuthService } from '../../modules/auth/services/google-auth.service.js';

/**
 * Optional dependencies for constructing the version 1 API router.
 *
 * Allows services to be injected into nested routers for integration
 * testing and controlled application configuration.
 */
export interface V1RouterDependencies {
  /** Registration service forwarded to the authentication router. */
  registrationService?: RegistrationService;

  /** Email verification service forwarded to the authentication router. */
  emailVerificationService?: EmailVerificationService;

  resendVerificationService?: ResendVerificationService;

  /** Google authentication service forwarded to the authentication router. */
  googleAuthService?: GoogleAuthService;
}

/**
 * Creates the version 1 API router and registers its endpoints.
 *
 * @param dependencies - Optional services required by nested routers.
 * @returns The configured router for API version 1.
 */
export function createV1Router(
  dependencies: V1RouterDependencies = {},
): Router {
  const v1Router = Router();

  /* Reports whether the API is responding to HTTP requests. */
  v1Router.get('/health', (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
      },
    });
  });

  /* Mount authentication endpoints under /auth. */
  v1Router.use(
    '/auth',
    createAuthRouter({
      registrationService: dependencies.registrationService,
      emailVerificationService: dependencies.emailVerificationService,
      resendVerificationService: dependencies.resendVerificationService,
      googleAuthService: dependencies.googleAuthService,
    }),
  );

  return v1Router;
}

/* Export a default router for application code using the default services. */
export default createV1Router();
