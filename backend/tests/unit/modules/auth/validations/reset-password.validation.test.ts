import { describe, expect, it } from 'vitest';

import { resetPasswordSchema } from '../../../../../src/modules/auth/validations/reset-password.validation.js';

describe('resetPasswordSchema', () => {
  const validInput = {
    token: 'a'.repeat(64),
    password: 'StrongPassword123!',
  };

  it('accepts a valid reset token and password', () => {
    expect(resetPasswordSchema.safeParse(validInput).success).toBe(true);
  });

  it('rejects a token that is not 64 hexadecimal characters', () => {
    expect(
      resetPasswordSchema.safeParse({
        ...validInput,
        token: 'invalid-token',
      }).success,
    ).toBe(false);
  });

  it('rejects a password shorter than 12 characters', () => {
    expect(
      resetPasswordSchema.safeParse({
        ...validInput,
        password: 'Short123!',
      }).success,
    ).toBe(false);
  });

  it('rejects a password longer than 128 Unicode code points', () => {
    expect(
      resetPasswordSchema.safeParse({
        ...validInput,
        password: 'a'.repeat(129),
      }).success,
    ).toBe(false);
  });

  it('rejects unexpected fields', () => {
    expect(
      resetPasswordSchema.safeParse({
        ...validInput,
        email: 'user@example.com',
      }).success,
    ).toBe(false);
  });
});
