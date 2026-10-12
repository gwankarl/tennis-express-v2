import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, inject } from 'vitest';

const mongodbUri = inject('mongodbUri');

if (!mongodbUri) {
  throw new Error('Test MongoDB URI was not provided');
}

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = mongodbUri;
process.env.CLIENT_URL = 'http://localhost:5173';

beforeAll(async () => {
  const { connectToDatabase } =
    await import('../../src/config/database/mongodb.js');

  await connectToDatabase();
});

afterEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );
});

afterAll(async () => {
  const { disconnectFromDatabase } =
    await import('../../src/config/database/mongodb.js');

  await disconnectFromDatabase();
});
