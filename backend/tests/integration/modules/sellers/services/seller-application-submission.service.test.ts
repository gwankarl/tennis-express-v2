import mongoose from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';

import { CategoryModel } from '../../../../../src/modules/categories/models/category.model.js';
import { CategoryCheckerService } from '../../../../../src/modules/categories/services/category-checker.service.js';
import { SellerApplicationModel } from '../../../../../src/modules/sellers/models/seller-application.model.js';
import { SellerApplicationService } from '../../../../../src/modules/sellers/services/seller-application.service.js';
import { UserModel } from '../../../../../src/modules/users/models/user.model.js';

import type { CreateSellerApplicationRequest } from '../../../../../src/modules/sellers/validations/seller-application.validation.js';

describe('Seller application submission integration', () => {
  let applicantId: string;
  let categoryChecker: CategoryCheckerService;
  let service: SellerApplicationService;
  let categoryCreatorId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    const applicant = await UserModel.create({
      email: `seller-applicant-${new mongoose.Types.ObjectId().toString()}@example.com`,
      passwordHash: 'test-password-hash',
      roles: ['buyer'],
      status: 'active',
      emailVerifiedAt: new Date(),
      profile: {
        firstName: 'Alex',
        lastName: 'Seller',
      },
    });

    applicantId = applicant._id.toString();
    categoryCreatorId = applicant._id;

    categoryChecker = new CategoryCheckerService();
    service = new SellerApplicationService(categoryChecker);
  });

  async function createCategory(status: 'active' | 'inactive' = 'active') {
    return CategoryModel.create({
      name: `Tennis Equipment ${new mongoose.Types.ObjectId().toString()}`,
      slug: `tennis-equipment-${new mongoose.Types.ObjectId().toString()}`,
      parentId: null,
      status,
      sortOrder: 0,
      attributes: [],
      createdBy: categoryCreatorId,
      updatedBy: categoryCreatorId,
    });
  }

  function createApplicationInput(
    categoryIds: string[],
  ): CreateSellerApplicationRequest {
    return {
      applicationData: {
        businessDetails: {
          sellerType: 'individual' as const,
          businessName: null,
          storeName: 'Karlson Tennis Gear',
          businessRegistrationNumber: null,
        },
        contactDetails: {
          region: 'Centre',
          city: 'Yaoundé',
          address: '123 Example Street',
          phoneNumber: '+237 670000000',
        },
        productDetails: {
          productCategoryIds: categoryIds,
          businessDescription:
            'I sell genuine tennis rackets, balls, and other tennis equipment.',
          sourcingMethods: ['manufacturer' as const],
          otherSourcingMethod: null,
        },
        fulfilmentDetails: {
          methods: ['delivery' as const, 'collection' as const],
          serviceRegions: ['Centre'],
          dispatchTime: 'one_to_three_days' as const,
        },
        supportingDocuments: [],
        declarations: {
          informationIsAccurate: true,
          sellerPolicyAccepted: true,
          productsAreGenuineAndLegallySellable: true,
        },
      },
    };
  }

  it('submits an application when all selected categories are active', async () => {
    const category = await createCategory('active');

    const result = await service.submitApplication(
      applicantId,
      createApplicationInput([category._id.toString()]),
    );

    expect(result.status).toBe('pending');
    expect(result.applicantId.toString()).toBe(applicantId);
    expect(
      result.applicationData.productDetails.productCategoryIds.map((id) =>
        id.toString(),
      ),
    ).toContain(category._id.toString());

    const persistedApplication = await SellerApplicationModel.findById(
      result._id,
    ).exec();

    expect(persistedApplication).not.toBeNull();
    expect(persistedApplication?.status).toBe('pending');
  });

  it('rejects an application containing an inactive category', async () => {
    const category = await createCategory('inactive');

    await expect(
      service.submitApplication(
        applicantId,
        createApplicationInput([category._id.toString()]),
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'CATEGORY_NOT_ACTIVE',
    });

    const persistedApplication = await SellerApplicationModel.findOne({
      applicantId,
    }).exec();

    expect(persistedApplication).toBeNull();
  });

  it('rejects an application containing a nonexistent category', async () => {
    const nonexistentCategoryId = new mongoose.Types.ObjectId().toString();

    await expect(
      service.submitApplication(
        applicantId,
        createApplicationInput([nonexistentCategoryId]),
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'CATEGORY_NOT_FOUND',
    });

    const persistedApplication = await SellerApplicationModel.findOne({
      applicantId,
    }).exec();

    expect(persistedApplication).toBeNull();
  });
});
