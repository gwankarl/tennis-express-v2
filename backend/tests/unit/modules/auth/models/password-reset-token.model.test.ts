import { describe, expect, it } from 'vitest';

import { PasswordResetTokenModel } from '../../../../../src/modules/auth/models/password-reset-token.model.js';

describe('PasswordResetTokenModel', () => {
  it('defines the required password-reset token fields', () => {
    const paths = PasswordResetTokenModel.schema.paths;

    expect(paths.userId).toBeDefined();
    expect(paths.tokenHash).toBeDefined();
    expect(paths.expiresAt).toBeDefined();
    expect(paths.consumedAt).toBeDefined();
  });

  it('requires userId, tokenHash, and expiresAt', async () => {
    const token = new PasswordResetTokenModel({});

    await expect(token.validate()).rejects.toThrow();

    expect(token.errors?.userId).toBeDefined();
    expect(token.errors?.tokenHash).toBeDefined();
    expect(token.errors?.expiresAt).toBeDefined();
  });

  it('defaults consumedAt to null', () => {
    const token = new PasswordResetTokenModel({
      userId: '507f1f77bcf86cd799439011',
      tokenHash: 'example-hash',
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(token.consumedAt).toBeNull();
  });

  it('excludes tokenHash from ordinary queries', () => {
    expect(
      PasswordResetTokenModel.schema.path('tokenHash').options.select,
    ).toBe(false);
  });

  it('defines a unique index on tokenHash', () => {
    const indexes = PasswordResetTokenModel.schema.indexes();

    expect(
      indexes.some(
        ([fields, options]) => 'tokenHash' in fields && options.unique === true,
      ),
    ).toBe(true);
  });

  it('defines a TTL index on expiresAt', () => {
    const indexes = PasswordResetTokenModel.schema.indexes();

    expect(
      indexes.some(
        ([fields, options]) =>
          'expiresAt' in fields && options.expireAfterSeconds === 0,
      ),
    ).toBe(true);
  });
});
