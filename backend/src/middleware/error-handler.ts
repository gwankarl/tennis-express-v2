import type { ErrorRequestHandler } from 'express';

import { logger } from '../config/logger.js';
import { AppError } from '../shared/errors/app-error.js';
import type { ApiErrorResponse } from '../shared/responses/api-error-response.js';

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.too.large'
  ) {
    res.status(413).json({
      success: false,
      error: {
        code: 'REQUEST_TOO_LARGE',
        message: 'Request body exceeds the allowed size',
      },
    });
    return;
  }

  if (error instanceof AppError) {
    const body: ApiErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined && {
          details: error.details,
        }),
      },
    };

    if (error.statusCode >= 500) {
      logger.error(
        {
          err: error,
          requestId: res.locals.requestId,
          method: req.method,
          path: req.path,
          statusCode: error.statusCode,
          code: error.code,
        },
        'Application error',
      );
    }

    res.status(error.statusCode).json(body);
    return;
  }

  logger.error(
    {
      err: error,
      requestId: res.locals.requestId,
      method: req.method,
      path: req.path,
      statusCode: 500,
    },
    'Unexpected server error',
  );

  const body: ApiErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  };

  res.status(500).json(body);
};
