import mongoose from 'mongoose';

import { AppError } from '../../../shared/errors/app-error.js';
import { AccountDeletionRequestModel } from '../models/account-deletion-request.model.js';
import { UserModel } from '../models/user.model.js';
import type {
  AccountDeletionRequest,
  AccountDeletionRequestStatus,
} from '../models/account-deletion-request.model.js';

/*
 * The cancellation window begins only after eligibility has been confirmed.
 */
export const ACCOUNT_DELETION_CANCELLATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface AccountDeletionEligibilityResult {
  eligible: boolean;
  blockedReasons: string[];
}

export interface AccountDeletionEligibilityChecker {
  checkEligibility(userId: string): Promise<AccountDeletionEligibilityResult>;
}

type AccountDeletionRequestDocument =
  mongoose.HydratedDocument<AccountDeletionRequest>;

const ACTIVE_REQUEST_STATUSES: AccountDeletionRequestStatus[] = [
  'pending_review',
  'scheduled',
  'processing',
  'failed',
];

/** Manages account-deletion requests and their initial lifecycle transitions. */
export class AccountDeletionRequestService {
  constructor(
    private readonly eligibilityChecker: AccountDeletionEligibilityChecker,
  ) {}

  /**
   * Creates a deletion request and determines whether it can be scheduled.
   *
   * Marketplace eligibility checks are injected so the service can be
   * connected to the real order, dispute, refund, and payment workflows.
   */
  async requestDeletion(
    userId: string,
  ): Promise<AccountDeletionRequestDocument> {
    this.validateUserId(userId);

    const user = await UserModel.findOne({
      _id: userId,
      deletedAt: null,
      status: 'active',
    })
      .select('_id')
      .lean()
      .exec();

    if (!user) {
      throw this.userNotFoundError();
    }

    const existingRequest = await AccountDeletionRequestModel.findOne({
      userId,
      isActive: true,
      status: { $in: ACTIVE_REQUEST_STATUSES },
    })
      .lean()
      .exec();

    if (existingRequest) {
      throw new AppError({
        statusCode: 409,
        code: 'ACCOUNT_DELETION_REQUEST_ALREADY_ACTIVE',
        message: 'An active account-deletion request already exists.',
      });
    }

    const eligibility = await this.eligibilityChecker.checkEligibility(userId);

    const now = new Date();
    const eligible =
      eligibility.eligible && eligibility.blockedReasons.length === 0;

    const request = {
      userId: new mongoose.Types.ObjectId(userId),
      status: eligible ? ('scheduled' as const) : ('pending_review' as const),
      isActive: true,
      requestedAt: now,
      eligibilityCheckedAt: now,
      scheduledFor: eligible
        ? new Date(now.getTime() + ACCOUNT_DELETION_CANCELLATION_WINDOW_MS)
        : null,
      cancelledAt: null,
      completedAt: null,
      processingStartedAt: null,
      attempts: 0,
      nextAttemptAt: null,
      blockedReasons: eligibility.blockedReasons,
      lastError: null,
      reviewedBy: null,
      reviewNotes: null,
    };

    try {
      return await AccountDeletionRequestModel.create(request);
    } catch (error) {
      /*
       * The unique partial index handles concurrent requests that pass the
       * earlier lookup at approximately the same time.
       */
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        throw new AppError({
          statusCode: 409,
          code: 'ACCOUNT_DELETION_REQUEST_ALREADY_ACTIVE',
          message: 'An active account-deletion request already exists.',
        });
      }

      throw error;
    }
  }

  /**
   * Cancels a request before deletion processing has begun.
   *
   * The atomic status condition prevents cancellation from winning after
   * another process has transitioned the request to processing.
   */
  async cancelRequest(userId: string): Promise<AccountDeletionRequestDocument> {
    this.validateUserId(userId);

    const request = await AccountDeletionRequestModel.findOneAndUpdate(
      {
        userId,
        isActive: true,
        status: { $in: ['pending_review', 'scheduled'] },
      },
      {
        $set: {
          status: 'cancelled',
          isActive: false,
          cancelledAt: new Date(),
          scheduledFor: null,
          nextAttemptAt: null,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).exec();

    if (!request) {
      throw new AppError({
        statusCode: 409,
        code: 'ACCOUNT_DELETION_REQUEST_NOT_CANCELLABLE',
        message:
          'There is no cancellable account-deletion request for this user.',
      });
    }

    return request;
  }

  /**
   * Rechecks a request that was waiting on eligibility blockers.
   *
   * When all blockers are resolved, a new seven-day cancellation window
   * begins. This method does not perform account deletion itself.
   */
  async reevaluateEligibility(
    userId: string,
  ): Promise<AccountDeletionRequestDocument> {
    this.validateUserId(userId);

    const existingRequest = await AccountDeletionRequestModel.findOne({
      userId,
      isActive: true,
      status: 'pending_review',
    }).exec();

    if (!existingRequest) {
      throw new AppError({
        statusCode: 404,
        code: 'ACCOUNT_DELETION_REQUEST_NOT_FOUND',
        message: 'No deletion request awaiting eligibility review was found.',
      });
    }

    const eligibility = await this.eligibilityChecker.checkEligibility(userId);

    const now = new Date();
    const eligible =
      eligibility.eligible && eligibility.blockedReasons.length === 0;

    existingRequest.eligibilityCheckedAt = now;
    existingRequest.blockedReasons = eligibility.blockedReasons;

    if (eligible) {
      existingRequest.status = 'scheduled';
      existingRequest.scheduledFor = new Date(
        now.getTime() + ACCOUNT_DELETION_CANCELLATION_WINDOW_MS,
      );
    }

    await existingRequest.save();

    return existingRequest;
  }

  private validateUserId(userId: string): void {
    if (!mongoose.isValidObjectId(userId)) {
      throw this.userNotFoundError();
    }
  }

  private userNotFoundError(): AppError {
    return new AppError({
      statusCode: 404,
      code: 'USER_NOT_FOUND',
      message: 'The user account could not be found.',
    });
  }
}
