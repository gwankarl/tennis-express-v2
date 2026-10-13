import { describe, expect, it } from 'vitest';

import { SessionModel } from '../../../../../src/modules/auth/models/session.model.js';
import { SessionService } from '../../../../../src/modules/auth/services/session.service.js';
import { UserModel } from '../../../../../src/modules/users/models/user.model.js';

describe('SessionService', () => {
  const service = new SessionService();

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

  async function createSession(
    expiresAt = new Date(Date.now() + 60 * 60 * 1000),
  ) {
    const user = await createUser();

    return SessionModel.create({
      userId: user._id,
      refreshTokenHash: 'test-refresh-token-hash',
      expiresAt,
    });
  }

  it('creates an active session', async () => {
    const user = await createUser();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const session = await service.createSession({
      userId: user._id.toString(),
      expiresAt,
      refreshTokenHash: 'test-refresh-token-hash',
    });

    expect(session.userId.toString()).toBe(user._id.toString());
    expect(session.status).toBe('active');
    expect(session.expiresAt.getTime()).toBe(expiresAt.getTime());
    expect(session.revokedAt).toBeNull();
  });

  it('rejects an expiration time in the past', async () => {
    const user = await createUser();

    await expect(
      service.createSession({
        userId: user._id.toString(),
        expiresAt: new Date(Date.now() - 1000),
        refreshTokenHash: 'test-refresh-token-hash',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_SESSION_EXPIRY',
    });
  });

  it('finds an active, unexpired session', async () => {
    const session = await createSession();

    const result = await service.findValidSession(session._id.toString());

    expect(result?._id.toString()).toBe(session._id.toString());
    expect(result?.status).toBe('active');
  });

  it('rotates a refresh-token hash successfully', async () => {
    const session = await createSession();
    const currentHash = 'a'.repeat(64);
    const newHash = 'b'.repeat(64);

    await SessionModel.updateOne(
      { _id: session._id },
      { $set: { refreshTokenHash: currentHash } },
    );

    const result = await service.rotateRefreshToken(currentHash, newHash);

    expect(result?._id.toString()).toBe(session._id.toString());
    expect(result?.refreshTokenHash).toBe(newHash);

    const storedSession = await SessionModel.findById(session._id).select(
      '+refreshTokenHash',
    );

    expect(storedSession?.refreshTokenHash).toBe(newHash);
  });

  it('rejects reuse of the old refresh-token hash', async () => {
    const session = await createSession();
    const currentHash = 'c'.repeat(64);
    const newHash = 'd'.repeat(64);

    await SessionModel.updateOne(
      { _id: session._id },
      { $set: { refreshTokenHash: currentHash } },
    );

    expect(
      await service.rotateRefreshToken(currentHash, newHash),
    ).not.toBeNull();

    const secondRotation = await service.rotateRefreshToken(
      currentHash,
      'e'.repeat(64),
    );

    expect(secondRotation).toBeNull();
  });

  it('rejects rotation of an expired session', async () => {
    const session = await createSession(new Date(Date.now() - 1000));
    const currentHash = 'f'.repeat(64);

    await SessionModel.updateOne(
      { _id: session._id },
      { $set: { refreshTokenHash: currentHash } },
    );

    const result = await service.rotateRefreshToken(
      currentHash,
      '1'.repeat(64),
    );

    expect(result).toBeNull();
  });

  it('rejects rotation of a revoked session', async () => {
    const session = await createSession();
    const currentHash = '2'.repeat(64);

    await SessionModel.updateOne(
      { _id: session._id },
      { $set: { refreshTokenHash: currentHash } },
    );

    await service.revokeSession(session._id.toString());

    const result = await service.rotateRefreshToken(
      currentHash,
      '3'.repeat(64),
    );

    expect(result).toBeNull();
  });

  it('rejects malformed refresh-token hashes', async () => {
    const session = await createSession();
    const currentHash = '4'.repeat(64);

    await SessionModel.updateOne(
      { _id: session._id },
      { $set: { refreshTokenHash: currentHash } },
    );

    await expect(
      service.rotateRefreshToken('invalid-hash', '5'.repeat(64)),
    ).resolves.toBeNull();

    await expect(
      service.rotateRefreshToken(currentHash, 'invalid-hash'),
    ).resolves.toBeNull();

    await expect(
      service.rotateRefreshToken(currentHash, currentHash),
    ).resolves.toBeNull();
  });

  it('does not find an expired session', async () => {
    const session = await createSession(new Date(Date.now() - 1000));

    const result = await service.findValidSession(session._id.toString());

    expect(result).toBeNull();
  });

  it('does not find a revoked session', async () => {
    const session = await createSession();

    await service.revokeSession(session._id.toString());

    const result = await service.findValidSession(session._id.toString());

    expect(result).toBeNull();
  });

  it('returns null for a malformed session identifier', async () => {
    await expect(
      service.findValidSession('not-an-object-id'),
    ).resolves.toBeNull();
  });

  it('revokes an active session', async () => {
    const session = await createSession();

    const result = await service.revokeSession(session._id.toString());

    expect(result).toBe(true);

    const storedSession = await SessionModel.findById(session._id);

    expect(storedSession?.status).toBe('revoked');
    expect(storedSession?.revokedAt).toBeInstanceOf(Date);
  });

  it('does not revoke the same session twice', async () => {
    const session = await createSession();
    const sessionId = session._id.toString();

    expect(await service.revokeSession(sessionId)).toBe(true);
    expect(await service.revokeSession(sessionId)).toBe(false);
  });

  it('returns false for a malformed identifier when revoking', async () => {
    await expect(service.revokeSession('invalid-id')).resolves.toBe(false);
  });
});
