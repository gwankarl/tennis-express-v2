import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../../../../src/config/auth-cookie.js', () => ({
  REFRESH_TOKEN_COOKIE_NAME: 'refreshToken',
  refreshCookieOptions: {
    httpOnly: true,
    secure: false,
    sameSite: 'strict',
    path: '/',
  },
}));

import { createGoogleAuthController } from '../../../../../src/modules/auth/controllers/google-auth.controller.js';
import type { GoogleAuthService } from '../../../../../src/modules/auth/services/google-auth.service.js';
import type { AuthTokenService } from '../../../../../src/modules/auth/services/auth-token.service.js';

import {
  REFRESH_TOKEN_COOKIE_NAME,
  refreshCookieOptions,
} from '../../../../../src/config/auth-cookie.js';

describe('createGoogleAuthController', () => {
  const mockAuthenticate = vi.fn();
  const mockIssueTokenPair = vi.fn();
  const mockCookie = vi.fn();
  const mockStatus = vi.fn();
  const mockJson = vi.fn();
  const mockNext = vi.fn();

  const googleAuthService = {
    authenticate: mockAuthenticate,
  } as unknown as GoogleAuthService;

  const authTokenService = {
    issueTokenPair: mockIssueTokenPair,
  } as unknown as AuthTokenService;

  const controller = createGoogleAuthController(
    googleAuthService,
    authTokenService,
  );

  const user = {
    id: 'user-123',
    email: 'player@example.com',
    firstName: 'Alex',
    lastName: 'Player',
    roles: ['buyer'],
    status: 'active',
  };

  const tokens = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    sessionId: 'session-123',
    accessTokenExpiresIn: 900,
  };

  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      body: {
        idToken: 'google-id-token',
      },
    };

    mockStatus.mockReturnThis();

    res = {
      cookie: mockCookie,
      status: mockStatus,
      json: mockJson,
    };

    mockAuthenticate.mockResolvedValue({ user });
    mockIssueTokenPair.mockResolvedValue(tokens);
  });

  it('authenticates the Google identity and returns the standard login response', async () => {
    await controller(req as Request, res as Response, mockNext as NextFunction);

    expect(mockAuthenticate).toHaveBeenCalledWith('google-id-token');
    expect(mockIssueTokenPair).toHaveBeenCalledWith({
      userId: user.id,
      roles: ['buyer'],
    });

    expect(mockCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE_NAME,
      tokens.refreshToken,
      refreshCookieOptions,
    );

    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({
      success: true,
      data: {
        user,
        tokens: {
          accessToken: tokens.accessToken,
          tokenType: 'Bearer',
          expiresIn: tokens.accessTokenExpiresIn,
        },
      },
    });

    expect(mockNext).not.toHaveBeenCalled();
  });

  it('forwards Google authentication errors to the error handler', async () => {
    const error = new Error('Google authentication failed');
    mockAuthenticate.mockRejectedValueOnce(error);

    await controller(req as Request, res as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalledWith(error);
    expect(mockIssueTokenPair).not.toHaveBeenCalled();
    expect(mockStatus).not.toHaveBeenCalled();
  });

  it('forwards token issuance errors to the error handler', async () => {
    const error = new Error('Token issuance failed');
    mockIssueTokenPair.mockRejectedValueOnce(error);

    await controller(req as Request, res as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalledWith(error);
    expect(mockCookie).not.toHaveBeenCalled();
    expect(mockStatus).not.toHaveBeenCalled();
  });
});
