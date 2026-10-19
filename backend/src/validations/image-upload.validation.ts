/**
 * Defines the file constraints for image uploads.
 */
export const IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type ImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/**
 * Checks whether an uploaded file has an allowed MIME type and size.
 */
export function isValidImage(file: {
  mimetype: string;
  size: number;
}): boolean {
  return (
    ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype as ImageMimeType) &&
    file.size > 0 &&
    file.size <= IMAGE_MAX_SIZE_BYTES
  );
}
