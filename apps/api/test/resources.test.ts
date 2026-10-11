import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('protected resource routes', () => {
  const dummyProjectId = '123e4567-e89b-12d3-a456-426614174000';

  it('rejects unauthenticated resource list requests', async () => {
    const response = await request(createApp()).get(
      `/api/v1/projects/${dummyProjectId}/resources`,
    );

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required.',
      },
    });
  });

  it('rejects unauthenticated upload-init requests', async () => {
    const response = await request(createApp())
      .post(`/api/v1/projects/${dummyProjectId}/resources/upload-init`)
      .send({
        file_size_bytes: 1024,
        filename: 'syllabus.pdf',
        mime_type: 'application/pdf',
        resource_kind: 'SYLLABUS',
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required.',
      },
    });
  });

  it('rejects unauthenticated finalize requests', async () => {
    const response = await request(createApp())
      .post(`/api/v1/projects/${dummyProjectId}/resources`)
      .send({
        original_filename: 'syllabus.pdf',
        resource_id: dummyProjectId,
        resource_kind: 'SYLLABUS',
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required.',
      },
    });
  });

  it('rejects unauthenticated archive requests', async () => {
    const response = await request(createApp()).post(
      `/api/v1/projects/${dummyProjectId}/resources/${dummyProjectId}/archive`,
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
