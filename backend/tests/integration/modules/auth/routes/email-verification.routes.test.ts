import { createHash, randomBytes } from 'node:crypto';

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VerificationTokenModel } from '../../../../../src/modules/auth/models/verification-token.model.js';
import { EmailVerificationService } from '../../../../../src/modules/auth/services/email-verification.service.js';
import { UserModel } from '../../../../../src/modules/users/models/user.model.js';
import { createTestApp } from '../../../../helpers/test-app.js';

/**
 * Integration tests for POST /api/v1/auth/verify-email.
 *
 * Tests the HTTP contract, request validation, and persisted account state.
 */
describe('POST /api/v1/auth/verify-email', () => {
  beforeEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}),
      VerificationTokenModel.deleteMany({}),
    ]);
  });

  /**
   * Creates a pending user with a persisted verification-token hash.
   */
  async function createVerificationFixture(options?: {
    expiresAt?: Date;
  }): Promise<{ userId: string; token: string }> {
    const user = await UserModel.create({
      email: 'verify@example.com',
      passwordHash: 'test-password-hash',
      roles: ['buyer'],
      status: 'pending_verification',
      emailVerifiedAt: null,
      profile: {
        firstName: 'Tennis',
        lastName: 'Player',
      },
    });

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    await VerificationTokenModel.create({
      userId: user._id,
      tokenHash,
      expiresAt: options?.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
    });

    return {
      userId: user._id.toString(),
      token,
    };
  }

  it('verifies a valid token and returns a success response', async () => {
    const { userId, token } = await createVerificationFixture();
    const app = createTestApp();

    const response = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        message: 'Your email address has been verified successfully.',
      },
    });

    const user = await UserModel.findById(userId);
    const storedToken = await VerificationTokenModel.findOne({ userId });

    expect(user?.status).toBe('active');
    expect(user?.emailVerifiedAt).toBeInstanceOf(Date);
    expect(storedToken?.consumedAt).toBeInstanceOf(Date);
  });

  it('rejects an invalid token', async () => {
    const app = createTestApp();

    const response = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: randomBytes(32).toString('hex') });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VERIFICATION_TOKEN_INVALID');
  });

  it('rejects an expired token', async () => {
    const { userId, token } = await createVerificationFixture({
      expiresAt: new Date(Date.now() - 60_000),
    });
    const app = createTestApp();

    const response = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VERIFICATION_TOKEN_INVALID');

    const user = await UserModel.findById(userId);

    expect(user?.status).toBe('pending_verification');
    expect(user?.emailVerifiedAt).toBeNull();
  });

  it('rejects a malformed token before invoking the service', async () => {
    const verifyEmail = vi.fn();
    const service = {
      verifyEmail,
    } as unknown as EmailVerificationService;

    const app = createTestApp({
      emailVerificationService: service,
    });

    const response = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: 'malformed-token' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(verifyEmail).not.toHaveBeenCalled();
  });

  it('rejects requests with missing tokens', async () => {
    const app = createTestApp();

    const response = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unexpected request fields', async () => {
    const app = createTestApp();

    const response = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({
        token: randomBytes(32).toString('hex'),
        userId: 'unexpected',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects reuse of an already-consumed token', async () => {
    const { token } = await createVerificationFixture();
    const app = createTestApp();

    const firstResponse = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token });

    const secondResponse = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token });

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(400);
    expect(secondResponse.body.error.code).toBe('VERIFICATION_TOKEN_INVALID');
  });
});
