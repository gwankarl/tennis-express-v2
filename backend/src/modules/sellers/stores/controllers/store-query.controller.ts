import type { RequestHandler } from 'express';
import { AppError } from '../../../../shared/errors/app-error.js';

import { StoreQueryService } from '../services/store-query.service.js';

/** Creates controllers for publicly accessible store queries. */
export function createStoreQueryController() {
  const storeQueryService = new StoreQueryService();

  const getMyStore: RequestHandler = async (req, res, next) => {
    try {
      if (!req.auth?.userId) {
        next(
          new AppError({
            statusCode: 401,
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required to access this resource.',
          }),
        );
        return;
      }

      const store = await storeQueryService.getMyStore(req.auth.userId);

      res.status(200).json({
        success: true,
        data: { store },
      });
    } catch (error) {
      next(error);
    }
  };

  return { getMyStore };
}

/** Default controller instance for public store queries. */
export const storeQueryController = createStoreQueryController();
