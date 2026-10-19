import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* Shared validation rules                                                    */
/* -------------------------------------------------------------------------- */

const nonEmptyString = z.string().trim().min(1);

const storeLocationSchema = z
  .object({
    region: nonEmptyString,
    city: nonEmptyString,
    address: nonEmptyString,
  })
  .strict();

const storeLogoSchema = z
  .object({
    publicId: nonEmptyString,
    secureUrl: z
      .string()
      .url()
      .refine((value) => value.startsWith('https://'), {
        message: 'The logo URL must use HTTPS.',
      }),
  })
  .strict();

const storeDeliveryOptionSchema = z
  .object({
    name: nonEmptyString,
    description: nonEmptyString,
    fee: z.number().finite().min(0),
  })
  .strict();

const storeCollectionOptionSchema = z
  .object({
    name: nonEmptyString,
    description: nonEmptyString,
    fee: z.number().finite().min(0),
  })
  .strict();

const storeReturnPolicySchema = z
  .object({
    summary: nonEmptyString,
    returnWindowDays: z.number().int().min(0),
    conditions: z.array(nonEmptyString),
  })
  .strict();

/* -------------------------------------------------------------------------- */
/* Store identity update                                                      */
/* -------------------------------------------------------------------------- */

export const storeIdentityUpdateSchema = z
  .object({
    name: nonEmptyString.max(100),
    description: nonEmptyString.max(2000),
  })
  .strict();

/* -------------------------------------------------------------------------- */
/* Store location update                                                      */
/* -------------------------------------------------------------------------- */

export const storeLocationUpdateSchema = z
  .object({
    location: storeLocationSchema,
  })
  .strict();

/* -------------------------------------------------------------------------- */
/* Store logo update                                                          */
/* -------------------------------------------------------------------------- */

export const storeLogoUpdateSchema = z
  .object({
    logo: storeLogoSchema.nullable(),
  })
  .strict();

/* -------------------------------------------------------------------------- */
/* Store delivery options update                                              */
/* -------------------------------------------------------------------------- */

export const storeDeliveryOptionsUpdateSchema = z
  .object({
    deliveryOptions: z.array(storeDeliveryOptionSchema),
  })
  .strict();

/* -------------------------------------------------------------------------- */
/* Store collection options update                                            */
/* -------------------------------------------------------------------------- */

export const storeCollectionOptionsUpdateSchema = z
  .object({
    collectionOptions: z.array(storeCollectionOptionSchema),
  })
  .strict();

/* -------------------------------------------------------------------------- */
/* Store return policy update                                                 */
/* -------------------------------------------------------------------------- */

export const storeReturnPolicyUpdateSchema = z
  .object({
    returnPolicy: storeReturnPolicySchema.nullable(),
  })
  .strict();
