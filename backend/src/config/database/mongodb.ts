import mongoose from 'mongoose';
import { env } from '../env.js';

// Establish the application's MongoDB connection.
export async function connectToDatabase(): Promise<void> {
  try {
    await mongoose.connect(env.mongodbUri);

    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed');

    throw error;
  }
}

// Close the MongoDB connection during application shutdown.
export async function disconnectFromDatabase(): Promise<void> {
  await mongoose.disconnect();

  console.log('MongoDB disconnected');
}
