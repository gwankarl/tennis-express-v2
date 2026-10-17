import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { REFRESH_TOKEN_COOKIE_NAME } from '../../../../../src/config/auth-cookie.js';
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

async function createUser() {
  return UserModel.create({
    email: validCredentials.email,
    passwordHash: await passwordHasher.hash(validCredentials.password),
    emailVerifiedAt: new Date(),
    roles: ['buyer'],
    status: 'active',
    profile: {
      firstName: 'Alex',
      lastName: 'Tennis',
    },
  });
}

describe('POST /api/v1/auth/logout', () => {
  beforeEach(async () => {
    await Promise.all([UserModel.deleteMany({}), SessionModel.deleteMany({})]);
  });

  it('revokes the session and clears the refresh-token cookie', async () => {
    const user = await createUser();

    const tokens = await authTokenService.issueTokenPair({
      userId: user.id,
      roles: ['buyer'],
    });

    const sessionBeforeLogout = await SessionModel.findOne({
      userId: user._id,
    });

    expect(sessionBeforeLogout?.status).toBe('active');

    const response = await request(createTestApp())
      .post('/api/v1/auth/logout')
      .set('Cookie', `${REFRESH_TOKEN_COOKIE_NAME}=${tokens.refreshToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Logged out successfully.',
    });

    const sessionAfterLogout = await SessionModel.findById(
      sessionBeforeLogout?._id,
    );

    expect(sessionAfterLogout?.status).toBe('revoked');
    expect(sessionAfterLogout?.revokedAt).toBeInstanceOf(Date);

    const clearedCookie = response.headers['set-cookie'];

    expect(clearedCookie).toBeDefined();

    const cookieHeaders = Array.isArray(clearedCookie)
      ? clearedCookie
      : [clearedCookie];

    const refreshCookie = cookieHeaders.find((cookie: string) =>
      cookie.startsWith(`${REFRESH_TOKEN_COOKIE_NAME}=`),
    );

    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/Expires=Thu, 01 Jan 1970/i);
    expect(refreshCookie).toMatch(/Path=\/api\/v1\/auth/i);
  });

  it('succeeds and clears the cookie when no refresh token is provided', async () => {
    const response = await request(createTestApp()).post('/api/v1/auth/logout');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.headers['set-cookie']).toBeDefined();
    expect(await SessionModel.countDocuments()).toBe(0);
  });

  it('succeeds and clears the cookie when the refresh token is invalid', async () => {
    const response = await request(createTestApp())
      .post('/api/v1/auth/logout')
      .set('Cookie', `${REFRESH_TOKEN_COOKIE_NAME}=invalid-token`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.headers['set-cookie']).toBeDefined();
    expect(await SessionModel.countDocuments()).toBe(0);
  });
});
