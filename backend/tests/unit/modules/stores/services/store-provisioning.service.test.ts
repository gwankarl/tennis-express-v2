import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

import { StoreModel } from '../../../../../src/modules/stores/models/store.model.js';
import { StoreProvisioningService } from '../../../../../src/modules/stores/services/store-provisioning.service.js';

import type { Store } from '../../../../../src/modules/stores/types/store.types.js';

/*
 * Mock the Store model so these tests focus on provisioning logic without
 * requiring a database connection.
 */
vi.mock('../../../../../src/modules/stores/models/store.model.js', () => ({
  StoreModel: {
    findOne: vi.fn(),
    exists: vi.fn(),
    create: vi.fn(),
  },
}));

type MockQuery<T> = {
  exec: ReturnType<typeof vi.fn>;
  session: ReturnType<typeof vi.fn>;
  then: (
    resolve: (value: T) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

function createMockQuery<T>(result: T): MockQuery<T> {
  const query = {
    exec: vi.fn().mockResolvedValue(result),
    session: vi.fn(),
    then: (
      resolve: (value: T) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };

  query.session.mockReturnValue(query);

  return query;
}

function createStore(overrides: Partial<Store> = {}): Store {
  return {
    _id: new Types.ObjectId(),
    sellerId: new Types.ObjectId(),
    name: 'Baseline Tennis',
    slug: 'baseline-tennis',
    description: 'Tennis equipment and accessories',
    location: {
      region: 'Centre',
      city: 'Yaounde',
      address: 'Central Yaounde',
    },
    logo: null,
    status: 'paused',
    deliveryOptions: [],
    collectionOptions: [],
    returnPolicy: null,
    ratingSummary: {
      averageRating: 0,
      totalReviews: 0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createStoreDocument(store: Store) {
  return {
    toObject: vi.fn().mockReturnValue(store),
  };
}

describe('StoreProvisioningService', () => {
  let service: StoreProvisioningService;
  let sellerId: string;

  beforeEach(() => {
    vi.clearAllMocks();

    service = new StoreProvisioningService();
    sellerId = new Types.ObjectId().toString();

    vi.mocked(StoreModel.findOne).mockReturnValue(
      createMockQuery(null) as never,
    );

    vi.mocked(StoreModel.exists).mockReturnValue(
      createMockQuery(null) as never,
    );

    vi.mocked(StoreModel.create).mockResolvedValue(
      createStoreDocument(createStore()) as never,
    );
  });

  it('should create a paused storefront with default settings', async () => {
    const store = createStore();

    vi.mocked(StoreModel.create).mockResolvedValue(
      createStoreDocument(store) as never,
    );

    const result = await service.provisionStore({
      sellerId,
      name: 'Baseline Tennis',
      description: 'Tennis equipment and accessories',
      location: {
        region: 'Centre',
        city: 'Yaounde',
        address: 'Central Yaounde',
      },
    });

    expect(result).toEqual(store);

    expect(StoreModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sellerId: expect.any(Types.ObjectId),
        name: 'Baseline Tennis',
        slug: 'baseline-tennis',
        status: 'paused',
        logo: null,
        deliveryOptions: [],
        collectionOptions: [],
        returnPolicy: null,
        ratingSummary: {
          averageRating: 0,
          totalReviews: 0,
        },
      }),
    );
  });

  it('should return an existing storefront without creating another', async () => {
    const existingStore = createStore();

    vi.mocked(StoreModel.findOne).mockReturnValue(
      createMockQuery(createStoreDocument(existingStore)) as never,
    );

    const result = await service.provisionStore({
      sellerId: existingStore.sellerId.toString(),
      name: existingStore.name,
      description: existingStore.description,
      location: existingStore.location,
    });

    expect(result).toEqual(existingStore);
    expect(StoreModel.create).not.toHaveBeenCalled();
  });

  it('should append a suffix when a slug is already taken', async () => {
    vi.mocked(StoreModel.exists)
      .mockReturnValueOnce(
        createMockQuery({ _id: new Types.ObjectId() }) as never,
      )
      .mockReturnValueOnce(createMockQuery(null) as never);

    const store = createStore({
      slug: 'baseline-tennis-2',
    });

    vi.mocked(StoreModel.create).mockResolvedValue(
      createStoreDocument(store) as never,
    );

    await service.provisionStore({
      sellerId,
      name: 'Baseline Tennis',
      description: 'Tennis equipment and accessories',
      location: {
        region: 'Centre',
        city: 'Yaounde',
        address: 'Central Yaounde',
      },
    });

    expect(StoreModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'baseline-tennis-2',
      }),
    );
  });

  it('should reject an invalid seller ID', async () => {
    await expect(
      service.provisionStore({
        sellerId: 'invalid-id',
        name: 'Baseline Tennis',
        description: 'Tennis equipment and accessories',
        location: {
          region: 'Centre',
          city: 'Yaounde',
          address: 'Central Yaounde',
        },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_SELLER_ID',
    });

    expect(StoreModel.findOne).not.toHaveBeenCalled();
    expect(StoreModel.create).not.toHaveBeenCalled();
  });

  it('should reject an empty store name', async () => {
    await expect(
      service.provisionStore({
        sellerId,
        name: '   ',
        description: 'Tennis equipment and accessories',
        location: {
          region: 'Centre',
          city: 'Yaounde',
          address: 'Central Yaounde',
        },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_STORE_DETAILS',
    });
  });

  it('should reject an empty store description', async () => {
    await expect(
      service.provisionStore({
        sellerId,
        name: 'Baseline Tennis',
        description: '   ',
        location: {
          region: 'Centre',
          city: 'Yaounde',
          address: 'Central Yaounde',
        },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_STORE_DETAILS',
    });
  });

  it('should reject a store name that cannot produce a slug', async () => {
    await expect(
      service.provisionStore({
        sellerId,
        name: '東京',
        description: 'Tennis equipment and accessories',
        location: {
          region: 'Centre',
          city: 'Yaounde',
          address: 'Central Yaounde',
        },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_STORE_NAME',
    });

    expect(StoreModel.create).not.toHaveBeenCalled();
  });

  it('should return the existing storefront if another request creates it concurrently', async () => {
    const existingStore = createStore();

    vi.mocked(StoreModel.create).mockRejectedValue({
      code: 11000,
      keyPattern: { sellerId: 1 },
      keyValue: { sellerId: existingStore.sellerId },
    });

    vi.mocked(StoreModel.findOne)
      .mockReturnValueOnce(createMockQuery(null) as never)
      .mockReturnValueOnce(
        createMockQuery(createStoreDocument(existingStore)) as never,
      );

    const result = await service.provisionStore({
      sellerId: existingStore.sellerId.toString(),
      name: existingStore.name,
      description: existingStore.description,
      location: existingStore.location,
    });

    expect(result).toEqual(existingStore);
    expect(StoreModel.findOne).toHaveBeenCalledTimes(2);
  });
});
