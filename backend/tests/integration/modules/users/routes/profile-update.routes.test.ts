import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccessTokenService } from '../../../../../src/modules/auth/services/access-token.service.js';
import type { SessionService } from '../../../../../src/modules/auth/services/session.service.js';
import type { ProfileUpdateService } from '../../../../../src/modules/users/services/profile-update.service.js';
import type { CurrentUserResponse } from '../../../../../src/modules/users/types/current-user.types.js';
import { createTestApp } from '../../../../helpers/test-app.js';
import { AppError } from '../../../../../src/shared/errors/app-error.js';

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  findValidSession: vi.fn(),
  updateProfile: vi.fn(),
}));

const accessTokenService = {
  verifyToken: mocks.verifyToken,
} as unknown as AccessTokenService;

const sessionService = {
  findValidSession: mocks.findValidSession,
} as unknown as SessionService;

const profileUpdateService = {
  updateProfile: mocks.updateProfile,
} as unknown as ProfileUpdateService;

const userId = '507f1f77bcf86cd799439011';
const sessionId = '507f1f77bcf86cd799439012';

const updatedUser: CurrentUserResponse = {
  id: userId,
  email: 'alex@example.com',
  emailVerifiedAt: null,
  roles: ['buyer'],
  status: 'active',
  profile: {
    firstName: 'Alexandra',
    lastName: 'Tennis',
    image: null,
    contactDetails: {
      phoneNumber: '123456789',
      preferredContactMethod: 'phone',
    },
  },
  notificationPreferences: {
    email: true,
    inApp: true,
  },
  lastLoginAt: null,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-12T10:00:00.000Z'),
};

const app = () =>
  createTestApp({
    accessTokenService,
    sessionService,
    profileUpdateService,
  });

describe('PATCH /api/v1/users/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.verifyToken.mockReturnValue({
      userId,
      sessionId,
      roles: ['buyer'],
    });

    mocks.findValidSession.mockResolvedValue({
      userId,
    });

    mocks.updateProfile.mockResolvedValue(updatedUser);
  });

  it('rejects requests without an access token', async () => {
    const response = await request(app())
      .patch('/api/v1/users/me')
      .send({ firstName: 'Alexandra' });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
      },
    });

    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it('rejects requests with an invalid session', async () => {
    mocks.findValidSession.mockResolvedValue(null);

    const response = await request(app())
      .patch('/api/v1/users/me')
      .set('Authorization', 'Bearer test-access-token')
      .send({ firstName: 'Alexandra' });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_SESSION',
      },
    });

    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it('rejects an empty profile update', async () => {
    const response = await request(app())
      .patch('/api/v1/users/me')
      .set('Authorization', 'Bearer test-access-token')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
      },
    });

    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it('rejects invalid profile fields', async () => {
    const response = await request(app())
      .patch('/api/v1/users/me')
      .set('Authorization', 'Bearer test-access-token')
      .send({
        firstName: '   ',
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
      },
    });

    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it('updates the authenticated user profile', async () => {
    const response = await request(app())
      .patch('/api/v1/users/me')
      .set('Authorization', 'Bearer test-access-token')
      .send({
        firstName: 'Alexandra',
        contactDetails: {
          phoneNumber: '123456789',
          preferredContactMethod: 'phone',
        },
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        user: {
          id: userId,
          profile: {
            firstName: 'Alexandra',
            contactDetails: {
              phoneNumber: '123456789',
              preferredContactMethod: 'phone',
            },
          },
        },
      },
    });

    expect(mocks.verifyToken).toHaveBeenCalledWith('test-access-token');
    expect(mocks.findValidSession).toHaveBeenCalledWith(sessionId);
    expect(mocks.updateProfile).toHaveBeenCalledWith(userId, {
      firstName: 'Alexandra',
      contactDetails: {
        phoneNumber: '123456789',
        preferredContactMethod: 'phone',
      },
    });

    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.user.googleId).toBeUndefined();
  });

  it('returns 404 when the profile service cannot find the user', async () => {
    mocks.updateProfile.mockRejectedValue(
      new AppError({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: 'The user account could not be found.',
      }),
    );

    const response = await request(app())
      .patch('/api/v1/users/me')
      .set('Authorization', 'Bearer test-access-token')
      .send({ firstName: 'Alexandra' });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
      },
    });
  });
});
