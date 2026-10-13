import { createHash } from 'node:crypto';

import { AppError } from '../../../shared/errors/app-error.js';
import type { PasswordCompromiseChecker } from '../types/registration.types.js';

const PWNED_PASSWORDS_API = 'https://api.pwnedpasswords.com/range/';
const USER_AGENT = 'Tennis-Xpress-Password-Compromise-Checker';
const REQUEST_TIMEOUT_MS = 5_000;

type FetchFunction = typeof fetch;

/**
 * Checks passwords against the Pwned Passwords range API.
 *
 * Only the first five characters of the SHA-1 password hash are sent
 * to the API. The raw password and complete hash remain local.
 */
export class PwnedPasswordCompromiseChecker implements PasswordCompromiseChecker {
  constructor(private readonly fetcher: FetchFunction = fetch) {}

  /**
   * Determines whether a password appears in the compromised-password dataset.
   *
   * @param password - The exact password supplied by the user.
   * @returns True when the password has a positive compromise count.
   * @throws AppError when the API request or response cannot be processed.
   */
  async isPasswordCompromised(password: string): Promise<boolean> {
    /*
     * The range API uses k-anonymity: send only the hash prefix,
     * then compare the returned suffixes locally.
     */
    const hash = createHash('sha1')
      .update(password, 'utf8')
      .digest('hex')
      .toUpperCase();

    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    let response: Response;

    try {
      response = await this.fetcher(`${PWNED_PASSWORDS_API}${prefix}`, {
        method: 'GET',
        headers: {
          'Add-Padding': 'true',
          'User-Agent': USER_AGENT,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new AppError({
        statusCode: 503,
        code: 'PASSWORD_COMPROMISE_CHECK_UNAVAILABLE',
        message: 'Password security checks are temporarily unavailable.',
      });
    }

    /* Fail closed if the external security service returns an error. */
    if (!response.ok) {
      throw new AppError({
        statusCode: 503,
        code: 'PASSWORD_COMPROMISE_CHECK_UNAVAILABLE',
        message: 'Password security checks are temporarily unavailable.',
      });
    }

    let responseBody: string;

    try {
      responseBody = await response.text();
    } catch {
      throw new AppError({
        statusCode: 503,
        code: 'PASSWORD_COMPROMISE_CHECK_UNAVAILABLE',
        message: 'Password security checks are temporarily unavailable.',
      });
    }

    /* Match the full hash suffix locally and require a positive count. */
    return responseBody.split(/\r?\n/).some((line) => {
      const [returnedSuffix, count] = line.trim().split(':');

      return returnedSuffix?.toUpperCase() === suffix && Number(count) > 0;
    });
  }
}
