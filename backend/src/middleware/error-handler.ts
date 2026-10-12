import type { ErrorRequestHandler } from 'express';
import { AppError } from '../shared/errors/app-error.js';
import type { ApiErrorResponse } from '../shared/responses/api-error-response.js';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
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

    res.status(error.statusCode).json(body);
    return;
  }

  const body: ApiErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  };

  res.status(500).json(body);
};
