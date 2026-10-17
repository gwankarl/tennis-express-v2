import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserModel } from '../../../../../src/modules/users/models/user.model.js';
import { PasswordResetTokenModel } from '../../../../../src/modules/auth/models/password-reset-token.model.js';
import { SessionModel } from '../../../../../src/modules/auth/models/session.model.js';
import { Argon2PasswordHasher } from '../../../../../src/modules/auth/services/argon2-password-hasher.js';
import { PwnedPasswordCompromiseChecker } from '../../../../../src/modules/auth/services/pwned-password-compromise.checker.js';
import { ResetPasswordService } from '../../../../../src/modules/auth/services/reset-password.service.js';
import { SessionService } from '../../../../../src/modules/auth/services/session.service.js';

describe('ResetPasswordService', () => {
  let service: ResetPasswordService;

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(Argon2PasswordHasher.prototype, 'hash').mockResolvedValue(
      'new-argon2id-password-hash',
    );

    vi.spyOn(
      PwnedPasswordCompromiseChecker.prototype,
      'isPasswordCompromised',
    ).mockResolvedValue(false);

    vi.spyOn(SessionService.prototype, 'revokeAllUserSessions');

    service = new ResetPasswordService();
  });

  async function createUser() {
    return UserModel.create({
      email: 'reset-player@example.com',
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
    return PasswordResetTokenModel.create({
      userId,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
  }

  async function createSession(userId: string) {
    return SessionModel.create({
      userId,
      refreshTokenHash: createHash('sha256')
        .update(`refresh-${userId}-${Math.random()}`)
        .digest('hex'),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
  }

  it('resets the password and consumes the token', async () => {
    const user = await createUser();
    const rawToken = 'a'.repeat(64);
    const resetToken = await createResetToken(user._id.toString(), rawToken);

    await service.resetPassword(rawToken, 'new-secure-password-123');

    const updatedUser = await UserModel.findById(user._id).select(
      '+passwordHash',
    );
    const updatedToken = await PasswordResetTokenModel.findById(resetToken._id);

    expect(updatedUser?.passwordHash).toBe('new-argon2id-password-hash');
    expect(updatedToken?.consumedAt).toBeInstanceOf(Date);
    expect(Argon2PasswordHasher.prototype.hash).toHaveBeenCalledWith(
      'new-secure-password-123',
    );
  });

  it('rejects an invalid reset token', async () => {
    await expect(
      service.resetPassword('b'.repeat(64), 'new-secure-password-123'),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_OR_EXPIRED_RESET_TOKEN',
    });

    expect(Argon2PasswordHasher.prototype.hash).not.toHaveBeenCalled();
  });

  it('rejects an expired reset token', async () => {
    const user = await createUser();
    const rawToken = 'c'.repeat(64);

    await PasswordResetTokenModel.create({
      userId: user._id,
      tokenHash: createHash('sha256').update(rawToken).digest('hex'),
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      service.resetPassword(rawToken, 'new-secure-password-123'),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_OR_EXPIRED_RESET_TOKEN',
    });
  });

  it('rejects a compromised password', async () => {
    const user = await createUser();
    const rawToken = 'd'.repeat(64);

    await createResetToken(user._id.toString(), rawToken);

    vi.mocked(
      PwnedPasswordCompromiseChecker.prototype.isPasswordCompromised,
    ).mockResolvedValue(true);

    await expect(
      service.resetPassword(rawToken, 'compromised-password-123'),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'PASSWORD_COMPROMISED',
    });

    const unchangedUser = await UserModel.findById(user._id).select(
      '+passwordHash',
    );

    expect(unchangedUser?.passwordHash).toBe('old-password-hash');
    expect(Argon2PasswordHasher.prototype.hash).not.toHaveBeenCalled();
  });

  it('revokes active sessions after a successful password reset', async () => {
    const user = await createUser();
    const rawToken = 'e'.repeat(64);

    await createResetToken(user._id.toString(), rawToken);
    const activeSession = await createSession(user._id.toString());

    await service.resetPassword(rawToken, 'new-secure-password-123');

    const updatedSession = await SessionModel.findById(activeSession._id);

    expect(updatedSession?.status).toBe('revoked');
    expect(updatedSession?.revokedAt).toBeInstanceOf(Date);
    expect(SessionService.prototype.revokeAllUserSessions).toHaveBeenCalledWith(
      user._id.toString(),
      expect.anything(),
    );
  });

  it('rejects reuse of a consumed reset token', async () => {
    const user = await createUser();
    const rawToken = 'f'.repeat(64);

    const resetToken = await createResetToken(user._id.toString(), rawToken);

    resetToken.consumedAt = new Date();
    await resetToken.save();

    await expect(
      service.resetPassword(rawToken, 'another-secure-password-123'),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_OR_EXPIRED_RESET_TOKEN',
    });
  });

  it('invalidates other outstanding reset tokens after a successful reset', async () => {
    const user = await createUser();
    const activeToken = '1'.repeat(64);
    const otherToken = '2'.repeat(64);

    const consumedToken = await createResetToken(
      user._id.toString(),
      activeToken,
    );

    await createResetToken(user._id.toString(), otherToken);

    await service.resetPassword(activeToken, 'new-secure-password-123');

    const remainingTokens = await PasswordResetTokenModel.find({
      userId: user._id,
    });

    expect(remainingTokens).toHaveLength(1);
    expect(remainingTokens[0]?._id.toString()).toBe(
      consumedToken._id.toString(),
    );
    expect(remainingTokens[0]?.consumedAt).toBeInstanceOf(Date);
  });

  it('rolls back the password reset if session revocation fails', async () => {
    const user = await createUser();
    const rawToken = '3'.repeat(64);

    const resetToken = await createResetToken(user._id.toString(), rawToken);

    vi.mocked(
      SessionService.prototype.revokeAllUserSessions,
    ).mockRejectedValueOnce(new Error('Session revocation failed'));

    await expect(
      service.resetPassword(rawToken, 'new-secure-password-123'),
    ).rejects.toThrow('Session revocation failed');

    const unchangedUser = await UserModel.findById(user._id).select(
      '+passwordHash',
    );

    const unchangedToken = await PasswordResetTokenModel.findById(
      resetToken._id,
    );

    expect(unchangedUser?.passwordHash).toBe('old-password-hash');
    expect(unchangedToken?.consumedAt).toBeNull();
  });
});
