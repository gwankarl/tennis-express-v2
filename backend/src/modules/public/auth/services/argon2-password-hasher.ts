import argon2 from 'argon2';

import type { PasswordHasher } from '../types/registration.types.js';

/**
 * Argon2id configuration for password hashing.
 *
 * Memory and time costs should be benchmarked against the production
 * environment before deployment.
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Implements password hashing with Argon2id.
 *
 * The encoded hash includes the algorithm configuration and salt needed
 * for later verification. The original password is never persisted here.
 */
export class Argon2PasswordHasher implements PasswordHasher {
  /**
   * Hashes a password using the configured Argon2id parameters.
   *
   * @param password - The original password, passed without modification.
   * @returns The encoded password hash.
   */
  async hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  /**
   * Verifies a password against its stored Argon2 hash.
   *
   * @param password - The password supplied during login.
   * @param encodedHash - The encoded hash retrieved from the user record.
   * @returns Whether the password matches the stored hash.
   */
  async verify(password: string, encodedHash: string): Promise<boolean> {
    try {
      return await argon2.verify(encodedHash, password);
    } catch {
      return false;
    }
  }
}
