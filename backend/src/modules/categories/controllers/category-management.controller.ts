import type { RequestHandler } from 'express';
import { Types } from 'mongoose';

import { AppError } from '../../../shared/errors/app-error.js';

import { CategoryManagementService } from '../services/category-management.service.js';

import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../services/category-management.service.js';

import type {
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '../validations/category.validation.js';

/** Defines the category management operations required by this controller. */
export interface CategoryManagementControllerService {
  create(input: CreateCategoryInput): Promise<unknown>;
  update(input: UpdateCategoryInput): Promise<unknown>;
}

/** Dependencies required by the category management controller. */
export interface CategoryManagementControllerDependencies {
  categoryManagementService?: CategoryManagementControllerService;
}

/** Creates handlers for administrator-managed category operations. */
export function createCategoryManagementController(
  dependencies: CategoryManagementControllerDependencies = {},
) {
  const categoryManagementService = dependencies.categoryManagementService ?? {
    create: (input: CreateCategoryInput) =>
      CategoryManagementService.create(input),
    update: (input: UpdateCategoryInput) =>
      CategoryManagementService.update(input),
  };

  const createCategory: RequestHandler = async (req, res, next) => {
    try {
      if (!req.auth) {
        throw new AppError({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required to access this resource.',
        });
      }

      const input = req.body as CreateCategoryRequest;

      const category = await categoryManagementService.create({
        ...input,
        createdBy: new Types.ObjectId(req.auth.userId),
      });

      res.status(201).json({
        success: true,
        data: { category },
      });
    } catch (error) {
      next(error);
    }
  };

  const updateCategory: RequestHandler = async (req, res, next) => {
    try {
      if (!req.auth) {
        throw new AppError({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required to access this resource.',
        });
      }

      const categoryId = req.params.categoryId;

      if (typeof categoryId !== 'string') {
        throw new AppError({
          statusCode: 400,
          code: 'INVALID_CATEGORY_ID',
          message: 'A valid category ID is required.',
        });
      }

      const changes = req.body as UpdateCategoryRequest;

      const category = await categoryManagementService.update({
        categoryId: new Types.ObjectId(categoryId),
        updatedBy: new Types.ObjectId(req.auth.userId),
        changes,
      });

      res.status(200).json({
        success: true,
        data: { category },
      });
    } catch (error) {
      next(error);
    }
  };

  return {
    createCategory,
    updateCategory,
  };
}
