import mongoose, { Schema, Types } from 'mongoose';

import {
  PRODUCT_SOURCING_METHODS,
  SELLER_APPLICATION_DOCUMENT_TYPES,
  SELLER_APPLICATION_STATUSES,
  SELLER_FULFILMENT_METHODS,
  SELLER_TYPES,
} from '../types/seller-application.types.js';

import type {
  SellerApplication,
  SellerApplicationData,
} from '../types/seller-application.types.js';

/* -------------------------------------------------------------------------- */
/* Supporting document schema                                                 */
/* -------------------------------------------------------------------------- */

const sellerApplicationDocumentSchema = new Schema<
  SellerApplicationData['supportingDocuments'][number]
>(
  {
    documentType: {
      type: String,
      enum: SELLER_APPLICATION_DOCUMENT_TYPES,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
      trim: true,
    },
    secureUrl: {
      type: String,
      required: true,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

/* -------------------------------------------------------------------------- */
/* Application data schema                                                    */
/* -------------------------------------------------------------------------- */

const sellerApplicationDataSchema = new Schema<SellerApplicationData>(
  {
    businessDetails: {
      sellerType: {
        type: String,
        enum: SELLER_TYPES,
        required: true,
      },
      businessName: {
        type: String,
        default: null,
        trim: true,
      },
      storeName: {
        type: String,
        default: null,
        trim: true,
      },
      businessRegistrationNumber: {
        type: String,
        default: null,
        trim: true,
      },
    },

    contactDetails: {
      region: {
        type: String,
        required: true,
        trim: true,
      },
      city: {
        type: String,
        required: true,
        trim: true,
      },
      address: {
        type: String,
        required: true,
        trim: true,
      },
      phoneNumber: {
        type: String,
        required: true,
        trim: true,
      },
    },

    productDetails: {
      productCategoryIds: {
        type: [Schema.Types.ObjectId],
        required: true,
        validate: {
          validator: (value: Types.ObjectId[]) => value.length > 0,
          message: 'At least one product category is required.',
        },
      },
      businessDescription: {
        type: String,
        required: true,
        trim: true,
      },
      sourcingMethods: {
        type: [
          {
            type: String,
            enum: PRODUCT_SOURCING_METHODS,
          },
        ],
        required: true,
        validate: {
          validator: (value: string[]) => value.length > 0,
          message: 'At least one sourcing method is required.',
        },
      },
      otherSourcingMethod: {
        type: String,
        default: null,
        trim: true,
      },
    },

    fulfilmentDetails: {
      methods: {
        type: [
          {
            type: String,
            enum: SELLER_FULFILMENT_METHODS,
          },
        ],
        required: true,
        validate: {
          validator: (value: string[]) => value.length > 0,
          message: 'At least one fulfilment method is required.',
        },
      },
      serviceRegions: {
        type: [String],
        required: true,
        validate: {
          validator: (value: string[]) => value.length > 0,
          message: 'At least one service region is required.',
        },
      },
      dispatchTime: {
        type: String,
        enum: [
          'same_day',
          'one_to_three_days',
          'four_to_seven_days',
          'over_seven_days',
        ],
        required: true,
      },
    },

    supportingDocuments: {
      type: [sellerApplicationDocumentSchema],
      default: [],
    },

    declarations: {
      informationIsAccurate: {
        type: Boolean,
        required: true,
        validate: {
          validator: (value: boolean) => value === true,
          message: 'Accuracy declaration must be accepted.',
        },
      },
      sellerPolicyAccepted: {
        type: Boolean,
        required: true,
        validate: {
          validator: (value: boolean) => value === true,
          message: 'Seller policy must be accepted.',
        },
      },
      productsAreGenuineAndLegallySellable: {
        type: Boolean,
        required: true,
        validate: {
          validator: (value: boolean) => value === true,
          message: 'Product declaration must be accepted.',
        },
      },
    },
  },
  { _id: false },
);

/* -------------------------------------------------------------------------- */
/* Seller application schema                                                  */
/* -------------------------------------------------------------------------- */

const sellerApplicationSchema = new Schema<SellerApplication>(
  {
    applicantId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: false,
    },

    status: {
      type: String,
      enum: SELLER_APPLICATION_STATUSES,
      default: 'pending',
      required: true,
    },

    applicationData: {
      type: sellerApplicationDataSchema,
      required: true,
    },

    submittedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    decisionReason: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'sellerapplications',
  },
);

/* -------------------------------------------------------------------------- */
/* Indexes                                                                    */
/* -------------------------------------------------------------------------- */

/*
 * An applicant can have only one pending application at a time.
 * Approved and rejected applications remain available as history.
 */
sellerApplicationSchema.index(
  { applicantId: 1 },
  {
    unique: true,
    name: 'unique_pending_seller_application_per_applicant',
    partialFilterExpression: { status: 'pending' },
  },
);

/* Supports retrieving an applicant's application history. */
sellerApplicationSchema.index(
  { applicantId: 1, submittedAt: -1 },
  { name: 'seller_application_history' },
);

/* Supports administrative queues filtered by status and submission date. */
sellerApplicationSchema.index(
  { status: 1, submittedAt: 1 },
  { name: 'seller_application_review_queue' },
);

/* -------------------------------------------------------------------------- */
/* Model registration                                                         */
/* -------------------------------------------------------------------------- */

export const SellerApplicationModel =
  mongoose.models.SellerApplication ??
  mongoose.model<SellerApplication>(
    'SellerApplication',
    sellerApplicationSchema,
  );
