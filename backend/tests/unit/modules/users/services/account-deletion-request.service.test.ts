import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../../../src/shared/errors/app-error.js';
import {
  ACCOUNT_DELETION_CANCELLATION_WINDOW_MS,
  AccountDeletionRequestService,
  type AccountDeletionEligibilityChecker,
} from '../../../../../src/modules/users/services/account-deletion-request.service.js';

const mocks = vi.hoisted(() => ({
  userFindOne: vi.fn(),
  userSelect: vi.fn(),
  userLean: vi.fn(),
  userExec: vi.fn(),
  requestFindOne: vi.fn(),
  requestLean: vi.fn(),
  requestExec: vi.fn(),
  requestCreate: vi.fn(),
  requestFindOneAndUpdate: vi.fn(),
  requestUpdateExec: vi.fn(),
}));

vi.mock('../../../../../src/modules/users/models/user.model.js', () => ({
  UserModel: {
    findOne: mocks.userFindOne,
  },
}));

vi.mock(
  '../../../../../src/modules/users/models/account-deletion-request.model.js',
  () => ({
    AccountDeletionRequestModel: {
      findOne: mocks.requestFindOne,
      create: mocks.requestCreate,
      findOneAndUpdate: mocks.requestFindOneAndUpdate,
    },
  }),
);

const userId = '507f1f77bcf86cd799439011';
const requestId = '607f1f77bcf86cd799439012';

const eligibleResult = {
  eligible: true,
  blockedReasons: [],
};

const blockedResult = {
  eligible: false,
  blockedReasons: ['An active order must be resolved.'],
};

type MockAccountDeletionRequest = {
  _id: string;
  userId: string;
  status: string;
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
  reviewedBy: string | null;
  reviewNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  save: ReturnType<typeof vi.fn>;
};

const createRequestDocument = (
  overrides: Partial<MockAccountDeletionRequest> = {},
): MockAccountDeletionRequest => ({
  _id: requestId,
  userId,
  status: 'pending_review',
  isActive: true,
  requestedAt: new Date('2026-01-10T10:00:00.000Z'),
  eligibilityCheckedAt: new Date('2026-01-10T10:00:00.000Z'),
  scheduledFor: null,
  cancelledAt: null,
  completedAt: null,
  processingStartedAt: null,
  attempts: 0,
  nextAttemptAt: null,
  blockedReasons: [],
  lastError: null,
  reviewedBy: null,
  reviewNotes: null,
  createdAt: new Date('2026-01-10T10:00:00.000Z'),
  updatedAt: new Date('2026-01-10T10:00:00.000Z'),
  save: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('AccountDeletionRequestService', () => {
  let service: AccountDeletionRequestService;
  let eligibilityChecker: AccountDeletionEligibilityChecker;

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.userFindOne.mockReturnValue({
      select: mocks.userSelect,
    });
    mocks.userSelect.mockReturnValue({
      lean: mocks.userLean,
    });
    mocks.userLean.mockReturnValue({
      exec: mocks.userExec,
    });

    mocks.requestFindOne.mockReturnValue({
      lean: mocks.requestLean,
      exec: mocks.requestExec,
    });
    mocks.requestLean.mockReturnValue({
      exec: mocks.requestExec,
    });

    mocks.requestFindOneAndUpdate.mockReturnValue({
      exec: mocks.requestUpdateExec,
    });

    eligibilityChecker = {
      checkEligibility: vi.fn().mockResolvedValue(eligibleResult),
    };

    service = new AccountDeletionRequestService(eligibilityChecker);
  });

  describe('requestDeletion', () => {
    it('creates and schedules a request when the user is eligible', async () => {
      mocks.userExec.mockResolvedValue({ _id: userId });
      mocks.requestExec.mockResolvedValue(null);

      const createdRequest = createRequestDocument({
        status: 'scheduled',
      });
      mocks.requestCreate.mockResolvedValue(createdRequest);

      const result = await service.requestDeletion(userId);

      expect(mocks.userFindOne).toHaveBeenCalledWith({
        _id: userId,
        deletedAt: null,
        status: 'active',
      });
      expect(mocks.userSelect).toHaveBeenCalledWith('_id');
      expect(mocks.requestFindOne).toHaveBeenCalledWith({
        userId,
        isActive: true,
        status: {
          $in: ['pending_review', 'scheduled', 'processing', 'failed'],
        },
      });
      expect(eligibilityChecker.checkEligibility).toHaveBeenCalledWith(userId);

      expect(mocks.requestCreate).toHaveBeenCalledTimes(1);

      const requestData = mocks.requestCreate.mock.calls[0][0];

      expect(requestData.userId.toString()).toBe(userId);
      expect(requestData.status).toBe('scheduled');
      expect(requestData.isActive).toBe(true);
      expect(requestData.eligibilityCheckedAt).toBeInstanceOf(Date);
      expect(requestData.scheduledFor).toBeInstanceOf(Date);
      expect(
        requestData.scheduledFor.getTime() - requestData.requestedAt.getTime(),
      ).toBe(ACCOUNT_DELETION_CANCELLATION_WINDOW_MS);
      expect(requestData.blockedReasons).toEqual([]);
      expect(requestData.attempts).toBe(0);

      expect(result).toBe(createdRequest);
    });

    it('creates a pending-review request when eligibility is blocked', async () => {
      mocks.userExec.mockResolvedValue({ _id: userId });
      mocks.requestExec.mockResolvedValue(null);
      vi.mocked(eligibilityChecker.checkEligibility).mockResolvedValue(
        blockedResult,
      );

      const createdRequest = createRequestDocument({
        status: 'pending_review',
        blockedReasons: blockedResult.blockedReasons,
      });
      mocks.requestCreate.mockResolvedValue(createdRequest);

      await service.requestDeletion(userId);

      const requestData = mocks.requestCreate.mock.calls[0][0];

      expect(requestData.status).toBe('pending_review');
      expect(requestData.scheduledFor).toBeNull();
      expect(requestData.blockedReasons).toEqual(blockedResult.blockedReasons);
    });

    it('does not schedule a request when eligibility is false without reasons', async () => {
      mocks.userExec.mockResolvedValue({ _id: userId });
      mocks.requestExec.mockResolvedValue(null);
      vi.mocked(eligibilityChecker.checkEligibility).mockResolvedValue({
        eligible: false,
        blockedReasons: [],
      });
      mocks.requestCreate.mockResolvedValue(
        createRequestDocument({ status: 'pending_review' }),
      );

      await service.requestDeletion(userId);

      expect(mocks.requestCreate.mock.calls[0][0].status).toBe(
        'pending_review',
      );
      expect(mocks.requestCreate.mock.calls[0][0].scheduledFor).toBeNull();
    });

    it('rejects an invalid user ID without querying the database', async () => {
      await expect(service.requestDeletion('invalid-id')).rejects.toMatchObject(
        {
          statusCode: 404,
          code: 'USER_NOT_FOUND',
        },
      );

      expect(mocks.userFindOne).not.toHaveBeenCalled();
      expect(mocks.requestCreate).not.toHaveBeenCalled();
    });

    it('rejects a missing or deleted user', async () => {
      mocks.userExec.mockResolvedValue(null);

      await expect(service.requestDeletion(userId)).rejects.toBeInstanceOf(
        AppError,
      );

      expect(mocks.requestCreate).not.toHaveBeenCalled();
      expect(eligibilityChecker.checkEligibility).not.toHaveBeenCalled();
    });

    it('rejects a request when an active request already exists', async () => {
      mocks.userExec.mockResolvedValue({ _id: userId });
      mocks.requestExec.mockResolvedValue({
        _id: requestId,
        status: 'scheduled',
        isActive: true,
      });

      await expect(service.requestDeletion(userId)).rejects.toMatchObject({
        statusCode: 409,
        code: 'ACCOUNT_DELETION_REQUEST_ALREADY_ACTIVE',
      });

      expect(eligibilityChecker.checkEligibility).not.toHaveBeenCalled();
      expect(mocks.requestCreate).not.toHaveBeenCalled();
    });

    it('translates a duplicate-key database error into a conflict', async () => {
      mocks.userExec.mockResolvedValue({ _id: userId });
      mocks.requestExec.mockResolvedValue(null);
      mocks.requestCreate.mockRejectedValue({
        code: 11000,
      });

      await expect(service.requestDeletion(userId)).rejects.toMatchObject({
        statusCode: 409,
        code: 'ACCOUNT_DELETION_REQUEST_ALREADY_ACTIVE',
      });
    });

    it('propagates unexpected database errors', async () => {
      const databaseError = new Error('Database unavailable');
      mocks.userExec.mockResolvedValue({ _id: userId });
      mocks.requestExec.mockRejectedValue(databaseError);

      await expect(service.requestDeletion(userId)).rejects.toBe(databaseError);

      expect(eligibilityChecker.checkEligibility).not.toHaveBeenCalled();
    });

    it('propagates eligibility-check failures without creating a request', async () => {
      const eligibilityError = new Error('Eligibility check failed');

      mocks.userExec.mockResolvedValue({ _id: userId });
      mocks.requestExec.mockResolvedValue(null);
      vi.mocked(eligibilityChecker.checkEligibility).mockRejectedValue(
        eligibilityError,
      );

      await expect(service.requestDeletion(userId)).rejects.toBe(
        eligibilityError,
      );

      expect(mocks.requestCreate).not.toHaveBeenCalled();
    });
  });

  describe('cancelRequest', () => {
    it('cancels a pending-review or scheduled request atomically', async () => {
      const cancelledRequest = createRequestDocument({
        status: 'cancelled',
        isActive: false,
        cancelledAt: new Date(),
      });
      mocks.requestUpdateExec.mockResolvedValue(cancelledRequest);

      const result = await service.cancelRequest(userId);

      expect(mocks.requestFindOneAndUpdate).toHaveBeenCalledWith(
        {
          userId,
          isActive: true,
          status: {
            $in: ['pending_review', 'scheduled'],
          },
        },
        {
          $set: {
            status: 'cancelled',
            isActive: false,
            cancelledAt: expect.any(Date),
            scheduledFor: null,
            nextAttemptAt: null,
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );

      expect(result).toBe(cancelledRequest);
    });

    it('rejects cancellation when no cancellable request exists', async () => {
      mocks.requestUpdateExec.mockResolvedValue(null);

      await expect(service.cancelRequest(userId)).rejects.toMatchObject({
        statusCode: 409,
        code: 'ACCOUNT_DELETION_REQUEST_NOT_CANCELLABLE',
      });
    });

    it('rejects an invalid user ID without querying requests', async () => {
      await expect(service.cancelRequest('invalid-id')).rejects.toMatchObject({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
      });

      expect(mocks.requestFindOneAndUpdate).not.toHaveBeenCalled();
    });

    it('propagates cancellation database errors', async () => {
      const databaseError = new Error('Database unavailable');
      mocks.requestUpdateExec.mockRejectedValue(databaseError);

      await expect(service.cancelRequest(userId)).rejects.toBe(databaseError);
    });
  });

  describe('reevaluateEligibility', () => {
    it('schedules a blocked request when all blockers are resolved', async () => {
      const pendingRequest = createRequestDocument({
        status: 'pending_review',
        blockedReasons: blockedResult.blockedReasons,
      });

      mocks.requestFindOne.mockReturnValueOnce({
        exec: mocks.requestExec,
      });
      mocks.requestExec.mockResolvedValue(pendingRequest);

      vi.mocked(eligibilityChecker.checkEligibility).mockResolvedValue(
        eligibleResult,
      );

      const result = await service.reevaluateEligibility(userId);

      expect(mocks.requestFindOne).toHaveBeenCalledWith({
        userId,
        isActive: true,
        status: 'pending_review',
      });
      expect(eligibilityChecker.checkEligibility).toHaveBeenCalledWith(userId);

      expect(pendingRequest.status).toBe('scheduled');
      expect(pendingRequest.eligibilityCheckedAt).toBeInstanceOf(Date);
      expect(pendingRequest.scheduledFor).toBeInstanceOf(Date);
      expect(pendingRequest.blockedReasons).toEqual([]);

      expect(
        pendingRequest.scheduledFor!.getTime() -
          pendingRequest.eligibilityCheckedAt!.getTime(),
      ).toBe(ACCOUNT_DELETION_CANCELLATION_WINDOW_MS);

      expect(pendingRequest.save).toHaveBeenCalledTimes(1);
      expect(result).toBe(pendingRequest);
    });

    it('keeps a request pending when blockers remain', async () => {
      const pendingRequest = createRequestDocument({
        status: 'pending_review',
        blockedReasons: [],
      });

      mocks.requestFindOne.mockReturnValueOnce({
        exec: mocks.requestExec,
      });
      mocks.requestExec.mockResolvedValue(pendingRequest);

      vi.mocked(eligibilityChecker.checkEligibility).mockResolvedValue(
        blockedResult,
      );

      await service.reevaluateEligibility(userId);

      expect(pendingRequest.status).toBe('pending_review');
      expect(pendingRequest.scheduledFor).toBeNull();
      expect(pendingRequest.blockedReasons).toEqual(
        blockedResult.blockedReasons,
      );
      expect(pendingRequest.save).toHaveBeenCalledTimes(1);
    });

    it('rejects when no pending-review request exists', async () => {
      mocks.requestFindOne.mockReturnValueOnce({
        exec: mocks.requestExec,
      });
      mocks.requestExec.mockResolvedValue(null);

      await expect(service.reevaluateEligibility(userId)).rejects.toMatchObject(
        {
          statusCode: 404,
          code: 'ACCOUNT_DELETION_REQUEST_NOT_FOUND',
        },
      );

      expect(eligibilityChecker.checkEligibility).not.toHaveBeenCalled();
    });

    it('rejects an invalid user ID without querying requests', async () => {
      await expect(
        service.reevaluateEligibility('invalid-id'),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
      });

      expect(mocks.requestFindOne).not.toHaveBeenCalled();
    });

    it('propagates eligibility-check errors without saving the request', async () => {
      const pendingRequest = createRequestDocument({
        status: 'pending_review',
      });
      const eligibilityError = new Error('Eligibility check failed');

      mocks.requestFindOne.mockReturnValueOnce({
        exec: mocks.requestExec,
      });
      mocks.requestExec.mockResolvedValue(pendingRequest);

      vi.mocked(eligibilityChecker.checkEligibility).mockRejectedValue(
        eligibilityError,
      );

      await expect(service.reevaluateEligibility(userId)).rejects.toBe(
        eligibilityError,
      );

      expect(pendingRequest.save).not.toHaveBeenCalled();
    });

    it('propagates request lookup database errors', async () => {
      const databaseError = new Error('Database unavailable');

      mocks.requestFindOne.mockReturnValueOnce({
        exec: mocks.requestExec,
      });
      mocks.requestExec.mockRejectedValue(databaseError);

      await expect(service.reevaluateEligibility(userId)).rejects.toBe(
        databaseError,
      );

      expect(eligibilityChecker.checkEligibility).not.toHaveBeenCalled();
    });
  });
});
