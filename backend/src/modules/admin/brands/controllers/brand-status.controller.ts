import type { RequestHandler } from 'express';
import { Types } from 'mongoose';

import { AppError } from '../../../../shared/errors/app-error.js';

import { BrandStatusService } from '../services/brand-status.service.js';

import type { UpdateBrandStatusInput } from '../services/brand-status.service.js';

/* -------------------------------------------------------------------------- */
/* Brand status controller                                                    */
/* -------------------------------------------------------------------------- */

export function createBrandStatusController() {
  const brandStatusService = {
    activate: (input: UpdateBrandStatusInput) =>
      BrandStatusService.activate(input),
    deactivate: (input: UpdateBrandStatusInput) =>
      BrandStatusService.deactivate(input),
  };

  /* ------------------------------------------------------------------------ */
  /* Shared status update handler                                             */
  /* ------------------------------------------------------------------------ */

  const updateBrandStatus = (
    operation: 'activate' | 'deactivate',
  ): RequestHandler => {
    return async (req, res, next) => {
      try {
        if (!req.auth) {
          throw new AppError({
            statusCode: 401,
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required to access this resource.',
          });
        }

        const brandId = req.params.brandId;

        if (typeof brandId !== 'string') {
          throw new AppError({
            statusCode: 400,
            code: 'INVALID_BRAND_ID',
            message: 'A valid brand ID is required.',
          });
        }

        const input: UpdateBrandStatusInput = {
          brandId: new Types.ObjectId(brandId),
          updatedBy: new Types.ObjectId(req.auth.userId),
        };

        const brand =
          operation === 'activate'
            ? await brandStatusService.activate(input)
            : await brandStatusService.deactivate(input);

        res.status(200).json({
          success: true,
          data: { brand },
        });
      } catch (error) {
        next(error);
      }
    };
  };

  return {
    activateBrand: updateBrandStatus('activate'),
    deactivateBrand: updateBrandStatus('deactivate'),
  };
}
