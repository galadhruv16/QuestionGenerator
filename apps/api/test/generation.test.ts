import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import {
  buildGenerationPlan,
  computeStemSimilarity,
} from '../src/services/question-generator.js';

describe('generation planner and routes', () => {
  const dummyProjectId = '123e4567-e89b-12d3-a456-426614174000';
  const dummyRunId = '223e4567-e89b-12d3-a456-426614174000';

  it('accurately computes stem similarity for deduplication policy enforcement', () => {
    // 1. Exact match returns 1.0
    const exact = computeStemSimilarity(
      'How does the Banker algorithm prevent deadlock?',
      'How does the Banker algorithm prevent deadlock?',
    );
    expect(exact).toBe(1.0);

    // 2. Normalization: different casing and punctuation returns 1.0
    const normalized = computeStemSimilarity(
      'How does the Banker Algorithm prevent deadlock?!',
      'how does the banker algorithm prevent deadlock',
    );
    expect(normalized).toBe(1.0);

    // 3. High overlap returns > 0.82
    const highOverlap = computeStemSimilarity(
      'In distributed systems how does the Banker algorithm prevent deadlock in threads',
      'In distributed systems how does the Banker algorithm prevent deadlock for threads',
    );
    expect(highOverlap).toBeGreaterThan(0.82);

    // 4. Distinct concepts return low similarity
    const distinct = computeStemSimilarity(
      'Explain how singly linked lists implement pointer reversal',
      'Describe Coffman conditions required for mutual exclusion deadlocks',
    );
    expect(distinct).toBeLessThan(0.25);
  });

  it('decomposes blueprint configuration into discrete per-question plan targets', () => {
    const config = {
      bloom: { analyze: 50, apply: 50 },
      difficulty: { EASY: 20, HARD: 30, MEDIUM: 50 },
      duplicate_policy: 'PREVENT' as const,
      model_name: 'llama3',
      question_count: 5,
      styles: { ANALYTICAL: 50, SCENARIO: 50 },
      temperature: 0.15,
      topics: { topic1: 60, topic2: 40 },
      types: { MCQ: 60, SHORT_ANSWER: 40 },
    };

    const targets = buildGenerationPlan(config, ['topic1', 'topic2']);
    expect(targets).toHaveLength(5);
    expect(targets[0]!.sequenceNumber).toBe(1);
    expect(targets[4]!.sequenceNumber).toBe(5);
    for (const t of targets) {
      expect(['analyze', 'apply']).toContain(t.bloomSlug);
      expect(['EASY', 'MEDIUM', 'HARD']).toContain(t.difficultySlug);
      expect(['MCQ', 'SHORT_ANSWER']).toContain(t.typeSlug);
    }
  });

  it('rejects unauthenticated presets list requests', async () => {
    const response = await request(createApp()).get(
      `/api/v1/projects/${dummyProjectId}/presets`,
    );

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required.',
      },
    });
  });

  it('rejects unauthenticated presets create requests', async () => {
    const response = await request(createApp())
      .post(`/api/v1/projects/${dummyProjectId}/presets`)
      .send({
        configuration: {
          question_count: 10,
        },
        name: 'Custom Preset',
      });

    expect(response.status).toBe(401);
  });

  it('rejects unauthenticated blueprints list requests', async () => {
    const response = await request(createApp()).get(
      `/api/v1/projects/${dummyProjectId}/blueprints`,
    );

    expect(response.status).toBe(401);
  });

  it('rejects unauthenticated blueprints create requests', async () => {
    const response = await request(createApp())
      .post(`/api/v1/projects/${dummyProjectId}/blueprints`)
      .send({
        configuration: {
          question_count: 10,
        },
        name: 'Test Blueprint',
      });

    expect(response.status).toBe(401);
  });

  it('rejects unauthenticated generation-runs start requests', async () => {
    const response = await request(createApp())
      .post(`/api/v1/projects/${dummyProjectId}/generation-runs`)
      .send({
        configuration: {
          question_count: 10,
        },
      });

    expect(response.status).toBe(401);
  });

  it('rejects unauthenticated generation-runs get request', async () => {
    const response = await request(createApp()).get(
      `/api/v1/projects/${dummyProjectId}/generation-runs/${dummyRunId}`,
    );

    expect(response.status).toBe(401);
  });

  it('rejects unauthenticated questions list requests', async () => {
    const response = await request(createApp()).get(
      `/api/v1/projects/${dummyProjectId}/questions`,
    );

    expect(response.status).toBe(401);
  });

  it('rejects unauthenticated questions patch status requests', async () => {
    const response = await request(createApp())
      .patch(`/api/v1/projects/${dummyProjectId}/questions/${dummyRunId}`)
      .send({ status: 'ACCEPTED' });

    expect(response.status).toBe(401);
  });

  it('rejects unauthenticated questions bulk-status requests', async () => {
    const response = await request(createApp())
      .post(`/api/v1/projects/${dummyProjectId}/questions/bulk-status`)
      .send({
        question_ids: [dummyRunId],
        status: 'ACCEPTED',
      });

    expect(response.status).toBe(401);
  });

  it('rejects unauthenticated questions versions creation requests', async () => {
    const response = await request(createApp())
      .post(`/api/v1/projects/${dummyProjectId}/questions/${dummyRunId}/versions`)
      .send({
        question_text: 'What is a distributed commit protocol?',
      });

    expect(response.status).toBe(401);
  });
});
