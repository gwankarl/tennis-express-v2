import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock(
  '../../../../../src/modules/users/models/cloudinary-cleanup-job.model.js',
  () => ({
    CloudinaryCleanupJobModel: {
      create: mocks.create,
    },
  }),
);

import { CloudinaryCleanupQueueService } from '../../../../../src/modules/users/services/cloudinary-cleanup-queue.service.js';

describe('CloudinaryCleanupQueueService', () => {
  let service: CloudinaryCleanupQueueService;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({});
    service = new CloudinaryCleanupQueueService();
  });

  it('creates a pending cleanup job with default values', async () => {
    const publicId = 'tennis-xpress/profile-images/old-image';

    await service.scheduleDeletion({ publicId });

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        publicId,
        resourceType: 'image',
        status: 'pending',
        attempts: 0,
        lastError: null,
        completedAt: null,
        nextAttemptAt: expect.any(Date),
      }),
    );
  });

  it('uses the supplied retry time', async () => {
    const nextAttemptAt = new Date('2026-10-18T12:00:00.000Z');

    await service.scheduleDeletion({
      publicId: 'tennis-xpress/profile-images/old-image',
      resourceType: 'image',
      nextAttemptAt,
    });

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nextAttemptAt,
      }),
    );
  });

  it('propagates database errors when a job cannot be saved', async () => {
    const databaseError = new Error('Database unavailable');

    mocks.create.mockRejectedValue(databaseError);

    await expect(
      service.scheduleDeletion({
        publicId: 'tennis-xpress/profile-images/old-image',
      }),
    ).rejects.toThrow('Database unavailable');
  });
});
