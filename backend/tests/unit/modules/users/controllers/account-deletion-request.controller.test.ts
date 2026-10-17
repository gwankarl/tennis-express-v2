import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../../../src/shared/errors/app-error.js';
import { createAccountDeletionRequestController } from '../../../../../src/modules/users/controllers/account-deletion-request.controller.js';

const mocks = vi.hoisted(() => ({
  requestDeletion: vi.fn(),
  cancelRequest: vi.fn(),
}));

vi.mock(
  '../../../../../src/modules/users/services/account-deletion-request.service.js',
  () => ({
    AccountDeletionRequestService: class {
      requestDeletion = mocks.requestDeletion;
      cancelRequest = mocks.cancelRequest;
    },
  }),
);

const userId = '507f1f77bcf86cd799439011';
const requestId = '607f1f77bcf86cd799439012';

const deletionRequest = {
  id: requestId,
  userId,
  status: 'scheduled',
  isActive: true,
  requestedAt: new Date('2026-01-10T10:00:00.000Z'),
  eligibilityCheckedAt: new Date('2026-01-10T10:00:00.000Z'),
  scheduledFor: new Date('2026-01-17T10:00:00.000Z'),
  cancelledAt: null,
  completedAt: null,
  processingStartedAt: null,
  attempts: 0,
  nextAttemptAt: null,
  blockedReasons: [],
  lastError: null,
  reviewedBy: null,
  reviewNotes: null,
};

function createRequest(authenticated = true): Request {
  return {
    auth: authenticated
      ? {
          userId,
          sessionId: '507f1f77bcf86cd799439013',
          roles: ['buyer'],
        }
      : undefined,
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
  action: 'requestDeletion' | 'cancelRequest',
  authenticated = true,
) {
  const req = createRequest(authenticated);
  const res = createResponse();
  const next = createNext();

  const controller = createAccountDeletionRequestController();

  await (
    controller[action] as unknown as (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => Promise<void>
  )(req, res, next);

  return { req, res, next };
}

describe('account-deletion request controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requestDeletion.mockResolvedValue(deletionRequest);
    mocks.cancelRequest.mockResolvedValue({
      ...deletionRequest,
      status: 'cancelled',
      isActive: false,
      scheduledFor: null,
      cancelledAt: new Date('2026-01-11T10:00:00.000Z'),
    });
  });

  describe('requestDeletion', () => {
    it('creates a deletion request and returns HTTP 201', async () => {
      const { res, next } = await invokeController('requestDeletion');

      expect(mocks.requestDeletion).toHaveBeenCalledWith(userId);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { request: deletionRequest },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('passes an authentication error to the error handler when req.auth is missing', async () => {
      const { next } = await invokeController('requestDeletion', false);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
        }),
      );

      expect(mocks.requestDeletion).not.toHaveBeenCalled();
    });

    it('passes service errors to the error handler', async () => {
      const serviceError = new AppError({
        statusCode: 409,
        code: 'ACCOUNT_DELETION_REQUEST_ALREADY_ACTIVE',
        message: 'An active account-deletion request already exists.',
      });

      mocks.requestDeletion.mockRejectedValue(serviceError);

      const { next } = await invokeController('requestDeletion');

      expect(next).toHaveBeenCalledWith(serviceError);
    });
  });

  describe('cancelRequest', () => {
    it('cancels a deletion request and returns HTTP 200', async () => {
      const { res, next } = await invokeController('cancelRequest');

      expect(mocks.cancelRequest).toHaveBeenCalledWith(userId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          request: expect.objectContaining({
            status: 'cancelled',
            isActive: false,
          }),
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('passes an authentication error to the error handler when req.auth is missing', async () => {
      const { next } = await invokeController('cancelRequest', false);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
        }),
      );

      expect(mocks.cancelRequest).not.toHaveBeenCalled();
    });

    it('passes service errors to the error handler', async () => {
      const serviceError = new AppError({
        statusCode: 409,
        code: 'ACCOUNT_DELETION_REQUEST_NOT_CANCELLABLE',
        message:
          'There is no cancellable account-deletion request for this user.',
      });

      mocks.cancelRequest.mockRejectedValue(serviceError);

      const { next } = await invokeController('cancelRequest');

      expect(next).toHaveBeenCalledWith(serviceError);
    });
  });
});
