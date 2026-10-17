import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../../../src/shared/errors/app-error.js';
import type { ProfileUpdateService } from '../../../../../src/modules/users/services/profile-update.service.js';

import { createProfileUpdateController } from '../../../../../src/modules/users/controllers/profile-update.controller.js';

describe('createProfileUpdateController', () => {
  const updateProfile = vi.fn();

  const profileUpdateService = {
    updateProfile,
  } as unknown as ProfileUpdateService;

  const userId = '507f1f77bcf86cd799439011';

  const updatedUser = {
    id: userId,
    email: 'user@example.com',
    emailVerifiedAt: null,
    roles: ['buyer'],
    status: 'active',
    profile: {
      firstName: 'Jane',
      lastName: 'Doe',
      image: null,
      contactDetails: {
        phoneNumber: '123456789',
        preferredContactMethod: 'email',
      },
    },
    notificationPreferences: {
      email: true,
      inApp: true,
    },
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };

  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      auth: {
        userId,
        sessionId: '507f1f77bcf86cd799439012',
        roles: ['buyer'],
      },
      body: {
        firstName: 'Jane',
      },
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    next = vi.fn();
    updateProfile.mockResolvedValue(updatedUser);
  });

  it('updates the authenticated user profile and returns status 200', async () => {
    const controller = createProfileUpdateController(profileUpdateService);

    await controller(req as Request, res as Response, next);

    expect(updateProfile).toHaveBeenCalledWith(userId, {
      firstName: 'Jane',
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        user: updatedUser,
      },
    });

    expect(next).not.toHaveBeenCalled();
  });

  it('forwards an authentication error when request authentication is missing', async () => {
    req.auth = undefined;

    const controller = createProfileUpdateController(profileUpdateService);

    await controller(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'AUTHENTICATION_REQUIRED',
      }),
    );

    expect(updateProfile).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('forwards service errors to the error handler', async () => {
    const error = new AppError({
      statusCode: 404,
      code: 'USER_NOT_FOUND',
      message: 'The user account could not be found.',
    });

    updateProfile.mockRejectedValue(error);

    const controller = createProfileUpdateController(profileUpdateService);

    await controller(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});
