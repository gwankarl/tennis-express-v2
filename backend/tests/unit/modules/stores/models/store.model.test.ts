import { describe, expect, it } from 'vitest';

import { StoreModel } from '../../../../../src/modules/stores/models/store.model.js';

describe('StoreModel', () => {
  const validStore = {
    sellerId: '507f1f77bcf86cd799439011',
    name: 'Karlson Tennis Gear',
    slug: 'karlson-tennis-gear',
    description: 'Tennis equipment and accessories for players in Cameroon.',
    location: {
      region: 'Centre',
      city: 'Yaounde',
      address: 'Example Street',
    },
  };

  describe('validation', () => {
    it('should accept a valid store', async () => {
      const store = new StoreModel(validStore);

      await expect(store.validate()).resolves.toBeUndefined();
    });

    it('should require sellerId', async () => {
      const store = new StoreModel({
        ...validStore,
        sellerId: undefined,
      });

      await expect(store.validate()).rejects.toThrow();
    });

    it('should require the store name', async () => {
      const store = new StoreModel({
        ...validStore,
        name: undefined,
      });

      await expect(store.validate()).rejects.toThrow();
    });

    it('should reject an invalid slug', async () => {
      const store = new StoreModel({
        ...validStore,
        slug: 'Invalid Store Slug!',
      });

      await expect(store.validate()).rejects.toThrow();
    });

    it('should reject a rating above five', async () => {
      const store = new StoreModel({
        ...validStore,
        ratingSummary: {
          averageRating: 6,
          totalReviews: 1,
        },
      });

      await expect(store.validate()).rejects.toThrow();
    });

    it('should reject a negative delivery fee', async () => {
      const store = new StoreModel({
        ...validStore,
        deliveryOptions: [
          {
            name: 'Standard delivery',
            description: 'Delivery within the service area.',
            fee: -100,
          },
        ],
      });

      await expect(store.validate()).rejects.toThrow();
    });

    it('should reject a status outside the supported values', async () => {
      const store = new StoreModel({
        ...validStore,
        status: 'deleted',
      });

      await expect(store.validate()).rejects.toThrow();
    });
  });

  describe('defaults', () => {
    it('should initialize a new store as paused', () => {
      const store = new StoreModel(validStore);

      expect(store.status).toBe('paused');
    });

    it('should initialize optional collections and rating summary', () => {
      const store = new StoreModel(validStore);

      expect(store.logo).toBeNull();
      expect(store.returnPolicy).toBeNull();
      expect(store.deliveryOptions).toHaveLength(0);
      expect(store.collectionOptions).toHaveLength(0);
      expect(store.ratingSummary.averageRating).toBe(0);
      expect(store.ratingSummary.totalReviews).toBe(0);
    });
  });

  describe('indexes', () => {
    it('should enforce unique ownership and unique slugs', () => {
      const indexes = StoreModel.schema.indexes();

      expect(indexes).toEqual(
        expect.arrayContaining([
          [
            { sellerId: 1 },
            expect.objectContaining({
              unique: true,
              name: 'unique_store_per_seller',
            }),
          ],
          [
            { slug: 1 },
            expect.objectContaining({
              unique: true,
              name: 'unique_store_slug',
            }),
          ],
        ]),
      );
    });
  });
});
