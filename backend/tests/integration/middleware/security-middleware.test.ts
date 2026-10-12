import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createTestApp } from '../../helpers/test-app.js';

describe('Security middleware', () => {
  const app = createTestApp();

  it('sets security headers', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBeDefined();
  });

  it('allows the configured frontend origin', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .set('Origin', process.env.CLIENT_URL || 'http://localhost:5173');

    expect(response.headers['access-control-allow-origin']).toBe(
      process.env.CLIENT_URL || 'http://localhost:5173',
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not allow an unconfigured frontend origin', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://untrusted.example');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects request bodies larger than the configured limit', async () => {
    const oversizedBody = JSON.stringify({
      data: 'a'.repeat(1024 * 1024 + 1),
    });

    const response = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send(oversizedBody);

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'REQUEST_TOO_LARGE',
        message: 'Request body exceeds the allowed size',
      },
    });
  });
});
