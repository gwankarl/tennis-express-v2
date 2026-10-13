import { createHash, randomBytes } from 'node:crypto';

import { beforeEach, describe, expect, it } from 'vitest';

import { VerificationTokenModel } from '../../../../../src/modules/auth/models/verification-token.model.js';
import { EmailVerificationService } from '../../../../../src/modules/auth/services/email-verification.service.js';
import { UserModel } from '../../../../../src/modules/users/models/user.model.js';

/**
 * Integration tests for email verification.
 *
 * These tests use the configured test database to verify token persistence,
 * expiration, single-use enforcement, and account activation behavior.
 */
describe('EmailVerificationService', () => {
  let service: EmailVerificationService;

  beforeEach(() => {
    service = new EmailVerificationService();
  });

  /**
   * Creates a pending account and its corresponding verification token.
   *
   * Only the token hash is persisted, matching the registration workflow.
   */
  async function createVerificationFixture(
    options: {
      expiresAt?: Date;
      status?: 'pending_verification' | 'active' | 'suspended';
      emailVerifiedAt?: Date | null;
    } = {},
  ): Promise<{ userId: string; rawToken: string }> {
    const user = await UserModel.create({
      email: 'player@example.com',
      passwordHash: 'test-password-hash',
      roles: ['buyer'],
      status: options.status ?? 'pending_verification',
      emailVerifiedAt: options.emailVerifiedAt ?? null,
      profile: {
        firstName: 'Tennis',
        lastName: 'Player',
      },
    });

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    await VerificationTokenModel.create({
      userId: user._id,
      tokenHash,
      expiresAt: options.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
    });

    return {
      userId: user._id.toString(),
      rawToken,
    };
  }

  it('activates a pending account and records the verification time', async () => {
    const { userId, rawToken } = await createVerificationFixture();

    const result = await service.verifyEmail(rawToken);

    const user = await UserModel.findById(userId);
    const token = await VerificationTokenModel.findOne({ userId });

    expect(result).toEqual({ userId });
    expect(user?.status).toBe('active');
    expect(user?.emailVerifiedAt).toBeInstanceOf(Date);
    expect(token?.consumedAt).toBeInstanceOf(Date);
  });

  it('rejects an expired verification token', async () => {
    const { userId, rawToken } = await createVerificationFixture({
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(service.verifyEmail(rawToken)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VERIFICATION_TOKEN_INVALID',
    });

    const user = await UserModel.findById(userId);

    expect(user?.status).toBe('pending_verification');
    expect(user?.emailVerifiedAt).toBeNull();
  });

  it('rejects a token that does not exist', async () => {
    const unknownToken = randomBytes(32).toString('hex');

    await expect(service.verifyEmail(unknownToken)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VERIFICATION_TOKEN_INVALID',
    });
  });

  it('rejects a malformed token', async () => {
    await expect(
      service.verifyEmail('not-a-valid-token'),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VERIFICATION_TOKEN_INVALID',
    });
  });

  it('rejects a token that has already been consumed', async () => {
    const { userId, rawToken } = await createVerificationFixture();

    await service.verifyEmail(rawToken);

    await expect(service.verifyEmail(rawToken)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VERIFICATION_TOKEN_INVALID',
    });

    const user = await UserModel.findById(userId);

    expect(user?.status).toBe('active');
  });

  it('rejects verification when the account is no longer pending', async () => {
    const { userId, rawToken } = await createVerificationFixture({
      status: 'suspended',
    });

    await expect(service.verifyEmail(rawToken)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VERIFICATION_TOKEN_INVALID',
    });

    const user = await UserModel.findById(userId);

    expect(user?.status).toBe('suspended');
    expect(user?.emailVerifiedAt).toBeNull();
  });

  it('does not accept a token that has expired at verification time', async () => {
    const fixedNow = new Date('2026-10-13T10:00:00.000Z');
    const { userId, rawToken } = await createVerificationFixture({
      expiresAt: fixedNow,
    });

    const fixedTimeService = new EmailVerificationService({
      now: () => fixedNow,
    });

    await expect(fixedTimeService.verifyEmail(rawToken)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VERIFICATION_TOKEN_INVALID',
    });

    const user = await UserModel.findById(userId);

    expect(user?.status).toBe('pending_verification');
  });
});
