import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { SellerApplicationModel } from '../../../../../src/modules/sellers/models/seller-application.model.js';
import { SellerApplicationService } from '../../../../../src/modules/sellers/services/seller-application.service.js';
import { StoreModel } from '../../../../../src/modules/stores/models/store.model.js';
import { UserModel } from '../../../../../src/modules/users/models/user.model.js';

import type { SellerApplicationCategoryChecker } from '../../../../../src/modules/sellers/services/seller-application.service.js';
import { StoreProvisioningService } from '../../../../../src/modules/stores/services/store-provisioning.service.js';

describe('Seller application approval integration', () => {
  it('promotes the applicant, provisions a storefront, and approves the application atomically', async () => {
    const applicant = await UserModel.create({
      email: 'seller-applicant@example.com',
      passwordHash: 'test-password-hash',
      roles: ['buyer'],
      status: 'active',
      emailVerifiedAt: new Date(),
      profile: {
        firstName: 'Alex',
        lastName: 'Seller',
      },
    });

    const reviewer = await UserModel.create({
      email: 'seller-reviewer@example.com',
      passwordHash: 'test-password-hash',
      roles: ['admin'],
      status: 'active',
      emailVerifiedAt: new Date(),
      profile: {
        firstName: 'Admin',
        lastName: 'Reviewer',
      },
    });

    const application = await SellerApplicationModel.create({
      applicantId: applicant._id,
      status: 'pending',
      applicationData: {
        businessDetails: {
          sellerType: 'individual',
          businessName: null,
          storeName: 'Baseline Tennis Gear',
          businessRegistrationNumber: null,
        },
        contactDetails: {
          region: 'Centre',
          city: 'Yaoundé',
          address: 'Central Yaoundé',
          phoneNumber: '+237 699 123 456',
        },
        productDetails: {
          productCategoryIds: [new mongoose.Types.ObjectId()],
          businessDescription:
            'Quality tennis rackets, balls, and accessories.',
          sourcingMethods: ['authorized_distributor'],
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
      },
    });

    const categoryChecker: SellerApplicationCategoryChecker = {
      validateCategories: async () => undefined,
    };

    const service = new SellerApplicationService(categoryChecker);

    const result = await service.approveApplication({
      applicationId: application._id.toString(),
      reviewerId: reviewer._id.toString(),
    });

    const persistedApplicant = await UserModel.findById(applicant._id).exec();

    const persistedApplication = await SellerApplicationModel.findById(
      application._id,
    ).exec();

    const store = await StoreModel.findOne({
      sellerId: applicant._id,
    }).exec();

    expect(result.status).toBe('approved');

    expect(persistedApplication).not.toBeNull();
    expect(persistedApplication?.status).toBe('approved');
    expect(persistedApplication?.reviewedBy?.toString()).toBe(
      reviewer._id.toString(),
    );
    expect(persistedApplication?.reviewedAt).toBeInstanceOf(Date);

    expect(persistedApplicant?.roles).toContain('both');
    expect(persistedApplicant?.roles).not.toContain('buyer');

    expect(store).not.toBeNull();
    expect(store?.sellerId.toString()).toBe(applicant._id.toString());
    expect(store?.name).toBe('Baseline Tennis Gear');
    expect(store?.slug).toBe('baseline-tennis-gear');
    expect(store?.description).toBe(
      'Quality tennis rackets, balls, and accessories.',
    );
    expect(store?.location).toMatchObject({
      region: 'Centre',
      city: 'Yaoundé',
      address: 'Central Yaoundé',
    });
    expect(store?.status).toBe('paused');
  });

  it('rolls back role promotion and application approval when storefront provisioning fails', async () => {
    const applicant = await UserModel.create({
      email: 'rollback-applicant@example.com',
      passwordHash: 'test-password-hash',
      roles: ['buyer'],
      status: 'active',
      emailVerifiedAt: new Date(),
      profile: {
        firstName: 'Alex',
        lastName: 'Rollback',
      },
    });

    const reviewer = await UserModel.create({
      email: 'rollback-reviewer@example.com',
      passwordHash: 'test-password-hash',
      roles: ['admin'],
      status: 'active',
      emailVerifiedAt: new Date(),
      profile: {
        firstName: 'Admin',
        lastName: 'Reviewer',
      },
    });

    const application = await SellerApplicationModel.create({
      applicantId: applicant._id,
      status: 'pending',
      applicationData: {
        businessDetails: {
          sellerType: 'individual',
          businessName: null,
          storeName: 'Rollback Tennis Gear',
          businessRegistrationNumber: null,
        },
        contactDetails: {
          region: 'Centre',
          city: 'Yaoundé',
          address: 'Central Yaoundé',
          phoneNumber: '+237 699 123 456',
        },
        productDetails: {
          productCategoryIds: [new mongoose.Types.ObjectId()],
          businessDescription:
            'Quality tennis rackets, balls, and accessories.',
          sourcingMethods: ['authorized_distributor'],
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
      },
    });

    const categoryChecker: SellerApplicationCategoryChecker = {
      validateCategories: async () => undefined,
    };

    const provisioningFailure = new Error(
      'Simulated storefront provisioning failure',
    );

    const failingProvisioningService = {
      provisionStore: vi.fn().mockRejectedValue(provisioningFailure),
    } as unknown as StoreProvisioningService;

    const service = new SellerApplicationService(
      categoryChecker,
      failingProvisioningService,
    );

    await expect(
      service.approveApplication({
        applicationId: application._id.toString(),
        reviewerId: reviewer._id.toString(),
      }),
    ).rejects.toThrow('Simulated storefront provisioning failure');

    const persistedApplicant = await UserModel.findById(applicant._id).exec();

    const persistedApplication = await SellerApplicationModel.findById(
      application._id,
    ).exec();

    const store = await StoreModel.findOne({
      sellerId: applicant._id,
    }).exec();

    expect(failingProvisioningService.provisionStore).toHaveBeenCalledOnce();

    expect(persistedApplicant?.roles).toContain('buyer');
    expect(persistedApplicant?.roles).not.toContain('both');
    expect(persistedApplicant?.roles).not.toContain('seller');

    expect(persistedApplication).not.toBeNull();
    expect(persistedApplication?.status).toBe('pending');
    expect(persistedApplication?.reviewedBy).toBeNull();
    expect(persistedApplication?.reviewedAt).toBeNull();

    expect(store).toBeNull();
  });
});
