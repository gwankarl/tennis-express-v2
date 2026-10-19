import type { RequestHandler } from 'express';

import type { EmailVerificationService } from '../services/email-verification.service.js';

/**
 * Creates the HTTP handler for email verification.
 *
 * The service validates and consumes the verification token. The controller
 * exposes a consistent success response without returning account details.
 *
 * @param emailVerificationService - Service responsible for verifying email.
 * @returns An Express handler that processes verification requests.
 */
export function createEmailVerificationController(
  emailVerificationService: EmailVerificationService,
): RequestHandler {
  return async (req, res, next) => {
    try {
      await emailVerificationService.verifyEmail(req.body.token);

      res.status(200).json({
        success: true,
        data: {
          message: 'Your email address has been verified successfully.',
        },
      });
    } catch (error) {
      /* Delegate errors to the centralized error handler. */
      next(error);
    }
  };
}
