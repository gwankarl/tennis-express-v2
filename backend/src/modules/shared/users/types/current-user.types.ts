import type {
  UserNotificationPreferences,
  UserProfile,
  UserRole,
  UserStatus,
} from './user.types.js';

/** Safe account information returned to the authenticated user. */
export interface CurrentUserResponse {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  roles: UserRole[];
  status: UserStatus;
  profile: UserProfile;
  notificationPreferences: UserNotificationPreferences;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
