import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestApp } from '../../../../helpers/test-app.js';
import type { ResendVerificationService } from '../../../../../src/modules/auth/services/resend-verification.service.js';

describe('POST /api/v1/auth/resend-verification', () => {
  let resendVerification: ReturnType<typeof vi.fn>;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    resendVerification = vi.fn().mockResolvedValue(undefined);

    app = createTestApp({
      resendVerificationService: {
        resendVerification,
      } as unknown as ResendVerificationService,
    });
  });

  it('returns a generic success response for a valid email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'pending@example.com' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        message:
          'If an account with that email address requires verification, a verification email will be sent.',
      },
    });

    expect(resendVerification).toHaveBeenCalledWith('pending@example.com');
  });

  it('rejects a malformed email address', async () => {
    const response = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(resendVerification).not.toHaveBeenCalled();
  });

  it('rejects a missing email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({});

    expect(response.status).toBe(400);
    expect(resendVerification).not.toHaveBeenCalled();
  });

  it('rejects unexpected request fields', async () => {
    const response = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({
        email: 'pending@example.com',
        role: 'admin',
      });

    expect(response.status).toBe(400);
    expect(resendVerification).not.toHaveBeenCalled();
  });

  it('returns a generic success response when no account requires verification', async () => {
    resendVerification.mockResolvedValueOnce(undefined);

    const response = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'unknown@example.com' });

    expect(response.status).toBe(200);
    expect(response.body.data.message).toBe(
      'If an account with that email address requires verification, a verification email will be sent.',
    );
  });

  it('returns 429 after exceeding the rate limit', async () => {
    const sendRequest = () =>
      request(app)
        .post('/api/v1/auth/resend-verification')
        .send({ email: 'pending@example.com' });

    for (let i = 0; i < 5; i += 1) {
      const response = await sendRequest();
      expect(response.status).toBe(200);
    }

    const limitedResponse = await sendRequest();

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.body.success).toBe(false);
    expect(limitedResponse.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(resendVerification).toHaveBeenCalledTimes(5);
  });
});
