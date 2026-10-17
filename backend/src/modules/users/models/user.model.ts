import mongoose, { model, Schema } from 'mongoose';

import { USER_ROLES, USER_STATUSES } from '../types/user.types.js';
import type {
  User,
  UserContactDetails,
  UserImageReference,
  UserNotificationPreferences,
  UserProfile,
} from '../types/user.types.js';

/**
 * Stores a reference to a user's profile image.
 *
 * The image itself is managed by the configured image-storage provider.
 */
const userImageSchema = new Schema<UserImageReference>(
  {
    publicId: {
      type: String,
      required: true,
      trim: true,
    },
    secureUrl: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

/**
 * Stores optional contact details and the user's preferred contact method.
 */
const contactDetailsSchema = new Schema<UserContactDetails>(
  {
    phoneNumber: {
      type: String,
      trim: true,
    },
    preferredContactMethod: {
      type: String,
      enum: ['email', 'phone'],
    },
  },
  { _id: false },
);

/**
 * Stores a user's personal profile information.
 *
 * Names are required; image and contact details are optional.
 */
const profileSchema = new Schema<UserProfile>(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    image: {
      type: userImageSchema,
      default: null,
    },
    contactDetails: {
      type: contactDetailsSchema,
      default: () => ({}),
    },
  },
  { _id: false },
);

/**
 * Stores the user's notification preferences.
 *
 * Both channels are enabled by default.
 */
const notificationPreferencesSchema = new Schema<UserNotificationPreferences>(
  {
    email: {
      type: Boolean,
      default: true,
    },
    inApp: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false },
);

/**
 * Defines the persisted user account document.
 *
 * Authentication credentials, authorization roles, account status,
 * profile information, preferences, and lifecycle timestamps are
 * stored together in one user document.
 */
const userSchema = new Schema<User>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: false,
      select: false,
    },
    googleId: {
      type: String,
      required: false,
      select: false,
      trim: true,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    roles: {
      type: [String],
      enum: USER_ROLES,
      default: ['buyer'],
      required: true,
    },
    status: {
      type: String,
      enum: USER_STATUSES,
      default: 'active',
      required: true,
    },
    profile: {
      type: profileSchema,
      required: true,
    },
    notificationPreferences: {
      type: notificationPreferencesSchema,
      default: () => ({}),
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/* Enforces email uniqueness and supports account-status filtering. */
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ status: 1 });
userSchema.index(
  { googleId: 1 },
  {
    unique: true,
    partialFilterExpression: { googleId: { $type: 'string' } },
  },
);

/*
 * Reuse the registered model when available, avoiding duplicate model
 * registration in environments that reload or import modules repeatedly.
 */
export const UserModel =
  mongoose.models.User ?? model<User>('User', userSchema);
