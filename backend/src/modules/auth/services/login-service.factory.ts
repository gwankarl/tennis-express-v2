import { Argon2PasswordHasher } from './argon2-password-hasher.js';
import { LoginService } from './login.service.js';

/**
 * Builds the login service with application-configured dependencies.
 */
export function createLoginService(): LoginService {
  return new LoginService({
    passwordHasher: new Argon2PasswordHasher(),
  });
}
