import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAIProvider } from '../src/ai/providers/ai-provider.js';
import { GeminiProvider } from '../src/ai/providers/gemini-provider.js';
import { GroqProvider } from '../src/ai/providers/groq-provider.js';
import {
  OllamaProvider,
  matchExactModel,
  normalizeModelTag,
} from '../src/ai/providers/ollama-provider.js';
import { computeStemSimilarity } from '../src/services/question-generator.js';

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

  describe('Preflight Verification', () => {
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

  describe('Provider Factory & Immutability Assertions', () => {
    it('returns an OllamaProvider instance for ollama requests', () => {
      const provider = getAIProvider('ollama', 'mistral:latest');
      expect(provider).toBeInstanceOf(OllamaProvider);
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
});
