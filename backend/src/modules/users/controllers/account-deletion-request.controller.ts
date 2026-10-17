import type { RequestHandler } from 'express';

import { AppError } from '../../../shared/errors/app-error.js';
import { AccountDeletionRequestService } from '../services/account-deletion-request.service.js';

/* Dependencies required by the account-deletion request controller. */
export interface AccountDeletionRequestControllerDependencies {
  accountDeletionRequestService?: AccountDeletionRequestService;
}

/* Creates a controller for managing the authenticated user's deletion request. */
export function createAccountDeletionRequestController(
  dependencies: AccountDeletionRequestControllerDependencies = {},
): {
  requestDeletion: RequestHandler;
  cancelRequest: RequestHandler;
} {
  const accountDeletionRequestService =
    dependencies.accountDeletionRequestService ??
    new AccountDeletionRequestService({
      async checkEligibility() {
        throw new AppError({
          statusCode: 503,
          code: 'ACCOUNT_DELETION_ELIGIBILITY_UNAVAILABLE',
          message:
            'Account deletion eligibility checks are not configured yet.',
        });
      },
    });

  const requestDeletion: RequestHandler = async (req, res, next) => {
    try {
      if (!req.auth) {
        throw new AppError({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required to access this resource.',
        });
      }

      const request = await accountDeletionRequestService.requestDeletion(
        req.auth.userId,
      );

      res.status(201).json({
        success: true,
        data: { request },
      });
    } catch (error) {
      next(error);
    }
  };

  const cancelRequest: RequestHandler = async (req, res, next) => {
    try {
      if (!req.auth) {
        throw new AppError({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required to access this resource.',
        });
      }

      const request = await accountDeletionRequestService.cancelRequest(
        req.auth.userId,
      );

      res.status(200).json({
        success: true,
        data: { request },
      });
    } catch (error) {
      next(error);
    }
  };

  return {
    requestDeletion,
    cancelRequest,
  };
}
