import 'vitest';

declare module 'vitest' {
  interface ProvidedContext {
    mongodbUri: string;
  }
}
