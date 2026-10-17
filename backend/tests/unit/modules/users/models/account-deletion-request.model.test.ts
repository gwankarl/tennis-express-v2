import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_DELETION_REQUEST_STATUSES,
  AccountDeletionRequestModel,
} from '../../../../../src/modules/users/models/account-deletion-request.model.js';

describe('AccountDeletionRequestModel', () => {
  const userId = new Types.ObjectId();

  function createRequest(overrides: Record<string, unknown> = {}) {
    return new AccountDeletionRequestModel({
      userId,
      ...overrides,
    });
  }

  describe('schema defaults', () => {
    it('defaults to a pending review with an active request', () => {
      const request = createRequest();

      expect(request.status).toBe('pending_review');
      expect(request.isActive).toBe(true);
      expect(request.attempts).toBe(0);
    });

    it('initializes optional lifecycle fields to null', () => {
      const request = createRequest();

      expect(request.eligibilityCheckedAt).toBeNull();
      expect(request.scheduledFor).toBeNull();
      expect(request.cancelledAt).toBeNull();
      expect(request.completedAt).toBeNull();
      expect(request.processingStartedAt).toBeNull();
      expect(request.nextAttemptAt).toBeNull();
      expect(request.lastError).toBeNull();
      expect(request.reviewedBy).toBeNull();
      expect(request.reviewNotes).toBeNull();
    });

    it('initializes blocked reasons as an empty array', () => {
      const request = createRequest();

      expect(request.blockedReasons).toEqual([]);
    });

    it('sets requestedAt when a request is instantiated', () => {
      const request = createRequest();
      const now = Date.now();

      expect(request.requestedAt).toBeInstanceOf(Date);
      expect(Math.abs(request.requestedAt.getTime() - now)).toBeLessThan(5000);
    });

    it('configures automatic creation and update timestamps', () => {
      const schemaOptions = AccountDeletionRequestModel.schema.options;

      expect(schemaOptions.timestamps).toBe(true);
      expect(schemaOptions.versionKey).toBe(false);
    });
  });

  describe('schema validation', () => {
    it('accepts every supported lifecycle status', () => {
      for (const status of ACCOUNT_DELETION_REQUEST_STATUSES) {
        const request = createRequest({ status });

        expect(request.validateSync()).toBeUndefined();
      }
    });

    it('rejects an unsupported lifecycle status', () => {
      const request = createRequest({
        status: 'unknown_status',
      });

      const error = request.validateSync();

      expect(error?.errors.status).toBeDefined();
    });

    it('requires a user reference', () => {
      const request = new AccountDeletionRequestModel({});
      const error = request.validateSync();

      expect(error?.errors.userId).toBeDefined();
    });

    it('requires a valid non-negative integer attempt count', () => {
      const validRequest = createRequest({ attempts: 2 });

      expect(validRequest.validateSync()).toBeUndefined();

      const negativeRequest = createRequest({ attempts: -1 });
      expect(negativeRequest.validateSync()?.errors.attempts).toBeDefined();

      const fractionalRequest = createRequest({ attempts: 1.5 });
      expect(fractionalRequest.validateSync()?.errors.attempts).toBeDefined();
    });

    it('rejects an error message that exceeds the maximum length', () => {
      const request = createRequest({
        lastError: 'x'.repeat(1001),
      });

      expect(request.validateSync()?.errors.lastError).toBeDefined();
    });

    it('rejects review notes that exceed the maximum length', () => {
      const request = createRequest({
        reviewNotes: 'x'.repeat(2001),
      });

      expect(request.validateSync()?.errors.reviewNotes).toBeDefined();
    });

    it('accepts eligibility blockers and review information', () => {
      const request = createRequest({
        blockedReasons: [
          'An order is still active.',
          'A dispute remains unresolved.',
        ],
        reviewedBy: new Types.ObjectId(),
        reviewNotes: 'The outstanding dispute requires resolution.',
      });

      expect(request.validateSync()).toBeUndefined();
      expect(request.blockedReasons).toHaveLength(2);
      expect(request.reviewedBy).toBeInstanceOf(Types.ObjectId);
    });
  });

  describe('schema configuration', () => {
    it('makes userId and requestedAt immutable', () => {
      expect(
        AccountDeletionRequestModel.schema.path('userId').options.immutable,
      ).toBe(true);

      expect(
        AccountDeletionRequestModel.schema.path('requestedAt').options
          .immutable,
      ).toBe(true);
    });

    it('enables timestamps and disables the version key', () => {
      expect(AccountDeletionRequestModel.schema.options.timestamps).toBe(true);

      expect(AccountDeletionRequestModel.schema.options.versionKey).toBe(false);
    });

    it('uses the intended collection name', () => {
      expect(AccountDeletionRequestModel.collection.collectionName).toBe(
        'accountdeletionrequests',
      );
    });

    it('defines the unique partial index for active requests', () => {
      const indexes = AccountDeletionRequestModel.schema.indexes();

      expect(indexes).toContainEqual([
        { userId: 1 },
        expect.objectContaining({
          unique: true,
          partialFilterExpression: { isActive: true },
          name: 'unique_active_account_deletion_request_per_user',
        }),
      ]);
    });

    it('defines the background-processing index', () => {
      const indexes = AccountDeletionRequestModel.schema.indexes();

      expect(indexes).toContainEqual([
        { status: 1, nextAttemptAt: 1 },
        expect.objectContaining({
          name: 'account_deletion_processing_schedule',
        }),
      ]);
    });

    it('defines the user-history index', () => {
      const indexes = AccountDeletionRequestModel.schema.indexes();

      expect(indexes).toContainEqual([
        { userId: 1, createdAt: -1 },
        expect.objectContaining({
          name: 'account_deletion_user_history',
        }),
      ]);
    });
  });
});
