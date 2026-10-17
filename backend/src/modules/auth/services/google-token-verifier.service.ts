import { OAuth2Client } from 'google-auth-library';

import { env } from '../../../config/env.js';
import type {
  GoogleIdentity,
  GoogleTokenVerifier,
} from './google-auth.service.js';

/** Verifies Google ID tokens against this application's OAuth client ID. */
export class GoogleTokenVerifierService implements GoogleTokenVerifier {
  private readonly client = new OAuth2Client(env.googleClientId);

  async verify(idToken: string): Promise<GoogleIdentity | null> {
    if (!env.googleClientId) {
      throw new Error('Google authentication is not configured.');
    }

    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: env.googleClientId,
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified,
      givenName: payload.given_name,
      familyName: payload.family_name,
      name: payload.name,
    };
  }
}
