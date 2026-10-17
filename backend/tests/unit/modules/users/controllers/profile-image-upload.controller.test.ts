import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../../../src/shared/errors/app-error.js';
import { createProfileImageUploadController } from '../../../../../src/modules/users/controllers/profile-image-upload.controller.js';
import type { ProfileImageUpdateService } from '../../../../../src/modules/users/services/profile-image-update.service.js';
import type { CurrentUserResponse } from '../../../../../src/modules/users/types/current-user.types.js';

const mocks = vi.hoisted(() => ({
  updateProfileImage: vi.fn(),
}));

const profileImageUpdateService = {
  updateProfileImage: mocks.updateProfileImage,
} as unknown as ProfileImageUpdateService;

const userId = '507f1f77bcf86cd799439011';

const updatedUser: CurrentUserResponse = {
  id: userId,
  email: 'alex@example.com',
  emailVerifiedAt: null,
  roles: ['buyer'],
  status: 'active',
  profile: {
    firstName: 'Alex',
    lastName: 'Tennis',
    image: {
      publicId: 'tennis-xpress/profile-images/image-123',
      secureUrl: 'https://res.cloudinary.com/demo/image-123.jpg',
    },
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

function createResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };

  response.status.mockReturnValue(response);

  return response;
}

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    auth: {
      userId,
      sessionId: '507f1f77bcf86cd799439012',
      roles: ['buyer'],
    },
    file: {
      buffer: Buffer.from('image-content'),
      mimetype: 'image/jpeg',
      originalname: 'profile.jpg',
      size: 14,
    },
    ...overrides,
  };
}

describe('createProfileImageUploadController', () => {
  const next = vi.fn() as unknown as NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateProfileImage.mockResolvedValue(updatedUser);
  });

  it('returns the updated user profile on success', async () => {
    const req = createRequest();
    const res = createResponse();

    const controller = createProfileImageUploadController(
      profileImageUpdateService,
    );

    await controller(
      req as unknown as Request,
      res as unknown as Response,
      next,
    );

    expect(mocks.updateProfileImage).toHaveBeenCalledWith(userId, {
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
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

  it('forwards an authentication error when the user is not authenticated', async () => {
    const req = createRequest({ auth: undefined });
    const res = createResponse();

    const controller = createProfileImageUploadController(
      profileImageUpdateService,
    );

    await controller(
      req as unknown as Request,
      res as unknown as Response,
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'AUTHENTICATION_REQUIRED',
      }),
    );
    expect(mocks.updateProfileImage).not.toHaveBeenCalled();
  });

  it('forwards an error when no file is provided', async () => {
    const req = createRequest({ file: undefined });
    const res = createResponse();

    const controller = createProfileImageUploadController(
      profileImageUpdateService,
    );

    await controller(
      req as unknown as Request,
      res as unknown as Response,
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        code: 'PROFILE_IMAGE_REQUIRED',
      }),
    );
    expect(mocks.updateProfileImage).not.toHaveBeenCalled();
  });

  it('forwards service errors to the next middleware', async () => {
    const serviceError = new AppError({
      statusCode: 502,
      code: 'PROFILE_IMAGE_UPLOAD_FAILED',
      message: 'The profile image could not be uploaded.',
    });

    mocks.updateProfileImage.mockRejectedValue(serviceError);

    const req = createRequest();
    const res = createResponse();

    const controller = createProfileImageUploadController(
      profileImageUpdateService,
    );

    await controller(
      req as unknown as Request,
      res as unknown as Response,
      next,
    );

    expect(next).toHaveBeenCalledWith(serviceError);
  });
});
