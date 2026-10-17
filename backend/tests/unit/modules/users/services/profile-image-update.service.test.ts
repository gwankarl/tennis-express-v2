import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  uploadProfileImage: vi.fn(),
  deleteProfileImage: vi.fn(),
  scheduleDeletion: vi.fn(),
}));

vi.mock('../../../../../src/modules/users/models/user.model.js', () => ({
  UserModel: {
    findOne: mocks.findOne,
    findOneAndUpdate: mocks.findOneAndUpdate,
  },
}));

vi.mock(
  '../../../../../src/modules/users/services/profile-image-upload.service.js',
  () => ({
    ProfileImageUploadService: class {
      uploadProfileImage = mocks.uploadProfileImage;
      deleteProfileImage = mocks.deleteProfileImage;
    },
  }),
);

vi.mock(
  '../../../../../src/modules/users/services/cloudinary-cleanup-queue.service.js',
  () => ({
    CloudinaryCleanupQueueService: class {
      scheduleDeletion = mocks.scheduleDeletion;
    },
  }),
);

import { ProfileImageUpdateService } from '../../../../../src/modules/users/services/profile-image-update.service.js';

const userId = '507f1f77bcf86cd799439011';

const oldImage = {
  publicId: 'tennis-xpress/profile-images/old-image',
  secureUrl: 'https://res.cloudinary.com/demo/old-image.jpg',
};

const newImage = {
  publicId: 'tennis-xpress/profile-images/new-image',
  secureUrl: 'https://res.cloudinary.com/demo/new-image.jpg',
};

const existingUser = {
  _id: userId,
  profile: {
    firstName: 'Alex',
    lastName: 'Tennis',
    image: oldImage,
    contactDetails: {},
  },
};

const updatedUser = {
  _id: userId,
  email: 'alex@example.com',
  emailVerifiedAt: null,
  roles: ['buyer'],
  status: 'active',
  profile: {
    firstName: 'Alex',
    lastName: 'Tennis',
    image: newImage,
    contactDetails: {},
  },
  notificationPreferences: {
    email: true,
    inApp: true,
  },
  lastLoginAt: null,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-12T10:00:00.000Z'),
};

function createQueryMock(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(result),
  };
}

describe('ProfileImageUpdateService', () => {
  let service: ProfileImageUpdateService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();

    mocks.uploadProfileImage.mockResolvedValue(newImage);
    mocks.deleteProfileImage.mockResolvedValue(undefined);
    mocks.scheduleDeletion.mockResolvedValue(undefined);

    mocks.findOne.mockReturnValue(
      createQueryMock({
        ...existingUser,
        profile: { ...existingUser.profile },
      }),
    );

    mocks.findOneAndUpdate.mockReturnValue(
      createQueryMock({
        ...updatedUser,
        profile: { ...updatedUser.profile },
      }),
    );

    service = new ProfileImageUpdateService();
  });

  it('uploads and saves a new profile image when no previous image exists', async () => {
    mocks.findOne.mockReturnValue(
      createQueryMock({
        ...existingUser,
        profile: {
          ...existingUser.profile,
          image: null,
        },
      }),
    );

    const result = await service.updateProfileImage(userId, {
      buffer: Buffer.from('test-image'),
      mimetype: 'image/png',
    });

    expect(mocks.uploadProfileImage).toHaveBeenCalledWith({
      buffer: Buffer.from('test-image'),
      mimetype: 'image/png',
    });

    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: userId,
        deletedAt: null,
      },
      {
        $set: {
          'profile.image': newImage,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    expect(mocks.deleteProfileImage).not.toHaveBeenCalled();
    expect(mocks.scheduleDeletion).not.toHaveBeenCalled();
    expect(result.profile.image).toEqual(newImage);
  });

  it('deletes the previous image only after the database update succeeds', async () => {
    const operationOrder: string[] = [];

    mocks.uploadProfileImage.mockImplementation(async () => {
      operationOrder.push('upload');
      return newImage;
    });

    mocks.findOneAndUpdate.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      exec: vi.fn().mockImplementation(async () => {
        operationOrder.push('database-update');
        return updatedUser;
      }),
    });

    mocks.deleteProfileImage.mockImplementation(async () => {
      operationOrder.push('delete-old-image');
    });

    await service.updateProfileImage(userId, {
      buffer: Buffer.from('test-image'),
      mimetype: 'image/png',
    });

    expect(operationOrder).toEqual([
      'upload',
      'database-update',
      'delete-old-image',
    ]);

    expect(mocks.deleteProfileImage).toHaveBeenCalledWith(oldImage.publicId);

    expect(mocks.scheduleDeletion).not.toHaveBeenCalled();
  });

  it('throws USER_NOT_FOUND when the user does not exist', async () => {
    mocks.findOne.mockReturnValue(createQueryMock(null));

    await expect(
      service.updateProfileImage(userId, {
        buffer: Buffer.from('test-image'),
        mimetype: 'image/png',
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'USER_NOT_FOUND',
    });

    expect(mocks.uploadProfileImage).not.toHaveBeenCalled();
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('deletes the newly uploaded image if the database update fails', async () => {
    const databaseError = new Error('Database update failed');

    mocks.findOneAndUpdate.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      exec: vi.fn().mockRejectedValue(databaseError),
    });

    await expect(
      service.updateProfileImage(userId, {
        buffer: Buffer.from('test-image'),
        mimetype: 'image/png',
      }),
    ).rejects.toThrow('Database update failed');

    expect(mocks.deleteProfileImage).toHaveBeenCalledWith(newImage.publicId);

    expect(mocks.scheduleDeletion).not.toHaveBeenCalled();
  });

  it('preserves the successful update and queues the old image if deletion fails', async () => {
    mocks.deleteProfileImage.mockRejectedValue(
      new Error('Cloudinary deletion failed'),
    );

    const result = await service.updateProfileImage(userId, {
      buffer: Buffer.from('test-image'),
      mimetype: 'image/png',
    });

    expect(result.profile.image).toEqual(newImage);

    expect(mocks.deleteProfileImage).toHaveBeenCalledWith(oldImage.publicId);

    expect(mocks.scheduleDeletion).toHaveBeenCalledWith({
      publicId: oldImage.publicId,
      resourceType: 'image',
    });
  });

  it('preserves the successful update and logs an error if queuing cleanup also fails', async () => {
    const queueError = new Error('Cleanup queue unavailable');

    mocks.deleteProfileImage.mockRejectedValue(
      new Error('Cloudinary deletion failed'),
    );
    mocks.scheduleDeletion.mockRejectedValue(queueError);

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const result = await service.updateProfileImage(userId, {
      buffer: Buffer.from('test-image'),
      mimetype: 'image/png',
    });

    expect(result.profile.image).toEqual(newImage);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to schedule Cloudinary image cleanup.',
      expect.objectContaining({
        publicId: oldImage.publicId,
        queueError,
      }),
    );
  });

  it('rejects invalid user IDs without querying the database or uploading', async () => {
    await expect(
      service.updateProfileImage('invalid-user-id', {
        buffer: Buffer.from('test-image'),
        mimetype: 'image/png',
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'USER_NOT_FOUND',
    });

    expect(mocks.findOne).not.toHaveBeenCalled();
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.uploadProfileImage).not.toHaveBeenCalled();
  });
});
