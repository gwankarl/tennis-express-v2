import mongoose from 'mongoose';

import { AppError } from '../../../../shared/errors/app-error.js';
import { UserModel } from '../../../shared/users/models/user.model.js';
import { SellerApplicationModel } from '../../../shared/sellers/models/seller-application.model.js';

import type { SellerApplication } from '../../../shared/sellers/types/seller-application.types.js';
import type { CreateSellerApplicationRequest } from '../validations/seller-application.validation.js';

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
    private readonly categoryChecker: SellerApplicationCategoryChecker,
  ) {}

  /**
   * Creates a pending seller application for an active user.
   */
  async submitApplication(
    applicantId: string,
    input: CreateSellerApplicationRequest,
  ): Promise<SellerApplicationDocument> {
    await this.requireActiveUser(applicantId);

    const existingApplication = await SellerApplicationModel.findOne({
      applicantId,
      status: 'pending',
    })
      .select('_id')
      .lean()
      .exec();

    if (existingApplication) {
      throw this.applicationAlreadyPendingError();
    }

    const categoryIds = input.applicationData.productDetails.productCategoryIds;

    await this.categoryChecker.validateCategories(categoryIds);

    try {
      const application = await SellerApplicationModel.create({
        applicantId: new mongoose.Types.ObjectId(applicantId),
        applicationData: input.applicationData,
        status: 'pending',
        submittedAt: new Date(),
        reviewedBy: null,
        reviewedAt: null,
        decisionReason: null,
      });

      return application;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        throw this.applicationAlreadyPendingError();
      }

      throw error;
    }
  }

  /**
   * Returns the applicant's most recently submitted application.
   */
  async getMyLatestApplication(
    applicantId: string,
  ): Promise<SellerApplicationDocument | null> {
    await this.requireActiveUser(applicantId);

    return SellerApplicationModel.findOne({ applicantId })
      .sort({ submittedAt: -1 })
      .exec();
  }

  private async requireActiveUser(userId: string): Promise<void> {
    if (!mongoose.isValidObjectId(userId)) {
      throw this.userNotFoundError();
    }

    const user = await UserModel.findOne({
      _id: userId,
      deletedAt: null,
      status: 'active',
    })
      .select('_id')
      .lean()
      .exec();

    if (!user) {
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

  private applicationAlreadyPendingError(): AppError {
    return new AppError({
      statusCode: 409,
      code: 'SELLER_APPLICATION_ALREADY_PENDING',
      message: 'The applicant already has a pending seller application.',
    });
  }
}
