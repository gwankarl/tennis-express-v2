import type { RequestHandler } from 'express';

import { AppError } from '../../../shared/errors/app-error.js';
import { StoreManagementService } from '../services/store-management.service.js';
import type {
  UpdateStoreCollectionOptionsInput,
  UpdateStoreDeliveryOptionsInput,
  UpdateStoreIdentityInput,
  UpdateStoreLocationInput,
  UpdateStoreReturnPolicyInput,
  UpdateStoreLogoInput,
} from '../services/store-management.service.js';

/**
 * Creates handlers for seller-owned store management operations.
 */
export const createStoreManagementController = (
  storeManagementService = new StoreManagementService(),
) => {
  const getSellerId = (req: Parameters<RequestHandler>[0]): string => {
    const sellerId = req.auth?.userId;

    if (!sellerId) {
      throw new AppError({
        statusCode: 401,
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required.',
      });
    }

    return sellerId;
  };

  const updateStoreIdentity: RequestHandler = async (req, res, next) => {
    try {
      const sellerId = getSellerId(req);
      const input = req.body as UpdateStoreIdentityInput;

      const store = await storeManagementService.updateStoreIdentity(
        sellerId,
        input,
      );

      res.status(200).json({
        success: true,
        data: { store },
      });
    } catch (error) {
      next(error);
    }
  };

  const updateStoreLocation: RequestHandler = async (req, res, next) => {
    try {
      const sellerId = getSellerId(req);
      const input = req.body as UpdateStoreLocationInput;

      const store = await storeManagementService.updateStoreLocation(
        sellerId,
        input,
      );

      res.status(200).json({
        success: true,
        data: { store },
      });
    } catch (error) {
      next(error);
    }
  };

  const updateStoreLogo: RequestHandler = async (req, res, next) => {
    try {
      const sellerId = getSellerId(req);

      if (!req.file) {
        throw new AppError({
          statusCode: 400,
          code: 'STORE_LOGO_REQUIRED',
          message: 'A store logo image is required.',
        });
      }

      const input: UpdateStoreLogoInput = {
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
      };

      const store = await storeManagementService.updateStoreLogo(
        sellerId,
        input,
      );

      res.status(200).json({
        success: true,
        data: { store },
      });
    } catch (error) {
      next(error);
    }
  };

  const updateStoreDeliveryOptions: RequestHandler = async (req, res, next) => {
    try {
      const sellerId = getSellerId(req);
      const input = req.body as UpdateStoreDeliveryOptionsInput;

      const store = await storeManagementService.updateStoreDeliveryOptions(
        sellerId,
        input,
      );

      res.status(200).json({
        success: true,
        data: { store },
      });
    } catch (error) {
      next(error);
    }
  };

  const updateStoreCollectionOptions: RequestHandler = async (
    req,
    res,
    next,
  ) => {
    try {
      const sellerId = getSellerId(req);
      const input = req.body as UpdateStoreCollectionOptionsInput;

      const store = await storeManagementService.updateStoreCollectionOptions(
        sellerId,
        input,
      );

      res.status(200).json({
        success: true,
        data: { store },
      });
    } catch (error) {
      next(error);
    }
  };

  const updateStoreReturnPolicy: RequestHandler = async (req, res, next) => {
    try {
      const sellerId = getSellerId(req);
      const input = req.body as UpdateStoreReturnPolicyInput;

      const store = await storeManagementService.updateStoreReturnPolicy(
        sellerId,
        input,
      );

      res.status(200).json({
        success: true,
        data: { store },
      });
    } catch (error) {
      next(error);
    }
  };

  return {
    updateStoreIdentity,
    updateStoreLocation,
    updateStoreLogo,
    updateStoreDeliveryOptions,
    updateStoreCollectionOptions,
    updateStoreReturnPolicy,
  };
};

export const storeManagementController = createStoreManagementController();
