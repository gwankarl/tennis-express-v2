import argon2 from 'argon2';
import { describe, expect, it } from 'vitest';

import { Argon2PasswordHasher } from '../../../../../src/modules/auth/services/argon2-password-hasher.js';

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();

  it('hashes a password without returning the original password', async () => {
    const password = 'Correct-Horse-Battery-42!';
    const hash = await hasher.hash(password);

    expect(hash).not.toBe(password);
    expect(hash).toContain('$argon2id$');
    await expect(argon2.verify(hash, password)).resolves.toBe(true);
  });

  it('produces a different salted hash for the same password', async () => {
    const password = 'Correct-Horse-Battery-42!';

    const firstHash = await hasher.hash(password);
    const secondHash = await hasher.hash(password);

    expect(firstHash).not.toBe(secondHash);
    await expect(argon2.verify(firstHash, password)).resolves.toBe(true);
    await expect(argon2.verify(secondHash, password)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hasher.hash('Correct-Horse-Battery-42!');

    await expect(argon2.verify(hash, 'Incorrect-Password-99!')).resolves.toBe(
      false,
    );
  });
});
