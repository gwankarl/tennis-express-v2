import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';

import { AppError } from '../../../../../src/shared/errors/app-error.js';
import { SellerApplicationService } from '../../../../../src/modules/sellers/services/seller-application.service.js';

import type { CreateSellerApplicationRequest } from '../../../../../src/modules/sellers/validations/seller-application.validation.js';
import type { SellerApplicationCategoryChecker } from '../../../../../src/modules/sellers/services/seller-application.service.js';

const mocks = vi.hoisted(() => ({
  userFindOne: vi.fn(),
  applicationFindOne: vi.fn(),
  applicationCreate: vi.fn(),
  applicationFindOneAndUpdate: vi.fn(),
  applicationFindById: vi.fn(),
  storeProvision: vi.fn(),
  sessionWithTransaction: vi.fn(),
  sessionEnd: vi.fn(),
}));

vi.mock('../../../../../src/modules/users/models/user.model.js', () => ({
  UserModel: {
    findOne: mocks.userFindOne,
  },
}));

vi.mock(
  '../../../../../src/modules/sellers/models/seller-application.model.js',
  () => ({
    SellerApplicationModel: {
      findOne: mocks.applicationFindOne,
      create: mocks.applicationCreate,
      findOneAndUpdate: mocks.applicationFindOneAndUpdate,
      findById: mocks.applicationFindById,
    },
  }),
);

vi.mock(
  '../../../../../src/modules/stores/services/store-provisioning.service.js',
  () => ({
    StoreProvisioningService: class {
      provisionStore = mocks.storeProvision;
    },
  }),
);

const validApplicantId = '507f1f77bcf86cd799439011';
const validApplicationId = '507f1f77bcf86cd799439012';
const validCategoryId = '507f1f77bcf86cd799439013';

const validInput: CreateSellerApplicationRequest = {
  applicationData: {
    businessDetails: {
      sellerType: 'individual',
      businessName: null,
      businessRegistrationNumber: null,
      storeName: 'Karlson Tennis Gear',
    },
    contactDetails: {
      region: 'Centre',
      city: 'Yaoundé',
      address: 'A valid operating address',
      phoneNumber: '+237 699 123 456',
    },
    productDetails: {
      productCategoryIds: [validCategoryId],
      businessDescription: 'We sell quality tennis rackets and accessories.',
      sourcingMethods: ['authorized_distributor'],
      otherSourcingMethod: null,
    },
    fulfilmentDetails: {
      methods: ['delivery', 'collection'],
      serviceRegions: ['Centre', 'Littoral'],
      dispatchTime: 'one_to_three_days',
    },
    supportingDocuments: [],
    declarations: {
      informationIsAccurate: true,
      sellerPolicyAccepted: true,
      productsAreGenuineAndLegallySellable: true,
    },
  },
};

const createdApplication = {
  _id: validApplicationId,
  applicantId: validApplicantId,
  status: 'pending',
  applicationData: validInput.applicationData,
  submittedAt: new Date(),
  reviewedBy: null,
  reviewedAt: null,
  decisionReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const rejectedApplication = {
  ...createdApplication,
  status: 'rejected',
  reviewedBy: validApplicantId,
  reviewedAt: new Date('2026-10-01T11:00:00.000Z'),
  decisionReason:
    'Please provide more information about your product sourcing.',
};

function createQuery(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    session: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(result),
  };
}

describe('SellerApplicationService', () => {
  let service: SellerApplicationService;
  let categoryChecker: SellerApplicationCategoryChecker;

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.sessionWithTransaction.mockImplementation(async (callback) => {
      await callback();
    });
    mocks.sessionEnd.mockResolvedValue(undefined);
    mocks.storeProvision.mockResolvedValue({});

    vi.spyOn(mongoose, 'startSession').mockResolvedValue({
      withTransaction: mocks.sessionWithTransaction,
      endSession: mocks.sessionEnd,
    } as unknown as mongoose.ClientSession);

    categoryChecker = {
      validateCategories: vi.fn().mockResolvedValue(undefined),
    };

    service = new SellerApplicationService(categoryChecker);
  });

  describe('submitApplication', () => {
    it('creates a pending application for an active applicant', async () => {
      mocks.userFindOne.mockReturnValue(
        createQuery({
          _id: validApplicantId,
        }),
      );

      mocks.applicationFindOne.mockReturnValue(createQuery(null));
      mocks.applicationCreate.mockResolvedValue(createdApplication);

      const result = await service.submitApplication(
        validApplicantId,
        validInput,
      );

      expect(result).toEqual(createdApplication);
      expect(categoryChecker.validateCategories).toHaveBeenCalledWith([
        validCategoryId,
      ]);

      expect(mocks.applicationCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          applicationData: validInput.applicationData,
          reviewedBy: null,
          reviewedAt: null,
          decisionReason: null,
        }),
      );
    });

    it('rejects an invalid applicant ID', async () => {
      await expect(
        service.submitApplication('invalid-id', validInput),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
      });

      expect(mocks.userFindOne).not.toHaveBeenCalled();
    });

    it('rejects a nonexistent or inactive applicant', async () => {
      mocks.userFindOne.mockReturnValue(createQuery(null));

      await expect(
        service.submitApplication(validApplicantId, validInput),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
      });

      expect(mocks.applicationCreate).not.toHaveBeenCalled();
    });

    it('rejects submission when a pending application already exists', async () => {
      mocks.userFindOne.mockReturnValue(
        createQuery({
          _id: validApplicantId,
        }),
      );

      mocks.applicationFindOne.mockReturnValue(
        createQuery({
          _id: validApplicationId,
        }),
      );

      await expect(
        service.submitApplication(validApplicantId, validInput),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'SELLER_APPLICATION_ALREADY_PENDING',
      });

      expect(categoryChecker.validateCategories).not.toHaveBeenCalled();
      expect(mocks.applicationCreate).not.toHaveBeenCalled();
    });

    it('does not create an application when category validation fails', async () => {
      mocks.userFindOne.mockReturnValue(
        createQuery({
          _id: validApplicantId,
        }),
      );

      mocks.applicationFindOne.mockReturnValue(createQuery(null));

      vi.mocked(categoryChecker.validateCategories).mockRejectedValue(
        new AppError({
          statusCode: 400,
          code: 'INVALID_PRODUCT_CATEGORIES',
          message: 'One or more product categories are invalid.',
        }),
      );

      await expect(
        service.submitApplication(validApplicantId, validInput),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_PRODUCT_CATEGORIES',
      });

      expect(mocks.applicationCreate).not.toHaveBeenCalled();
    });

    it('converts a MongoDB duplicate-key error into a conflict error', async () => {
      mocks.userFindOne.mockReturnValue(
        createQuery({
          _id: validApplicantId,
        }),
      );

      mocks.applicationFindOne.mockReturnValue(createQuery(null));

      mocks.applicationCreate.mockRejectedValue(
        Object.assign(new Error('Duplicate key'), { code: 11000 }),
      );

      await expect(
        service.submitApplication(validApplicantId, validInput),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'SELLER_APPLICATION_ALREADY_PENDING',
      });
    });

    it('rethrows unexpected database errors', async () => {
      const databaseError = new Error('Database unavailable');

      mocks.userFindOne.mockReturnValue(
        createQuery({
          _id: validApplicantId,
        }),
      );

      mocks.applicationFindOne.mockReturnValue(createQuery(null));
      mocks.applicationCreate.mockRejectedValue(databaseError);

      await expect(
        service.submitApplication(validApplicantId, validInput),
      ).rejects.toBe(databaseError);
    });
  });

  describe('getMyLatestApplication', () => {
    it('returns the latest application for an existing applicant', async () => {
      mocks.userFindOne.mockReturnValue(
        createQuery({
          _id: validApplicantId,
        }),
      );

      const query = createQuery(createdApplication);
      mocks.applicationFindOne.mockReturnValue(query);

      const result = await service.getMyLatestApplication(validApplicantId);

      expect(result).toEqual(createdApplication);
      expect(mocks.applicationFindOne).toHaveBeenCalledWith({
        applicantId: validApplicantId,
      });
      expect(query.sort).toHaveBeenCalledWith({ submittedAt: -1 });
    });

    it('returns null when the applicant has no applications', async () => {
      mocks.userFindOne.mockReturnValue(
        createQuery({
          _id: validApplicantId,
        }),
      );

      mocks.applicationFindOne.mockReturnValue(createQuery(null));

      const result = await service.getMyLatestApplication(validApplicantId);

      expect(result).toBeNull();
    });

    it('rejects retrieval for a nonexistent applicant', async () => {
      mocks.userFindOne.mockReturnValue(createQuery(null));

      await expect(
        service.getMyLatestApplication(validApplicantId),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
      });
    });
  });

  describe('getMyApplicationById', () => {
    it('returns an application belonging to the applicant', async () => {
      mocks.applicationFindOne.mockReturnValue(createQuery(createdApplication));

      const result = await service.getMyApplicationById(
        validApplicantId,
        validApplicationId,
      );

      expect(result).toEqual(createdApplication);
      expect(mocks.applicationFindOne).toHaveBeenCalledWith({
        _id: validApplicationId,
        applicantId: validApplicantId,
      });
    });

    it('rejects an invalid application ID', async () => {
      await expect(
        service.getMyApplicationById(validApplicantId, 'invalid-id'),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'SELLER_APPLICATION_NOT_FOUND',
      });

      expect(mocks.applicationFindOne).not.toHaveBeenCalled();
    });

    it('does not expose an application belonging to another applicant', async () => {
      mocks.applicationFindOne.mockReturnValue(createQuery(null));

      await expect(
        service.getMyApplicationById(validApplicantId, validApplicationId),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'SELLER_APPLICATION_NOT_FOUND',
      });
    });
  });

  describe('approveApplication', () => {
    it('approves a pending application and records the reviewer', async () => {
      const applicant = {
        _id: new mongoose.Types.ObjectId(validApplicantId),
        roles: ['buyer'],
        save: vi.fn().mockResolvedValue(undefined),
      };

      const application = {
        ...createdApplication,
        applicantId: applicant._id,
        save: vi.fn().mockImplementation(async () => undefined),
      };

      mocks.applicationFindOne.mockReturnValue(createQuery(application));
      mocks.applicationFindById.mockReturnValue(
        createQuery({ ...createdApplication, status: 'pending' }),
      );
      mocks.userFindOne.mockReturnValue(createQuery(applicant));

      const result = await service.approveApplication({
        applicationId: validApplicationId,
        reviewerId: validApplicantId,
      });

      expect(result.status).toBe('approved');
      expect(result.reviewedBy).toEqual(
        new mongoose.Types.ObjectId(validApplicantId),
      );
      expect(result.reviewedAt).toBeInstanceOf(Date);
      expect(applicant.roles).toContain('both');
      expect(applicant.save).toHaveBeenCalled();
      expect(mocks.storeProvision).toHaveBeenCalledWith(
        expect.objectContaining({
          sellerId: validApplicantId,
          name: 'Karlson Tennis Gear',
        }),
      );
      expect(application.save).toHaveBeenCalled();
      expect(mocks.sessionWithTransaction).toHaveBeenCalledOnce();
      expect(mocks.sessionEnd).toHaveBeenCalledOnce();
    });

    it('returns not found when the application does not exist', async () => {
      mocks.applicationFindOne.mockReturnValue(createQuery(null));
      mocks.applicationFindById.mockReturnValue(createQuery(null));

      await expect(
        service.approveApplication({
          applicationId: validApplicationId,
          reviewerId: validApplicantId,
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'SELLER_APPLICATION_NOT_FOUND',
      });

      expect(mocks.sessionEnd).toHaveBeenCalledOnce();
    });

    it('returns a conflict when the application was already reviewed', async () => {
      mocks.applicationFindOne.mockReturnValue(createQuery(null));
      mocks.applicationFindById.mockReturnValue(
        createQuery({ _id: validApplicationId, status: 'rejected' }),
      );

      await expect(
        service.approveApplication({
          applicationId: validApplicationId,
          reviewerId: validApplicantId,
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'SELLER_APPLICATION_ALREADY_REVIEWED',
      });

      expect(mocks.sessionEnd).toHaveBeenCalledOnce();
    });

    it('rejects an invalid reviewer ID', async () => {
      await expect(
        service.approveApplication({
          applicationId: validApplicationId,
          reviewerId: 'invalid-id',
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
      });

      expect(mocks.applicationFindOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('rejectApplication', () => {
    it('rejects a pending application and records the trimmed reason', async () => {
      mocks.applicationFindOneAndUpdate.mockReturnValue(
        createQuery(rejectedApplication),
      );

      const result = await service.rejectApplication({
        applicationId: validApplicationId,
        reviewerId: validApplicantId,
        reason:
          '  Please provide more information about your product sourcing.  ',
      });

      expect(result).toEqual(rejectedApplication);

      expect(mocks.applicationFindOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: validApplicationId,
          status: 'pending',
        },
        {
          $set: {
            status: 'rejected',
            reviewedBy: expect.any(mongoose.Types.ObjectId),
            reviewedAt: expect.any(Date),
            decisionReason:
              'Please provide more information about your product sourcing.',
          },
        },
        {
          new: true,
          runValidators: true,
        },
      );
    });

    it('rejects a reason that is too short', async () => {
      await expect(
        service.rejectApplication({
          applicationId: validApplicationId,
          reviewerId: validApplicantId,
          reason: 'Not good',
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_SELLER_APPLICATION_REJECTION_REASON',
      });

      expect(mocks.applicationFindOneAndUpdate).not.toHaveBeenCalled();
    });

    it('rejects an empty reason', async () => {
      await expect(
        service.rejectApplication({
          applicationId: validApplicationId,
          reviewerId: validApplicantId,
          reason: '           ',
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_SELLER_APPLICATION_REJECTION_REASON',
      });

      expect(mocks.applicationFindOneAndUpdate).not.toHaveBeenCalled();
    });

    it('returns a conflict when another reviewer has already decided', async () => {
      mocks.applicationFindOneAndUpdate.mockReturnValue(createQuery(null));
      mocks.applicationFindById.mockReturnValue(
        createQuery({ _id: validApplicationId, status: 'approved' }),
      );

      await expect(
        service.rejectApplication({
          applicationId: validApplicationId,
          reviewerId: validApplicantId,
          reason: 'The application needs additional verification.',
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'SELLER_APPLICATION_ALREADY_REVIEWED',
      });
    });
  });
});
