import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('GET /api/v1/health', () => {
  it('returns the API health response', async () => {
    const response = await request(createApp()).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'groundq-api' });
  });
});

describe('protected project routes', () => {
  it('rejects requests without a bearer token', async () => {
    const response = await request(createApp()).get('/api/v1/projects');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required.',
      },
    });
  });
});
