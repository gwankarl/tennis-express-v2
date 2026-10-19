import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* Reusable validation schemas                                                */
/* -------------------------------------------------------------------------- */

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid MongoDB ObjectId.');

const brandImageSchema = z
  .object({
    publicId: z.string().trim().min(1).max(500),
    secureUrl: z.string().trim().url().max(2048),
  })
  .strict();

/* -------------------------------------------------------------------------- */
/* Brand field validation                                                     */
/* -------------------------------------------------------------------------- */

const brandFieldsSchema = {
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable(),
  logo: brandImageSchema.nullable(),
};

/* -------------------------------------------------------------------------- */
/* Create brand validation                                                    */
/* -------------------------------------------------------------------------- */

export const createBrandSchema = z
  .object({
    name: brandFieldsSchema.name,
    description: brandFieldsSchema.description.optional(),
    logo: brandFieldsSchema.logo.optional(),
  })
  .strict();

export type CreateBrandRequest = z.infer<typeof createBrandSchema>;

/* -------------------------------------------------------------------------- */
/* Update brand validation                                                    */
/* -------------------------------------------------------------------------- */

export const updateBrandParamsSchema = z
  .object({
    brandId: objectIdSchema,
  })
  .strict();

export const updateBrandSchema = z
  .object({
    name: brandFieldsSchema.name.optional(),
    description: brandFieldsSchema.description.optional(),
    logo: brandFieldsSchema.logo.optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    'At least one brand field must be provided.',
  );

export type UpdateBrandRequest = z.infer<typeof updateBrandSchema>;

export type UpdateBrandParams = z.infer<typeof updateBrandParamsSchema>;
