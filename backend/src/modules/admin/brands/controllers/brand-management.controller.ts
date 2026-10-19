import type { RequestHandler } from 'express';
import { Types } from 'mongoose';

import { AppError } from '../../../../shared/errors/app-error.js';

import { BrandManagementService } from '../services/brand-management.service.js';

import type {
  CreateBrandInput,
  UpdateBrandInput,
} from '../services/brand-management.service.js';

import type {
  CreateBrandRequest,
  UpdateBrandRequest,
} from '../validations/brand.validation.js';

/* -------------------------------------------------------------------------- */
/* Brand management controller                                                */
/* -------------------------------------------------------------------------- */

export function createBrandManagementController() {
  const brandManagementService = {
    create: (input: CreateBrandInput) => BrandManagementService.create(input),
    update: (input: UpdateBrandInput) => BrandManagementService.update(input),
  };

  /* ------------------------------------------------------------------------ */
  /* Create a brand                                                           */
  /* ------------------------------------------------------------------------ */

  const createBrand: RequestHandler = async (req, res, next) => {
    try {
      if (!req.auth) {
        throw new AppError({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required to access this resource.',
        });
      }

      const input = req.body as CreateBrandRequest;

      const brand = await brandManagementService.create({
        ...input,
        createdBy: new Types.ObjectId(req.auth.userId),
      });

      res.status(201).json({
        success: true,
        data: { brand },
      });
    } catch (error) {
      next(error);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Update a brand                                                           */
  /* ------------------------------------------------------------------------ */

  const updateBrand: RequestHandler = async (req, res, next) => {
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

      const changes = req.body as UpdateBrandRequest;

      const brand = await brandManagementService.update({
        brandId: new Types.ObjectId(brandId),
        updatedBy: new Types.ObjectId(req.auth.userId),
        changes,
      });

      res.status(200).json({
        success: true,
        data: { brand },
      });
    } catch (error) {
      next(error);
    }
  };

  return {
    createBrand,
    updateBrand,
  };
}
