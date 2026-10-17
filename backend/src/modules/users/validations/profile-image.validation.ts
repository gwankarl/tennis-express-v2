/**
 * Defines the file constraints for profile-image uploads.
 */
export const PROFILE_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export const PROFILE_IMAGE_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type ProfileImageMimeType =
  (typeof PROFILE_IMAGE_ALLOWED_MIME_TYPES)[number];

/**
 * Checks whether an uploaded file has an allowed MIME type and size.
 */
export function isValidProfileImage(file: {
  mimetype: string;
  size: number;
}): boolean {
  return (
    PROFILE_IMAGE_ALLOWED_MIME_TYPES.includes(
      file.mimetype as ProfileImageMimeType,
    ) &&
    file.size > 0 &&
    file.size <= PROFILE_IMAGE_MAX_SIZE_BYTES
  );
}
