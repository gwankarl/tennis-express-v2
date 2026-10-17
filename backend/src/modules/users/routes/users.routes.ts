import { Router } from 'express';

import { validateRequest } from '../../../middleware/validate-request.js';
import { createRequireAuthentication } from '../../auth/middleware/require-authentication.js';
import type { RequireAuthenticationDependencies } from '../../auth/middleware/require-authentication.js';

import { createCurrentUserController } from '../controllers/current-user.controller.js';
import type { CurrentUserControllerDependencies } from '../controllers/current-user.controller.js';
import { createAccountDeletionRequestController } from '../controllers/account-deletion-request.controller.js';
import type { AccountDeletionRequestControllerDependencies } from '../controllers/account-deletion-request.controller.js';
import { createProfileUpdateController } from '../controllers/profile-update.controller.js';

import { ProfileUpdateService } from '../services/profile-update.service.js';
import { AccountDeletionRequestService } from '../services/account-deletion-request.service.js';
import { profileUpdateSchema } from '../validations/profile-update.validation.js';

import { createProfileImageUploadController } from '../controllers/profile-image-upload.controller.js';
import { uploadProfileImage } from '../middleware/profile-image-upload.middleware.js';
import { ProfileImageUpdateService } from '../services/profile-image-update.service.js';
import type { ProfileImageUpdateService as ProfileImageUpdateServiceType } from '../services/profile-image-update.service.js';
import { validateProfileImageContent } from '../middleware/profile-image-content-validation.middleware.js';

/** Dependencies required by the Users module routes. */
export interface UsersRouterDependencies
  extends
    RequireAuthenticationDependencies,
    CurrentUserControllerDependencies,
    AccountDeletionRequestControllerDependencies {
  profileUpdateService?: ProfileUpdateService;
  profileImageUpdateService?: ProfileImageUpdateServiceType;
}

/** Creates routes for authenticated user-account operations. */
export function createUsersRouter(
  dependencies: UsersRouterDependencies = {},
): Router {
  const usersRouter = Router();

  const requireAuthentication = createRequireAuthentication({
    accessTokenService: dependencies.accessTokenService,
    sessionService: dependencies.sessionService,
  });

  const getCurrentUser = createCurrentUserController({
    currentUserService: dependencies.currentUserService,
  });

  const accountDeletionRequestController =
    createAccountDeletionRequestController({
      accountDeletionRequestService:
        dependencies.accountDeletionRequestService ??
        new AccountDeletionRequestService({
          async checkEligibility() {
            return {
              eligible: false,
              blockedReasons: [
                'Marketplace eligibility checks are not configured.',
              ],
            };
          },
        }),
    });

  const updateProfile = createProfileUpdateController(
    dependencies.profileUpdateService ?? new ProfileUpdateService(),
  );

  const uploadProfileImageController = createProfileImageUploadController(
    dependencies.profileImageUpdateService ?? new ProfileImageUpdateService(),
  );

  usersRouter.get('/me', requireAuthentication, getCurrentUser);

  usersRouter.patch(
    '/me',
    requireAuthentication,
    validateRequest('body', profileUpdateSchema),
    updateProfile,
  );

  usersRouter.post(
    '/me/image',
    requireAuthentication,
    uploadProfileImage,
    validateProfileImageContent,
    uploadProfileImageController,
  );

  usersRouter.post(
    '/me/deletion-request',
    requireAuthentication,
    accountDeletionRequestController.requestDeletion,
  );

  usersRouter.delete(
    '/me/deletion-request',
    requireAuthentication,
    accountDeletionRequestController.cancelRequest,
  );

  return usersRouter;
}

export default createUsersRouter();
