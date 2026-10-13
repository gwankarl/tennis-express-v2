import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PwnedPasswordCompromiseChecker } from '../../../../../src/modules/auth/services/pwned-password-compromise.checker.js';

describe('PwnedPasswordCompromiseChecker', () => {
  const password = 'example-password-123';
  const hash = createHash('sha1')
    .update(password, 'utf8')
    .digest('hex')
    .toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
  let checker: PwnedPasswordCompromiseChecker;

  beforeEach(() => {
    fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:2\r\n', {
        status: 200,
      }),
    );

    checker = new PwnedPasswordCompromiseChecker(fetcher);
  });

  it('returns true when the password hash suffix is present', async () => {
    fetcher.mockResolvedValue(
      new Response(
        `${suffix}:12\r\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:2\r\n`,
        {
          status: 200,
        },
      ),
    );

    await expect(checker.isPasswordCompromised(password)).resolves.toBe(true);
  });

  it('returns false when the password hash suffix is absent', async () => {
    await expect(checker.isPasswordCompromised(password)).resolves.toBe(false);
  });

  it('sends only the first five hash characters to the API', async () => {
    await checker.isPasswordCompromised(password);

    expect(fetcher).toHaveBeenCalledOnce();

    const [url, options] = fetcher.mock.calls[0]!;

    expect(url).toBe(`https://api.pwnedpasswords.com/range/${prefix}`);
    expect(url).not.toContain(suffix);
    expect(url).not.toContain(password);
    expect(options).toMatchObject({
      method: 'GET',
      headers: {
        'Add-Padding': 'true',
        'User-Agent': 'Tennis-Xpress-Password-Compromise-Checker',
      },
    });
  });

  it('fails closed when the API request fails', async () => {
    fetcher.mockRejectedValue(new Error('Network unavailable'));

    await expect(checker.isPasswordCompromised(password)).rejects.toMatchObject(
      {
        statusCode: 503,
        code: 'PASSWORD_COMPROMISE_CHECK_UNAVAILABLE',
      },
    );
  });

  it('fails closed when the API returns an unsuccessful status', async () => {
    fetcher.mockResolvedValue(
      new Response('Service unavailable', { status: 503 }),
    );

    await expect(checker.isPasswordCompromised(password)).rejects.toMatchObject(
      {
        statusCode: 503,
        code: 'PASSWORD_COMPROMISE_CHECK_UNAVAILABLE',
      },
    );
  });

  it('fails closed when the response body cannot be read', async () => {
    const response = new Response(null, { status: 200 });
    vi.spyOn(response, 'text').mockRejectedValue(new Error('Read failed'));
    fetcher.mockResolvedValue(response);

    await expect(checker.isPasswordCompromised(password)).rejects.toMatchObject(
      {
        statusCode: 503,
        code: 'PASSWORD_COMPROMISE_CHECK_UNAVAILABLE',
      },
    );
  });
});
