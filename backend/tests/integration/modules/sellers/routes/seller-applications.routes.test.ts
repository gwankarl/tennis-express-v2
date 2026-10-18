import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccessTokenService } from '../../../../../src/modules/auth/services/access-token.service.js';
import type { SessionService } from '../../../../../src/modules/auth/services/session.service.js';
import type { SellerApplicationService } from '../../../../../src/modules/sellers/services/seller-application.service.js';
import { createTestApp } from '../../../../helpers/test-app.js';
import { AppError } from '../../../../../src/shared/errors/app-error.js';

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  findValidSession: vi.fn(),
  submitApplication: vi.fn(),
  getMyLatestApplication: vi.fn(),
  getMyApplicationById: vi.fn(),
}));

const accessTokenService = {
  verifyToken: mocks.verifyToken,
} as unknown as AccessTokenService;

const sessionService = {
  findValidSession: mocks.findValidSession,
} as unknown as SessionService;

const sellerApplicationService = {
  submitApplication: mocks.submitApplication,
  getMyLatestApplication: mocks.getMyLatestApplication,
  getMyApplicationById: mocks.getMyApplicationById,
} as unknown as SellerApplicationService;

const userId = '507f1f77bcf86cd799439011';
const sessionId = '507f1f77bcf86cd799439012';
const applicationId = '507f1f77bcf86cd799439013';
const categoryId = '507f1f77bcf86cd799439014';

const applicationData = {
  businessDetails: {
    sellerType: 'individual',
    businessName: null,
    storeName: 'Karlson Tennis Gear',
    businessRegistrationNumber: null,
  },
  contactDetails: {
    region: 'Centre',
    city: 'Yaounde',
    address: '123 Example Street',
    phoneNumber: '+237 670000000',
  },
  productDetails: {
    productCategoryIds: [categoryId],
    businessDescription:
      'I sell genuine tennis rackets, balls, and other tennis equipment.',
    sourcingMethods: ['manufacturer'],
    otherSourcingMethod: null,
  },
  fulfilmentDetails: {
    methods: ['delivery', 'collection'],
    serviceRegions: ['Centre'],
    dispatchTime: 'one_to_three_days',
  },
  supportingDocuments: [],
  declarations: {
    informationIsAccurate: true,
    sellerPolicyAccepted: true,
    productsAreGenuineAndLegallySellable: true,
  },
};

const application = {
  _id: applicationId,
  applicantId: userId,
  status: 'pending',
  applicationData,
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

describe('Seller application routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.verifyToken.mockReturnValue({
      userId,
      sessionId,
      roles: ['buyer'],
    });

    mocks.findValidSession.mockResolvedValue({ userId });

    mocks.submitApplication.mockResolvedValue(application);
    mocks.getMyLatestApplication.mockResolvedValue(application);
    mocks.getMyApplicationById.mockResolvedValue(application);
  });

  describe('POST /api/v1/seller-applications', () => {
    it('rejects requests without an access token', async () => {
      const response = await request(app())
        .post('/api/v1/seller-applications')
        .send({ applicationData });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'AUTHENTICATION_REQUIRED' },
      });

      expect(mocks.submitApplication).not.toHaveBeenCalled();
    });

    it('rejects invalid application data', async () => {
      const response = await authenticate(
        request(app()).post('/api/v1/seller-applications'),
      ).send({
        applicationData: {
          ...applicationData,
          contactDetails: {
            ...applicationData.contactDetails,
            phoneNumber: '',
          },
        },
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });

      expect(mocks.submitApplication).not.toHaveBeenCalled();
    });

    it('submits a valid application for the authenticated user', async () => {
      const response = await authenticate(
        request(app()).post('/api/v1/seller-applications'),
      ).send({ applicationData });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          application: {
            _id: applicationId,
            applicantId: userId,
            status: 'pending',
          },
        },
      });

      expect(mocks.submitApplication).toHaveBeenCalledWith(userId, {
        applicationData,
      });
    });
  });

  describe('GET /api/v1/seller-applications/me', () => {
    it('rejects requests without an access token', async () => {
      const response = await request(app()).get(
        '/api/v1/seller-applications/me',
      );

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'AUTHENTICATION_REQUIRED' },
      });

      expect(mocks.getMyLatestApplication).not.toHaveBeenCalled();
    });

    it('returns the latest application for the authenticated user', async () => {
      const response = await authenticate(
        request(app()).get('/api/v1/seller-applications/me'),
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          application: {
            _id: applicationId,
            applicantId: userId,
            status: 'pending',
          },
        },
      });

      expect(mocks.getMyLatestApplication).toHaveBeenCalledWith(userId);
    });

    it('returns null when the user has no application', async () => {
      mocks.getMyLatestApplication.mockResolvedValue(null);

      const response = await authenticate(
        request(app()).get('/api/v1/seller-applications/me'),
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: { application: null },
      });
    });
  });

  describe('GET /api/v1/seller-applications/:applicationId', () => {
    it('rejects requests without an access token', async () => {
      const response = await request(app()).get(
        `/api/v1/seller-applications/${applicationId}`,
      );

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'AUTHENTICATION_REQUIRED' },
      });

      expect(mocks.getMyApplicationById).not.toHaveBeenCalled();
    });

    it('returns an application belonging to the authenticated user', async () => {
      const response = await authenticate(
        request(app()).get(`/api/v1/seller-applications/${applicationId}`),
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          application: {
            _id: applicationId,
            applicantId: userId,
            status: 'pending',
          },
        },
      });

      expect(mocks.getMyApplicationById).toHaveBeenCalledWith(
        userId,
        applicationId,
      );
    });

    it('rejects an invalid application ID', async () => {
      const response = await authenticate(
        request(app()).get('/api/v1/seller-applications/not-an-object-id'),
      );

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });

      expect(mocks.getMyApplicationById).not.toHaveBeenCalled();
    });

    it('forwards service errors to the error handler', async () => {
      mocks.getMyApplicationById.mockRejectedValue(
        new AppError({
          statusCode: 404,
          code: 'SELLER_APPLICATION_NOT_FOUND',
          message: 'Seller application not found.',
        }),
      );

      const response = await authenticate(
        request(app()).get(`/api/v1/seller-applications/${applicationId}`),
      );

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'SELLER_APPLICATION_NOT_FOUND' },
      });
    });
  });
});
