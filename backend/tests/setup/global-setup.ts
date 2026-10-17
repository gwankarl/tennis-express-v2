import { MongoMemoryReplSet } from 'mongodb-memory-server';

export default async function globalSetup({
  provide,
}: {
  provide: (key: string, value: string) => void;
}) {
  const replicaSet = await MongoMemoryReplSet.create({
    binary: {
      version: '7.0.1',
    },
    replSet: {
      count: 1,
      dbName: 'tennis_xpress_test',
    },
  });

  provide('mongodbUri', replicaSet.getUri('tennis_xpress_test'));

  return async () => {
    await replicaSet.stop();
  };
}
