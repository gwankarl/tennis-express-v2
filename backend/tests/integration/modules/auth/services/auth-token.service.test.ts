import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { AuthTokenService } from '../../../../../src/modules/auth/services/auth-token.service.js';
import { AccessTokenService } from '../../../../../src/modules/auth/services/access-token.service.js';
import { UserModel } from '../../../../../src/modules/users/models/user.model.js';

describe('AuthTokenService', () => {
  it('issues an access token, refresh token, and session', async () => {
    const service = new AuthTokenService();

    const result = await service.issueTokenPair({
      userId: new mongoose.Types.ObjectId().toString(),
      roles: ['buyer'],
    });

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.sessionId).toMatch(/^[a-f\d]{24}$/i);
    expect(result.accessTokenExpiresIn).toBeGreaterThan(0);
  });

  it('issues an access token with the expected claims', async () => {
    const service = new AuthTokenService();
    const userId = new mongoose.Types.ObjectId().toString();
    const roles = ['buyer'] as const;

    const result = await service.issueTokenPair({
      userId,
      roles: [...roles],
    });

    const claims = new AccessTokenService().verifyToken(result.accessToken);

    expect(claims).toEqual({
      userId,
      sessionId: result.sessionId,
      roles: [...roles],
    });
  });

  it('persists the refresh-token hash instead of the raw token', async () => {
    const service = new AuthTokenService();

    const result = await service.issueTokenPair({
      userId: new mongoose.Types.ObjectId().toString(),
      roles: ['buyer'],
    });

    const collection = mongoose.connection.collection('authsessions');
    const session = await collection.findOne({
      _id: new mongoose.Types.ObjectId(result.sessionId),
    });

    expect(session).not.toBeNull();
    expect(session?.refreshTokenHash).toBeTruthy();
    expect(session?.refreshTokenHash).not.toBe(result.refreshToken);
  });

  it('creates a session with a future expiry', async () => {
    const service = new AuthTokenService();

    const result = await service.issueTokenPair({
      userId: new mongoose.Types.ObjectId().toString(),
      roles: ['buyer'],
    });

    const collection = mongoose.connection.collection('authsessions');
    const session = await collection.findOne({
      _id: new mongoose.Types.ObjectId(result.sessionId),
    });

    expect(session).not.toBeNull();
    expect(new Date(session!.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('generates a different refresh token for each issuance', async () => {
    const service = new AuthTokenService();
    const userId = new mongoose.Types.ObjectId().toString();

    const first = await service.issueTokenPair({
      userId,
      roles: ['buyer'],
    });

    const second = await service.issueTokenPair({
      userId,
      roles: ['buyer'],
    });

    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.sessionId).not.toBe(first.sessionId);
  });

  it('rotates refresh tokens while preserving the existing session', async () => {
    const service = new AuthTokenService();
    const user = await UserModel.create({
      email: 'refresh-player@example.com',
      passwordHash: 'stored-password-hash',
      roles: ['buyer'],
      status: 'active',
      emailVerifiedAt: new Date(),
      profile: {
        firstName: 'Alex',
        lastName: 'Player',
      },
    });

    const issued = await service.issueTokenPair({
      userId: user._id.toString(),
      roles: ['buyer'],
    });

    const refreshed = await service.refreshToken(issued.refreshToken);

    expect(refreshed.accessToken).not.toBe(issued.accessToken);
    expect(refreshed.refreshToken).not.toBe(issued.refreshToken);
    expect(refreshed.sessionId).toBe(issued.sessionId);
    expect(refreshed.accessTokenExpiresIn).toBeGreaterThan(0);

    await expect(
      service.refreshToken(issued.refreshToken),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'REFRESH_TOKEN_INVALID',
    });

    const claims = new AccessTokenService().verifyToken(refreshed.accessToken);

    expect(claims).toEqual({
      userId: user._id.toString(),
      sessionId: issued.sessionId,
      roles: ['buyer'],
    });
  });

  it('rejects an invalid refresh token', async () => {
    const service = new AuthTokenService();

    await expect(
      service.refreshToken('invalid-refresh-token'),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'REFRESH_TOKEN_INVALID',
    });
  });

  it('rejects refresh tokens for unverified accounts', async () => {
    const service = new AuthTokenService();

    const user = await UserModel.create({
      email: 'refresh-unverified@example.com',
      passwordHash: 'stored-password-hash',
      roles: ['buyer'],
      status: 'active',
      emailVerifiedAt: new Date(),
      profile: {
        firstName: 'Alex',
        lastName: 'Player',
      },
    });

    const issued = await service.issueTokenPair({
      userId: user._id.toString(),
      roles: ['buyer'],
    });

    user.emailVerifiedAt = null;
    await user.save();

    await expect(
      service.refreshToken(issued.refreshToken),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'ACCOUNT_UNAVAILABLE',
    });
  });

  it('rejects refresh tokens for suspended accounts', async () => {
    const service = new AuthTokenService();

    const user = await UserModel.create({
      email: 'refresh-suspended@example.com',
      passwordHash: 'stored-password-hash',
      roles: ['buyer'],
      status: 'active',
      emailVerifiedAt: new Date(),
      profile: {
        firstName: 'Alex',
        lastName: 'Player',
      },
    });

    const issued = await service.issueTokenPair({
      userId: user._id.toString(),
      roles: ['buyer'],
    });

    user.status = 'suspended';
    await user.save();

    await expect(
      service.refreshToken(issued.refreshToken),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'ACCOUNT_UNAVAILABLE',
    });
  });

  it('rejects refresh tokens for deleted accounts', async () => {
    const service = new AuthTokenService();

    const user = await UserModel.create({
      email: 'refresh-deleted@example.com',
      passwordHash: 'stored-password-hash',
      roles: ['buyer'],
      status: 'active',
      emailVerifiedAt: new Date(),
      profile: {
        firstName: 'Alex',
        lastName: 'Player',
      },
    });

    const issued = await service.issueTokenPair({
      userId: user._id.toString(),
      roles: ['buyer'],
    });

    user.deletedAt = new Date();
    await user.save();

    await expect(
      service.refreshToken(issued.refreshToken),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'ACCOUNT_UNAVAILABLE',
    });
  });
});
