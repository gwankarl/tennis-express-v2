import { Router } from 'express';

import { createAuthRouter } from './auth/routes/auth.routes.js';
import type { EmailVerificationService } from './auth/services/email-verification.service.js';
import type { RegistrationService } from './auth/services/registration.service.js';
import type { ResendVerificationService } from './auth/services/resend-verification.service.js';
import type { GoogleAuthService } from './auth/services/google-auth.service.js';

import { createBrandQueryRouter } from './brands/routes/brand-query.routes.js';
import { createCategoryQueryRouter } from './categories/routes/category-query.routes.js';
import { createStoreQueryRouter } from './stores/routes/store-query.routes.js';
import { createProductQueryRouter } from './products/routes/product-query.routes.js';

/**
 * Optional dependencies for constructing the version 1 API router.
 *
 * Allows services to be injected into nested routers for integration
 * testing and controlled application configuration.
 */
export interface V1PublicRouterDependencies {
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
export function createV1PublicRouter(
  dependencies: V1PublicRouterDependencies = {},
): Router {
  const v1PublicRouter = Router();

  /* Reports whether the API is responding to HTTP requests. */
  v1PublicRouter.get('/health', (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
      },
    });
  });

  v1PublicRouter.use(
    '/auth',
    createAuthRouter({
      registrationService: dependencies.registrationService,
      emailVerificationService: dependencies.emailVerificationService,
      resendVerificationService: dependencies.resendVerificationService,
      googleAuthService: dependencies.googleAuthService,
    }),
  );

  /* Mount public brand retrieval endpoints. */
  v1PublicRouter.use('/brands', createBrandQueryRouter());

  /* Mount public category retrieval endpoints. */
  v1PublicRouter.use('/categories', createCategoryQueryRouter());

  /* Mount public store profile retrieval endpoints. */
  v1PublicRouter.use('/stores', createStoreQueryRouter());

  /* Mount public product detail retrieval endpoints. */
  v1PublicRouter.use('/products', createProductQueryRouter());

  return v1PublicRouter;
}
