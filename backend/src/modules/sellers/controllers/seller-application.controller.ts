import type { RequestHandler } from 'express';

import { AppError } from '../../../shared/errors/app-error.js';
import { SellerApplicationService } from '../services/seller-application.service.js';

import type { CreateSellerApplicationRequest } from '../validations/seller-application.validation.js';

/** Dependencies required by the seller application controller. */
export interface SellerApplicationControllerDependencies {
  sellerApplicationService: SellerApplicationService;
}

/** Creates controllers for applicant-owned seller application operations. */
export function createSellerApplicationController(
  dependencies: SellerApplicationControllerDependencies,
) {
  const { sellerApplicationService } = dependencies;

  const submitApplication: RequestHandler = async (req, res, next) => {
    try {
      if (!req.auth) {
        throw new AppError({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required to access this resource.',
        });
      }

      const input = req.body as CreateSellerApplicationRequest;

      const application = await sellerApplicationService.submitApplication(
        req.auth.userId,
        input,
      );

      res.status(201).json({
        success: true,
        data: { application },
      });
    } catch (error) {
      next(error);
    }
  };

  const getLatestApplication: RequestHandler = async (req, res, next) => {
    try {
      if (!req.auth) {
        throw new AppError({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required to access this resource.',
        });
      }

      const application = await sellerApplicationService.getMyLatestApplication(
        req.auth.userId,
      );

      res.status(200).json({
        success: true,
        data: { application },
      });
    } catch (error) {
      next(error);
    }
  };

  const getApplicationById: RequestHandler = async (req, res, next) => {
    try {
      if (!req.auth) {
        throw new AppError({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required to access this resource.',
        });
      }

      const applicationId = req.params.applicationId;

      if (typeof applicationId !== 'string') {
        throw new AppError({
          statusCode: 400,
          code: 'INVALID_APPLICATION_ID',
          message: 'A valid seller application ID is required.',
        });
      }

      const application = await sellerApplicationService.getMyApplicationById(
        req.auth.userId,
        applicationId,
      );

      res.status(200).json({
        success: true,
        data: { application },
      });
    } catch (error) {
      next(error);
    }
  };

  return {
    submitApplication,
    getLatestApplication,
    getApplicationById,
  };
}
