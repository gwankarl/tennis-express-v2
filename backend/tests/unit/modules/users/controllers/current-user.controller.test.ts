import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../../../src/shared/errors/app-error.js';
import { createCurrentUserController } from '../../../../../src/modules/users/controllers/current-user.controller.js';
import type { CurrentUserResponse } from '../../../../../src/modules/users/types/current-user.types.js';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock(
  '../../../../../src/modules/users/services/current-user.service.js',
  () => ({
    CurrentUserService: class {
      getCurrentUser = mocks.getCurrentUser;
    },
  }),
);

const userId = '507f1f77bcf86cd799439011';

const currentUser: CurrentUserResponse = {
  id: userId,
  email: 'buyer@example.com',
  emailVerifiedAt: new Date('2026-01-10T10:00:00.000Z'),
  roles: ['buyer'],
  status: 'active',
  profile: {
    firstName: 'Alex',
    lastName: 'Buyer',
    image: null,
    contactDetails: {},
  },
  notificationPreferences: {
    email: true,
    inApp: true,
  },
  lastLoginAt: null,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-12T10:00:00.000Z'),
};

function createRequest(authenticated = true): Request {
  return {
    auth: authenticated
      ? {
          userId,
          sessionId: '507f1f77bcf86cd799439012',
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

async function invokeController(authenticated = true) {
  const req = createRequest(authenticated);
  const res = createResponse();
  const next = createNext();

  const controller = createCurrentUserController();

  await (
    controller as unknown as (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => Promise<void>
  )(req, res, next);

  return { req, res, next };
}

describe('current-user controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue(currentUser);
  });

  it('returns the current user with HTTP 200', async () => {
    const { res, next } = await invokeController();

    expect(mocks.getCurrentUser).toHaveBeenCalledWith(userId);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { user: currentUser },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('passes an authentication error to the error handler when req.auth is missing', async () => {
    const { next } = await invokeController(false);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'AUTHENTICATION_REQUIRED',
      }),
    );

    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
  });

  it('passes service errors to the error handler', async () => {
    const serviceError = new AppError({
      statusCode: 404,
      code: 'USER_NOT_FOUND',
      message: 'The user account could not be found.',
    });

    mocks.getCurrentUser.mockRejectedValue(serviceError);

    const { next } = await invokeController();

    expect(next).toHaveBeenCalledWith(serviceError);
  });
});
