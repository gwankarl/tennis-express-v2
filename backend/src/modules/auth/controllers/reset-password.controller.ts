import type { RequestHandler } from 'express';

import type { ResetPasswordService } from '../services/reset-password.service.js';

export function createResetPasswordController(
  service: ResetPasswordService,
): RequestHandler {
  return async (req, res, next) => {
    try {
      await service.resetPassword(req.body.token, req.body.password);

      res.status(200).json({
        success: true,
        data: {
          message: 'Your password has been reset successfully.',
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
