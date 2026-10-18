import { describe, expect, it } from 'vitest';

import {
  createSellerApplicationSchema,
  sellerApplicationDataSchema,
} from '../../../../../src/modules/sellers/validations/seller-application.validation.js';

const validApplicationData = {
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
    productCategoryIds: ['507f1f77bcf86cd799439011'],
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

describe('sellerApplicationDataSchema', () => {
  it('accepts valid seller application data', () => {
    const result = sellerApplicationDataSchema.safeParse(validApplicationData);

    expect(result.success).toBe(true);
  });

  it('defaults supportingDocuments to an empty array when omitted', () => {
    const { supportingDocuments: _documents, ...data } = validApplicationData;

    const result = sellerApplicationDataSchema.safeParse(data);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.supportingDocuments).toEqual([]);
    }
  });

  it('rejects an invalid contact phone number', () => {
    const result = sellerApplicationDataSchema.safeParse({
      ...validApplicationData,
      contactDetails: {
        ...validApplicationData.contactDetails,
        phoneNumber: 'phone-number',
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects a missing contact phone number', () => {
    const { phoneNumber: _phoneNumber, ...contactDetails } =
      validApplicationData.contactDetails;

    const result = sellerApplicationDataSchema.safeParse({
      ...validApplicationData,
      contactDetails,
    });

    expect(result.success).toBe(false);
  });

  it('rejects an invalid product category identifier', () => {
    const result = sellerApplicationDataSchema.safeParse({
      ...validApplicationData,
      productDetails: {
        ...validApplicationData.productDetails,
        productCategoryIds: ['not-an-object-id'],
      },
    });

    expect(result.success).toBe(false);
  });

  it('requires at least one product category', () => {
    const result = sellerApplicationDataSchema.safeParse({
      ...validApplicationData,
      productDetails: {
        ...validApplicationData.productDetails,
        productCategoryIds: [],
      },
    });

    expect(result.success).toBe(false);
  });

  it('requires a business name for business applicants', () => {
    const result = sellerApplicationDataSchema.safeParse({
      ...validApplicationData,
      businessDetails: {
        sellerType: 'business',
        businessName: null,
        businessRegistrationNumber: null,
        storeName: null,
      },
    });

    expect(result.success).toBe(false);
  });

  it('allows an individual applicant without business registration details', () => {
    const result = sellerApplicationDataSchema.safeParse({
      ...validApplicationData,
      businessDetails: {
        sellerType: 'individual',
        businessName: null,
        businessRegistrationNumber: null,
        storeName: 'Karlson Tennis Gear',
      },
    });

    expect(result.success).toBe(true);
  });

  it('allows a business applicant without a registration number', () => {
    const result = sellerApplicationDataSchema.safeParse({
      ...validApplicationData,
      businessDetails: {
        sellerType: 'business',
        businessName: 'Example Tennis Supplies',
        businessRegistrationNumber: null,
        storeName: null,
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects an unaccepted seller policy declaration', () => {
    const result = sellerApplicationDataSchema.safeParse({
      ...validApplicationData,
      declarations: {
        ...validApplicationData.declarations,
        sellerPolicyAccepted: false,
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects an invalid Cameroon region', () => {
    const result = sellerApplicationDataSchema.safeParse({
      ...validApplicationData,
      contactDetails: {
        ...validApplicationData.contactDetails,
        region: 'Unknown Region',
      },
    });

    expect(result.success).toBe(false);
  });

  it('requires at least one fulfilment method', () => {
    const result = sellerApplicationDataSchema.safeParse({
      ...validApplicationData,
      fulfilmentDetails: {
        ...validApplicationData.fulfilmentDetails,
        methods: [],
      },
    });

    expect(result.success).toBe(false);
  });

  it('requires a description when other sourcing is selected', () => {
    const result = sellerApplicationDataSchema.safeParse({
      ...validApplicationData,
      productDetails: {
        ...validApplicationData.productDetails,
        sourcingMethods: ['other'],
        otherSourcingMethod: null,
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown properties', () => {
    const result = sellerApplicationDataSchema.safeParse({
      ...validApplicationData,
      unexpectedField: 'not allowed',
    });

    expect(result.success).toBe(false);
  });
});

describe('createSellerApplicationSchema', () => {
  it('accepts a valid application submission payload', () => {
    const result = createSellerApplicationSchema.safeParse({
      applicationData: validApplicationData,
    });

    expect(result.success).toBe(true);
  });

  it('rejects a payload without applicationData', () => {
    const result = createSellerApplicationSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it('rejects unknown top-level properties', () => {
    const result = createSellerApplicationSchema.safeParse({
      applicationData: validApplicationData,
      status: 'approved',
    });

    expect(result.success).toBe(false);
  });
});
