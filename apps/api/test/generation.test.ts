import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import {
  allocateCounts,
  buildGenerationPlan,
  computeStemSimilarity,
  safeParseJson,
  shuffleOptions,
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

  it('deterministically shuffles MCQ options and eliminates Option B predictability bias', () => {
    const rawOptions = [
      { explanation: 'Incorrect A', is_correct: false, text: 'Distractor 1' },
      { explanation: 'Correct B', is_correct: true, text: 'Correct Answer' },
      { explanation: 'Incorrect C', is_correct: false, text: 'Distractor 2' },
      { explanation: 'Incorrect D', is_correct: false, text: 'Distractor 3' },
    ];

    // 1. Determinism check: same seed gives identical shuffle
    const shuffle1 = shuffleOptions(rawOptions, 42);
    const shuffle2 = shuffleOptions(rawOptions, 42);
    expect(shuffle1.map((o) => o.text)).toEqual(shuffle2.map((o) => o.text));

    // 2. Integrity check: preserves all items and exactly 1 correct answer
    expect(shuffle1).toHaveLength(4);
    expect(shuffle1.filter((o) => o.is_correct)).toHaveLength(1);

    // 3. Distribution check: correct option lands across diverse indices, not stuck at index 1 (Option B)
    const positionCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (let seq = 1; seq <= 40; seq++) {
      const res = shuffleOptions(rawOptions, seq);
      const correctIdx = res.findIndex((o) => o.is_correct);
      positionCounts[correctIdx] = (positionCounts[correctIdx] || 0) + 1;
    }

    // Must have hits on all 4 positions (A, B, C, D)
    expect(positionCounts[0]).toBeGreaterThan(2);
    expect(positionCounts[1]).toBeGreaterThan(2);
    expect(positionCounts[2]).toBeGreaterThan(2);
    expect(positionCounts[3]).toBeGreaterThan(2);
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

  it('guarantees 100% single-option allocation and completely excludes 0% weight options', () => {
    // 1. 100% Hard difficulty calibration
    const hardOnlyConfig = {
      bloom: { analyze: 100, apply: 0, evaluate: 0 },
      difficulty: { easy: 0, hard: 100, medium: 0 },
      duplicate_policy: 'PREVENT' as const,
      model_name: 'mistral:latest',
      question_count: 5,
      styles: { scenario: 100 },
      temperature: 0.15,
      topics: { t1: 100 },
      types: { long_answer: 0, mcq: 100, short_answer: 0 },
    };

    const targets = buildGenerationPlan(hardOnlyConfig, ['t1']);
    expect(targets).toHaveLength(5);
    for (const t of targets) {
      expect(t.difficultySlug).toBe('HARD');
      expect(t.typeSlug).toBe('MCQ');
      expect(t.bloomSlug).toBe('analyze');
      expect(t.styleSlug).toBe('SCENARIO');
    }

    // 2. 50/50 split across 2 options, excluding the 3rd
    const splitConfig = {
      bloom: { analyze: 50, apply: 50 },
      difficulty: { easy: 50, hard: 50, medium: 0 },
      duplicate_policy: 'PREVENT' as const,
      model_name: 'mistral:latest',
      question_count: 6,
      styles: { analytical: 50, scenario: 50 },
      temperature: 0.15,
      topics: { t1: 100 },
      types: { long_answer: 0, mcq: 50, short_answer: 50 },
    };

    const splitTargets = buildGenerationPlan(splitConfig, ['t1']);
    expect(splitTargets).toHaveLength(6);

    const difficulties = splitTargets.map((t) => t.difficultySlug);
    expect(difficulties.filter((d) => d === 'EASY')).toHaveLength(3);
    expect(difficulties.filter((d) => d === 'HARD')).toHaveLength(3);
    expect(difficulties.filter((d) => d === 'MEDIUM')).toHaveLength(0);

    const types = splitTargets.map((t) => t.typeSlug);
    expect(types.filter((t) => t === 'MCQ')).toHaveLength(3);
    expect(types.filter((t) => t === 'SHORT_ANSWER')).toHaveLength(3);
    expect(types.filter((t) => t === 'LONG_ANSWER')).toHaveLength(0);
  });

  it('allocates discrete integer counts using Hamilton largest remainder method', () => {
    // 5 items with 20% / 40% / 40%
    const counts = allocateCounts(
      { EASY: 20, HARD: 40, MEDIUM: 40 },
      5,
      'MEDIUM',
    );
    expect(counts).toHaveLength(5);
    expect(counts.filter((c) => c === 'EASY')).toHaveLength(1);
    expect(counts.filter((c) => c === 'HARD')).toHaveLength(2);
    expect(counts.filter((c) => c === 'MEDIUM')).toHaveLength(2);

    // Single item 100%
    const single = allocateCounts({ HARD: 100, MEDIUM: 0 }, 7, 'MEDIUM');
    expect(single).toHaveLength(7);
    expect(single.every((c) => c === 'HARD')).toBe(true);
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

  it('rejects unauthenticated questions regenerate requests', async () => {
    const response = await request(createApp())
      .post(`/api/v1/projects/${dummyProjectId}/questions/${dummyRunId}/regenerate`)
      .send({
        bloom_slug: 'analyze',
        difficulty_slug: 'HARD',
      });

    expect(response.status).toBe(401);
  });

  it('rejects unauthenticated questions bulk-regenerate requests', async () => {
    const response = await request(createApp())
      .post(`/api/v1/projects/${dummyProjectId}/questions/bulk-regenerate`)
      .send({
        question_ids: [dummyRunId],
        bloom_slug: 'analyze',
      });

    expect(response.status).toBe(401);
  });

  describe('safeParseJson truncation repair', () => {
    it('parses valid JSON string', () => {
      const parsed = safeParseJson('{"stem": "What is latent heat?", "question_type": "SHORT_ANSWER"}');
      expect(parsed).toEqual({
        stem: 'What is latent heat?',
        question_type: 'SHORT_ANSWER',
      });
    });

    it('automatically repairs JSON missing closing braces', () => {
      const truncated = '{"stem": "Explain dehumidification process in cooling towers.", "model_answer": "It involves heat exchange."';
      const parsed = safeParseJson(truncated);
      expect(parsed).toBeDefined();
      expect(parsed?.stem).toBe('Explain dehumidification process in cooling towers.');
      expect(parsed?.model_answer).toBe('It involves heat exchange.');
    });

    it('repairs JSON with unclosed trailing string and open brace', () => {
      const cutOff = '{"stem": "In the context of dehumidification, consider a situation where you need to choose';
      const parsed = safeParseJson(cutOff);
      expect(parsed).toBeDefined();
      expect(parsed?.stem).toContain('In the context of dehumidification');
    });
  });
});

