import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserModel } from '../../../../../src/modules/users/models/user.model.js';
import { LoginService } from '../../../../../src/modules/auth/services/login.service.js';
import type { PasswordHasher } from '../../../../../src/modules/auth/types/registration.types.js';

describe('LoginService', () => {
  const passwordHasher: PasswordHasher = {
    hash: vi.fn().mockResolvedValue('stored-password-hash'),
    verify: vi.fn(),
  };

  const service = new LoginService({ passwordHasher });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function createUser(overrides: Record<string, unknown> = {}) {
    return UserModel.create({
      email: 'player@example.com',
      passwordHash: 'stored-password-hash',
      roles: ['buyer'],
      status: 'active',
      emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      deletedAt: null,
      profile: {
        firstName: 'Alex',
        lastName: 'Player',
      },
      ...overrides,
    });
  }

  it('authenticates a verified active user', async () => {
    await createUser();
    vi.mocked(passwordHasher.verify).mockResolvedValueOnce(true);

    const result = await service.login({
      email: ' PLAYER@example.com ',
      password: 'correct-password',
    });

    expect(result.user).toMatchObject({
      email: 'player@example.com',
      firstName: 'Alex',
      lastName: 'Player',
      roles: ['buyer'],
      status: 'active',
    });
    expect(result.user.id).toBeTruthy();
    expect(passwordHasher.verify).toHaveBeenCalledWith(
      'correct-password',
      'stored-password-hash',
    );

    const updatedUser = await UserModel.findOne({
      email: 'player@example.com',
    });

    expect(updatedUser?.lastLoginAt).toBeInstanceOf(Date);
  });

  it('rejects an unknown email with a generic credentials error', async () => {
    await expect(
      service.login({
        email: 'unknown@example.com',
        password: 'correct-password',
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
    });

    expect(passwordHasher.verify).not.toHaveBeenCalled();
  });

  it('rejects an incorrect password with a generic credentials error', async () => {
    await createUser();
    vi.mocked(passwordHasher.verify).mockResolvedValueOnce(false);

    await expect(
      service.login({
        email: 'player@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
    });
  });

  it('rejects an account that has not verified its email', async () => {
    await createUser({
      status: 'pending_verification',
      emailVerifiedAt: null,
    });
    vi.mocked(passwordHasher.verify).mockResolvedValueOnce(true);

    await expect(
      service.login({
        email: 'player@example.com',
        password: 'correct-password',
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'EMAIL_NOT_VERIFIED',
    });
  });

  it('rejects an account with no verification timestamp', async () => {
    await createUser({ emailVerifiedAt: null });
    vi.mocked(passwordHasher.verify).mockResolvedValueOnce(true);

    await expect(
      service.login({
        email: 'player@example.com',
        password: 'correct-password',
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'EMAIL_NOT_VERIFIED',
    });
  });

  it('rejects a suspended account', async () => {
    await createUser({ status: 'suspended' });
    vi.mocked(passwordHasher.verify).mockResolvedValueOnce(true);

    await expect(
      service.login({
        email: 'player@example.com',
        password: 'correct-password',
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'ACCOUNT_UNAVAILABLE',
    });
  });

  it('does not return password hashes in the result', async () => {
    await createUser();
    vi.mocked(passwordHasher.verify).mockResolvedValueOnce(true);

    const result = await service.login({
      email: 'player@example.com',
      password: 'correct-password',
    });

    expect(result.user).not.toHaveProperty('passwordHash');
  });
});
