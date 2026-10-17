import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { createTestApp } from '../../../../helpers/test-app.js';
import { UserModel } from '../../../../../src/modules/users/models/user.model.js';
import { PasswordResetTokenModel } from '../../../../../src/modules/auth/models/password-reset-token.model.js';
import { Argon2PasswordHasher } from '../../../../../src/modules/auth/services/argon2-password-hasher.js';
import { PwnedPasswordCompromiseChecker } from '../../../../../src/modules/auth/services/pwned-password-compromise.checker.js';

describe('POST /api/v1/auth/reset-password', () => {
  const app = createTestApp();

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(Argon2PasswordHasher.prototype, 'hash').mockResolvedValue(
      'new-argon2id-password-hash',
    );

    vi.spyOn(
      PwnedPasswordCompromiseChecker.prototype,
      'isPasswordCompromised',
    ).mockResolvedValue(false);
  });

  async function createUser() {
    return UserModel.create({
      email: 'reset-route-player@example.com',
      passwordHash: 'old-password-hash',
      roles: ['buyer'],
      status: 'active',
      emailVerifiedAt: new Date(),
      deletedAt: null,
      profile: {
        firstName: 'Tennis',
        lastName: 'Player',
      },
    });
  }

  async function createResetToken(userId: string, token: string) {
    await PasswordResetTokenModel.create({
      userId,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
  }

  it('resets the password and returns a success response', async () => {
    const user = await createUser();
    const token = 'a'.repeat(64);

    await createResetToken(user._id.toString(), token);

    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token,
        password: 'new-secure-password-123',
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        message: 'Your password has been reset successfully.',
      },
    });

    const updatedUser = await UserModel.findById(user._id).select(
      '+passwordHash',
    );

    expect(updatedUser?.passwordHash).toBe('new-argon2id-password-hash');
  });

  it('rejects an invalid token format', async () => {
    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: 'invalid-token',
        password: 'new-secure-password-123',
      });

    expect(response.status).toBe(400);
    expect(Argon2PasswordHasher.prototype.hash).not.toHaveBeenCalled();
  });

  it('rejects a password shorter than 12 characters', async () => {
    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: 'a'.repeat(64),
        password: 'short',
      });

    expect(response.status).toBe(400);
    expect(Argon2PasswordHasher.prototype.hash).not.toHaveBeenCalled();
  });

  it('rejects unexpected request fields', async () => {
    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: 'a'.repeat(64),
        password: 'new-secure-password-123',
        email: 'reset-route-player@example.com',
      });

    expect(response.status).toBe(400);
    expect(Argon2PasswordHasher.prototype.hash).not.toHaveBeenCalled();
  });

  it('rejects an unknown reset token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: 'b'.repeat(64),
        password: 'new-secure-password-123',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('rejects a compromised password', async () => {
    const user = await createUser();
    const token = 'c'.repeat(64);

    await createResetToken(user._id.toString(), token);

    vi.mocked(
      PwnedPasswordCompromiseChecker.prototype.isPasswordCompromised,
    ).mockResolvedValue(true);

    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token,
        password: 'compromised-password-123',
      });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
    expect(Argon2PasswordHasher.prototype.hash).not.toHaveBeenCalled();
  });
});
