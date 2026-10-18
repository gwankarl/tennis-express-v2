import type { RequestHandler } from 'express';

import type { SellerApplicationService } from '../../sellers/services/seller-application.service.js';

/** Dependencies required by the seller application review controller. */
export interface SellerApplicationReviewControllerDependencies {
  sellerApplicationService: SellerApplicationService;
}

/** Extracts a single application ID from the validated route parameters. */
function getApplicationId(params: Record<string, string | string[]>): string {
  const applicationId = params.applicationId;

  if (typeof applicationId !== 'string') {
    throw new Error('A valid seller application ID is required.');
  }

  return applicationId;
}

/** Creates administrator handlers for reviewing seller applications. */
export function createSellerApplicationReviewController(
  dependencies: SellerApplicationReviewControllerDependencies,
) {
  const { sellerApplicationService } = dependencies;

  const approveApplication: RequestHandler = async (req, res, next) => {
    try {
      const application = await sellerApplicationService.approveApplication({
        applicationId: getApplicationId(req.params),
        reviewerId: req.auth!.userId,
      });

      res.status(200).json({
        success: true,
        data: { application },
      });
    } catch (error) {
      next(error);
    }
  };

  const rejectApplication: RequestHandler = async (req, res, next) => {
    try {
      const application = await sellerApplicationService.rejectApplication({
        applicationId: getApplicationId(req.params),
        reviewerId: req.auth!.userId,
        reason: req.body.reason,
      });

      res.status(200).json({
        success: true,
        data: { application },
      });
    } catch (error) {
      next(error);
    }
  };

  return {
    approveApplication,
    rejectApplication,
  };
}
