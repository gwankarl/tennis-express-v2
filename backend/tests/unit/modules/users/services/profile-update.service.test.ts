import mongoose from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserModel } from '../../../../../src/modules/users/models/user.model.js';
import { ProfileUpdateService } from '../../../../../src/modules/users/services/profile-update.service.js';

vi.mock('../../../../../src/modules/users/models/user.model.js', () => ({
  UserModel: {
    findOneAndUpdate: vi.fn(),
  },
}));

describe('ProfileUpdateService', () => {
  let service: ProfileUpdateService;

  const userId = new mongoose.Types.ObjectId().toString();

  const existingUser = {
    _id: new mongoose.Types.ObjectId(userId),
    email: 'user@example.com',
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    roles: ['buyer'],
    status: 'active',
    profile: {
      firstName: 'Jane',
      lastName: 'Doe',
      image: null,
      contactDetails: {
        phoneNumber: '123456789',
        preferredContactMethod: 'email',
      },
    },
    notificationPreferences: {
      email: true,
      inApp: true,
    },
    lastLoginAt: new Date('2026-01-02T00:00:00.000Z'),
    createdAt: new Date('2025-12-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };

  const configureQuery = (result: unknown) => {
    const query = {
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(result),
    };

    vi.mocked(UserModel.findOneAndUpdate).mockReturnValue(query as never);

    return query;
  };

  beforeEach(() => {
    service = new ProfileUpdateService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates only the supplied first name', async () => {
    const updatedUser = {
      ...existingUser,
      profile: {
        ...existingUser.profile,
        firstName: 'Janet',
      },
    };

    configureQuery(updatedUser);

    const result = await service.updateProfile(userId, {
      firstName: 'Janet',
    });

    expect(UserModel.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: userId,
        deletedAt: null,
      },
      {
        $set: {
          'profile.firstName': 'Janet',
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    expect(result.profile.firstName).toBe('Janet');
    expect(result.profile.lastName).toBe('Doe');
  });

  it('updates only the supplied last name', async () => {
    configureQuery({
      ...existingUser,
      profile: {
        ...existingUser.profile,
        lastName: 'Smith',
      },
    });

    const result = await service.updateProfile(userId, {
      lastName: 'Smith',
    });

    expect(UserModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.any(Object),
      {
        $set: {
          'profile.lastName': 'Smith',
        },
      },
      expect.any(Object),
    );

    expect(result.profile.lastName).toBe('Smith');
  });

  it('updates only the supplied contact details', async () => {
    configureQuery({
      ...existingUser,
      profile: {
        ...existingUser.profile,
        contactDetails: {
          ...existingUser.profile.contactDetails,
          phoneNumber: '987654321',
        },
      },
    });

    const result = await service.updateProfile(userId, {
      contactDetails: {
        phoneNumber: '987654321',
      },
    });

    expect(UserModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.any(Object),
      {
        $set: {
          'profile.contactDetails.phoneNumber': '987654321',
        },
      },
      expect.any(Object),
    );

    expect(result.profile.contactDetails.phoneNumber).toBe('987654321');
    expect(result.profile.contactDetails.preferredContactMethod).toBe('email');
  });

  it('updates the preferred contact method', async () => {
    configureQuery({
      ...existingUser,
      profile: {
        ...existingUser.profile,
        contactDetails: {
          ...existingUser.profile.contactDetails,
          preferredContactMethod: 'phone',
        },
      },
    });

    const result = await service.updateProfile(userId, {
      contactDetails: {
        preferredContactMethod: 'phone',
      },
    });

    expect(UserModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.any(Object),
      {
        $set: {
          'profile.contactDetails.preferredContactMethod': 'phone',
        },
      },
      expect.any(Object),
    );

    expect(result.profile.contactDetails.preferredContactMethod).toBe('phone');
  });

  it('rejects an invalid user ID', async () => {
    await expect(
      service.updateProfile('invalid-id', {
        firstName: 'Janet',
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'USER_NOT_FOUND',
    });

    expect(UserModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects when the user does not exist or has been deleted', async () => {
    configureQuery(null);

    await expect(
      service.updateProfile(userId, {
        firstName: 'Janet',
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'USER_NOT_FOUND',
    });
  });

  it('returns only the expected safe account fields', async () => {
    configureQuery(existingUser);

    const result = await service.updateProfile(userId, {
      firstName: 'Jane',
    });

    expect(result).toEqual({
      id: userId,
      email: 'user@example.com',
      emailVerifiedAt: existingUser.emailVerifiedAt,
      roles: ['buyer'],
      status: 'active',
      profile: existingUser.profile,
      notificationPreferences: existingUser.notificationPreferences,
      lastLoginAt: existingUser.lastLoginAt,
      createdAt: existingUser.createdAt,
      updatedAt: existingUser.updatedAt,
    });

    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('deletedAt');
  });
});
