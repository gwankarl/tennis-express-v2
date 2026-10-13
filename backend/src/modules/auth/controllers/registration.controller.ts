import type { RequestHandler } from 'express';

import { AppError } from '../../../shared/errors/app-error.js';
import type { RegistrationService } from '../services/registration.service.js';

/**
 * Creates the HTTP handler for user registration.
 *
 * Uses a generic success response for duplicate email addresses to avoid
 * revealing whether an email address is already registered.
 *
 * @param registrationService - Service responsible for the registration workflow.
 * @returns An Express handler that processes registration requests.
 */
export function createRegistrationController(
  registrationService: RegistrationService,
): RequestHandler {
  return async (req, res, next) => {
    try {
      await registrationService.register(req.body);

      res.status(201).json({
        success: true,
        data: {
          message:
            'If registration can be completed, verification instructions will be sent to the supplied email address.',
        },
      });
    } catch (error) {
      /*
       * Return the same response for duplicate email addresses so callers
       * cannot use registration to discover existing accounts.
       */
      if (
        error instanceof AppError &&
        error.code === 'EMAIL_ALREADY_REGISTERED'
      ) {
        res.status(201).json({
          success: true,
          data: {
            message:
              'If registration can be completed, verification instructions will be sent to the supplied email address.',
          },
        });
        return;
      }

      /* Delegate unexpected failures to the centralized error handler. */
      next(error);
    }
  };
}
