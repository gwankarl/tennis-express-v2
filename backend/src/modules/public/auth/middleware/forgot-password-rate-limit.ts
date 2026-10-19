import { rateLimit } from 'express-rate-limit';

/* Limits password-recovery requests to reduce abuse and email flooding. */
export function createForgotPasswordRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many password-recovery requests. Please try again later.',
      },
    },
  });
}
