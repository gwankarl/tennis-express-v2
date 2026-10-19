/* -------------------------------------------------------------------------- */
/* Product image upload constraints                                           */
/* -------------------------------------------------------------------------- */

export const PRODUCT_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export const PRODUCT_IMAGE_MAX_FILES = 10;

export const PRODUCT_IMAGE_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type ProductImageMimeType =
  (typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES)[number];

/**
 * Checks whether an uploaded product image has an allowed MIME type and size.
 */
export function isValidProductImage(file: {
  mimetype: string;
  size: number;
}): boolean {
  return (
    PRODUCT_IMAGE_ALLOWED_MIME_TYPES.includes(
      file.mimetype as ProductImageMimeType,
    ) &&
    file.size > 0 &&
    file.size <= PRODUCT_IMAGE_MAX_SIZE_BYTES
  );
}
