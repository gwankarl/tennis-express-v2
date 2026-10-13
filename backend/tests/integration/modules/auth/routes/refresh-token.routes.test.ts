import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { SessionModel } from '../../../../../src/modules/auth/models/session.model.js';
import { AuthTokenService } from '../../../../../src/modules/auth/services/auth-token.service.js';
import { UserModel } from '../../../../../src/modules/users/models/user.model.js';
import { createTestApp } from '../../../../helpers/test-app.js';

async function createActiveUser() {
  return UserModel.create({
    email: 'refresh-player@example.com',
    passwordHash: 'stored-password-hash',
    emailVerifiedAt: new Date(),
    roles: ['buyer'],
    status: 'active',
    profile: {
      firstName: 'Alex',
      lastName: 'Tennis',
    },
  });
}

describe('POST /api/v1/auth/refresh-token', () => {
  beforeEach(async () => {
    await Promise.all([UserModel.deleteMany({}), SessionModel.deleteMany({})]);
  });

  it('rotates a refresh token and preserves the session', async () => {
    const user = await createActiveUser();
    const authTokenService = new AuthTokenService();

    const issued = await authTokenService.issueTokenPair({
      userId: user._id.toString(),
      roles: ['buyer'],
    });

    const response = await request(createTestApp())
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: issued.refreshToken });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      sessionId: issued.sessionId,
      accessTokenExpiresIn: expect.any(Number),
    });

    expect(response.body.data.refreshToken).not.toBe(issued.refreshToken);

    const reuseResponse = await request(createTestApp())
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: issued.refreshToken });

    expect(reuseResponse.status).toBe(401);
    expect(reuseResponse.body.error.code).toBe('REFRESH_TOKEN_INVALID');
  });

  it('rejects an invalid refresh token', async () => {
    const response = await request(createTestApp())
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: 'invalid-refresh-token' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('REFRESH_TOKEN_INVALID');
  });

  it('rejects a missing refresh token', async () => {
    const response = await request(createTestApp())
      .post('/api/v1/auth/refresh-token')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unexpected request fields', async () => {
    const response = await request(createTestApp())
      .post('/api/v1/auth/refresh-token')
      .send({
        refreshToken: 'invalid-refresh-token',
        roles: ['admin'],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects refresh tokens for suspended accounts', async () => {
    const user = await createActiveUser();
    const authTokenService = new AuthTokenService();

    const issued = await authTokenService.issueTokenPair({
      userId: user._id.toString(),
      roles: ['buyer'],
    });

    user.status = 'suspended';
    await user.save();

    const response = await request(createTestApp())
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: issued.refreshToken });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCOUNT_UNAVAILABLE');
  });

  it('rejects refresh tokens for unverified accounts', async () => {
    const user = await createActiveUser();
    const authTokenService = new AuthTokenService();

    const issued = await authTokenService.issueTokenPair({
      userId: user._id.toString(),
      roles: ['buyer'],
    });

    user.emailVerifiedAt = null;
    await user.save();

    const response = await request(createTestApp())
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: issued.refreshToken });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCOUNT_UNAVAILABLE');
  });
});
