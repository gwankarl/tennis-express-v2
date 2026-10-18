import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccessTokenService } from '../../../../../src/modules/auth/services/access-token.service.js';
import type { SessionService } from '../../../../../src/modules/auth/services/session.service.js';
import type { SellerApplicationService } from '../../../../../src/modules/sellers/services/seller-application.service.js';
import { AppError } from '../../../../../src/shared/errors/app-error.js';
import { createTestApp } from '../../../../helpers/test-app.js';

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  findValidSession: vi.fn(),
  approveApplication: vi.fn(),
  rejectApplication: vi.fn(),
}));

const accessTokenService = {
  verifyToken: mocks.verifyToken,
} as unknown as AccessTokenService;

const sessionService = {
  findValidSession: mocks.findValidSession,
} as unknown as SessionService;

const sellerApplicationService = {
  approveApplication: mocks.approveApplication,
  rejectApplication: mocks.rejectApplication,
} as unknown as SellerApplicationService;

const adminId = '507f1f77bcf86cd799439011';
const sessionId = '507f1f77bcf86cd799439012';
const applicationId = '507f1f77bcf86cd799439013';

const application = {
  _id: applicationId,
  applicantId: '507f1f77bcf86cd799439014',
  status: 'pending',
  applicationData: {},
  submittedAt: new Date('2026-10-01T10:00:00.000Z'),
  reviewedBy: null,
  reviewedAt: null,
  decisionReason: null,
  createdAt: new Date('2026-10-01T10:00:00.000Z'),
  updatedAt: new Date('2026-10-01T10:00:00.000Z'),
};

const app = () =>
  createTestApp({
    accessTokenService,
    sessionService,
    sellerApplicationService,
  });

const authenticate = (testRequest: request.Test) =>
  testRequest.set('Authorization', 'Bearer test-access-token');

const approvalUrl = `/api/v1/admin/seller-applications/${applicationId}/approve`;

const rejectionUrl = `/api/v1/admin/seller-applications/${applicationId}/reject`;

describe('Admin seller application review routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.verifyToken.mockReturnValue({
      userId: adminId,
      sessionId,
      roles: ['admin'],
    });

    mocks.findValidSession.mockResolvedValue({ userId: adminId });
    mocks.approveApplication.mockResolvedValue({
      ...application,
      status: 'approved',
      reviewedBy: adminId,
      reviewedAt: new Date('2026-10-01T11:00:00.000Z'),
    });
    mocks.rejectApplication.mockResolvedValue({
      ...application,
      status: 'rejected',
      reviewedBy: adminId,
      reviewedAt: new Date('2026-10-01T11:00:00.000Z'),
      decisionReason: 'Please provide more information about sourcing.',
    });
  });

  describe('PATCH /api/v1/admin/seller-applications/:applicationId/approve', () => {
    it('rejects requests without an access token', async () => {
      const response = await request(app()).patch(approvalUrl);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'AUTHENTICATION_REQUIRED' },
      });

      expect(mocks.approveApplication).not.toHaveBeenCalled();
    });

    it('rejects authenticated users without the admin role', async () => {
      mocks.verifyToken.mockReturnValue({
        userId: adminId,
        sessionId,
        roles: ['buyer'],
      });

      const response = await authenticate(request(app()).patch(approvalUrl));

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS' },
      });

      expect(mocks.approveApplication).not.toHaveBeenCalled();
    });

    it('rejects an invalid application ID', async () => {
      const response = await authenticate(
        request(app()).patch(
          '/api/v1/admin/seller-applications/not-an-object-id/approve',
        ),
      );

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });

      expect(mocks.approveApplication).not.toHaveBeenCalled();
    });

    it('allows an administrator to approve an application', async () => {
      const response = await authenticate(request(app()).patch(approvalUrl));

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          application: {
            _id: applicationId,
            status: 'approved',
            reviewedBy: adminId,
          },
        },
      });

      expect(mocks.approveApplication).toHaveBeenCalledWith({
        applicationId,
        reviewerId: adminId,
      });
    });

    it('forwards service errors to the error handler', async () => {
      mocks.approveApplication.mockRejectedValue(
        new AppError({
          statusCode: 409,
          code: 'SELLER_APPLICATION_ALREADY_REVIEWED',
          message: 'This seller application has already been reviewed.',
        }),
      );

      const response = await authenticate(request(app()).patch(approvalUrl));

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'SELLER_APPLICATION_ALREADY_REVIEWED' },
      });
    });
  });

  describe('PATCH /api/v1/admin/seller-applications/:applicationId/reject', () => {
    it('rejects requests without an access token', async () => {
      const response = await request(app())
        .patch(rejectionUrl)
        .send({ reason: 'Please provide more information about sourcing.' });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'AUTHENTICATION_REQUIRED' },
      });

      expect(mocks.rejectApplication).not.toHaveBeenCalled();
    });

    it('rejects authenticated users without the admin role', async () => {
      mocks.verifyToken.mockReturnValue({
        userId: adminId,
        sessionId,
        roles: ['seller'],
      });

      const response = await authenticate(
        request(app()).patch(rejectionUrl),
      ).send({ reason: 'Please provide more information about sourcing.' });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS' },
      });

      expect(mocks.rejectApplication).not.toHaveBeenCalled();
    });

    it('rejects an invalid application ID', async () => {
      const response = await authenticate(
        request(app()).patch(
          '/api/v1/admin/seller-applications/not-an-object-id/reject',
        ),
      ).send({ reason: 'Please provide more information about sourcing.' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });

      expect(mocks.rejectApplication).not.toHaveBeenCalled();
    });

    it('rejects a missing or invalid rejection reason', async () => {
      const response = await authenticate(
        request(app()).patch(rejectionUrl),
      ).send({ reason: 'Too short' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });

      expect(mocks.rejectApplication).not.toHaveBeenCalled();
    });

    it('allows an administrator to reject an application', async () => {
      const reason = 'Please provide more information about sourcing.';

      const response = await authenticate(
        request(app()).patch(rejectionUrl),
      ).send({ reason });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          application: {
            _id: applicationId,
            status: 'rejected',
            reviewedBy: adminId,
            decisionReason: reason,
          },
        },
      });

      expect(mocks.rejectApplication).toHaveBeenCalledWith({
        applicationId,
        reviewerId: adminId,
        reason,
      });
    });
  });
});
