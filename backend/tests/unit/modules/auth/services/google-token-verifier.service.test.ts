import { OAuth2Client } from 'google-auth-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleTokenVerifierService } from '../../../../../src/modules/auth/services/google-token-verifier.service.js';

const { mockVerifyIdToken, mockGetPayload, mockEnv } = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockGetPayload: vi.fn(),
  mockEnv: {
    googleClientId: 'test-google-client-id',
  },
}));

vi.mock('../../../../../src/config/env.js', () => ({
  env: mockEnv,
}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn(
    class {
      verifyIdToken = mockVerifyIdToken;
    },
  ),
}));

describe('GoogleTokenVerifierService', () => {
  let verifier: GoogleTokenVerifierService;

  beforeEach(() => {
    mockEnv.googleClientId = 'test-google-client-id';
    mockVerifyIdToken.mockReset();
    mockGetPayload.mockReset();

    verifier = new GoogleTokenVerifierService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('verifies an ID token using the configured Google client ID', async () => {
    mockGetPayload.mockReturnValue({
      sub: 'google-user-123',
      email: 'player@example.com',
      email_verified: true,
      given_name: 'Alex',
      family_name: 'Player',
      name: 'Alex Player',
    });

    mockVerifyIdToken.mockResolvedValue({
      getPayload: mockGetPayload,
    });

    await expect(verifier.verify('valid-google-id-token')).resolves.toEqual({
      sub: 'google-user-123',
      email: 'player@example.com',
      emailVerified: true,
      givenName: 'Alex',
      familyName: 'Player',
      name: 'Alex Player',
    });

    expect(OAuth2Client).toHaveBeenCalledWith('test-google-client-id');
    expect(mockVerifyIdToken).toHaveBeenCalledWith({
      idToken: 'valid-google-id-token',
      audience: 'test-google-client-id',
    });
  });

  it('returns null when Google provides no token payload', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: mockGetPayload,
    });
    mockGetPayload.mockReturnValue(undefined);

    await expect(verifier.verify('id-token-without-payload')).resolves.toBe(
      null,
    );
  });

  it.each([
    {
      description: 'the subject is missing',
      payload: {
        email: 'player@example.com',
        email_verified: true,
      },
    },
    {
      description: 'the email is missing',
      payload: {
        sub: 'google-user-123',
        email_verified: true,
      },
    },
    {
      description: 'the email is not verified',
      payload: {
        sub: 'google-user-123',
        email: 'player@example.com',
        email_verified: false,
      },
    },
  ])('returns null when $description', async ({ payload }) => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: mockGetPayload,
    });
    mockGetPayload.mockReturnValue(payload);

    await expect(verifier.verify('invalid-google-id-token')).resolves.toBe(
      null,
    );
  });

  it('throws when Google authentication is not configured', async () => {
    mockEnv.googleClientId = '';

    await expect(verifier.verify('any-google-id-token')).rejects.toThrow(
      'Google authentication is not configured.',
    );

    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it('propagates errors when Google rejects the ID token', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Token verification failed'));

    await expect(verifier.verify('expired-google-id-token')).rejects.toThrow(
      'Token verification failed',
    );
  });
});
