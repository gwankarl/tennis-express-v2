import mongoose from 'mongoose';

import { AppError } from '../../../../shared/errors/app-error.js';
import { UserModel } from '../../../shared/users/models/user.model.js';
import { StoreProvisioningService } from './store-provisioning.service.js';
import { SellerApplicationModel } from '../../../shared/sellers/models/seller-application.model.js';

import type { UserRole } from '../../../shared/users/types/user.types.js';
import type { SellerApplication } from '../../../shared/sellers/types/seller-application.types.js';

type SellerApplicationDocument = mongoose.HydratedDocument<SellerApplication>;

export interface SellerApplicationCategoryChecker {
  validateCategories(categoryIds: string[]): Promise<void>;
}

export interface ReviewSellerApplicationInput {
  applicationId: string;
  reviewerId: string;
}

export interface RejectSellerApplicationInput extends ReviewSellerApplicationInput {
  reason: string;
}

export class SellerApplicationService {
  constructor(
    private readonly storeProvisioningService: StoreProvisioningService = new StoreProvisioningService(),
  ) {}

  /**
   * Returns an application belonging to the specified applicant.
   */
  async getMyApplicationById(
    applicantId: string,
    applicationId: string,
  ): Promise<SellerApplicationDocument> {
    if (
      !mongoose.isValidObjectId(applicantId) ||
      !mongoose.isValidObjectId(applicationId)
    ) {
      throw this.applicationNotFoundError();
    }

    const application = await SellerApplicationModel.findOne({
      _id: applicationId,
      applicantId,
    }).exec();

    if (!application) {
      throw this.applicationNotFoundError();
    }

    return application;
  }

  /**
   * Approves a pending application, promotes the applicant's role,
   * and provisions the initial storefront atomically.
   */
  async approveApplication(
    input: ReviewSellerApplicationInput,
  ): Promise<SellerApplicationDocument> {
    this.validateReviewerId(input.reviewerId);

    if (!mongoose.isValidObjectId(input.applicationId)) {
      throw this.applicationNotFoundError();
    }

    const session = await mongoose.startSession();
    let approvedApplication: SellerApplicationDocument | null = null;

    try {
      await session.withTransaction(async () => {
        const application = await SellerApplicationModel.findOne({
          _id: input.applicationId,
          status: 'pending',
        })
          .session(session)
          .exec();

        if (!application) {
          const existingApplication = await SellerApplicationModel.findById(
            input.applicationId,
          )
            .select('_id status')
            .session(session)
            .lean()
            .exec();

          if (!existingApplication) {
            throw this.applicationNotFoundError();
          }

          throw this.applicationAlreadyReviewedError();
        }

        const applicant = await UserModel.findOne({
          _id: application.applicantId,
          deletedAt: null,
          status: 'active',
        })
          .session(session)
          .exec();

        if (!applicant) {
          throw this.userNotFoundError();
        }

        const roles = new Set<UserRole>(applicant.roles);

        if (roles.has('buyer')) {
          roles.delete('buyer');
          roles.add('both');
        } else if (
          !roles.has('seller') &&
          !roles.has('both') &&
          !roles.has('admin')
        ) {
          roles.add('seller');
        }

        applicant.roles = [...roles];
        await applicant.save({ session });

        const businessDetails = application.applicationData.businessDetails;
        const contactDetails = application.applicationData.contactDetails;
        const productDetails = application.applicationData.productDetails;

        const storeName =
          businessDetails.sellerType === 'individual'
            ? businessDetails.storeName
            : businessDetails.businessName;

        if (!storeName) {
          throw new AppError({
            statusCode: 400,
            code: 'INVALID_SELLER_APPLICATION_STORE_NAME',
            message: 'The application does not contain a valid store name.',
          });
        }

        await this.storeProvisioningService.provisionStore({
          sellerId: applicant._id.toString(),
          name: storeName,
          description: productDetails.businessDescription,
          location: {
            region: contactDetails.region,
            city: contactDetails.city,
            address: contactDetails.address,
          },
          session,
        });

        application.status = 'approved';
        application.reviewedBy = new mongoose.Types.ObjectId(input.reviewerId);
        application.reviewedAt = new Date();
        application.decisionReason = null;

        await application.save({ session });

        approvedApplication = application;
      });
    } finally {
      await session.endSession();
    }

    if (!approvedApplication) {
      throw new Error('Seller application approval did not complete.');
    }

    return approvedApplication;
  }

  /**
   * Rejects a pending application and records the reviewer's reason.
   */
  async rejectApplication(
    input: RejectSellerApplicationInput,
  ): Promise<SellerApplicationDocument> {
    this.validateReviewerId(input.reviewerId);

    if (!mongoose.isValidObjectId(input.applicationId)) {
      throw this.applicationNotFoundError();
    }

    const reason = input.reason.trim();

    if (reason.length < 20) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_SELLER_APPLICATION_REJECTION_REASON',
        message: 'The rejection reason must contain at least 20 characters.',
      });
    }

    const application = await SellerApplicationModel.findOneAndUpdate(
      {
        _id: input.applicationId,
        status: 'pending',
      },
      {
        $set: {
          status: 'rejected',
          reviewedBy: new mongoose.Types.ObjectId(input.reviewerId),
          reviewedAt: new Date(),
          decisionReason: reason,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).exec();

    if (!application) {
      const existingApplication = await SellerApplicationModel.findById(
        input.applicationId,
      )
        .select('_id status')
        .lean()
        .exec();

      if (!existingApplication) {
        throw this.applicationNotFoundError();
      }

      throw this.applicationAlreadyReviewedError();
    }

    return application;
  }

  private validateReviewerId(reviewerId: string): void {
    if (!mongoose.isValidObjectId(reviewerId)) {
      throw this.userNotFoundError();
    }
  }

  private userNotFoundError(): AppError {
    return new AppError({
      statusCode: 404,
      code: 'USER_NOT_FOUND',
      message: 'The requested user could not be found.',
    });
  }

  private applicationNotFoundError(): AppError {
    return new AppError({
      statusCode: 404,
      code: 'SELLER_APPLICATION_NOT_FOUND',
      message: 'The seller application could not be found.',
    });
  }

  private applicationAlreadyReviewedError(): AppError {
    return new AppError({
      statusCode: 409,
      code: 'SELLER_APPLICATION_ALREADY_REVIEWED',
      message: 'The seller application has already been reviewed.',
    });
  }
}
