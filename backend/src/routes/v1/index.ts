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

import { createSellerApplicationsRouter } from '../../modules/sellers/routes/seller-applications.routes.js';
import type { SellerApplicationsRouterDependencies } from '../../modules/sellers/routes/seller-applications.routes.js';
import type { SellerApplicationService } from '../../modules/sellers/services/seller-application.service.js';

import { createAdminSellerApplicationReviewRouter } from '../../modules/admin/routes/seller-application-review.routes.js';
import type { AdminSellerApplicationReviewRouterDependencies } from '../../modules/admin/routes/seller-application-review.routes.js';

import { createCategoryManagementRouter } from '../../modules/categories/routes/category-management.routes.js';
import type { CategoryManagementRouterDependencies } from '../../modules/categories/routes/category-management.routes.js';
import type { CategoryManagementControllerService } from '../../modules/categories/controllers/category-management.controller.js';
import { createCategoryQueryRouter } from '../../modules/categories/routes/category-query.routes.js';

import { createBrandManagementRouter } from '../../modules/brands/routes/brand-management.routes.js';
import type { BrandManagementRouterDependencies } from '../../modules/brands/routes/brand-management.routes.js';

import type { BrandManagementControllerService } from '../../modules/brands/controllers/brand-management.controller.js';
import type { BrandStatusControllerService } from '../../modules/brands/controllers/brand-status.controller.js';

import { createBrandQueryRouter } from '../../modules/brands/routes/brand-query.routes.js';

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

  /** Dependencies forwarded to the seller applications router. */
  sellerApplications?: Omit<
    SellerApplicationsRouterDependencies,
    'sellerApplicationService'
  >;

  sellerApplicationService?: SellerApplicationService;

  /** Additional dependencies forwarded to admin seller application review routes. */
  adminSellerApplicationReview?: Omit<
    AdminSellerApplicationReviewRouterDependencies,
    'sellerApplicationService'
  >;

  /** Dependencies forwarded to administrator-only category management routes. */
  categoryManagement?: Omit<
    CategoryManagementRouterDependencies,
    'categoryManagementService'
  >;

  categoryManagementService?: CategoryManagementControllerService;

  brandManagement?: Omit<
    BrandManagementRouterDependencies,
    'brandManagementService' | 'brandStatusService'
  >;
  brandManagementService?: BrandManagementControllerService;
  brandStatusService?: BrandStatusControllerService;
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

  /* Mount authenticated seller application endpoints. */
  v1Router.use(
    '/seller-applications',
    createSellerApplicationsRouter({
      ...dependencies.sellerApplications,
      accessTokenService: dependencies.accessTokenService,
      sessionService: dependencies.sessionService,
      sellerApplicationService: dependencies.sellerApplicationService,
    }),
  );

  /* Mount administrator-only seller application review endpoints. */
  v1Router.use(
    '/admin/seller-applications',
    createAdminSellerApplicationReviewRouter({
      ...dependencies.adminSellerApplicationReview,
      accessTokenService: dependencies.accessTokenService,
      sessionService: dependencies.sessionService,
      sellerApplicationService: dependencies.sellerApplicationService,
    }),
  );

  /* Mount administrator-only category management endpoints. */
  v1Router.use(
    '/admin/categories',
    createCategoryManagementRouter({
      ...dependencies.categoryManagement,
      accessTokenService: dependencies.accessTokenService,
      sessionService: dependencies.sessionService,
      categoryManagementService: dependencies.categoryManagementService,
    }),
  );

  v1Router.use(
    '/admin/brands',
    createBrandManagementRouter({
      ...dependencies.brandManagement,
      accessTokenService: dependencies.accessTokenService,
      sessionService: dependencies.sessionService,
      brandManagementService: dependencies.brandManagementService,
      brandStatusService: dependencies.brandStatusService,
    }),
  );

  /* Mount public category retrieval endpoints. */
  v1Router.use('/categories', createCategoryQueryRouter());

  /* Mount public brand retrieval endpoints. */
  v1Router.use('/brands', createBrandQueryRouter());

  return v1Router;
}

/* Export a default router for application code using the default services. */
export default createV1Router();
