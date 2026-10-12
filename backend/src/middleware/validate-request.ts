import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../shared/errors/app-error.js';

type RequestPart = 'body' | 'query' | 'params';

export const validateRequest = (
  part: RequestPart,
  schema: ZodType,
): RequestHandler => {
  return (req, _res, next) => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      next(
        new AppError({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: result.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        }),
      );
      return;
    }

    if (part === 'body') {
      req.body = result.data;
    }

    next();
  };
};
