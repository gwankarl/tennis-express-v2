import type { Types } from 'mongoose';

/** Roles used to determine which marketplace capabilities a user may access. */
export const USER_ROLES = ['buyer', 'seller', 'both', 'admin'] as const;

/** A role supported by the application. */
export type UserRole = (typeof USER_ROLES)[number];

/** Lifecycle states supported for user accounts. */
export const USER_STATUSES = [
  'pending_verification',
  'active',
  'suspended',
  'deactivated',
] as const;

/** A valid user-account status. */
export type UserStatus = (typeof USER_STATUSES)[number];

/** Contact channel preferred by the user. */
export type PreferredContactMethod = 'email' | 'phone';

/**
 * Identifies a profile image managed by an external storage provider.
 */
export interface UserImageReference {
  publicId: string;
  secureUrl: string;
}

/** Optional contact information associated with a user's profile. */
export interface UserContactDetails {
  phoneNumber?: string;
  preferredContactMethod?: PreferredContactMethod;
}

/** Notification channels and their enabled states. */
export interface UserNotificationPreferences {
  email: boolean;
  inApp: boolean;
}

/** Personal information displayed on a user's marketplace profile. */
export interface UserProfile {
  firstName: string;
  lastName: string;
  image: UserImageReference | null;
  contactDetails: UserContactDetails;
}

/**
 * TypeScript representation of a persisted user account.
 *
 * Runtime validation, defaults, indexes, and query-selection behavior
 * are defined by the Mongoose user schema.
 */
export interface User {
  _id: Types.ObjectId;
  email: string;
  passwordHash?: string;
  emailVerifiedAt: Date | null;
  roles: UserRole[];
  status: UserStatus;
  profile: UserProfile;
  notificationPreferences: UserNotificationPreferences;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
