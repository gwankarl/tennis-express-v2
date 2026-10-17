import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindOne, mockUpdateOne, mockCreate } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockUpdateOne: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock('../../../../../src/modules/users/models/user.model.js', () => ({
  UserModel: {
    findOne: mockFindOne,
    updateOne: mockUpdateOne,
    create: mockCreate,
  },
}));

import { GoogleAuthService } from '../../../../../src/modules/auth/services/google-auth.service.js';
import type { GoogleIdentity } from '../../../../../src/modules/auth/services/google-auth.service.js';

describe('GoogleAuthService', () => {
  const tokenVerifier = {
    verify: vi.fn(),
  };

  const service = new GoogleAuthService({ tokenVerifier });

  const identity: GoogleIdentity = {
    sub: 'google-user-123',
    email: 'player@example.com',
    emailVerified: true,
    givenName: 'Alex',
    familyName: 'Player',
    name: 'Alex Player',
  };

  function createUser(overrides: Record<string, unknown> = {}) {
    return {
      _id: { toString: () => 'user-123' },
      email: 'player@example.com',
      googleId: 'google-user-123',
      profile: {
        firstName: 'Alex',
        lastName: 'Player',
      },
      roles: ['buyer'],
      status: 'active',
      emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      deletedAt: null,
      ...overrides,
    };
  }

  function mockFindOneResult(user: ReturnType<typeof createUser> | null) {
    mockFindOne.mockReturnValueOnce({
      select: vi.fn().mockResolvedValue(user),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();

    tokenVerifier.verify.mockResolvedValue(identity);
    mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockCreate.mockResolvedValue(createUser());

    mockFindOne.mockImplementation(
      (query: { googleId?: string; email?: string }) => ({
        select: vi.fn().mockResolvedValue(query.googleId ? null : null),
      }),
    );
  });

  it('creates a verified buyer account for a new Google identity', async () => {
    const newUser = createUser();
    mockCreate.mockResolvedValue(newUser);

    const result = await service.authenticate('valid-google-id-token');

    expect(tokenVerifier.verify).toHaveBeenCalledWith('valid-google-id-token');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'player@example.com',
        googleId: 'google-user-123',
        emailVerifiedAt: expect.any(Date),
        roles: ['buyer'],
        status: 'active',
        profile: {
          firstName: 'Alex',
          lastName: 'Player',
        },
        lastLoginAt: expect.any(Date),
      }),
    );
    expect(result.user).toEqual({
      id: 'user-123',
      email: 'player@example.com',
      firstName: 'Alex',
      lastName: 'Player',
      roles: ['buyer'],
      status: 'active',
    });
  });

  it('authenticates an existing linked Google account', async () => {
    const linkedUser = createUser();

    mockFindOneResult(linkedUser);

    const result = await service.authenticate('valid-google-id-token');

    expect(mockFindOne).toHaveBeenCalledWith({
      googleId: 'google-user-123',
    });
    expect(mockUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: linkedUser._id,
        status: 'active',
        emailVerifiedAt: { $ne: null },
        deletedAt: null,
      }),
      { $set: { lastLoginAt: expect.any(Date) } },
    );
    expect(result.user.id).toBe('user-123');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('requires explicit linking when an account already exists with the same email', async () => {
    mockFindOneResult(null);
    mockFindOneResult(createUser({ googleId: undefined }));

    await expect(
      service.authenticate('valid-google-id-token'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'ACCOUNT_LINK_REQUIRED',
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  it('rejects an invalid Google token', async () => {
    tokenVerifier.verify.mockRejectedValueOnce(
      new Error('Google token verification failed'),
    );

    await expect(
      service.authenticate('invalid-google-id-token'),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_GOOGLE_TOKEN',
    });

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects an unverified Google email', async () => {
    tokenVerifier.verify.mockResolvedValueOnce({
      ...identity,
      emailVerified: false,
    });

    await expect(
      service.authenticate('valid-google-id-token'),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'GOOGLE_EMAIL_NOT_VERIFIED',
    });

    expect(mockFindOne).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects a suspended linked account', async () => {
    mockFindOneResult(createUser({ status: 'suspended' }));

    await expect(
      service.authenticate('valid-google-id-token'),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'ACCOUNT_UNAVAILABLE',
    });

    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  it('rejects a linked account when its login update no longer matches', async () => {
    mockFindOneResult(createUser());
    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 0 });

    await expect(
      service.authenticate('valid-google-id-token'),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'ACCOUNT_UNAVAILABLE',
    });
  });
});
