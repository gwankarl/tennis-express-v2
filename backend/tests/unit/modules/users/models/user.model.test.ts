import { describe, expect, it } from 'vitest';

import { UserModel } from '../../../../../src/modules/users/models/user.model.js';
import { buildUserTestData } from '../../../../fixtures/user-test-data.js';

const validUser = buildUserTestData({
  email: '  PLAYER@EXAMPLE.COM ',
  profile: {
    firstName: '  Tennis  ',
    lastName: ' Player  ',
  },
});

describe('UserModel', () => {
  it('normalizes email and trims profile names', () => {
    const user = new UserModel(validUser);

    expect(user.email).toBe('player@example.com');
    expect(user.profile.firstName).toBe('Tennis');
    expect(user.profile.lastName).toBe('Player');
  });

  it('accepts pending verification as an account status', async () => {
    const user = new UserModel({
      ...validUser,
      status: 'pending_verification',
    });

    await expect(user.validate()).resolves.toBeUndefined();
    expect(user.status).toBe('pending_verification');
  });

  it('applies default roles and account status', () => {
    const user = new UserModel(validUser);

    expect(user.roles).toEqual(['buyer']);
    expect(user.status).toBe('active');
  });

  it('allows a user without a password hash', async () => {
    const user = new UserModel({
      email: 'google@example.com',
      profile: {
        firstName: 'Google',
        lastName: 'User',
      },
    });

    expect(user.passwordHash).toBeUndefined();
    await expect(user.validate()).resolves.toBeUndefined();
  });

  it('defaults optional timestamps to null', () => {
    const user = new UserModel(validUser);

    expect(user.emailVerifiedAt).toBeNull();
    expect(user.lastLoginAt).toBeNull();
    expect(user.deletedAt).toBeNull();
  });

  it('defaults the profile image to null', () => {
    const user = new UserModel(validUser);

    expect(user.profile.image).toBeNull();
  });

  it('defaults contact details and notification preferences', () => {
    const user = new UserModel(validUser);

    expect(user.profile.contactDetails).toBeDefined();
    expect(user.notificationPreferences.email).toBe(true);
    expect(user.notificationPreferences.inApp).toBe(true);
  });

  it('requires an email address', async () => {
    const user = new UserModel({
      profile: {
        firstName: 'Tennis',
        lastName: 'Player',
      },
    });

    await expect(user.validate()).rejects.toMatchObject({
      errors: {
        email: expect.anything(),
      },
    });
  });

  it('requires both profile names', async () => {
    const user = new UserModel({
      email: 'player@example.com',
      profile: {},
    });

    await expect(user.validate()).rejects.toMatchObject({
      errors: {
        'profile.firstName': expect.anything(),
        'profile.lastName': expect.anything(),
      },
    });
  });

  it('rejects unsupported roles', async () => {
    const user = new UserModel({
      ...validUser,
      roles: ['superuser'],
    });

    await expect(user.validate()).rejects.toMatchObject({
      errors: {
        'roles.0': expect.anything(),
      },
    });
  });

  it('rejects unsupported account statuses', async () => {
    const user = new UserModel({
      ...validUser,
      status: 'pending_seller',
    });

    await expect(user.validate()).rejects.toMatchObject({
      errors: {
        status: expect.anything(),
      },
    });
  });

  it('defines a unique email index', () => {
    const emailIndex = UserModel.schema
      .indexes()
      .find(([fields]) => fields.email === 1);

    expect(emailIndex?.[1].unique).toBe(true);
  });

  it('enables automatic timestamps', () => {
    expect(UserModel.schema.options.timestamps).toBe(true);
  });
});
