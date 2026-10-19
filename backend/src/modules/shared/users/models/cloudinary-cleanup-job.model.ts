import mongoose, { Schema } from 'mongoose';

export type CloudinaryCleanupJobStatus = 'pending' | 'completed';

export interface CloudinaryCleanupJob {
  publicId: string;
  resourceType: 'image';
  status: CloudinaryCleanupJobStatus;
  attempts: number;
  nextAttemptAt: Date;
  lastError: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const cloudinaryCleanupJobSchema = new Schema<CloudinaryCleanupJob>(
  {
    publicId: {
      type: String,
      required: true,
      trim: true,
    },
    resourceType: {
      type: String,
      required: true,
      enum: ['image'],
      default: 'image',
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'completed'],
      default: 'pending',
    },
    attempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    nextAttemptAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    lastError: {
      type: String,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

cloudinaryCleanupJobSchema.index({
  status: 1,
  nextAttemptAt: 1,
});

export const CloudinaryCleanupJobModel =
  mongoose.models.CloudinaryCleanupJob ||
  mongoose.model<CloudinaryCleanupJob>(
    'CloudinaryCleanupJob',
    cloudinaryCleanupJobSchema,
  );
