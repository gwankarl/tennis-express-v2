import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { SessionModel } from '../../../../../src/modules/auth/models/session.model.js';
import { AuthTokenService } from '../../../../../src/modules/auth/services/auth-token.service.js';
import { Argon2PasswordHasher } from '../../../../../src/modules/auth/services/argon2-password-hasher.js';
import { UserModel } from '../../../../../src/modules/users/models/user.model.js';
import { createTestApp } from '../../../../helpers/test-app.js';

const validCredentials = {
  email: 'alex@example.com',
  password: 'Secure-Tennis-Pass-42!',
};

const passwordHasher = new Argon2PasswordHasher();
const authTokenService = new AuthTokenService();

async function createUser(options?: {
  status?: 'pending_verification' | 'active' | 'suspended';
  emailVerified?: boolean;
}) {
  const emailVerified = options?.emailVerified ?? true;

  return UserModel.create({
    email: validCredentials.email,
    passwordHash: await passwordHasher.hash(validCredentials.password),
    emailVerifiedAt: emailVerified ? new Date() : null,
    roles: ['buyer'],
    status: options?.status ?? 'active',
    profile: {
      firstName: 'Alex',
      lastName: 'Tennis',
    },
  });
}

function getRefreshCookie(response: {
  headers: Record<string, string | string[] | undefined>;
}): string | undefined {
  const header = response.headers['set-cookie'];

  const cookies = Array.isArray(header) ? header : header ? [header] : [];

  return cookies.find((cookie) => cookie.startsWith('refreshToken='));
}

function getRefreshToken(cookie: string): string {
  const match = cookie.match(/^refreshToken=([^;]+)/);

  if (!match) {
    throw new Error('Refresh token cookie was not found.');
  }

  return decodeURIComponent(match[1]);
}

describe('POST /api/v1/auth/refresh-token', () => {
  beforeEach(async () => {
    await Promise.all([UserModel.deleteMany({}), SessionModel.deleteMany({})]);
  });

  it('rotates the refresh token and returns a new access token', async () => {
    const user = await createUser();

    const issued = await authTokenService.issueTokenPair({
      userId: user.id,
      roles: ['buyer'],
    });

    const app = createTestApp();

    const response = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', `refreshToken=${issued.refreshToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      accessToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: expect.any(Number),
    });

    expect(response.body.data.refreshToken).toBeUndefined();
    expect(response.body.data.sessionId).toBeUndefined();

    const replacementCookie = getRefreshCookie(response);

    expect(replacementCookie).toBeDefined();
    expect(replacementCookie).toMatch(/HttpOnly/i);
    expect(replacementCookie).toMatch(/SameSite=Lax/i);

    const replacementToken = getRefreshToken(replacementCookie!);

    expect(replacementToken).not.toBe(issued.refreshToken);

    const reuseResponse = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', `refreshToken=${issued.refreshToken}`);

    expect(reuseResponse.status).toBe(401);
    expect(reuseResponse.body.error.code).toBe('REFRESH_TOKEN_INVALID');
  });

  it('rejects a missing refresh cookie', async () => {
    const response = await request(createTestApp()).post(
      '/api/v1/auth/refresh-token',
    );

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('REFRESH_TOKEN_INVALID');
  });

  it('rejects an invalid refresh token', async () => {
    const response = await request(createTestApp())
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', 'refreshToken=invalid-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('REFRESH_TOKEN_INVALID');
  });

  it('rejects refresh tokens belonging to suspended accounts', async () => {
    const user = await createUser({ status: 'suspended' });

    const issued = await authTokenService.issueTokenPair({
      userId: user.id,
      roles: ['buyer'],
    });

    const response = await request(createTestApp())
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', `refreshToken=${issued.refreshToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCOUNT_UNAVAILABLE');
  });

  it('rejects refresh tokens belonging to unverified accounts', async () => {
    const user = await createUser({
      status: 'pending_verification',
      emailVerified: false,
    });

    const issued = await authTokenService.issueTokenPair({
      userId: user.id,
      roles: ['buyer'],
    });

    const response = await request(createTestApp())
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', `refreshToken=${issued.refreshToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCOUNT_UNAVAILABLE');
  });
});
