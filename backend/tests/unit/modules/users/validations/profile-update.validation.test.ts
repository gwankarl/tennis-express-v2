import { describe, expect, it } from 'vitest';

import { profileUpdateSchema } from '../../../../../src/modules/users/validations/profile-update.validation.js';

describe('profileUpdateSchema', () => {
  it('accepts a first-name-only update and trims whitespace', () => {
    const result = profileUpdateSchema.safeParse({
      firstName: '  Alex  ',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toEqual({
        firstName: 'Alex',
      });
    }
  });

  it('accepts a last-name-only update', () => {
    const result = profileUpdateSchema.safeParse({
      lastName: '  Tennis  ',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.lastName).toBe('Tennis');
    }
  });

  it('accepts a partial contact-details update', () => {
    const result = profileUpdateSchema.safeParse({
      contactDetails: {
        phoneNumber: '  +237600000000  ',
      },
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.contactDetails).toEqual({
        phoneNumber: '+237600000000',
      });
    }
  });

  it('accepts a preferred contact-method update', () => {
    const result = profileUpdateSchema.safeParse({
      contactDetails: {
        preferredContactMethod: 'phone',
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts updates to multiple profile fields', () => {
    const result = profileUpdateSchema.safeParse({
      firstName: 'Alex',
      lastName: 'Tennis',
      contactDetails: {
        phoneNumber: '+237600000000',
        preferredContactMethod: 'email',
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects an empty update', () => {
    const result = profileUpdateSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it('rejects an empty first name', () => {
    const result = profileUpdateSchema.safeParse({
      firstName: '   ',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a first name exceeding 50 characters', () => {
    const result = profileUpdateSchema.safeParse({
      firstName: 'A'.repeat(51),
    });

    expect(result.success).toBe(false);
  });

  it('rejects a last name exceeding 50 characters', () => {
    const result = profileUpdateSchema.safeParse({
      lastName: 'B'.repeat(51),
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty phone number', () => {
    const result = profileUpdateSchema.safeParse({
      contactDetails: {
        phoneNumber: '   ',
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects a phone number exceeding 25 characters', () => {
    const result = profileUpdateSchema.safeParse({
      contactDetails: {
        phoneNumber: '1'.repeat(26),
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects an unsupported preferred contact method', () => {
    const result = profileUpdateSchema.safeParse({
      contactDetails: {
        preferredContactMethod: 'sms',
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown top-level fields', () => {
    const result = profileUpdateSchema.safeParse({
      email: 'changed@example.com',
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown contact-details fields', () => {
    const result = profileUpdateSchema.safeParse({
      contactDetails: {
        address: 'Yaoundé',
      },
    });

    expect(result.success).toBe(false);
  });
});
