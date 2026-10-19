import { z } from 'zod';

import {
  PRODUCT_SOURCING_METHODS,
  SELLER_APPLICATION_DOCUMENT_TYPES,
  SELLER_FULFILMENT_METHODS,
  SELLER_TYPES,
} from '../../../shared/sellers/types/seller-application.types.js';

/** Cameroon’s ten administrative regions. */
export const CAMEROON_REGIONS = [
  'Adamawa',
  'Centre',
  'East',
  'Far North',
  'Littoral',
  'North',
  'Northwest',
  'South',
  'Southwest',
  'West',
] as const;

/** Validates a MongoDB ObjectId represented as a hexadecimal string. */
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Enter a valid identifier.');

/** Validates a reference to an optional supporting document. */
export const sellerApplicationDocumentSchema = z
  .object({
    documentType: z.enum(SELLER_APPLICATION_DOCUMENT_TYPES),

    publicId: z
      .string()
      .trim()
      .min(1, 'Document storage identifier is required.')
      .max(255, 'Document storage identifier is too long.'),

    secureUrl: z
      .string()
      .trim()
      .url('Enter a valid document URL.')
      .max(2048, 'Document URL is too long.'),

    fileName: z
      .string()
      .trim()
      .min(1, 'Document file name is required.')
      .max(255, 'Document file name must not exceed 255 characters.'),
  })
  .strict();

/** Validates the applicant’s business identity details. */
export const sellerApplicationBusinessDetailsSchema = z
  .object({
    sellerType: z.enum(SELLER_TYPES),
    businessName: z.string().trim().max(150).nullable(),
    storeName: z.string().trim().max(100).nullable(),
    businessRegistrationNumber: z.string().trim().max(100).nullable(),
  })
  .superRefine((details, context) => {
    if (details.sellerType === 'business') {
      if (!details.businessName) {
        context.addIssue({
          code: 'custom',
          path: ['businessName'],
          message: 'Business sellers must provide a business name.',
        });
      }
    }

    if (details.sellerType === 'individual' && !details.storeName) {
      context.addIssue({
        code: 'custom',
        path: ['storeName'],
        message: 'Individual sellers must provide a store name.',
      });
    }
  });

/** Validates applicant location and contact information. */
export const sellerApplicationContactDetailsSchema = z
  .object({
    region: z.enum(CAMEROON_REGIONS),

    city: z
      .string()
      .trim()
      .min(1, 'City or town is required.')
      .max(100, 'City or town must not exceed 100 characters.'),

    address: z
      .string()
      .trim()
      .min(1, 'Operating address is required.')
      .max(300, 'Operating address must not exceed 300 characters.'),

    phoneNumber: z
      .string()
      .trim()
      .min(7, 'Enter a valid contact phone number.')
      .max(25, 'Phone number must not exceed 25 characters.')
      .regex(/^[+\d][\d\s()-]*$/, 'Enter a valid contact phone number.'),
  })
  .strict();

/** Validates the applicant’s intended products and sourcing methods. */
export const sellerApplicationProductDetailsSchema = z
  .object({
    productCategoryIds: z
      .array(objectIdSchema)
      .min(1, 'Select at least one product category.')
      .max(20, 'Select no more than 20 product categories.'),

    businessDescription: z
      .string()
      .trim()
      .min(20, 'Describe your business in at least 20 characters.')
      .max(2000, 'Business description must not exceed 2000 characters.'),

    sourcingMethods: z
      .array(z.enum(PRODUCT_SOURCING_METHODS))
      .min(1, 'Select at least one product sourcing method.')
      .max(5),

    otherSourcingMethod: z
      .string()
      .trim()
      .max(200, 'Other sourcing method must not exceed 200 characters.')
      .nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.sourcingMethods.includes('other') && !value.otherSourcingMethod) {
      context.addIssue({
        code: 'custom',
        path: ['otherSourcingMethod'],
        message: 'Describe the other sourcing method.',
      });
    }

    if (
      !value.sourcingMethods.includes('other') &&
      value.otherSourcingMethod !== null
    ) {
      context.addIssue({
        code: 'custom',
        path: ['otherSourcingMethod'],
        message: 'Only provide this field when selecting other.',
      });
    }
  });

/** Validates fulfilment methods and operating coverage. */
export const sellerApplicationFulfilmentDetailsSchema = z
  .object({
    methods: z
      .array(z.enum(SELLER_FULFILMENT_METHODS))
      .min(1, 'Select at least one fulfilment method.')
      .max(2),

    serviceRegions: z
      .array(z.enum(CAMEROON_REGIONS))
      .min(1, 'Select at least one service region.')
      .max(10, 'Select no more than 10 service regions.'),

    dispatchTime: z.enum([
      'same_day',
      'one_to_three_days',
      'four_to_seven_days',
      'over_seven_days',
    ]),
  })
  .strict();

/** Requires explicit acceptance of all seller application declarations. */
export const sellerApplicationDeclarationsSchema = z
  .object({
    informationIsAccurate: z.literal(true, {
      error: 'You must confirm that the submitted information is accurate.',
    }),

    sellerPolicyAccepted: z.literal(true, {
      error: 'You must accept the seller policies.',
    }),

    productsAreGenuineAndLegallySellable: z.literal(true, {
      error:
        'You must confirm that your products are genuine and legally sellable.',
    }),
  })
  .strict();

/** Validates the complete applicationData object. */
export const sellerApplicationDataSchema = z
  .object({
    businessDetails: sellerApplicationBusinessDetailsSchema,
    contactDetails: sellerApplicationContactDetailsSchema,
    productDetails: sellerApplicationProductDetailsSchema,
    fulfilmentDetails: sellerApplicationFulfilmentDetailsSchema,

    supportingDocuments: z
      .array(sellerApplicationDocumentSchema)
      .max(5, 'You may submit no more than five supporting documents.')
      .default([]),

    declarations: sellerApplicationDeclarationsSchema,
  })
  .strict();

/** Type of application data after Zod validation and normalization. */
export type SellerApplicationDataRequest = z.infer<
  typeof sellerApplicationDataSchema
>;

/** Validates a complete new seller application submission. */
export const createSellerApplicationSchema = z
  .object({
    applicationData: sellerApplicationDataSchema,
  })
  .strict();

export type CreateSellerApplicationRequest = z.infer<
  typeof createSellerApplicationSchema
>;
