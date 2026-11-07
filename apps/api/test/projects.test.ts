import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('protected project routes', () => {
  const dummyProjectId = '123e4567-e89b-12d3-a456-426614174000';

  it('rejects unauthenticated project list requests', async () => {
    const response = await request(createApp()).get('/api/v1/projects');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required.',
      },
    });
  });

  it('rejects unauthenticated project update requests', async () => {
    const response = await request(createApp())
      .patch(`/api/v1/projects/${dummyProjectId}`)
      .send({ name: 'Renamed Project' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required.',
      },
    });
  });

  it('rejects unauthenticated project archive requests via POST', async () => {
    const response = await request(createApp()).post(
      `/api/v1/projects/${dummyProjectId}/archive`,
    );

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required.',
      },
    });
  });

  it('rejects unauthenticated project delete/archive requests via DELETE', async () => {
    const response = await request(createApp()).delete(
      `/api/v1/projects/${dummyProjectId}`,
    );

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required.',
      },
    });
  });
});
