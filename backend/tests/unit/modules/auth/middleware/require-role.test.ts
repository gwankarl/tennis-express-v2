import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { createRequireRole } from '../../../../../src/modules/auth/middleware/require-role.js';
import type { UserRole } from '../../../../../src/modules/users/types/user.types.js';

function createRequest(roles?: UserRole[]): Request {
  return {
    auth:
      roles === undefined
        ? undefined
        : {
            userId: '507f1f77bcf86cd799439011',
            sessionId: '507f1f77bcf86cd799439012',
            roles,
          },
  } as unknown as Request;
}

function createResponse(): Response {
  return {} as Response;
}

function createNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

function invokeMiddleware(
  allowedRoles: readonly UserRole[],
  userRoles?: UserRole[],
): { next: NextFunction } {
  const req = createRequest(userRoles);
  const next = createNext();

  const middleware = createRequireRole(allowedRoles);

  middleware(req, createResponse(), next);

  return { next };
}

describe('require role middleware', () => {
  it('rejects requests without authenticated context', () => {
    const { next } = invokeMiddleware(['buyer']);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'AUTHENTICATION_REQUIRED',
      }),
    );
  });

  it('rejects an authenticated user without an allowed role', () => {
    const { next } = invokeMiddleware(['seller'], ['buyer']);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
      }),
    );
  });

  it('allows a user whose role matches an allowed role', () => {
    const { next } = invokeMiddleware(['buyer'], ['buyer']);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it('allows access when any one of multiple allowed roles matches', () => {
    const { next } = invokeMiddleware(['seller', 'admin'], ['admin']);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it('allows an authenticated user with multiple roles when one matches', () => {
    const { next } = invokeMiddleware(['seller'], ['buyer', 'seller']);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a user whose roles do not match any allowed role', () => {
    const { next } = invokeMiddleware(['seller', 'admin'], ['buyer']);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
      }),
    );
  });

  it('rejects access when no roles are allowed', () => {
    const { next } = invokeMiddleware([], ['buyer']);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
      }),
    );
  });
});
