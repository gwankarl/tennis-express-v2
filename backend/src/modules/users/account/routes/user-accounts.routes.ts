import { Router } from 'express';

import { validateRequest } from '../../../../middleware/validate-request.js';
import { createRequireAuthentication } from '../../../shared/auth/middleware/require-authentication.js';

import { createCurrentUserController } from '../controllers/current-user.controller.js';

import { createAccountDeletionRequestController } from '../controllers/account-deletion-request.controller.js';

import { createProfileUpdateController } from '../controllers/profile-update.controller.js';

import { ProfileUpdateService } from '../services/profile-update.service.js';
import { AccountDeletionRequestService } from '../services/account-deletion-request.service.js';
import { profileUpdateSchema } from '../validations/profile-update.validation.js';

import { createProfileImageUploadController } from '../controllers/profile-image-upload.controller.js';
import { uploadImage } from '../../../../middleware/image-uploads/image-upload.middleware.js';
import { validateImageContent } from '../../../../middleware/image-uploads/image-content-validation.middleware.js';
import { ProfileImageUpdateService } from '../services/profile-image-update.service.js';

/** Creates routes for authenticated user-account operations. */
export function createUserAccountsRouter(): Router {
  const usersRouter = Router();

  const requireAuthentication = createRequireAuthentication();

  const getCurrentUser = createCurrentUserController();

  const accountDeletionRequestController =
    createAccountDeletionRequestController({
      accountDeletionRequestService: new AccountDeletionRequestService({
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
    new ProfileUpdateService(),
  );

  const uploadProfileImageController = createProfileImageUploadController(
    new ProfileImageUpdateService(),
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
    uploadImage,
    validateImageContent,
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

export default createUserAccountsRouter();
