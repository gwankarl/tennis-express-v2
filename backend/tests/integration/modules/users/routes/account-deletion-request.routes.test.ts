import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccessTokenService } from '../../../../../src/modules/auth/services/access-token.service.js';
import type { SessionService } from '../../../../../src/modules/auth/services/session.service.js';
import type { AccountDeletionRequestService } from '../../../../../src/modules/users/services/account-deletion-request.service.js';
import { createTestApp } from '../../../../helpers/test-app.js';
import { AppError } from '../../../../../src/shared/errors/app-error.js';

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  findValidSession: vi.fn(),
  requestDeletion: vi.fn(),
  cancelRequest: vi.fn(),
}));

const accessTokenService = {
  verifyToken: mocks.verifyToken,
} as unknown as AccessTokenService;

const sessionService = {
  findValidSession: mocks.findValidSession,
} as unknown as SessionService;

const accountDeletionRequestService = {
  requestDeletion: mocks.requestDeletion,
  cancelRequest: mocks.cancelRequest,
} as unknown as AccountDeletionRequestService;

const userId = '507f1f77bcf86cd799439011';
const sessionId = '507f1f77bcf86cd799439012';
const requestId = '607f1f77bcf86cd799439013';

const deletionRequest = {
  id: requestId,
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
  blockedReasons: ['Marketplace eligibility checks are not configured.'],
  lastError: null,
  reviewedBy: null,
  reviewNotes: null,
};

const app = () =>
  createTestApp({
    accessTokenService,
    sessionService,
    accountDeletionRequestService,
  });

describe('POST /api/v1/users/me/deletion-request', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.verifyToken.mockReturnValue({
      userId,
      sessionId,
      roles: ['buyer'],
    });

    mocks.findValidSession.mockResolvedValue({ userId });

    mocks.requestDeletion.mockResolvedValue(deletionRequest);

    mocks.cancelRequest.mockResolvedValue({
      ...deletionRequest,
      status: 'cancelled',
      isActive: false,
      scheduledFor: null,
      cancelledAt: new Date('2026-01-11T10:00:00.000Z'),
    });
  });

  it('rejects requests without an access token', async () => {
    const response = await request(app()).post(
      '/api/v1/users/me/deletion-request',
    );

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
      },
    });

    expect(mocks.verifyToken).not.toHaveBeenCalled();
    expect(mocks.requestDeletion).not.toHaveBeenCalled();
  });

  it('rejects requests with an invalid session', async () => {
    mocks.findValidSession.mockResolvedValue(null);

    const response = await request(app())
      .post('/api/v1/users/me/deletion-request')
      .set('Authorization', 'Bearer test-access-token');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_SESSION',
      },
    });

    expect(mocks.requestDeletion).not.toHaveBeenCalled();
  });

  it('creates an authenticated account-deletion request', async () => {
    const response = await request(app())
      .post('/api/v1/users/me/deletion-request')
      .set('Authorization', 'Bearer test-access-token');

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        request: {
          id: requestId,
          userId,
          status: 'pending_review',
          isActive: true,
          blockedReasons: [
            'Marketplace eligibility checks are not configured.',
          ],
        },
      },
    });

    expect(mocks.verifyToken).toHaveBeenCalledWith('test-access-token');
    expect(mocks.findValidSession).toHaveBeenCalledWith(sessionId);
    expect(mocks.requestDeletion).toHaveBeenCalledWith(userId);
  });

  it('forwards service errors through centralized error handling', async () => {
    mocks.requestDeletion.mockRejectedValue(
      new AppError({
        message: 'An active request already exists.',
        statusCode: 409,
        code: 'ACCOUNT_DELETION_REQUEST_ALREADY_ACTIVE',
      }),
    );

    const response = await request(app())
      .post('/api/v1/users/me/deletion-request')
      .set('Authorization', 'Bearer test-access-token');

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'ACCOUNT_DELETION_REQUEST_ALREADY_ACTIVE',
      },
    });
  });
});

describe('DELETE /api/v1/users/me/deletion-request', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.verifyToken.mockReturnValue({
      userId,
      sessionId,
      roles: ['buyer'],
    });

    mocks.findValidSession.mockResolvedValue({ userId });

    mocks.requestDeletion.mockResolvedValue(deletionRequest);

    mocks.cancelRequest.mockResolvedValue({
      ...deletionRequest,
      status: 'cancelled',
      isActive: false,
      scheduledFor: null,
      cancelledAt: new Date('2026-01-11T10:00:00.000Z'),
    });
  });

  it('rejects requests without an access token', async () => {
    const response = await request(app()).delete(
      '/api/v1/users/me/deletion-request',
    );

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
      },
    });

    expect(mocks.verifyToken).not.toHaveBeenCalled();
    expect(mocks.cancelRequest).not.toHaveBeenCalled();
  });

  it('rejects requests with an invalid session', async () => {
    mocks.findValidSession.mockResolvedValue(null);

    const response = await request(app())
      .delete('/api/v1/users/me/deletion-request')
      .set('Authorization', 'Bearer test-access-token');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_SESSION',
      },
    });

    expect(mocks.cancelRequest).not.toHaveBeenCalled();
  });

  it('cancels the authenticated user account-deletion request', async () => {
    const response = await request(app())
      .delete('/api/v1/users/me/deletion-request')
      .set('Authorization', 'Bearer test-access-token');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        request: {
          id: requestId,
          userId,
          status: 'cancelled',
          isActive: false,
        },
      },
    });

    expect(mocks.verifyToken).toHaveBeenCalledWith('test-access-token');
    expect(mocks.findValidSession).toHaveBeenCalledWith(sessionId);
    expect(mocks.cancelRequest).toHaveBeenCalledWith(userId);
  });

  it('forwards cancellation errors through centralized error handling', async () => {
    mocks.cancelRequest.mockRejectedValue(
      new AppError({
        message: 'The request cannot be cancelled.',
        statusCode: 409,
        code: 'ACCOUNT_DELETION_REQUEST_NOT_CANCELLABLE',
      }),
    );

    const response = await request(app())
      .delete('/api/v1/users/me/deletion-request')
      .set('Authorization', 'Bearer test-access-token');

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'ACCOUNT_DELETION_REQUEST_NOT_CANCELLABLE',
      },
    });
  });
});
