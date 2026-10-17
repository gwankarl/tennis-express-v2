import type { UserStatus } from '../../users/types/user.types.js';

/**
 * Input required by the registration service.
 *
 * This represents application-level input; HTTP request validation
 * is handled separately by the registration Zod schema.
 */
export interface RegistrationInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

/**
 * Publicly safe user information returned after successful registration.
 *
 * Sensitive account data, including password hashes and verification
 * tokens, must not be included in this result.
 */
export interface RegistrationResult {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: UserStatus;
  };
}

/**
 * Contract for delivering account verification emails.
 */
export interface VerificationEmailSender {
  /**
   * Sends a verification message to the specified recipient.
   *
   * @param input - Recipient details and the raw verification token.
   * @returns A promise that resolves when the delivery operation completes.
   */
  sendVerificationEmail(input: {
    to: string;
    recipientName: string;
    token: string;
  }): Promise<void>;
}

/**
 * Contract for hashing passwords and verifying submitted credentials.
 *
 * Implementations must never expose the original password or stored hash
 * through application responses.
 */
export interface PasswordHasher {
  /**
   * Hashes a password using the configured password-hashing algorithm.
   *
   * @param password - The original password, without trimming or alteration.
   * @returns A promise resolving to the encoded password hash.
   */
  hash(password: string): Promise<string>;

  /**
   * Checks whether a submitted password matches an encoded password hash.
   *
   * @param password - The password supplied during login.
   * @param encodedHash - The previously stored password hash.
   * @returns True when the password matches; otherwise false.
   */
  verify(password: string, encodedHash: string): Promise<boolean>;
}

/**
 * Contract for checking whether a password is known to be compromised.
 */
export interface PasswordCompromiseChecker {
  /**
   * Checks a password against a compromised-password source.
   *
   * @param password - The exact password supplied by the user.
   * @returns A promise resolving to true if compromised, otherwise false.
   *
   * Implementations may reject if the security check cannot be completed.
   */
  isPasswordCompromised(password: string): Promise<boolean>;
}

/**
 * Contract for delivering password-reset emails.
 */
export interface PasswordResetEmailSender {
  sendPasswordResetEmail(input: {
    to: string;
    recipientName: string;
    token: string;
  }): Promise<void>;
}
