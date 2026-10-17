import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRequireAuthentication } from '../../../../../src/modules/auth/middleware/require-authentication.js';
import type { AccessTokenClaims } from '../../../../../src/modules/auth/services/access-token.service.js';
import type { AuthSession } from '../../../../../src/modules/auth/types/session.types.js';

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  findValidSession: vi.fn(),
}));

vi.mock(
  '../../../../../src/modules/auth/services/access-token.service.js',
  () => ({
    AccessTokenService: class {
      verifyToken = mocks.verifyToken;
    },
  }),
);

vi.mock('../../../../../src/modules/auth/services/session.service.js', () => ({
  SessionService: class {
    findValidSession = mocks.findValidSession;
  },
}));

const validClaims: AccessTokenClaims = {
  userId: '507f1f77bcf86cd799439011',
  sessionId: '507f1f77bcf86cd799439012',
  roles: ['buyer'],
};

const validSession = {
  _id: validClaims.sessionId,
  userId: validClaims.userId,
  status: 'active',
  expiresAt: new Date(Date.now() + 60_000),
  revokedAt: null,
} as unknown as AuthSession;

function createRequest(authorization?: string): Request {
  return {
    get: vi.fn((header: string) =>
      header.toLowerCase() === 'authorization' ? authorization : undefined,
    ),
  } as unknown as Request;
}

function createResponse(): Response {
  return {} as Response;
}

function createNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

async function invokeMiddleware(authorization?: string): Promise<{
  req: Request;
  next: NextFunction;
}> {
  const req = createRequest(authorization);
  const next = createNext();

  const middleware = createRequireAuthentication();

  await (
    middleware as unknown as (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => Promise<void>
  )(req, createResponse(), next);

  return { req, next };
}

describe('require authentication middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyToken.mockReturnValue(validClaims);
    mocks.findValidSession.mockResolvedValue(validSession);
  });

  it('rejects requests without a bearer token', async () => {
    const { next } = await invokeMiddleware();

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'AUTHENTICATION_REQUIRED',
      }),
    );

    expect(mocks.verifyToken).not.toHaveBeenCalled();
    expect(mocks.findValidSession).not.toHaveBeenCalled();
  });

  it('rejects an invalid access token', async () => {
    mocks.verifyToken.mockReturnValue(null);

    const { next } = await invokeMiddleware('Bearer invalid-token');

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'INVALID_ACCESS_TOKEN',
      }),
    );

    expect(mocks.findValidSession).not.toHaveBeenCalled();
  });

  it('rejects a missing, expired, or revoked session', async () => {
    mocks.findValidSession.mockResolvedValue(null);

    const { next } = await invokeMiddleware('Bearer valid-token');

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'INVALID_SESSION',
      }),
    );
  });

  it('rejects a session belonging to another user', async () => {
    mocks.findValidSession.mockResolvedValue({
      ...validSession,
      userId: '507f1f77bcf86cd799439099',
    });

    const { next } = await invokeMiddleware('Bearer valid-token');

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'INVALID_SESSION',
      }),
    );
  });

  it('attaches the verified identity when authentication succeeds', async () => {
    const { req, next } = await invokeMiddleware('Bearer valid-token');

    expect(req.auth).toEqual(validClaims);
    expect(mocks.findValidSession).toHaveBeenCalledWith(validClaims.sessionId);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it('passes unexpected session-service errors to the error handler', async () => {
    const databaseError = new Error('Database unavailable');
    mocks.findValidSession.mockRejectedValue(databaseError);

    const { next } = await invokeMiddleware('Bearer valid-token');

    expect(next).toHaveBeenCalledWith(databaseError);
  });
});
