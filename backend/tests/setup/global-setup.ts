import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function globalSetup({
  provide,
}: {
  provide: (key: string, value: string) => void;
}) {
  const server = await MongoMemoryServer.create({
    binary: {
      version: '7.0.1',
    },
    instance: {
      dbName: 'tennis_xpress_test',
    },
  });

  provide('mongodbUri', server.getUri('tennis_xpress_test'));

  return async () => {
    await server.stop();
  };
}
