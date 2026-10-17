import type { CookieOptions } from 'express';

import { env } from './env.js';

export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

export const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: 'lax',
  path: '/api/v1/auth',
  maxAge: env.refreshTokenTtlSeconds * 1000,
};

export const clearRefreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: 'lax',
  path: '/api/v1/auth',
};
