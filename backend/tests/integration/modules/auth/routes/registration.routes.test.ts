import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../../../src/shared/errors/app-error.js';
import { VerificationTokenModel } from '../../../../../src/modules/auth/models/verification-token.model.js';
import { RegistrationService } from '../../../../../src/modules/auth/services/registration.service.js';
import { UserModel } from '../../../../../src/modules/users/models/user.model.js';
import { createTestApp } from '../../../../helpers/test-app.js';

const registrationResponse = {
  success: true,
  data: {
    message:
      'If registration can be completed, verification instructions will be sent to the supplied email address.',
  },
};

const validRegistration = {
  firstName: 'Alex',
  lastName: 'Tennis',
  email: 'alex@example.com',
  password: 'Secure-Tennis-Pass-42!',
};

function createRegistrationService(options?: {
  compromised?: boolean;
  checkerError?: Error;
}) {
  const passwordHasher = {
    hash: vi.fn().mockResolvedValue('test-password-hash'),
    verify: vi.fn().mockResolvedValue(false),
  };

  const passwordCompromiseChecker = {
    isPasswordCompromised: vi.fn(async () => {
      if (options?.checkerError) {
        throw options.checkerError;
      }

      return options?.compromised ?? false;
    }),
  };

  const verificationEmailSender = {
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  };

  const service = new RegistrationService({
    passwordHasher,
    passwordCompromiseChecker,
    verificationEmailSender,
  });

  return {
    service,
    passwordHasher,
    passwordCompromiseChecker,
    verificationEmailSender,
  };
}

describe('POST /api/v1/auth/register', () => {
  beforeEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}),
      VerificationTokenModel.deleteMany({}),
    ]);
  });

  it('registers a pending user and returns a generic confirmation', async () => {
    const dependencies = createRegistrationService();
    const app = createTestApp({
      registrationService: dependencies.service,
    });

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(validRegistration);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(registrationResponse);

    const user = await UserModel.findOne({
      email: validRegistration.email,
    }).select('+passwordHash');

    expect(user).not.toBeNull();
    expect(user?.status).toBe('pending_verification');
    expect(user?.roles).toEqual(['buyer']);
    expect(user?.passwordHash).toBe('test-password-hash');
    expect(user?.emailVerifiedAt).toBeNull();

    expect(await VerificationTokenModel.countDocuments()).toBe(1);
    expect(
      dependencies.verificationEmailSender.sendVerificationEmail,
    ).toHaveBeenCalledOnce();
    expect(
      dependencies.verificationEmailSender.sendVerificationEmail,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        to: validRegistration.email,
        recipientName: 'Alex Tennis',
        token: expect.any(String),
      }),
    );
  });

  it('returns the same response when the email is already registered', async () => {
    const dependencies = createRegistrationService();
    const app = createTestApp({
      registrationService: dependencies.service,
    });

    const firstResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(validRegistration);

    const secondResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(validRegistration);

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(secondResponse.body).toEqual(firstResponse.body);
    expect(secondResponse.body).toEqual(registrationResponse);

    expect(
      dependencies.verificationEmailSender.sendVerificationEmail,
    ).toHaveBeenCalledOnce();

    expect(await UserModel.countDocuments()).toBe(1);
  });

  it('rejects invalid registration data', async () => {
    const dependencies = createRegistrationService();
    const app = createTestApp({
      registrationService: dependencies.service,
    });

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...validRegistration,
        email: 'not-an-email',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');

    expect(await UserModel.countDocuments()).toBe(0);
    expect(dependencies.passwordHasher.hash).not.toHaveBeenCalled();
  });

  it('rejects unexpected request fields', async () => {
    const dependencies = createRegistrationService();
    const app = createTestApp({
      registrationService: dependencies.service,
    });

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...validRegistration,
        roles: ['admin'],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(await UserModel.countDocuments()).toBe(0);
  });

  it('rejects a compromised password', async () => {
    const dependencies = createRegistrationService({
      compromised: true,
    });
    const app = createTestApp({
      registrationService: dependencies.service,
    });

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(validRegistration);

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('PASSWORD_COMPROMISED');
    expect(await UserModel.countDocuments()).toBe(0);
    expect(
      dependencies.verificationEmailSender.sendVerificationEmail,
    ).not.toHaveBeenCalled();
  });

  it('fails safely when the password security check is unavailable', async () => {
    const dependencies = createRegistrationService({
      checkerError: new AppError({
        statusCode: 503,
        code: 'PASSWORD_COMPROMISE_CHECK_UNAVAILABLE',
        message: 'Password security checks are temporarily unavailable.',
      }),
    });
    const app = createTestApp({
      registrationService: dependencies.service,
    });

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(validRegistration);

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe(
      'PASSWORD_COMPROMISE_CHECK_UNAVAILABLE',
    );
    expect(await UserModel.countDocuments()).toBe(0);
  });
});
