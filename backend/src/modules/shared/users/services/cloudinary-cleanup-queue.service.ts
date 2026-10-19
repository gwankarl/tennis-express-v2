import { CloudinaryCleanupJobModel } from '../models/cloudinary-cleanup-job.model.js';

interface ScheduleCloudinaryCleanupInput {
  publicId: string;
  resourceType?: 'image';
  nextAttemptAt?: Date;
}

/**
 * Persists Cloudinary deletion work so failed cleanup can be retried later.
 */
export class CloudinaryCleanupQueueService {
  /**
   * Adds a pending deletion job to MongoDB.
   */
  async scheduleDeletion(input: ScheduleCloudinaryCleanupInput): Promise<void> {
    await CloudinaryCleanupJobModel.create({
      publicId: input.publicId,
      resourceType: input.resourceType ?? 'image',
      status: 'pending',
      attempts: 0,
      nextAttemptAt: input.nextAttemptAt ?? new Date(),
      lastError: null,
      completedAt: null,
    });
  }
}
