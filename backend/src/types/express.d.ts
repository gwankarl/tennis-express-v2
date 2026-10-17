import type { UserRole } from '../modules/users/types/user.types.js';

/** Identity established by successful access-token authentication. */
export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
  roles: UserRole[];
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
    }
  }
}

export {};
