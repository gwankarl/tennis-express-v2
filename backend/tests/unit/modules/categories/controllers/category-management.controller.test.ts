import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../../../src/shared/errors/app-error.js';
import { createCategoryManagementController } from '../../../../../src/modules/categories/controllers/category-management.controller.js';
import type { CategoryManagementControllerService } from '../../../../../src/modules/categories/controllers/category-management.controller.js';

const userId = '507f1f77bcf86cd799439011';
const categoryId = '507f1f77bcf86cd799439012';

const category = {
  _id: new Types.ObjectId(categoryId),
  name: 'Tennis Rackets',
  slug: 'tennis-rackets',
  parentId: null,
  description: null,
  attributes: [],
  status: 'active',
  sortOrder: 0,
  createdBy: new Types.ObjectId(userId),
  updatedBy: new Types.ObjectId(userId),
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-01T10:00:00.000Z'),
};

const mocks = {
  create: vi.fn<CategoryManagementControllerService['create']>(),
  update: vi.fn<CategoryManagementControllerService['update']>(),
};

const categoryManagementService: CategoryManagementControllerService = {
  create: mocks.create,
  update: mocks.update,
};

function createRequest(options?: {
  authenticated?: boolean;
  params?: Record<string, string>;
  body?: Record<string, unknown>;
}): Request {
  const authenticated = options?.authenticated ?? true;

  return {
    auth: authenticated
      ? {
          userId,
          sessionId: '507f1f77bcf86cd799439013',
          roles: ['admin'],
        }
      : undefined,
    params: options?.params ?? {},
    body: options?.body ?? {},
  } as unknown as Request;
}

function createResponse(): Response {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };

  response.status.mockReturnValue(response);

  return response as unknown as Response;
}

function createNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

async function invokeController(
  handlerName: 'createCategory' | 'updateCategory',
  options?: {
    authenticated?: boolean;
    params?: Record<string, string>;
    body?: Record<string, unknown>;
  },
) {
  const req = createRequest(options);
  const res = createResponse();
  const next = createNext();

  const controller = createCategoryManagementController({
    categoryManagementService,
  });

  await controller[handlerName](req, res, next);

  return { req, res, next };
}

describe('category management controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue(category);
    mocks.update.mockResolvedValue(category);
  });

  describe('createCategory', () => {
    it('creates a category and returns HTTP 201', async () => {
      const body = {
        name: 'Tennis Rackets',
        description: 'Equipment for tennis players.',
      };

      const { res, next } = await invokeController('createCategory', {
        body,
      });

      expect(mocks.create).toHaveBeenCalledWith({
        ...body,
        createdBy: new Types.ObjectId(userId),
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { category },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated requests', async () => {
      const { next } = await invokeController('createCategory', {
        authenticated: false,
        body: { name: 'Tennis Rackets' },
      });

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
        }),
      );

      expect(mocks.create).not.toHaveBeenCalled();
    });

    it('forwards service errors to the error handler', async () => {
      const serviceError = new AppError({
        statusCode: 409,
        code: 'CATEGORY_CONFLICT',
        message: 'The category conflicts with an existing category.',
      });

      mocks.create.mockRejectedValue(serviceError);

      const { next } = await invokeController('createCategory', {
        body: { name: 'Tennis Rackets' },
      });

      expect(next).toHaveBeenCalledWith(serviceError);
    });
  });

  describe('updateCategory', () => {
    it('updates a category and returns HTTP 200', async () => {
      const changes = {
        name: 'Professional Tennis Rackets',
        description: 'Rackets for advanced players.',
      };

      const { res, next } = await invokeController('updateCategory', {
        params: { categoryId },
        body: changes,
      });

      expect(mocks.update).toHaveBeenCalledWith({
        categoryId: new Types.ObjectId(categoryId),
        updatedBy: new Types.ObjectId(userId),
        changes,
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { category },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated requests', async () => {
      const { next } = await invokeController('updateCategory', {
        authenticated: false,
        params: { categoryId },
        body: { name: 'Updated Rackets' },
      });

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
        }),
      );

      expect(mocks.update).not.toHaveBeenCalled();
    });

    it('rejects a missing category ID', async () => {
      const { next } = await invokeController('updateCategory', {
        params: {},
        body: { name: 'Updated Rackets' },
      });

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          code: 'INVALID_CATEGORY_ID',
        }),
      );

      expect(mocks.update).not.toHaveBeenCalled();
    });

    it('forwards service errors to the error handler', async () => {
      const serviceError = new AppError({
        statusCode: 404,
        code: 'CATEGORY_NOT_FOUND',
        message: 'The category does not exist.',
      });

      mocks.update.mockRejectedValue(serviceError);

      const { next } = await invokeController('updateCategory', {
        params: { categoryId },
        body: { name: 'Updated Rackets' },
      });

      expect(next).toHaveBeenCalledWith(serviceError);
    });
  });
});
