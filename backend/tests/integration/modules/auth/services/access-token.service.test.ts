import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import { env } from '../../../../../src/config/env.js';
import { AccessTokenService } from '../../../../../src/modules/auth/services/access-token.service.js';

describe('AccessTokenService', () => {
  const service = new AccessTokenService();

  const validInput = {
    userId: '507f1f77bcf86cd799439011',
    sessionId: '507f1f77bcf86cd799439012',
    roles: ['buyer'] as const,
  };

  it('creates a token that can be verified', () => {
    const token = service.createToken({
      ...validInput,
      roles: [...validInput.roles],
    });

    expect(service.verifyToken(token)).toEqual({
      userId: validInput.userId,
      sessionId: validInput.sessionId,
      roles: ['buyer'],
    });
  });

  it('includes the expected subject and token type', () => {
    const token = service.createToken({
      ...validInput,
      roles: [...validInput.roles],
    });

    const payload = jwt.verify(token, env.jwtAccessSecret);

    expect(payload).toMatchObject({
      sub: validInput.userId,
      sid: validInput.sessionId,
      tokenType: 'access',
      roles: ['buyer'],
    });
  });

  it('rejects a token whose signature has been tampered with', () => {
    const token = service.createToken({
      ...validInput,
      roles: [...validInput.roles],
    });

    const tamperedToken = `${token.slice(0, -1)}x`;

    expect(service.verifyToken(tamperedToken)).toBeNull();
  });

  it('rejects an expired token', () => {
    const token = jwt.sign(
      {
        sid: validInput.sessionId,
        roles: ['buyer'],
        tokenType: 'access',
      },
      env.jwtAccessSecret,
      {
        algorithm: 'HS256',
        subject: validInput.userId,
        expiresIn: -1,
      },
    );

    expect(service.verifyToken(token)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const token = jwt.sign(
      {
        sid: validInput.sessionId,
        roles: ['buyer'],
        tokenType: 'access',
      },
      'a-different-secret-that-is-long-enough-for-this-test',
      {
        algorithm: 'HS256',
        subject: validInput.userId,
        expiresIn: 60,
      },
    );

    expect(service.verifyToken(token)).toBeNull();
  });

  it('rejects a token with an unsupported role', () => {
    const token = jwt.sign(
      {
        sid: validInput.sessionId,
        roles: ['superuser'],
        tokenType: 'access',
      },
      env.jwtAccessSecret,
      {
        algorithm: 'HS256',
        subject: validInput.userId,
        expiresIn: 60,
      },
    );

    expect(service.verifyToken(token)).toBeNull();
  });

  it('rejects a token with the wrong token type', () => {
    const token = jwt.sign(
      {
        sid: validInput.sessionId,
        roles: ['buyer'],
        tokenType: 'refresh',
      },
      env.jwtAccessSecret,
      {
        algorithm: 'HS256',
        subject: validInput.userId,
        expiresIn: 60,
      },
    );

    expect(service.verifyToken(token)).toBeNull();
  });

  it('rejects malformed token strings', () => {
    expect(service.verifyToken('not-a-jwt')).toBeNull();
  });
});
