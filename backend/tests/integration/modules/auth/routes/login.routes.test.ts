import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { SessionModel } from '../../../../../src/modules/auth/models/session.model.js';
import { Argon2PasswordHasher } from '../../../../../src/modules/auth/services/argon2-password-hasher.js';
import { UserModel } from '../../../../../src/modules/users/models/user.model.js';
import { createTestApp } from '../../../../helpers/test-app.js';

const validCredentials = {
  email: 'alex@example.com',
  password: 'Secure-Tennis-Pass-42!',
};

const passwordHasher = new Argon2PasswordHasher();

async function createUser(options?: {
  status?: 'pending_verification' | 'active';
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

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await Promise.all([UserModel.deleteMany({}), SessionModel.deleteMany({})]);
  });

  it('authenticates an active user and creates a session', async () => {
    await createUser();

    const app = createTestApp();

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send(validCredentials);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toMatchObject({
      email: validCredentials.email,
      firstName: 'Alex',
      lastName: 'Tennis',
      roles: ['buyer'],
      status: 'active',
    });

    expect(response.body.data.user.passwordHash).toBeUndefined();
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

    expect(await SessionModel.countDocuments()).toBe(1);

    const user = await UserModel.findOne({
      email: validCredentials.email,
    });

    expect(user?.lastLoginAt).toBeInstanceOf(Date);
  });

  it('rejects incorrect credentials without creating a session', async () => {
    await createUser();

    const app = createTestApp();

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        ...validCredentials,
        password: 'Incorrect-Tennis-Password!',
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(await SessionModel.countDocuments()).toBe(0);
  });

  it('rejects an account that has not verified its email', async () => {
    await createUser({
      status: 'pending_verification',
      emailVerified: false,
    });

    const app = createTestApp();

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send(validCredentials);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect(await SessionModel.countDocuments()).toBe(0);
  });

  it('rejects invalid login data before authenticating', async () => {
    const app = createTestApp();

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'not-an-email',
      password: validCredentials.password,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(await SessionModel.countDocuments()).toBe(0);
  });

  it('rejects unexpected login fields', async () => {
    const app = createTestApp();

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        ...validCredentials,
        roles: ['admin'],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(await SessionModel.countDocuments()).toBe(0);
  });
});
