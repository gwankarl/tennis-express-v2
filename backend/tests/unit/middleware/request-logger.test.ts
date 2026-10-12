import type { Request, Response } from 'express';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockInfo } = vi.hoisted(() => ({
  mockInfo: vi.fn(),
}));

vi.mock('../../../src/config/logger.js', () => ({
  logger: {
    info: mockInfo,
  },
}));

import { requestLoggerMiddleware } from '../../../src/middleware/request-logger.js';

describe('requestLoggerMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers a listener for the response finish event', () => {
    const on = vi.fn();
    const res = {
      on,
      locals: { requestId: 'test-request-id' },
      statusCode: 200,
    };

    requestLoggerMiddleware(
      { method: 'GET', path: '/api/v1/health' } as Request,
      res as unknown as Response,
      vi.fn(),
    );

    expect(on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  it('logs request details when the response finishes', () => {
    let finishCallback: (() => void) | undefined;

    const res = {
      on: vi.fn((event: string, callback: () => void) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      }),
      locals: { requestId: 'test-request-id' },
      statusCode: 200,
    };

    const next = vi.fn();

    requestLoggerMiddleware(
      { method: 'GET', path: '/api/v1/health' } as Request,
      res as unknown as Response,
      next,
    );

    expect(next).toHaveBeenCalledOnce();

    finishCallback?.();

    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'test-request-id',
        method: 'GET',
        path: '/api/v1/health',
        statusCode: 200,
        durationMs: expect.any(Number),
      }),
      'HTTP request completed',
    );
  });

  it('calls next to continue request processing', () => {
    const res = {
      on: vi.fn(),
      locals: { requestId: 'test-request-id' },
      statusCode: 200,
    };

    const next = vi.fn();

    requestLoggerMiddleware(
      { method: 'GET', path: '/api/v1/health' } as Request,
      res as unknown as Response,
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });
});
