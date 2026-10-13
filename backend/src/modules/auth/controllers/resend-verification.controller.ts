import type { RequestHandler } from 'express';

import type { ResendVerificationService } from '../services/resend-verification.service.js';

/**
 * Creates the controller for requesting another email-verification link.
 *
 * The service handles account eligibility and avoids exposing whether an
 * email address belongs to an account that still requires verification.
 */
export function createResendVerificationController(
  service: ResendVerificationService,
): RequestHandler {
  return async (req, res, next) => {
    try {
      await service.resendVerification(req.body.email);

      res.status(200).json({
        success: true,
        data: {
          message:
            'If an account with that email address requires verification, a verification email will be sent.',
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
