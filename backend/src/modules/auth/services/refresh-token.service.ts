import { createHash, randomBytes } from 'node:crypto';

/** A refresh token and its persistable hash. */
export interface GeneratedRefreshToken {
  token: string;
  tokenHash: string;
}

/** Generates opaque refresh tokens and hashes them for persistence. */
export class RefreshTokenService {
  /**
   * Generates a cryptographically random refresh token.
   *
   * @returns The raw token and its SHA-256 hash.
   */
  generateToken(): GeneratedRefreshToken {
    const token = randomBytes(32).toString('base64url');

    return {
      token,
      tokenHash: this.hashToken(token),
    };
  }

  /**
   * Creates the SHA-256 hash used to look up a refresh token.
   *
   * @param token - The raw refresh token.
   * @returns A hexadecimal SHA-256 hash.
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}
