import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccessTokenService } from '../../../../../src/modules/auth/services/access-token.service.js';
import type { SessionService } from '../../../../../src/modules/auth/services/session.service.js';
import type { CategoryManagementControllerService } from '../../../../../src/modules/categories/controllers/category-management.controller.js';
import { AppError } from '../../../../../src/shared/errors/app-error.js';
import { createTestApp } from '../../../../helpers/test-app.js';

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  findValidSession: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

const accessTokenService = {
  verifyToken: mocks.verifyToken,
} as unknown as AccessTokenService;

const sessionService = {
  findValidSession: mocks.findValidSession,
} as unknown as SessionService;

const categoryManagementService = {
  create: mocks.create,
  update: mocks.update,
} as unknown as CategoryManagementControllerService;

const adminId = '507f1f77bcf86cd799439011';
const sessionId = '507f1f77bcf86cd799439012';
const categoryId = '507f1f77bcf86cd799439013';

const category = {
  _id: categoryId,
  name: 'Tennis Rackets',
  slug: 'tennis-rackets',
  parentId: null,
  description: null,
  attributes: [],
  status: 'active',
  sortOrder: 0,
  createdBy: adminId,
  updatedBy: adminId,
  createdAt: new Date('2026-10-01T10:00:00.000Z'),
  updatedAt: new Date('2026-10-01T10:00:00.000Z'),
};

const app = () =>
  createTestApp({
    accessTokenService,
    sessionService,
    categoryManagementService,
  });

const authenticate = (testRequest: request.Test) =>
  testRequest.set('Authorization', 'Bearer test-access-token');

const collectionUrl = '/api/v1/admin/categories';
const categoryUrl = `${collectionUrl}/${categoryId}`;

describe('Admin category management routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.verifyToken.mockReturnValue({
      userId: adminId,
      sessionId,
      roles: ['admin'],
    });

    mocks.findValidSession.mockResolvedValue({ userId: adminId });
    mocks.create.mockResolvedValue(category);
    mocks.update.mockResolvedValue(category);
  });

  describe('POST /api/v1/admin/categories', () => {
    it('rejects requests without an access token', async () => {
      const response = await request(app())
        .post(collectionUrl)
        .send({ name: 'Tennis Rackets' });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'AUTHENTICATION_REQUIRED' },
      });

      expect(mocks.create).not.toHaveBeenCalled();
    });

    it('rejects authenticated users without the admin role', async () => {
      mocks.verifyToken.mockReturnValue({
        userId: adminId,
        sessionId,
        roles: ['buyer'],
      });

      const response = await authenticate(
        request(app()).post(collectionUrl),
      ).send({ name: 'Tennis Rackets' });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS' },
      });

      expect(mocks.create).not.toHaveBeenCalled();
    });

    it('rejects invalid request bodies', async () => {
      const response = await authenticate(
        request(app()).post(collectionUrl),
      ).send({ name: '' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });

      expect(mocks.create).not.toHaveBeenCalled();
    });

    it('allows an administrator to create a category', async () => {
      const response = await authenticate(
        request(app()).post(collectionUrl),
      ).send({
        name: 'Tennis Rackets',
        description: 'Equipment for tennis players.',
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          category: {
            _id: categoryId,
            name: 'Tennis Rackets',
            slug: 'tennis-rackets',
          },
        },
      });

      expect(mocks.create).toHaveBeenCalledWith({
        name: 'Tennis Rackets',
        description: 'Equipment for tennis players.',
        createdBy: expect.objectContaining({
          _bsontype: 'ObjectId',
        }),
      });
    });

    it('forwards service errors to the error handler', async () => {
      mocks.create.mockRejectedValue(
        new AppError({
          statusCode: 409,
          code: 'CATEGORY_CONFLICT',
          message: 'The category conflicts with an existing category.',
        }),
      );

      const response = await authenticate(
        request(app()).post(collectionUrl),
      ).send({ name: 'Tennis Rackets' });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'CATEGORY_CONFLICT' },
      });
    });
  });

  describe('PATCH /api/v1/admin/categories/:categoryId', () => {
    it('rejects requests without an access token', async () => {
      const response = await request(app())
        .patch(categoryUrl)
        .send({ name: 'Updated Rackets' });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'AUTHENTICATION_REQUIRED' },
      });

      expect(mocks.update).not.toHaveBeenCalled();
    });

    it('rejects authenticated users without the admin role', async () => {
      mocks.verifyToken.mockReturnValue({
        userId: adminId,
        sessionId,
        roles: ['buyer'],
      });

      const response = await authenticate(
        request(app()).patch(categoryUrl),
      ).send({ name: 'Updated Rackets' });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS' },
      });

      expect(mocks.update).not.toHaveBeenCalled();
    });

    it('rejects an invalid category ID', async () => {
      const response = await authenticate(
        request(app()).patch(`${collectionUrl}/invalid-id`),
      ).send({ name: 'Updated Rackets' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });

      expect(mocks.update).not.toHaveBeenCalled();
    });

    it('rejects invalid update bodies', async () => {
      const response = await authenticate(
        request(app()).patch(categoryUrl),
      ).send({ name: '' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });

      expect(mocks.update).not.toHaveBeenCalled();
    });

    it('allows an administrator to update a category', async () => {
      const response = await authenticate(
        request(app()).patch(categoryUrl),
      ).send({
        name: 'Updated Rackets',
        description: 'Updated category description.',
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          category: {
            _id: categoryId,
            name: 'Tennis Rackets',
          },
        },
      });

      expect(mocks.update).toHaveBeenCalledWith({
        categoryId: expect.objectContaining({
          _bsontype: 'ObjectId',
        }),
        updatedBy: expect.objectContaining({
          _bsontype: 'ObjectId',
        }),
        changes: {
          name: 'Updated Rackets',
          description: 'Updated category description.',
        },
      });
    });

    it('forwards service errors to the error handler', async () => {
      mocks.update.mockRejectedValue(
        new AppError({
          statusCode: 404,
          code: 'CATEGORY_NOT_FOUND',
          message: 'The category does not exist.',
        }),
      );

      const response = await authenticate(
        request(app()).patch(categoryUrl),
      ).send({ name: 'Updated Rackets' });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'CATEGORY_NOT_FOUND' },
      });
    });
  });
});
