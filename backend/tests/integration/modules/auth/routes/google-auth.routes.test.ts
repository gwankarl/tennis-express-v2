import request from 'supertest';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionModel } from '../../../../../src/modules/auth/models/session.model.js';
import type { GoogleAuthService } from '../../../../../src/modules/auth/services/google-auth.service.js';
import { createTestApp } from '../../../../helpers/test-app.js';
import { AppError } from '../../../../../src/shared/errors/app-error.js';

const testUser = {
  id: new Types.ObjectId().toString(),
  email: 'alex@example.com',
  firstName: 'Alex',
  lastName: 'Tennis',
  roles: ['buyer'],
  status: 'active',
};

function createGoogleAuthServiceMock() {
  return {
    authenticate: vi.fn(),
  } as unknown as GoogleAuthService;
}

describe('POST /api/v1/auth/google', () => {
  beforeEach(async () => {
    await SessionModel.deleteMany({});
  });

  it('authenticates a Google user and creates a session', async () => {
    const googleAuthService = createGoogleAuthServiceMock();

    vi.mocked(googleAuthService.authenticate).mockResolvedValue({
      user: testUser,
    } as Awaited<ReturnType<GoogleAuthService['authenticate']>>);

    const app = createTestApp({ googleAuthService });

    const response = await request(app)
      .post('/api/v1/auth/google')
      .send({ idToken: 'valid-google-id-token' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toMatchObject({
      email: testUser.email,
      firstName: testUser.firstName,
      lastName: testUser.lastName,
      roles: ['buyer'],
      status: 'active',
    });

    expect(response.body.data.tokens).toMatchObject({
      accessToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: expect.any(Number),
    });

    expect(response.body.data.tokens.refreshToken).toBeUndefined();

    const setCookieHeader = response.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();

    const cookies = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : [setCookieHeader];

    const refreshCookie = cookies.find((cookie: string) =>
      cookie.startsWith('refreshToken='),
    );

    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/SameSite=Lax/i);

    expect(googleAuthService.authenticate).toHaveBeenCalledOnce();
    expect(googleAuthService.authenticate).toHaveBeenCalledWith(
      'valid-google-id-token',
    );
    expect(await SessionModel.countDocuments()).toBe(1);
  });

  it('rejects a missing Google ID token', async () => {
    const googleAuthService = createGoogleAuthServiceMock();
    const app = createTestApp({ googleAuthService });

    const response = await request(app).post('/api/v1/auth/google').send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(googleAuthService.authenticate).not.toHaveBeenCalled();
    expect(await SessionModel.countDocuments()).toBe(0);
  });

  it('rejects an empty Google ID token', async () => {
    const googleAuthService = createGoogleAuthServiceMock();
    const app = createTestApp({ googleAuthService });

    const response = await request(app)
      .post('/api/v1/auth/google')
      .send({ idToken: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(googleAuthService.authenticate).not.toHaveBeenCalled();
    expect(await SessionModel.countDocuments()).toBe(0);
  });

  it('rejects unexpected request fields', async () => {
    const googleAuthService = createGoogleAuthServiceMock();
    const app = createTestApp({ googleAuthService });

    const response = await request(app)
      .post('/api/v1/auth/google')
      .send({
        idToken: 'valid-google-id-token',
        roles: ['admin'],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(googleAuthService.authenticate).not.toHaveBeenCalled();
    expect(await SessionModel.countDocuments()).toBe(0);
  });

  it('returns the account-linking error without creating a session', async () => {
    const googleAuthService = createGoogleAuthServiceMock();

    vi.mocked(googleAuthService.authenticate).mockRejectedValue(
      new AppError({
        statusCode: 409,
        code: 'ACCOUNT_LINK_REQUIRED',
        message: 'Sign in using your existing account method.',
      }),
    );

    const app = createTestApp({ googleAuthService });

    const response = await request(app)
      .post('/api/v1/auth/google')
      .send({ idToken: 'valid-google-id-token' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ACCOUNT_LINK_REQUIRED');
    expect(await SessionModel.countDocuments()).toBe(0);
  });
});
