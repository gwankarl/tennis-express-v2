import { describe, expect, it } from 'vitest';
import { VerificationTokenModel } from '../../../../../src/modules/auth/models/verification-token.model.js';

describe('VerificationTokenModel', () => {
  it('defines the required verification-token fields', () => {
    const paths = VerificationTokenModel.schema.paths;

    expect(paths.userId).toBeDefined();
    expect(paths.tokenHash).toBeDefined();
    expect(paths.expiresAt).toBeDefined();
    expect(paths.consumedAt).toBeDefined();
  });

  it('requires userId, tokenHash, and expiresAt', async () => {
    const token = new VerificationTokenModel({});

    await expect(token.validate()).rejects.toThrow();

    expect(token.errors?.userId).toBeDefined();
    expect(token.errors?.tokenHash).toBeDefined();
    expect(token.errors?.expiresAt).toBeDefined();
  });

  it('defaults consumedAt to null', () => {
    const token = new VerificationTokenModel({
      userId: '507f1f77bcf86cd799439011',
      tokenHash: 'example-hash',
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(token.consumedAt).toBeNull();
  });

  it('excludes tokenHash from ordinary queries', () => {
    expect(VerificationTokenModel.schema.path('tokenHash').options.select).toBe(
      false,
    );
  });

  it('defines a TTL index on expiresAt', () => {
    const indexes = VerificationTokenModel.schema.indexes();

    expect(
      indexes.some(
        ([fields, options]) =>
          'expiresAt' in fields && options.expireAfterSeconds === 0,
      ),
    ).toBe(true);
  });
});
