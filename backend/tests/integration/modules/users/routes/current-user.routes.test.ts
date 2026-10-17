import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccessTokenService } from '../../../../../src/modules/auth/services/access-token.service.js';
import type { SessionService } from '../../../../../src/modules/auth/services/session.service.js';
import type { CurrentUserService } from '../../../../../src/modules/users/services/current-user.service.js';
import type { CurrentUserResponse } from '../../../../../src/modules/users/types/current-user.types.js';
import { createTestApp } from '../../../../helpers/test-app.js';

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  findValidSession: vi.fn(),
  getCurrentUser: vi.fn(),
}));

const accessTokenService = {
  verifyToken: mocks.verifyToken,
} as unknown as AccessTokenService;

const sessionService = {
  findValidSession: mocks.findValidSession,
} as unknown as SessionService;

const currentUserService = {
  getCurrentUser: mocks.getCurrentUser,
} as unknown as CurrentUserService;

const userId = '507f1f77bcf86cd799439011';
const sessionId = '507f1f77bcf86cd799439012';

const currentUser: CurrentUserResponse = {
  id: userId,
  email: 'alex@example.com',
  emailVerifiedAt: new Date('2026-01-10T10:00:00.000Z'),
  roles: ['buyer'],
  status: 'active',
  profile: {
    firstName: 'Alex',
    lastName: 'Tennis',
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

const app = () =>
  createTestApp({
    accessTokenService,
    sessionService,
    currentUserService,
  });

describe('GET /api/v1/users/me', () => {
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

    mocks.getCurrentUser.mockResolvedValue(currentUser);
  });

  it('rejects requests without an access token', async () => {
    const response = await request(app()).get('/api/v1/users/me');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
      },
    });

    expect(mocks.verifyToken).not.toHaveBeenCalled();
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
  });

  it('rejects requests with an invalid session', async () => {
    mocks.findValidSession.mockResolvedValue(null);

    const response = await request(app())
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer test-access-token');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_SESSION',
      },
    });

    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
  });

  it('returns the authenticated user account', async () => {
    const response = await request(app())
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer test-access-token');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        user: {
          id: userId,
          email: 'alex@example.com',
          roles: ['buyer'],
          status: 'active',
          profile: {
            firstName: 'Alex',
            lastName: 'Tennis',
          },
        },
      },
    });

    expect(mocks.verifyToken).toHaveBeenCalledWith('test-access-token');
    expect(mocks.findValidSession).toHaveBeenCalledWith(sessionId);
    expect(mocks.getCurrentUser).toHaveBeenCalledWith(userId);

    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.user.googleId).toBeUndefined();
  });
});
