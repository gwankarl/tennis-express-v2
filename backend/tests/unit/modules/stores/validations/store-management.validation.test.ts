import { describe, expect, it } from 'vitest';

import {
  storeCollectionOptionsUpdateSchema,
  storeDeliveryOptionsUpdateSchema,
  storeIdentityUpdateSchema,
  storeLocationUpdateSchema,
  storeLogoUpdateSchema,
  storeReturnPolicyUpdateSchema,
} from '../../../../../src/modules/stores/validations/store-management.validation.js';

/* -------------------------------------------------------------------------- */
/* Store identity validation                                                  */
/* -------------------------------------------------------------------------- */

describe('storeIdentityUpdateSchema', () => {
  it('accepts a valid store name and description', () => {
    const result = storeIdentityUpdateSchema.safeParse({
      name: 'Baseline Tennis',
      description: 'Tennis equipment and accessories.',
    });

    expect(result.success).toBe(true);
  });

  it('trims whitespace from the name and description', () => {
    const result = storeIdentityUpdateSchema.safeParse({
      name: '  Baseline Tennis  ',
      description: '  Tennis equipment.  ',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toEqual({
        name: 'Baseline Tennis',
        description: 'Tennis equipment.',
      });
    }
  });

  it('rejects an empty store name', () => {
    const result = storeIdentityUpdateSchema.safeParse({
      name: '   ',
      description: 'Tennis equipment.',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty description', () => {
    const result = storeIdentityUpdateSchema.safeParse({
      name: 'Baseline Tennis',
      description: '   ',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a name longer than 100 characters', () => {
    const result = storeIdentityUpdateSchema.safeParse({
      name: 'a'.repeat(101),
      description: 'Tennis equipment.',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a description longer than 2000 characters', () => {
    const result = storeIdentityUpdateSchema.safeParse({
      name: 'Baseline Tennis',
      description: 'a'.repeat(2001),
    });

    expect(result.success).toBe(false);
  });

  it('rejects unexpected fields', () => {
    const result = storeIdentityUpdateSchema.safeParse({
      name: 'Baseline Tennis',
      description: 'Tennis equipment.',
      slug: 'another-slug',
    });

    expect(result.success).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Store location validation                                                  */
/* -------------------------------------------------------------------------- */

describe('storeLocationUpdateSchema', () => {
  it('accepts a valid location', () => {
    const result = storeLocationUpdateSchema.safeParse({
      location: {
        region: 'Centre',
        city: 'Yaounde',
        address: 'Central Yaounde',
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects a location with a missing city', () => {
    const result = storeLocationUpdateSchema.safeParse({
      location: {
        region: 'Centre',
        address: 'Central Yaounde',
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty address', () => {
    const result = storeLocationUpdateSchema.safeParse({
      location: {
        region: 'Centre',
        city: 'Yaounde',
        address: '  ',
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects unexpected location fields', () => {
    const result = storeLocationUpdateSchema.safeParse({
      location: {
        region: 'Centre',
        city: 'Yaounde',
        address: 'Central Yaounde',
        country: 'Cameroon',
      },
    });

    expect(result.success).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Store logo validation                                                      */
/* -------------------------------------------------------------------------- */

describe('storeLogoUpdateSchema', () => {
  it('accepts a valid HTTPS logo payload', () => {
    const result = storeLogoUpdateSchema.safeParse({
      logo: {
        publicId: 'tennis-xpress/stores/baseline-logo',
        secureUrl: 'https://res.cloudinary.com/example/image/upload/logo.png',
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts null to clear the logo', () => {
    const result = storeLogoUpdateSchema.safeParse({
      logo: null,
    });

    expect(result.success).toBe(true);
  });

  it('rejects a non-HTTPS logo URL', () => {
    const result = storeLogoUpdateSchema.safeParse({
      logo: {
        publicId: 'tennis-xpress/stores/baseline-logo',
        secureUrl: 'http://example.com/logo.png',
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects a missing public ID', () => {
    const result = storeLogoUpdateSchema.safeParse({
      logo: {
        secureUrl: 'https://res.cloudinary.com/example/image/upload/logo.png',
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects unexpected logo fields', () => {
    const result = storeLogoUpdateSchema.safeParse({
      logo: {
        publicId: 'tennis-xpress/stores/baseline-logo',
        secureUrl: 'https://res.cloudinary.com/example/image/upload/logo.png',
        unrelatedField: true,
      },
    });

    expect(result.success).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Store delivery options validation                                          */
/* -------------------------------------------------------------------------- */

describe('storeDeliveryOptionsUpdateSchema', () => {
  it('accepts valid delivery options', () => {
    const result = storeDeliveryOptionsUpdateSchema.safeParse({
      deliveryOptions: [
        {
          name: 'Standard delivery',
          description: 'Delivery within three business days.',
          fee: 2500,
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('accepts an empty delivery options array', () => {
    const result = storeDeliveryOptionsUpdateSchema.safeParse({
      deliveryOptions: [],
    });

    expect(result.success).toBe(true);
  });

  it('accepts a zero delivery fee', () => {
    const result = storeDeliveryOptionsUpdateSchema.safeParse({
      deliveryOptions: [
        {
          name: 'Free delivery',
          description: 'No delivery charge.',
          fee: 0,
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects a negative delivery fee', () => {
    const result = storeDeliveryOptionsUpdateSchema.safeParse({
      deliveryOptions: [
        {
          name: 'Standard delivery',
          description: 'Delivery within three business days.',
          fee: -100,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects a non-finite delivery fee', () => {
    const result = storeDeliveryOptionsUpdateSchema.safeParse({
      deliveryOptions: [
        {
          name: 'Standard delivery',
          description: 'Delivery within three business days.',
          fee: Number.POSITIVE_INFINITY,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty delivery option name', () => {
    const result = storeDeliveryOptionsUpdateSchema.safeParse({
      deliveryOptions: [
        {
          name: ' ',
          description: 'Delivery within three business days.',
          fee: 2500,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects unexpected delivery option fields', () => {
    const result = storeDeliveryOptionsUpdateSchema.safeParse({
      deliveryOptions: [
        {
          name: 'Standard delivery',
          description: 'Delivery within three business days.',
          fee: 2500,
          isFree: false,
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Store collection options validation                                        */
/* -------------------------------------------------------------------------- */

describe('storeCollectionOptionsUpdateSchema', () => {
  it('accepts valid collection options', () => {
    const result = storeCollectionOptionsUpdateSchema.safeParse({
      collectionOptions: [
        {
          name: 'Store pickup',
          description: 'Collect your order at our store.',
          fee: 0,
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('accepts an empty collection options array', () => {
    const result = storeCollectionOptionsUpdateSchema.safeParse({
      collectionOptions: [],
    });

    expect(result.success).toBe(true);
  });

  it('rejects a negative collection fee', () => {
    const result = storeCollectionOptionsUpdateSchema.safeParse({
      collectionOptions: [
        {
          name: 'Store pickup',
          description: 'Collect your order at our store.',
          fee: -1,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects a missing collection option description', () => {
    const result = storeCollectionOptionsUpdateSchema.safeParse({
      collectionOptions: [
        {
          name: 'Store pickup',
          fee: 0,
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Store return policy validation                                             */
/* -------------------------------------------------------------------------- */

describe('storeReturnPolicyUpdateSchema', () => {
  it('accepts a valid return policy', () => {
    const result = storeReturnPolicyUpdateSchema.safeParse({
      returnPolicy: {
        summary: 'Returns accepted for eligible items.',
        returnWindowDays: 14,
        conditions: ['Item must be unused.', 'Original packaging required.'],
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts null to clear the return policy', () => {
    const result = storeReturnPolicyUpdateSchema.safeParse({
      returnPolicy: null,
    });

    expect(result.success).toBe(true);
  });

  it('accepts a zero-day return window', () => {
    const result = storeReturnPolicyUpdateSchema.safeParse({
      returnPolicy: {
        summary: 'No returns after purchase.',
        returnWindowDays: 0,
        conditions: [],
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects a negative return window', () => {
    const result = storeReturnPolicyUpdateSchema.safeParse({
      returnPolicy: {
        summary: 'Returns accepted.',
        returnWindowDays: -1,
        conditions: [],
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects a fractional return window', () => {
    const result = storeReturnPolicyUpdateSchema.safeParse({
      returnPolicy: {
        summary: 'Returns accepted.',
        returnWindowDays: 1.5,
        conditions: [],
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty return policy summary', () => {
    const result = storeReturnPolicyUpdateSchema.safeParse({
      returnPolicy: {
        summary: ' ',
        returnWindowDays: 14,
        conditions: [],
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty condition', () => {
    const result = storeReturnPolicyUpdateSchema.safeParse({
      returnPolicy: {
        summary: 'Returns accepted.',
        returnWindowDays: 14,
        conditions: ['  '],
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects unexpected return policy fields', () => {
    const result = storeReturnPolicyUpdateSchema.safeParse({
      returnPolicy: {
        summary: 'Returns accepted.',
        returnWindowDays: 14,
        conditions: [],
        approvedByAdmin: true,
      },
    });

    expect(result.success).toBe(false);
  });
});
