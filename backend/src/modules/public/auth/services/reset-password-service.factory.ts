import { ResetPasswordService } from './reset-password.service.js';

export function createResetPasswordService(): ResetPasswordService {
  return new ResetPasswordService();
}
