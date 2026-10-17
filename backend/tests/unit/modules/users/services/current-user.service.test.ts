import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../../../src/shared/errors/app-error.js';
import { CurrentUserService } from '../../../../../src/modules/users/services/current-user.service.js';

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  select: vi.fn(),
  lean: vi.fn(),
  exec: vi.fn(),
}));

vi.mock('../../../../../src/modules/users/models/user.model.js', () => ({
  UserModel: {
    findOne: mocks.findOne,
  },
}));

const userId = '507f1f77bcf86cd799439011';

const currentUser = {
  _id: { toString: () => userId },
  email: 'buyer@example.com',
  emailVerifiedAt: new Date('2026-01-10T10:00:00.000Z'),
  roles: ['buyer'],
  status: 'active',
  profile: {
    firstName: 'Alex',
    lastName: 'Buyer',
    image: null,
    contactDetails: {
      phoneNumber: '+237600000000',
      preferredContactMethod: 'email',
    },
  },
  notificationPreferences: {
    email: true,
    inApp: true,
  },
  lastLoginAt: new Date('2026-01-12T10:00:00.000Z'),
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-12T10:00:00.000Z'),
  passwordHash: 'must-not-be-returned',
  googleId: 'must-not-be-returned',
};

describe('CurrentUserService', () => {
  let service: CurrentUserService;

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.findOne.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ lean: mocks.lean });
    mocks.lean.mockReturnValue({ exec: mocks.exec });

    service = new CurrentUserService();
  });

  it('returns the safe current-user response', async () => {
    mocks.exec.mockResolvedValue(currentUser);

    const result = await service.getCurrentUser(userId);

    expect(mocks.findOne).toHaveBeenCalledWith({
      _id: userId,
      deletedAt: null,
    });

    expect(mocks.select).toHaveBeenCalledWith(
      '_id email emailVerifiedAt roles status profile notificationPreferences lastLoginAt createdAt updatedAt',
    );

    expect(result).toEqual({
      id: userId,
      email: currentUser.email,
      emailVerifiedAt: currentUser.emailVerifiedAt,
      roles: currentUser.roles,
      status: currentUser.status,
      profile: currentUser.profile,
      notificationPreferences: currentUser.notificationPreferences,
      lastLoginAt: currentUser.lastLoginAt,
      createdAt: currentUser.createdAt,
      updatedAt: currentUser.updatedAt,
    });

    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('googleId');
  });

  it('throws USER_NOT_FOUND when the account does not exist', async () => {
    mocks.exec.mockResolvedValue(null);

    await expect(service.getCurrentUser(userId)).rejects.toMatchObject({
      statusCode: 404,
      code: 'USER_NOT_FOUND',
    });
  });

  it('queries only accounts that have not been deleted', async () => {
    mocks.exec.mockResolvedValue(null);

    await expect(service.getCurrentUser(userId)).rejects.toBeInstanceOf(
      AppError,
    );

    expect(mocks.findOne).toHaveBeenCalledWith({
      _id: userId,
      deletedAt: null,
    });
  });

  it('rejects an invalid user ID without querying the database', async () => {
    await expect(service.getCurrentUser('invalid-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'USER_NOT_FOUND',
    });

    expect(mocks.findOne).not.toHaveBeenCalled();
  });
});
