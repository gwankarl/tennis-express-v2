import { describe, expect, it } from 'vitest';
import { AppError } from '../src/shared/errors/app-error.js';

describe('Backend foundation', () => {
  it('creates application errors with the expected status and code', () => {
    const error = new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Request validation failed');
  });
});
