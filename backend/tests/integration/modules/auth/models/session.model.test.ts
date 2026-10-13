import { describe, expect, it } from 'vitest';

import { SessionModel } from '../../../../../src/modules/auth/models/session.model.js';
import { UserModel } from '../../../../../src/modules/users/models/user.model.js';

describe('SessionModel', () => {
  async function createUser() {
    return UserModel.create({
      email: 'session-player@example.com',
      passwordHash: 'stored-password-hash',
      roles: ['buyer'],
      status: 'active',
      emailVerifiedAt: new Date(),
      profile: {
        firstName: 'Alex',
        lastName: 'Player',
      },
    });
  }

  it('creates an active session with a user reference and expiration', async () => {
    const user = await createUser();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const session = await SessionModel.create({
      userId: user._id,
      refreshTokenHash: 'test-refresh-token-hash',
      expiresAt,
    });

    expect(session.userId.toString()).toBe(user._id.toString());
    expect(session.status).toBe('active');
    expect(session.expiresAt.getTime()).toBe(expiresAt.getTime());
    expect(session.revokedAt).toBeNull();
    expect(session.createdAt).toBeInstanceOf(Date);
    expect(session.updatedAt).toBeInstanceOf(Date);
  });

  it('rejects a session without a user reference', async () => {
    await expect(
      SessionModel.create({
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      }),
    ).rejects.toThrow();
  });

  it('rejects a session without an expiration date', async () => {
    const user = await createUser();

    await expect(
      SessionModel.create({
        userId: user._id,
      }),
    ).rejects.toThrow();
  });

  it('supports revoking a session', async () => {
    const user = await createUser();
    const session = await SessionModel.create({
      userId: user._id,
      refreshTokenHash: 'test-refresh-token-hash',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const revokedAt = new Date();

    session.status = 'revoked';
    session.revokedAt = revokedAt;
    await session.save();

    const storedSession = await SessionModel.findById(session._id);

    expect(storedSession?.status).toBe('revoked');
    expect(storedSession?.revokedAt?.getTime()).toBe(revokedAt.getTime());
  });

  it('rejects unsupported session statuses', async () => {
    const user = await createUser();

    await expect(
      SessionModel.create({
        userId: user._id,
        status: 'invalid',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      }),
    ).rejects.toThrow();
  });
});
