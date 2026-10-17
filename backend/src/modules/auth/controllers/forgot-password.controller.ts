import type { RequestHandler } from 'express';

import type { ForgotPasswordService } from '../services/forgot-password.service.js';

/* Returns a generic response to avoid revealing account existence. */
export function createForgotPasswordController(
  service: ForgotPasswordService,
): RequestHandler {
  return async (req, res, next) => {
    try {
      await service.requestPasswordReset(req.body.email);

      res.status(200).json({
        success: true,
        data: {
          message:
            'If an eligible account exists for that email address, password-reset instructions will be sent.',
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
