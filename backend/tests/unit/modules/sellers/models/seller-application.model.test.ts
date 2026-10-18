import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';

import { SellerApplicationModel } from '../../../../../src/modules/sellers/models/seller-application.model.js';

function createValidApplicationData() {
  return {
    businessDetails: {
      sellerType: 'individual',
      businessName: null,
      storeName: 'Karlson Tennis Gear',
      businessRegistrationNumber: null,
    },
    contactDetails: {
      region: 'Centre',
      city: 'Yaoundé',
      address: 'A valid operating address',
      phoneNumber: '+237 699 123 456',
    },
    productDetails: {
      productCategoryIds: [new Types.ObjectId()],
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
  };
}

function createValidApplication() {
  return new SellerApplicationModel({
    applicantId: new Types.ObjectId(),
    applicationData: createValidApplicationData(),
  });
}

describe('SellerApplicationModel', () => {
  describe('document validation', () => {
    it('accepts a valid seller application', () => {
      const application = createValidApplication();

      expect(application.validateSync()).toBeUndefined();
    });

    it('requires an applicant ID', () => {
      const application = new SellerApplicationModel({
        applicationData: createValidApplicationData(),
      });

      const error = application.validateSync();

      expect(error?.errors.applicantId).toBeDefined();
    });

    it('requires application data', () => {
      const application = new SellerApplicationModel({
        applicantId: new Types.ObjectId(),
      });

      const error = application.validateSync();

      expect(error?.errors.applicationData).toBeDefined();
    });

    it('rejects an unsupported application status', () => {
      const application = new SellerApplicationModel({
        applicantId: new Types.ObjectId(),
        status: 'suspended',
        applicationData: createValidApplicationData(),
      });

      const error = application.validateSync();

      expect(error?.errors.status).toBeDefined();
    });

    it('rejects a declaration that is not accepted', () => {
      const applicationData = createValidApplicationData();

      applicationData.declarations.sellerPolicyAccepted =
        false as unknown as true;

      const application = new SellerApplicationModel({
        applicantId: new Types.ObjectId(),
        applicationData,
      });

      const error = application.validateSync();

      expect(error?.errors).toHaveProperty(
        'applicationData.declarations.sellerPolicyAccepted',
      );
    });

    it('rejects a missing contact phone number', () => {
      const applicationData = createValidApplicationData();

      delete (
        applicationData.contactDetails as {
          phoneNumber?: string;
        }
      ).phoneNumber;

      const application = new SellerApplicationModel({
        applicantId: new Types.ObjectId(),
        applicationData,
      });

      const error = application.validateSync();

      expect(error?.errors).toHaveProperty(
        'applicationData.contactDetails.phoneNumber',
      );
    });
  });

  describe('defaults', () => {
    it('defaults the application status to pending', () => {
      const application = createValidApplication();

      expect(application.status).toBe('pending');
    });

    it('sets submittedAt automatically', () => {
      const application = createValidApplication();

      expect(application.submittedAt).toBeInstanceOf(Date);
    });

    it('defaults review fields to null', () => {
      const application = createValidApplication();

      expect(application.reviewedBy).toBeNull();
      expect(application.reviewedAt).toBeNull();
      expect(application.decisionReason).toBeNull();
    });

    it('defaults supporting documents to an empty array', () => {
      const application = createValidApplication();

      expect(application.applicationData.supportingDocuments).toEqual([]);
    });

    it('enables createdAt and updatedAt timestamps', () => {
      const options = SellerApplicationModel.schema.options;

      expect(options.timestamps).toBe(true);
    });
  });

  describe('schema configuration', () => {
    it('references User for the applicant', () => {
      const path = SellerApplicationModel.schema.path('applicantId');

      expect(path?.options.ref).toBe('User');
    });

    it('references User for the reviewer', () => {
      const path = SellerApplicationModel.schema.path('reviewedBy');

      expect(path?.options.ref).toBe('User');
    });

    it('disables the version key', () => {
      expect(SellerApplicationModel.schema.options.versionKey).toBe(false);
    });

    it('uses the sellerapplications collection', () => {
      expect(SellerApplicationModel.collection.name).toBe('sellerapplications');
    });
  });

  describe('indexes', () => {
    it('defines a unique partial index for pending applications', () => {
      const indexes = SellerApplicationModel.schema.indexes();

      const pendingIndex = indexes.find(
        ([keys, options]) =>
          options.name === 'unique_pending_seller_application_per_applicant' &&
          keys.applicantId === 1,
      );

      expect(pendingIndex).toBeDefined();
      expect(pendingIndex?.[1].unique).toBe(true);
      expect(pendingIndex?.[1].partialFilterExpression).toEqual({
        status: 'pending',
      });
    });

    it('defines an index for applicant application history', () => {
      const indexes = SellerApplicationModel.schema.indexes();

      expect(
        indexes.some(
          ([keys, options]) =>
            options.name === 'seller_application_history' &&
            keys.applicantId === 1 &&
            keys.submittedAt === -1,
        ),
      ).toBe(true);
    });

    it('defines an index for the administrative review queue', () => {
      const indexes = SellerApplicationModel.schema.indexes();

      expect(
        indexes.some(
          ([keys, options]) =>
            options.name === 'seller_application_review_queue' &&
            keys.status === 1 &&
            keys.submittedAt === 1,
        ),
      ).toBe(true);
    });
  });
});
