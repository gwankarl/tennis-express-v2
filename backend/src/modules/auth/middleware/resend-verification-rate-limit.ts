import { rateLimit } from 'express-rate-limit';

/**
 * Creates a rate limiter for email-verification resend requests.
 *
 * Limits each client IP to five requests per 15-minute window.
 */
export function createResendVerificationRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many verification requests. Please try again later.',
      },
    },
  });
}
