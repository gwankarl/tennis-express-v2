import type { Request, Response } from 'express';

import { describe, expect, it, vi } from 'vitest';

import { requestIdMiddleware } from '../../../src/middleware/request-id.js';

describe('requestIdMiddleware', () => {
  it('generates a valid UUID for each request', () => {
    const res = {
      setHeader: vi.fn(),
      locals: {} as Record<string, unknown>,
    };

    const next = vi.fn();

    requestIdMiddleware({} as Request, res as unknown as Response, next);

    const requestId = res.locals.requestId;

    expect(requestId).toEqual(
      expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
    );
  });

  it('sets the X-Request-ID response header', () => {
    const res = {
      setHeader: vi.fn(),
      locals: {} as Record<string, unknown>,
    };

    const next = vi.fn();

    requestIdMiddleware({} as Request, res as unknown as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      res.locals.requestId,
    );
  });

  it('stores the request ID in response locals', () => {
    const res = {
      setHeader: vi.fn(),
      locals: {} as Record<string, unknown>,
    };

    const next = vi.fn();

    requestIdMiddleware({} as Request, res as unknown as Response, next);

    expect(res.locals.requestId).toBeDefined();
  });

  it('calls next to continue processing the request', () => {
    const res = {
      setHeader: vi.fn(),
      locals: {} as Record<string, unknown>,
    };

    const next = vi.fn();

    requestIdMiddleware({} as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it('generates a different request ID for each request', () => {
    const createResponse = () => ({
      setHeader: vi.fn(),
      locals: {} as Record<string, unknown>,
    });

    const firstResponse = createResponse();
    const secondResponse = createResponse();

    requestIdMiddleware(
      {} as Request,
      firstResponse as unknown as Response,
      vi.fn(),
    );

    requestIdMiddleware(
      {} as Request,
      secondResponse as unknown as Response,
      vi.fn(),
    );

    expect(firstResponse.locals.requestId).not.toBe(
      secondResponse.locals.requestId,
    );
  });
});
