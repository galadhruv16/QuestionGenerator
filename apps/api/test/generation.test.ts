import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { buildGenerationPlan } from '../src/services/question-generator.js';

describe('generation planner and routes', () => {
  const dummyProjectId = '123e4567-e89b-12d3-a456-426614174000';
  const dummyRunId = '223e4567-e89b-12d3-a456-426614174000';
  const dummyBlueprintId = '323e4567-e89b-12d3-a456-426614174000';
  const dummyPresetId = '423e4567-e89b-12d3-a456-426614174000';

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
});
