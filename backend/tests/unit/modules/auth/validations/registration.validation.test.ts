import { describe, expect, it } from 'vitest';

import { registrationSchema } from '../../../../../src/modules/auth/validations/registration.validation.js';

describe('registrationSchema', () => {
  const validInput = {
    firstName: 'Tennis',
    lastName: 'Player',
    email: 'player@example.com',
    password: 'secure-password-123',
  };

  it('accepts valid registration data', () => {
    expect(registrationSchema.safeParse(validInput).success).toBe(true);
  });

  it('trims names and normalizes the email', () => {
    const result = registrationSchema.safeParse({
      ...validInput,
      firstName: '  Tennis  ',
      lastName: '  Player  ',
      email: '  PLAYER@EXAMPLE.COM  ',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.firstName).toBe('Tennis');
      expect(result.data.lastName).toBe('Player');
      expect(result.data.email).toBe('player@example.com');
    }
  });

  it('rejects a missing first name', () => {
    const { firstName: _firstName, ...input } = validInput;

    expect(registrationSchema.safeParse(input).success).toBe(false);
  });

  it('rejects a missing last name', () => {
    const { lastName: _lastName, ...input } = validInput;

    expect(registrationSchema.safeParse(input).success).toBe(false);
  });

  it('rejects blank names', () => {
    expect(
      registrationSchema.safeParse({
        ...validInput,
        firstName: '   ',
      }).success,
    ).toBe(false);
  });

  it('rejects names longer than 50 characters', () => {
    expect(
      registrationSchema.safeParse({
        ...validInput,
        lastName: 'a'.repeat(51),
      }).success,
    ).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(
      registrationSchema.safeParse({
        ...validInput,
        email: 'not-an-email',
      }).success,
    ).toBe(false);
  });

  it('rejects passwords shorter than 12 Unicode code points', () => {
    expect(
      registrationSchema.safeParse({
        ...validInput,
        password: 'short123',
      }).success,
    ).toBe(false);
  });

  it('rejects passwords longer than 128 Unicode code points', () => {
    expect(
      registrationSchema.safeParse({
        ...validInput,
        password: 'a'.repeat(129),
      }).success,
    ).toBe(false);
  });

  it('preserves password whitespace', () => {
    const password = '  secure-password-123  ';
    const result = registrationSchema.safeParse({
      ...validInput,
      password,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.password).toBe(password);
    }
  });

  it('rejects unexpected server-controlled fields', () => {
    expect(
      registrationSchema.safeParse({
        ...validInput,
        roles: ['admin'],
        status: 'active',
      }).success,
    ).toBe(false);
  });
});
