import type { Request, Response } from 'express';

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { validateRequest } from '../../../src/middleware/validate-request.js';
import { AppError } from '../../../src/shared/errors/app-error.js';

describe('validateRequest', () => {
  it('calls next when the request body is valid', () => {
    const middleware = validateRequest(
      'body',
      z.object({
        name: z.string().min(1),
      }),
    );

    const req = {
      body: { name: 'Tennis racket' },
    } as Request;

    const next = vi.fn();

    middleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it('replaces the request body with the parsed data', () => {
    const schema = z.object({
      name: z.string(),
    });

    const middleware = validateRequest('body', schema);

    const req = {
      body: { name: 'Tennis racket', unexpected: true },
    } as Request;

    const next = vi.fn();

    middleware(req, {} as Response, next);

    expect(req.body).toEqual({ name: 'Tennis racket' });
  });

  it('passes a validation AppError to next when the request body is invalid', () => {
    const middleware = validateRequest(
      'body',
      z.object({
        name: z.string().min(1),
      }),
    );

    const req = {
      body: { name: '' },
    } as Request;

    const next = vi.fn();

    middleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledOnce();

    const error = next.mock.calls[0][0];

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
    });
  });

  it('includes field-level details when validation fails', () => {
    const middleware = validateRequest(
      'body',
      z.object({
        name: z.string().min(1),
      }),
    );

    const req = {
      body: { name: '' },
    } as Request;

    const next = vi.fn();

    middleware(req, {} as Response, next);

    const error = next.mock.calls[0][0] as AppError;

    expect(error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'name',
          message: expect.any(String),
        }),
      ]),
    );
  });
});
