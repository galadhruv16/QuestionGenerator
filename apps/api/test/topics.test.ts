import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { inferTopicsFromChunks } from '../src/services/topic-inferencer.js';

describe('protected topic routes', () => {
  const dummyProjectId = '123e4567-e89b-12d3-a456-426614174000';
  const dummyTopicId = '223e4567-e89b-12d3-a456-426614174000';

  it('rejects unauthenticated topics list requests', async () => {
    const response = await request(createApp()).get(
      `/api/v1/projects/${dummyProjectId}/topics`,
    );

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required.',
      },
    });
  });

  it('rejects unauthenticated topic create requests', async () => {
    const response = await request(createApp())
      .post(`/api/v1/projects/${dummyProjectId}/topics`)
      .send({
        description: 'Deadlock avoidance primitives',
        name: "Banker's Algorithm",
        parent_id: null,
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required.',
      },
    });
  });

  it('rejects unauthenticated topic update requests', async () => {
    const response = await request(createApp())
      .patch(`/api/v1/projects/${dummyProjectId}/topics/${dummyTopicId}`)
      .send({
        name: 'Updated Topic Name',
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required.',
      },
    });
  });

  it('rejects unauthenticated topic reorder requests', async () => {
    const response = await request(createApp())
      .post(`/api/v1/projects/${dummyProjectId}/topics/reorder`)
      .send({
        items: [{ id: dummyTopicId, parent_id: null, sort_order: 1 }],
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required.',
      },
    });
  });

  it('rejects unauthenticated topic archive requests', async () => {
    const response = await request(createApp()).post(
      `/api/v1/projects/${dummyProjectId}/topics/${dummyTopicId}/archive`,
    );

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required.',
      },
    });
  });

  it('rejects unauthenticated topic infer requests', async () => {
    const response = await request(createApp()).post(
      `/api/v1/projects/${dummyProjectId}/topics/infer`,
    );

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required.',
      },
    });
  });

  it('rejects unauthenticated evidence fetch requests', async () => {
    const response = await request(createApp()).get(
      `/api/v1/projects/${dummyProjectId}/topics/${dummyTopicId}/evidence`,
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

describe('topic-inferencer service unit tests', () => {
  it('extracts heuristic 2-level topic hierarchy when chunks are provided', async () => {
    const sampleChunks = [
      {
        chunk_index: 0,
        id: 'c1',
        page_number: 1,
        text: 'Chapter 1: Operating System Foundations. A deadlock is a state where a set of processes are blocked.',
      },
      {
        chunk_index: 1,
        id: 'c2',
        page_number: 2,
        text: "Chapter 2: Mutual exclusion and Banker's algorithm safe sequence evaluation.",
      },
      {
        chunk_index: 2,
        id: 'c3',
        page_number: 3,
        text: 'Chapter 3: Distributed Consensus Protocols like Paxos and Raft replicated state machines.',
      },
    ];

    const result = await inferTopicsFromChunks(sampleChunks);

    expect(result.chunkCount).toBe(3);
    expect(result.modules.length).toBeGreaterThan(0);
    expect(result.modules[0]?.subtopics.length).toBeGreaterThan(0);
  });

  it('returns empty hierarchy when chunks array is empty', async () => {
    const result = await inferTopicsFromChunks([]);
    expect(result.chunkCount).toBe(0);
    expect(result.modules).toEqual([]);
  });
});
