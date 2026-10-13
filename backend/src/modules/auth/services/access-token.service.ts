import jwt, { type JwtPayload } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

import { env } from '../../../config/env.js';
import { USER_ROLES } from '../../users/types/user.types.js';
import type { UserRole } from '../../users/types/user.types.js';

/** Data required to issue an access token. */
export interface CreateAccessTokenInput {
  userId: string;
  sessionId: string;
  roles: UserRole[];
}

/** Verified claims extracted from an access token. */
export interface AccessTokenClaims {
  userId: string;
  sessionId: string;
  roles: UserRole[];
}

/** Signs and verifies short-lived access tokens. */
export class AccessTokenService {
  /**
   * Creates a signed access token for an authenticated session.
   *
   * @param input - The user, session, and authorization roles.
   * @returns A signed JWT.
   */
  createToken(input: CreateAccessTokenInput): string {
    return jwt.sign(
      {
        sid: input.sessionId,
        roles: input.roles,
        tokenType: 'access',
        jti: randomUUID(),
      },
      env.jwtAccessSecret,
      {
        algorithm: 'HS256',
        subject: input.userId,
        expiresIn: env.accessTokenTtlSeconds,
      },
    );
  }

  /**
   * Verifies a token's signature, expiration, and expected claims.
   *
   * @param token - The JWT supplied by the client.
   * @returns Verified claims, or null when the token is invalid.
   */
  verifyToken(token: string): AccessTokenClaims | null {
    try {
      const decoded = jwt.verify(token, env.jwtAccessSecret, {
        algorithms: ['HS256'],
      });

      if (typeof decoded === 'string') {
        return null;
      }

      const payload = decoded as JwtPayload;
      const roles = payload.roles;

      if (
        typeof payload.sub !== 'string' ||
        typeof payload.sid !== 'string' ||
        payload.tokenType !== 'access' ||
        !Array.isArray(roles) ||
        roles.length === 0 ||
        !roles.every(
          (role): role is UserRole =>
            typeof role === 'string' &&
            (USER_ROLES as readonly string[]).includes(role),
        )
      ) {
        return null;
      }

      return {
        userId: payload.sub,
        sessionId: payload.sid,
        roles,
      };
    } catch {
      return null;
    }
  }

  /** Returns the configured access-token lifetime in seconds. */
  getExpiresInSeconds(): number {
    return env.accessTokenTtlSeconds;
  }
}
