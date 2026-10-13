import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserModel } from '../../../../../src/modules/users/models/user.model.js';
import { VerificationTokenModel } from '../../../../../src/modules/auth/models/verification-token.model.js';
import { RegistrationService } from '../../../../../src/modules/auth/services/registration.service.js';
import type {
  PasswordCompromiseChecker,
  PasswordHasher,
  VerificationEmailSender,
} from '../../../../../src/modules/auth/types/registration.types.js';

describe('RegistrationService', () => {
  let passwordHasher: PasswordHasher;
  let passwordCompromiseChecker: PasswordCompromiseChecker;
  let verificationEmailSender: VerificationEmailSender;
  let service: RegistrationService;

  beforeEach(() => {
    passwordHasher = {
      hash: vi.fn().mockResolvedValue('argon2id-hashed-password'),
    };

    passwordCompromiseChecker = {
      isPasswordCompromised: vi.fn().mockResolvedValue(false),
    };

    verificationEmailSender = {
      sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    };

    service = new RegistrationService({
      passwordHasher,
      passwordCompromiseChecker,
      verificationEmailSender,
    });
  });

  const validInput = {
    firstName: 'Tennis',
    lastName: 'Player',
    email: 'player@example.com',
    password: 'secure-password-123',
  };

  it('creates a pending buyer account and sends a verification email', async () => {
    const result = await service.register(validInput);

    const user = await UserModel.findById(result.user.id);

    expect(user).not.toBeNull();
    expect(user?.email).toBe(validInput.email);
    expect(user?.profile.firstName).toBe(validInput.firstName);
    expect(user?.profile.lastName).toBe(validInput.lastName);
    expect(user?.roles).toEqual(['buyer']);
    expect(user?.status).toBe('pending_verification');

    expect(
      passwordCompromiseChecker.isPasswordCompromised,
    ).toHaveBeenCalledWith(validInput.password);
    expect(passwordHasher.hash).toHaveBeenCalledWith(validInput.password);

    expect(result.user).toEqual({
      id: result.user.id,
      firstName: validInput.firstName,
      lastName: validInput.lastName,
      email: validInput.email,
      status: 'pending_verification',
    });

    expect(
      verificationEmailSender.sendVerificationEmail,
    ).toHaveBeenCalledOnce();

    const emailCall = vi.mocked(verificationEmailSender.sendVerificationEmail)
      .mock.calls[0]?.[0];

    expect(emailCall).toMatchObject({
      to: validInput.email,
      recipientName: 'Tennis Player',
    });
    expect(emailCall?.token).toEqual(expect.any(String));
    expect(emailCall?.token).not.toBe('');
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('token');
  });

  it('stores only the hash of the verification token', async () => {
    await service.register(validInput);

    const emailCall = vi.mocked(verificationEmailSender.sendVerificationEmail)
      .mock.calls[0]?.[0];

    expect(emailCall).toBeDefined();

    const storedToken = await VerificationTokenModel.findOne({
      userId: (await UserModel.findOne({ email: validInput.email }))?._id,
    }).select('+tokenHash');

    expect(storedToken).not.toBeNull();

    const expectedHash = createHash('sha256')
      .update(emailCall!.token)
      .digest('hex');

    expect(storedToken?.tokenHash).toBe(expectedHash);
    expect(storedToken?.tokenHash).not.toBe(emailCall?.token);
    expect(storedToken?.consumedAt).toBeNull();
    expect(storedToken?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects a compromised password before hashing or creating an account', async () => {
    vi.mocked(
      passwordCompromiseChecker.isPasswordCompromised,
    ).mockResolvedValue(true);

    await expect(service.register(validInput)).rejects.toMatchObject({
      statusCode: 422,
      code: 'PASSWORD_COMPROMISED',
    });

    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(
      verificationEmailSender.sendVerificationEmail,
    ).not.toHaveBeenCalled();
    await expect(
      UserModel.exists({ email: validInput.email }),
    ).resolves.toBeNull();
  });

  it('rejects an already registered email address', async () => {
    await UserModel.create({
      email: validInput.email,
      passwordHash: 'existing-hash',
      profile: {
        firstName: 'Existing',
        lastName: 'Player',
      },
    });

    await expect(service.register(validInput)).rejects.toMatchObject({
      statusCode: 409,
      code: 'EMAIL_ALREADY_REGISTERED',
    });

    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(
      verificationEmailSender.sendVerificationEmail,
    ).not.toHaveBeenCalled();
  });

  it('retains the pending account and token if email delivery fails', async () => {
    vi.mocked(verificationEmailSender.sendVerificationEmail).mockRejectedValue(
      new Error('Email provider unavailable'),
    );

    await expect(service.register(validInput)).rejects.toThrow(
      'Email provider unavailable',
    );

    const user = await UserModel.findOne({ email: validInput.email });
    expect(user?.status).toBe('pending_verification');

    const token = await VerificationTokenModel.findOne({
      userId: user?._id,
    });

    expect(token).not.toBeNull();
  });

  it('removes the new account if verification-token persistence fails', async () => {
    const tokenCreateSpy = vi
      .spyOn(VerificationTokenModel, 'create')
      .mockRejectedValueOnce(new Error('Token persistence failed'));

    try {
      await expect(service.register(validInput)).rejects.toThrow(
        'Token persistence failed',
      );

      await expect(
        UserModel.exists({ email: validInput.email }),
      ).resolves.toBeNull();

      expect(
        verificationEmailSender.sendVerificationEmail,
      ).not.toHaveBeenCalled();
    } finally {
      tokenCreateSpy.mockRestore();
    }
  });
});
