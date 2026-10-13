import type {
  UserRole,
  UserStatus,
} from '../../src/modules/users/types/user.types.js';

let testValueCounter = 0;

export function uniqueTestValue(prefix: string): string {
  testValueCounter += 1;

  return `${prefix}-test-${testValueCounter}`;
}

export interface UserTestData {
  email: string;
  passwordHash?: string;
  roles?: UserRole[];
  status?: UserStatus;
  profile?: {
    firstName?: string;
    lastName?: string;
    image?: {
      publicId: string;
      secureUrl: string;
    } | null;
    contactDetails?: {
      phoneNumber?: string;
      preferredContactMethod?: 'email' | 'phone';
    };
  };
  emailVerifiedAt?: Date | null;
  notificationPreferences?: {
    email?: boolean;
    inApp?: boolean;
  };
  lastLoginAt?: Date | null;
  deletedAt?: Date | null;
}

/*
 * Builds valid default user data for tests.
 *
 * The factory does not persist data. Each test decides
 * whether to instantiate or save the resulting document.
 */
export function buildUserTestData(
  overrides: Partial<UserTestData> = {},
): UserTestData {
  return {
    email: `${uniqueTestValue('user')}@example.com`,
    passwordHash: 'hashed-password',
    profile: {
      firstName: 'John',
      lastName: 'Doe',
    },
    ...overrides,
  };
}
