import mongoose, { Schema, Types } from 'mongoose';

export const ACCOUNT_DELETION_REQUEST_STATUSES = [
  'pending_review',
  'scheduled',
  'processing',
  'cancelled',
  'completed',
  'failed',
] as const;

export type AccountDeletionRequestStatus =
  (typeof ACCOUNT_DELETION_REQUEST_STATUSES)[number];

export interface AccountDeletionRequest {
  userId: Types.ObjectId;
  status: AccountDeletionRequestStatus;
  isActive: boolean;
  requestedAt: Date;
  eligibilityCheckedAt: Date | null;
  scheduledFor: Date | null;
  cancelledAt: Date | null;
  completedAt: Date | null;
  processingStartedAt: Date | null;
  attempts: number;
  nextAttemptAt: Date | null;
  blockedReasons: string[];
  lastError: string | null;
  reviewedBy: Types.ObjectId | null;
  reviewNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const accountDeletionRequestSchema = new Schema<AccountDeletionRequest>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    status: {
      type: String,
      enum: ACCOUNT_DELETION_REQUEST_STATUSES,
      required: true,
      default: 'pending_review',
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    requestedAt: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },
    eligibilityCheckedAt: {
      type: Date,
      default: null,
    },
    scheduledFor: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    processingStartedAt: {
      type: Date,
      default: null,
    },
    attempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Processing attempts must be an integer.',
      },
    },
    nextAttemptAt: {
      type: Date,
      default: null,
    },
    blockedReasons: {
      type: [String],
      default: [],
    },
    lastError: {
      type: String,
      default: null,
      maxlength: 1000,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewNotes: {
      type: String,
      default: null,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'accountdeletionrequests',
  },
);

/*
 * Only one active deletion request may exist per user.
 * Completed and cancelled requests remain available as history.
 */
accountDeletionRequestSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isActive: true,
    },
    name: 'unique_active_account_deletion_request_per_user',
  },
);

/*
 * Supports worker queries for requests that are ready to be processed
 * or retried.
 */
accountDeletionRequestSchema.index(
  { status: 1, nextAttemptAt: 1 },
  {
    name: 'account_deletion_processing_schedule',
  },
);

/*
 * Supports retrieving a user's deletion-request history.
 */
accountDeletionRequestSchema.index(
  { userId: 1, createdAt: -1 },
  {
    name: 'account_deletion_user_history',
  },
);

export const AccountDeletionRequestModel =
  mongoose.models.AccountDeletionRequest ||
  mongoose.model<AccountDeletionRequest>(
    'AccountDeletionRequest',
    accountDeletionRequestSchema,
  );
