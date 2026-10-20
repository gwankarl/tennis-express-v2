import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';

import { env } from '../../../../config/env.js';

const VISITOR_COOKIE_NAME = 'txp_visitor';
const VISITOR_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000;

/** Provides stable, pseudonymous identities for product-view deduplication. */
export class ProductViewIdentityService {
  private sign(value: string): string {
    return createHmac('sha256', env.jwtAccessSecret)
      .update(value)
      .digest('hex');
  }

  private createAnonymousToken(): string {
    return randomBytes(32).toString('hex');
  }

  private isValidAnonymousToken(value: unknown): value is string {
    if (typeof value !== 'string') {
      return false;
    }

    const separatorIndex = value.lastIndexOf('.');

    if (separatorIndex <= 0) {
      return false;
    }

    const token = value.slice(0, separatorIndex);
    const suppliedSignature = value.slice(separatorIndex + 1);

    if (
      !/^[a-f0-9]{64}$/.test(token) ||
      !/^[a-f0-9]{64}$/.test(suppliedSignature)
    ) {
      return false;
    }

    const expectedSignature = this.sign(token);
    const suppliedBuffer = Buffer.from(suppliedSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    return (
      suppliedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(suppliedBuffer, expectedBuffer)
    );
  }

  /**
   * Returns a stable pseudonymous identity for a verified account or visitor.
   * Anonymous visitor tokens are signed by the server and stored in an
   * HTTP-only cookie; the raw token is never stored in the activity collection.
   */
  getVisitorIdentity(
    req: Request,
    res: Response,
    authenticatedUserId?: string,
  ): { visitorHash: string; identityType: 'anonymous' | 'authenticated' } {
    if (authenticatedUserId) {
      return {
        visitorHash: this.sign(`user:${authenticatedUserId}`),
        identityType: 'authenticated',
      };
    }

    const existingCookie: unknown = req.cookies?.[VISITOR_COOKIE_NAME];
    let token: string;

    if (this.isValidAnonymousToken(existingCookie)) {
      token = existingCookie.slice(0, existingCookie.lastIndexOf('.'));
    } else {
      token = this.createAnonymousToken();

      res.cookie(VISITOR_COOKIE_NAME, `${token}.${this.sign(token)}`, {
        httpOnly: true,
        secure: env.cookieSecure,
        sameSite: 'lax',
        path: '/api/v1/products',
        maxAge: VISITOR_COOKIE_MAX_AGE,
      });
    }

    return {
      visitorHash: this.sign(`visitor:${token}`),
      identityType: 'anonymous',
    };
  }
}

export const productViewIdentityService = new ProductViewIdentityService();
