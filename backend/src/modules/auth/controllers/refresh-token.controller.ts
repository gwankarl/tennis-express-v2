import type { Request, Response } from 'express';

import { AuthTokenService } from '../services/auth-token.service.js';

/** Handles requests to refresh an authentication token pair. */
export class RefreshTokenController {
  constructor(private readonly authTokenService = new AuthTokenService()) {}

  /**
   * Rotates a refresh token and returns the replacement token pair.
   */
  async refresh(req: Request, res: Response): Promise<Response> {
    const { refreshToken } = req.body as { refreshToken: string };

    const tokens = await this.authTokenService.refreshToken(refreshToken);

    return res.status(200).json({
      success: true,
      data: tokens,
    });
  }
}
