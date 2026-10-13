import { describe, expect, it } from 'vitest';

import { RefreshTokenService } from '../../../../../src/modules/auth/services/refresh-token.service.js';

describe('RefreshTokenService', () => {
  const service = new RefreshTokenService();

  it('generates a cryptographically random token', () => {
    const result = service.generateToken();

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.token).toBeTruthy();
    expect(result.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generates a different token for each call', () => {
    const first = service.generateToken();
    const second = service.generateToken();

    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).not.toBe(second.tokenHash);
  });

  it('produces a consistent hash for the same token', () => {
    const token = service.generateToken().token;

    expect(service.hashToken(token)).toBe(service.hashToken(token));
  });

  it('produces different hashes for different tokens', () => {
    expect(service.hashToken('token-one')).not.toBe(
      service.hashToken('token-two'),
    );
  });

  it('does not store the raw token in the generated hash', () => {
    const result = service.generateToken();

    expect(result.tokenHash).not.toBe(result.token);
  });
});
