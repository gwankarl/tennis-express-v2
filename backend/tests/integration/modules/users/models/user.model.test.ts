import { describe, expect, it } from 'vitest';

import { UserModel } from '../../../../../src/modules/users/models/user.model.js';
import { buildUserTestData } from '../../../../fixtures/user-test-data.js';

describe('UserModel integration', () => {
  it('creates and persists a valid user', async () => {
    const user = new UserModel(buildUserTestData());

    await user.save();

    const persistedUser = await UserModel.findById(user._id);

    expect(persistedUser).not.toBeNull();
    expect(persistedUser?.email).toBe(user.email);
    expect(persistedUser?.profile.firstName).toBe('John');
    expect(persistedUser?.profile.lastName).toBe('Doe');
  });

  it('rejects duplicate email addresses', async () => {
    const firstUser = new UserModel(
      buildUserTestData({ email: 'duplicate@example.com' }),
    );

    await firstUser.save();

    const secondUser = new UserModel(
      buildUserTestData({ email: 'duplicate@example.com' }),
    );

    await expect(secondUser.save()).rejects.toMatchObject({
      code: 11000,
    });
  });

  it('allows users with different email addresses', async () => {
    const firstUser = new UserModel(
      buildUserTestData({ email: 'first@example.com' }),
    );

    const secondUser = new UserModel(
      buildUserTestData({ email: 'second@example.com' }),
    );

    await expect(
      UserModel.create([firstUser, secondUser]),
    ).resolves.toHaveLength(2);
  });

  it('enforces email uniqueness regardless of letter case', async () => {
    const firstUser = new UserModel(
      buildUserTestData({ email: 'player@example.com' }),
    );

    await firstUser.save();

    const secondUser = new UserModel(
      buildUserTestData({ email: 'PLAYER@EXAMPLE.COM' }),
    );

    await expect(secondUser.save()).rejects.toMatchObject({
      code: 11000,
    });
  });
});
