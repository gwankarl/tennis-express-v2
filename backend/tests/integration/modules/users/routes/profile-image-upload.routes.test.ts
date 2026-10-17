import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccessTokenService } from '../../../../../src/modules/auth/services/access-token.service.js';
import type { SessionService } from '../../../../../src/modules/auth/services/session.service.js';
import type { ProfileImageUpdateService } from '../../../../../src/modules/users/services/profile-image-update.service.js';
import type { CurrentUserResponse } from '../../../../../src/modules/users/types/current-user.types.js';
import { AppError } from '../../../../../src/shared/errors/app-error.js';
import { createTestApp } from '../../../../helpers/test-app.js';

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  findValidSession: vi.fn(),
  updateProfileImage: vi.fn(),
}));

const accessTokenService = {
  verifyToken: mocks.verifyToken,
} as unknown as AccessTokenService;

const sessionService = {
  findValidSession: mocks.findValidSession,
} as unknown as SessionService;

const profileImageUpdateService = {
  updateProfileImage: mocks.updateProfileImage,
} as unknown as ProfileImageUpdateService;

const userId = '507f1f77bcf86cd799439011';
const sessionId = '507f1f77bcf86cd799439012';

/*
 * A minimal PNG image fixture used to exercise the binary-content validator.
 */
const imageBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
);

const jpegImageBuffer = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9k=',
  'base64',
);

const webpImageBuffer = Buffer.from(
  'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==',
  'base64',
);

const updatedUser: CurrentUserResponse = {
  id: userId,
  email: 'alex@example.com',
  emailVerifiedAt: null,
  roles: ['buyer'],
  status: 'active',
  profile: {
    firstName: 'Alex',
    lastName: 'Tennis',
    image: {
      publicId: 'tennis-xpress/profile-images/image-123',
      secureUrl: 'https://res.cloudinary.com/demo/image-123.jpg',
    },
    contactDetails: {},
  },
  notificationPreferences: {
    email: true,
    inApp: true,
  },
  lastLoginAt: null,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-12T10:00:00.000Z'),
};

const app = () =>
  createTestApp({
    accessTokenService,
    sessionService,
    profileImageUpdateService,
  });

describe('POST /api/v1/users/me/image', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.verifyToken.mockReturnValue({
      userId,
      sessionId,
      roles: ['buyer'],
    });

    mocks.findValidSession.mockResolvedValue({ userId });
    mocks.updateProfileImage.mockResolvedValue(updatedUser);
  });

  it('rejects requests without an access token', async () => {
    const response = await request(app())
      .post('/api/v1/users/me/image')
      .attach('image', imageBuffer, {
        filename: 'profile.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
      },
    });

    expect(mocks.updateProfileImage).not.toHaveBeenCalled();
  });

  it('rejects requests with an invalid session', async () => {
    mocks.findValidSession.mockResolvedValue(null);

    const response = await request(app())
      .post('/api/v1/users/me/image')
      .set('Authorization', 'Bearer test-access-token')
      .attach('image', imageBuffer, {
        filename: 'profile.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_SESSION',
      },
    });

    expect(mocks.updateProfileImage).not.toHaveBeenCalled();
  });

  it('rejects requests without an image file', async () => {
    const response = await request(app())
      .post('/api/v1/users/me/image')
      .set('Authorization', 'Bearer test-access-token');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'PROFILE_IMAGE_REQUIRED',
      },
    });

    expect(mocks.updateProfileImage).not.toHaveBeenCalled();
  });

  it('uploads an image for the authenticated user', async () => {
    const response = await request(app())
      .post('/api/v1/users/me/image')
      .set('Authorization', 'Bearer test-access-token')
      .attach('image', imageBuffer, {
        filename: 'profile.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        user: {
          id: userId,
          profile: {
            image: {
              publicId: 'tennis-xpress/profile-images/image-123',
              secureUrl: 'https://res.cloudinary.com/demo/image-123.jpg',
            },
          },
        },
      },
    });

    expect(mocks.verifyToken).toHaveBeenCalledWith('test-access-token');
    expect(mocks.findValidSession).toHaveBeenCalledWith(sessionId);

    expect(mocks.updateProfileImage).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        mimetype: 'image/png',
      }),
    );

    const passedInput = mocks.updateProfileImage.mock.calls[0]?.[1];

    expect(passedInput.buffer).toEqual(imageBuffer);
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.user.googleId).toBeUndefined();
  });

  it('rejects files whose MIME type is not allowed', async () => {
    const response = await request(app())
      .post('/api/v1/users/me/image')
      .set('Authorization', 'Bearer test-access-token')
      .attach('image', Buffer.from('plain text'), {
        filename: 'profile.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_PROFILE_IMAGE',
      },
    });

    expect(mocks.updateProfileImage).not.toHaveBeenCalled();
  });

  it('rejects files larger than 5 MB', async () => {
    const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1);

    const response = await request(app())
      .post('/api/v1/users/me/image')
      .set('Authorization', 'Bearer test-access-token')
      .attach('image', oversizedBuffer, {
        filename: 'large.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(413);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'PROFILE_IMAGE_TOO_LARGE',
      },
    });

    expect(mocks.updateProfileImage).not.toHaveBeenCalled();
  });

  it('rejects files that claim to be images but contain invalid data', async () => {
    const response = await request(app())
      .post('/api/v1/users/me/image')
      .set('Authorization', 'Bearer test-access-token')
      .attach('image', Buffer.from('this is not an image'), {
        filename: 'fake.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_PROFILE_IMAGE',
      },
    });

    expect(mocks.updateProfileImage).not.toHaveBeenCalled();
  });

  it('forwards service errors to the shared error handler', async () => {
    mocks.updateProfileImage.mockRejectedValue(
      new AppError({
        statusCode: 502,
        code: 'PROFILE_IMAGE_UPLOAD_FAILED',
        message: 'The profile image could not be uploaded.',
      }),
    );

    const response = await request(app())
      .post('/api/v1/users/me/image')
      .set('Authorization', 'Bearer test-access-token')
      .attach('image', imageBuffer, {
        filename: 'profile.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(502);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'PROFILE_IMAGE_UPLOAD_FAILED',
      },
    });

    expect(mocks.updateProfileImage).toHaveBeenCalledTimes(1);
  });

  it('accepts a valid JPEG image', async () => {
    const response = await request(app())
      .post('/api/v1/users/me/image')
      .set('Authorization', 'Bearer test-access-token')
      .attach('image', jpegImageBuffer, {
        filename: 'profile.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(200);
    expect(mocks.updateProfileImage).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        mimetype: 'image/jpeg',
      }),
    );
  });

  it('accepts a valid WebP image', async () => {
    const response = await request(app())
      .post('/api/v1/users/me/image')
      .set('Authorization', 'Bearer test-access-token')
      .attach('image', webpImageBuffer, {
        filename: 'profile.webp',
        contentType: 'image/webp',
      });

    expect(response.status).toBe(200);
    expect(mocks.updateProfileImage).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        mimetype: 'image/webp',
      }),
    );
  });

  it('rejects requests containing multiple image files', async () => {
    const response = await request(app())
      .post('/api/v1/users/me/image')
      .set('Authorization', 'Bearer test-access-token')
      .attach('image', imageBuffer, {
        filename: 'profile.png',
        contentType: 'image/png',
      })
      .attach('image', imageBuffer, {
        filename: 'second.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_PROFILE_IMAGE_UPLOAD',
      },
    });

    expect(mocks.updateProfileImage).not.toHaveBeenCalled();
  });
});
