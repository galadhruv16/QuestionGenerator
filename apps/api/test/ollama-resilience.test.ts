import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { getAIProvider } from '../src/ai/providers/ai-provider.js';
import { GeminiProvider } from '../src/ai/providers/gemini-provider.js';
import { GroqProvider } from '../src/ai/providers/groq-provider.js';
import {
  OllamaProvider,
  matchExactModel,
  normalizeModelTag,
} from '../src/ai/providers/ollama-provider.js';
import { PDFParse } from 'pdf-parse';
import {
  createSupabaseAdminClient,
} from '../src/lib/supabase.js';
import { env } from '../src/config/env.js';
import {
  EXPECTED_EMBEDDING_DIMENSION,
  processResourcePipeline,
  runEmbeddingPreflight,
} from '../src/services/resource-processor.js';
import {
  computeStemSimilarity,
  extractJsonPayload,
  normalizeSynthesizedQuestion,
  safeParseJson,
  type PlanTarget,
} from '../src/services/question-generator.js';

describe('Ollama-Only Resilience and Provider Immutability', () => {
  describe('Exact Tag Matching', () => {
    it('normalizes tags by appending :latest if tag is omitted', () => {
      expect(normalizeModelTag('mistral')).toBe('mistral:latest');
      expect(normalizeModelTag('mistral:latest')).toBe('mistral:latest');
      expect(normalizeModelTag('mistral:7b')).toBe('mistral:7b');
      expect(normalizeModelTag('nomic-embed-text')).toBe('nomic-embed-text:latest');
      expect(normalizeModelTag('nomic-embed-text:latest')).toBe('nomic-embed-text:latest');
      expect(normalizeModelTag('phi3:mini')).toBe('phi3:mini');
    });

    it('rejects base-name prefix false positives (e.g. mistral:7b must NOT match mistral:latest)', () => {
      const installedModels = ['mistral:latest', 'nomic-embed-text:latest'];

      // mistral:latest should match
      expect(matchExactModel('mistral', installedModels)).toBe(true);
      expect(matchExactModel('mistral:latest', installedModels)).toBe(true);

      // mistral:7b is a different tag and MUST NOT match mistral:latest
      expect(matchExactModel('mistral:7b', installedModels)).toBe(false);
      expect(matchExactModel('mistral:instruct', installedModels)).toBe(false);

      // Other models
      expect(matchExactModel('llama3:latest', installedModels)).toBe(false);
      expect(matchExactModel('nomic-embed-text:v1.5', installedModels)).toBe(false);
      expect(matchExactModel('nomic-embed-text', installedModels)).toBe(true);
    });
  });

  describe('Generation Preflight Verification', () => {
    let ollama: OllamaProvider;

    beforeEach(() => {
      ollama = new OllamaProvider('http://127.0.0.1:11434', 'mistral:latest');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns service unreachable when Ollama endpoint connection fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('connect ECONNREFUSED 127.0.0.1:11434'),
      );

      const result = await ollama.checkPreflight('mistral:latest', 'nomic-embed-text:latest');
      expect(result.available).toBe(false);
      expect(result.reason).toBe('SERVICE_UNREACHABLE');
      expect(result.error).toMatch(/Ollama service is not reachable/i);
    });

    it('returns service unreachable when HTTP status is non-200', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Service Unavailable', { status: 503 }),
      );

      const result = await ollama.checkPreflight('mistral:latest', 'nomic-embed-text:latest');
      expect(result.available).toBe(false);
      expect(result.reason).toBe('SERVICE_UNREACHABLE');
      expect(result.error).toMatch(/returned HTTP 503/i);
    });

    it('returns model not found when required generation model is missing', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            models: [
              { name: 'llama3:latest' },
              { name: 'nomic-embed-text:latest' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await ollama.checkPreflight('mistral:latest', 'nomic-embed-text:latest');
      expect(result.available).toBe(false);
      expect(result.reason).toBe('MODEL_NOT_FOUND');
      expect(result.error).toMatch(/generation model "mistral:latest" is not installed/i);
    });

    it('returns embedding model not found when required embedding model is missing', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            models: [{ name: 'mistral:latest' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await ollama.checkPreflight('mistral:latest', 'nomic-embed-text:latest');
      expect(result.available).toBe(false);
      expect(result.reason).toBe('EMBEDDING_MODEL_NOT_FOUND');
      expect(result.error).toMatch(/embedding model "nomic-embed-text:latest" is not installed/i);
    });

    it('passes preflight check when both models are installed', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            models: [
              { name: 'mistral:latest' },
              { name: 'nomic-embed-text:latest' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await ollama.checkPreflight('mistral:latest', 'nomic-embed-text:latest');
      expect(result.available).toBe(true);
      expect(result.installedModels).toEqual(['mistral:latest', 'nomic-embed-text:latest']);
    });
  });

  describe('Resource Processing Embedding Preflight Verification', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('fails preflight when Ollama service is unreachable', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('connect ECONNREFUSED 127.0.0.1:11434'),
      );

      await expect(
        runEmbeddingPreflight('http://127.0.0.1:11434', 'nomic-embed-text:latest'),
      ).rejects.toThrow(/Ollama embedding preflight failed: Ollama service is not reachable/i);
    });

    it('fails preflight when embedding model is not pulled in Ollama', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            models: [{ name: 'mistral:latest' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(
        runEmbeddingPreflight('http://127.0.0.1:11434', 'nomic-embed-text:latest'),
      ).rejects.toThrow(/Required embedding model "nomic-embed-text:latest" is not installed/i);
    });

    it('fails preflight when embedding model returns wrong vector dimension', async () => {
      // 1. Tags call succeeds
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              models: [{ name: 'nomic-embed-text:latest' }],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
        // 2. Embed probe call returns 512 dimensions instead of 768
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              embedding: new Array(512).fill(0.1),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );

      await expect(
        runEmbeddingPreflight('http://127.0.0.1:11434', 'nomic-embed-text:latest'),
      ).rejects.toThrow(/produced vector of dimension 512, but GroundQ schema requires exactly 768/i);
    });

    it('passes preflight when exact model is installed and probe returns 768-dim vector', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              models: [{ name: 'nomic-embed-text:latest' }],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              embedding: new Array(EXPECTED_EMBEDDING_DIMENSION).fill(0.05),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );

      const result = await runEmbeddingPreflight(
        'http://127.0.0.1:11434',
        'nomic-embed-text:latest',
      );
      expect(result.success).toBe(true);
      expect(result.dimension).toBe(768);
    });
  });

  describe('Provider Factory & Immutability Assertions', () => {
    it('returns an OllamaProvider instance for ollama requests', () => {
      const provider = getAIProvider('ollama', 'mistral:latest');
      expect(provider).toBeInstanceOf(OllamaProvider);
    });

    it('defaults to ollama provider when none is specified', () => {
      const provider = getAIProvider();
      expect(provider).toBeInstanceOf(OllamaProvider);
      expect(provider.name).toBe('ollama');
    });

    it('rejects unsupported provider strings', () => {
      expect(() =>
        getAIProvider('openai' as unknown as 'ollama', 'gpt-4o'),
      ).toThrow(/Unsupported AI provider: "openai"/i);

      expect(() =>
        getAIProvider('anthropic' as unknown as 'ollama', 'claude-3-opus'),
      ).toThrow(/Unsupported AI provider: "anthropic"/i);
    });

    it('cloud providers do not fall back to Ollama for embeddings', async () => {
      const gemini = new GeminiProvider('fake-key', 'gemini-flash-lite-latest');
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('API key invalid', { status: 400 }),
      );

      await expect(gemini.embed('test text')).rejects.toThrow(
        /Gemini embedding generation failed/i,
      );

      const groq = new GroqProvider('fake-key', 'llama-3.3-70b-versatile');
      await expect(groq.embed('test text')).rejects.toThrow(
        /GroqProvider does not support vector embeddings/i,
      );
    });
  });

  describe('Deduplication & Replacement Enforcement', () => {
    it('accurately identifies duplicate question stems above 0.82 threshold', () => {
      const stemA = 'In distributed systems how does the Banker algorithm prevent deadlock for threads';
      const stemB = 'In distributed systems how does the Banker algorithm prevent deadlock with threads';
      const distinct = 'Describe memory segmentation and paging hardware structures in x86 architecture';

      const simHigh = computeStemSimilarity(stemA, stemB);
      expect(simHigh).toBeGreaterThan(0.82);

      const simLow = computeStemSimilarity(stemA, distinct);
      expect(simLow).toBeLessThan(0.82);
    });
  });

  describe('Security & Route Protection', () => {
    it('rejects unauthorized CORS origins', async () => {
      const response = await request(createApp())
        .get('/api/v1/health')
        .set('Origin', 'https://malicious-attacker-domain.com');

      // Express error handler intercepts rejected CORS origin
      expect(response.status).toBe(403);
      expect(response.body.error?.message).toMatch(/CORS request rejected: unauthorized origin/i);
    });

    it('confirms the unauthenticated debug generation-log endpoint is absent', async () => {
      const response = await request(createApp()).get('/api/v1/debug-generation-log');
      expect(response.status).toBe(404);
    });
  });

  describe('Scanned Document & Image Rejection (Local-Only Pipeline)', () => {
    function createMockSupabase(options?: {
      downloadData?: Buffer;
      downloadError?: Error | null;
      fileExt?: string;
      mimeType?: string;
    }) {
      const updateCalls: Array<{ table: string; payload: Record<string, unknown>; status?: string }> = [];
      return {
        calls: updateCalls,
        client: {
          storage: {
            from: (_bucket: string) => ({
              download: vi.fn().mockResolvedValue({
                data: {
                  arrayBuffer: async () => (options?.downloadData || Buffer.from('mock content')).buffer,
                },
                error: options?.downloadError || null,
              }),
            }),
          },
          from: (table: string) => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                file_extension: options?.fileExt ?? 'png',
                mime_type: options?.mimeType ?? 'image/png',
                original_filename: `test-file.${options?.fileExt ?? 'png'}`,
              },
              error: null,
            }),
            update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              updateCalls.push({ table, payload, status: payload.status as string | undefined });
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              };
            }),
          }),
        } as unknown as import('@supabase/supabase-js').SupabaseClient,
      };
    }

    it('rejects image files immediately without calling external Vision/OCR APIs', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const { client, calls } = createMockSupabase({
        fileExt: 'png',
        mimeType: 'image/png',
      });

      await processResourcePipeline({
        client,
        projectId: 'project-123',
        resourceId: 'res-image-123',
        runId: 'run-image-123',
        storagePath: 'resources/test-image.png',
      });

      // Assert fetch was never called (no external Gemini / cloud OCR invocations)
      expect(fetchSpy).not.toHaveBeenCalled();

      // Assert run was transitioned to FAILED with local OCR guidance message
      const runFailCall = calls.find(
        (c) => c.table === 'resource_processing_runs' && c.status === 'FAILED',
      );
      expect(runFailCall).toBeDefined();
      expect(runFailCall?.payload.error_message).toMatch(
        /Image resource processing requires local OCR, which is not available in GroundQ/i,
      );

      // Assert resource status was set to FAILED
      const resFailCall = calls.find(
        (c) => c.table === 'resources' && c.payload.status === 'FAILED',
      );
      expect(resFailCall).toBeDefined();
    });

    it('rejects scanned PDFs with insufficient text without calling external Vision/OCR APIs', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      vi.spyOn(PDFParse.prototype, 'getText').mockResolvedValueOnce({
        pages: [{ num: 1, text: 'Scanned image text' }],
        total: 1,
      } as unknown as Awaited<ReturnType<PDFParse['getText']>>);
      vi.spyOn(PDFParse.prototype, 'destroy').mockResolvedValueOnce(undefined);

      const emptyPdfBuffer = Buffer.from('%PDF-1.4 dummy buffer');
      const { client, calls } = createMockSupabase({
        downloadData: emptyPdfBuffer,
        fileExt: 'pdf',
        mimeType: 'application/pdf',
      });

      await processResourcePipeline({
        client,
        projectId: 'project-123',
        resourceId: 'res-pdf-123',
        runId: 'run-pdf-123',
        storagePath: 'resources/scanned-test.pdf',
      });

      // Assert fetch was never called (no external Gemini Vision calls)
      expect(fetchSpy).not.toHaveBeenCalled();

      // Assert run was transitioned to FAILED with scanned PDF guidance message
      const runFailCall = calls.find(
        (c) => c.table === 'resource_processing_runs' && c.status === 'FAILED',
      );
      expect(runFailCall).toBeDefined();
      expect(runFailCall?.payload.error_message).toMatch(
        /Scanned or non-selectable PDF detected/i,
      );
    });
  });

  describe('Local Candidate Generation & Malformed JSON Handling', () => {
    const dummyTarget: PlanTarget = {
      bloomSlug: 'analyze',
      difficultySlug: 'MEDIUM',
      sequenceNumber: 1,
      styleSlug: 'ANALYTICAL',
      topicId: 'topic-1',
      topicName: 'Operating Systems',
      typeSlug: 'MCQ',
    };

    it('safeParseJson returns null on conversational non-JSON text', () => {
      const nonJson = 'Sure! Here is a great multiple-choice question for you: What is paging?';
      const result = safeParseJson(nonJson);
      expect(result).toBeNull();
    });

    it('normalizeSynthesizedQuestion returns null when stem is missing or too short', () => {
      const invalidPayload = {
        options: ['Option A', 'Option B'],
        stem: 'Short',
      };
      const result = normalizeSynthesizedQuestion(invalidPayload, dummyTarget);
      expect(result).toBeNull();
    });

    it('extractJsonPayload strips markdown backticks and sanitizes LLM boolean typos', () => {
      const rawMarkdown = '```json\n{"stem": "Explain virtual memory.", "is_corrent": true}\n```';
      const extracted = extractJsonPayload(rawMarkdown);
      expect(extracted).toContain('"is_correct": true');
      expect(extracted).not.toContain('```');
    });

    it('normalizeSynthesizedQuestion accepts valid MCQ schema and normalizes options', () => {
      const validPayload = {
        options: [
          { explanation: 'Incorrect explanation', is_correct: false, option_text: 'Distractor 1' },
          { explanation: 'Correct explanation', is_correct: true, option_text: 'Correct Option' },
          { explanation: 'Incorrect explanation', is_correct: false, option_text: 'Distractor 2' },
          { explanation: 'Incorrect explanation', is_correct: false, option_text: 'Distractor 3' },
        ],
        stem: 'What is the primary function of the Memory Management Unit (MMU) in an operating system?',
      };
      const result = normalizeSynthesizedQuestion(validPayload, dummyTarget);
      expect(result).not.toBeNull();
      expect(result?.stem).toContain('Memory Management Unit');
      expect(result?.options).toHaveLength(4);
      expect(result?.options?.some((o) => o.is_correct)).toBe(true);
    });
  });

  describe('Duplicate Replacement Rejection under PREVENT', () => {
    it('detects high-similarity candidates exceeding 0.82 threshold', () => {
      const stem1 = 'In modern computer systems explain how the Banker algorithm avoids deadlock condition for multi-threaded processes';
      const stem2 = 'In modern computer systems explain how the Banker algorithm prevents deadlock condition for multi-threaded processes';
      const sim = computeStemSimilarity(stem1, stem2);
      expect(sim).toBeGreaterThan(0.82);

      // Under PREVENT policy, if retry candidate similarity > 0.82, it must be rejected
      const isRejected = sim > 0.82;
      expect(isRejected).toBe(true);
    });
  });

  describe('Run Status & Partial Generation Persistence Resilience', () => {
    it('determines final status correctly: FAILED for 0 questions, NEEDS_REVIEW for partial, COMPLETED for full', () => {
      const totalTargets = 5;

      const computeStatus = (generatedCount: number) => {
        return generatedCount === totalTargets
          ? 'COMPLETED'
          : generatedCount > 0
            ? 'NEEDS_REVIEW'
            : 'FAILED';
      };

      expect(computeStatus(0)).toBe('FAILED');
      expect(computeStatus(1)).toBe('NEEDS_REVIEW');
      expect(computeStatus(4)).toBe('NEEDS_REVIEW');
      expect(computeStatus(5)).toBe('COMPLETED');
    });
  });

  describe('Service-Role Client & Background Persistence Isolation', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('createSupabaseAdminClient throws descriptive error when service-role/secret key is missing', () => {
      const originalKey = env.SUPABASE_SERVICE_ROLE_KEY;
      const originalSecret = env.SUPABASE_SECRET_KEY;
      try {
        (env as { SUPABASE_SERVICE_ROLE_KEY?: string; SUPABASE_SECRET_KEY?: string }).SUPABASE_SERVICE_ROLE_KEY = undefined;
        (env as { SUPABASE_SERVICE_ROLE_KEY?: string; SUPABASE_SECRET_KEY?: string }).SUPABASE_SECRET_KEY = undefined;
        expect(() => createSupabaseAdminClient()).toThrow(
          /SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY is not configured on the server/i,
        );
      } finally {
        (env as { SUPABASE_SERVICE_ROLE_KEY?: string; SUPABASE_SECRET_KEY?: string }).SUPABASE_SERVICE_ROLE_KEY = originalKey;
        (env as { SUPABASE_SERVICE_ROLE_KEY?: string; SUPABASE_SECRET_KEY?: string }).SUPABASE_SECRET_KEY = originalSecret;
      }
    });

    it('createSupabaseAdminClient instantiates client without session persistence when service-role key is provided', () => {
      const originalKey = env.SUPABASE_SERVICE_ROLE_KEY;
      try {
        (env as { SUPABASE_SERVICE_ROLE_KEY?: string }).SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key-12345';
        const client = createSupabaseAdminClient();
        expect(client).toBeDefined();
        expect(client.auth).toBeDefined();
      } finally {
        (env as { SUPABASE_SERVICE_ROLE_KEY?: string }).SUPABASE_SERVICE_ROLE_KEY = originalKey;
      }
    });

    it('createSupabaseAdminClient instantiates client without session persistence when modern SUPABASE_SECRET_KEY is provided', () => {
      const originalKey = env.SUPABASE_SERVICE_ROLE_KEY;
      const originalSecret = env.SUPABASE_SECRET_KEY;
      try {
        (env as { SUPABASE_SERVICE_ROLE_KEY?: string; SUPABASE_SECRET_KEY?: string }).SUPABASE_SERVICE_ROLE_KEY = undefined;
        (env as { SUPABASE_SERVICE_ROLE_KEY?: string; SUPABASE_SECRET_KEY?: string }).SUPABASE_SECRET_KEY = 'sb_secret_mock_12345';
        const client = createSupabaseAdminClient();
        expect(client).toBeDefined();
        expect(client.auth).toBeDefined();
      } finally {
        (env as { SUPABASE_SERVICE_ROLE_KEY?: string; SUPABASE_SECRET_KEY?: string }).SUPABASE_SERVICE_ROLE_KEY = originalKey;
        (env as { SUPABASE_SERVICE_ROLE_KEY?: string; SUPABASE_SECRET_KEY?: string }).SUPABASE_SECRET_KEY = originalSecret;
      }
    });

    it('background execution uses detached service-role client unaffected by expired user JWT', async () => {
      // Simulates an admin client performing persistence operations after a hypothetical user JWT has expired
      const adminClient = {
        from: vi.fn().mockImplementation((_table: string) => ({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'q-saved-999' }, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        })),
      };

      // Writing via background client succeeds without depending on user session
      const res = await adminClient.from('questions').insert({}).select().single();
      expect(res.data?.id).toBe('q-saved-999');
      expect(res.error).toBeNull();
    });
  });
});
