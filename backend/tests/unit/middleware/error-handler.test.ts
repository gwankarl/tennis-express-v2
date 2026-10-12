import type { Request, Response, NextFunction } from 'express';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../src/shared/errors/app-error.js';

const { mockError } = vi.hoisted(() => ({
  mockError: vi.fn(),
}));

vi.mock('../../../src/config/logger.js', () => ({
  logger: {
    error: mockError,
  },
}));

import { errorHandler } from '../../../src/middleware/error-handler.js';

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createResponse = () => {
    const res = {
      status: vi.fn(),
      json: vi.fn(),
      locals: {
        requestId: 'test-request-id',
      },
    };

    res.status.mockReturnValue(res);

    return res;
  };

  it('maps an AppError to the expected status and response body', () => {
    const error = new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: { field: 'email' },
    });

    const res = createResponse();

    errorHandler(
      error,
      { method: 'POST', path: '/api/v1/users' } as Request,
      res as unknown as Response,
      vi.fn() as NextFunction,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: { field: 'email' },
      },
    });
    expect(mockError).not.toHaveBeenCalled();
  });

  it('logs unexpected errors with request context', () => {
    const error = new Error('Sensitive internal information');
    const res = createResponse();

    errorHandler(
      error,
      { method: 'GET', path: '/api/v1/products' } as Request,
      res as unknown as Response,
      vi.fn() as NextFunction,
    );

    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: error,
        requestId: 'test-request-id',
        method: 'GET',
        path: '/api/v1/products',
        statusCode: 500,
      }),
      'Unexpected server error',
    );
  });

  it('returns a generic response without exposing unexpected error details', () => {
    const error = new Error('Sensitive internal information');
    const res = createResponse();

    errorHandler(
      error,
      { method: 'GET', path: '/api/v1/products' } as Request,
      res as unknown as Response,
      vi.fn() as NextFunction,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });

    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain(
      'Sensitive internal information',
    );
  });

  it('logs AppError instances with server-error status codes', () => {
    const error = new AppError({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Service temporarily unavailable',
    });

    const res = createResponse();

    errorHandler(
      error,
      { method: 'GET', path: '/api/v1/products' } as Request,
      res as unknown as Response,
      vi.fn() as NextFunction,
    );

    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: error,
        requestId: 'test-request-id',
        method: 'GET',
        path: '/api/v1/products',
        statusCode: 503,
        code: 'SERVICE_UNAVAILABLE',
      }),
      'Application error',
    );

    expect(res.status).toHaveBeenCalledWith(503);
  });
});
