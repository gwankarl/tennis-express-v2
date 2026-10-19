import type { RequestHandler } from 'express';

import type { UserRole } from '../../../shared/users/types/user.types.js';
import { AppError } from '../../../../shared/errors/app-error.js';

/**
 * Creates middleware that authorizes an authenticated user
 * when at least one of their roles matches an allowed role.
 */
export function createRequireRole(
  allowedRoles: readonly UserRole[],
): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(
        new AppError({
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required to access this resource.',
        }),
      );
      return;
    }

    const hasAllowedRole = req.auth.roles.some((role) =>
      allowedRoles.includes(role),
    );

    if (!hasAllowedRole) {
      next(
        new AppError({
          statusCode: 403,
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to access this resource.',
        }),
      );
      return;
    }

    next();
  };
}
