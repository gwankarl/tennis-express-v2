import { Router } from 'express';

import { createAuthRouter } from '../../modules/auth/routes/auth.routes.js';
import type { EmailVerificationService } from '../../modules/auth/services/email-verification.service.js';
import type { RegistrationService } from '../../modules/auth/services/registration.service.js';
import type { ResendVerificationService } from '../../modules/auth/services/resend-verification.service.js';
import type { GoogleAuthService } from '../../modules/auth/services/google-auth.service.js';

import { createUsersRouter } from '../../modules/users/routes/users.routes.js';
import type { CurrentUserService } from '../../modules/users/services/current-user.service.js';
import type { AccessTokenService } from '../../modules/auth/services/access-token.service.js';
import type { SessionService } from '../../modules/auth/services/session.service.js';
import type { ProfileUpdateService } from '../../modules/users/services/profile-update.service.js';
import type { ProfileImageUpdateService } from '../../modules/users/services/profile-image-update.service.js';

import type { AccountDeletionRequestService } from '../../modules/users/services/account-deletion-request.service.js';

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

  /** Current-user service forwarded to the Users router. */
  currentUserService?: CurrentUserService;

  /** Access-token service forwarded to the Users router. */
  accessTokenService?: AccessTokenService;

  /** Session service forwarded to the Users router. */
  sessionService?: SessionService;

  /** Profile-update service forwarded to the Users router. */
  profileUpdateService?: ProfileUpdateService;

  profileImageUpdateService?: ProfileImageUpdateService;

  accountDeletionRequestService?: AccountDeletionRequestService;
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

  /* Mount user-account endpoints under /users. */
  v1Router.use(
    '/users',
    createUsersRouter({
      currentUserService: dependencies.currentUserService,
      accessTokenService: dependencies.accessTokenService,
      sessionService: dependencies.sessionService,
      profileUpdateService: dependencies.profileUpdateService,
      profileImageUpdateService: dependencies.profileImageUpdateService,
      accountDeletionRequestService: dependencies.accountDeletionRequestService,
    }),
  );

  return v1Router;
}

/* Export a default router for application code using the default services. */
export default createV1Router();
