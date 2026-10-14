import type { AIProvider, GenerateOptions } from './ai-provider.js';
import { env } from '../../config/env.js';
import { defaultAIProvider } from './ollama-provider.js';

const FALLBACK_MODELS = [
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
];

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini' as const;

  private readonly apiKey: string | undefined;
  private readonly defaultModel: string;

  constructor(
    apiKey: string | undefined = env.GEMINI_API_KEY,
    defaultModel: string = env.GEMINI_MODEL || 'gemini-flash-latest',
  ) {
    this.apiKey = apiKey ? apiKey.trim() : undefined;
    this.defaultModel = defaultModel;
  }

  async generate(options: GenerateOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not configured in backend environment (.env). Please provide a valid Google Gemini API key.',
      );
    }

    const requestedModel = options.model || this.defaultModel;
    // Build candidate model list with requested model first, then known working fallbacks
    const candidateModels = Array.from(
      new Set([requestedModel, ...FALLBACK_MODELS]),
    );

    let lastError: Error | null = null;

    for (const model of candidateModels) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        options.timeoutMs ?? 25000,
      );

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
        const response = await fetch(url, {
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: options.prompt }],
              },
            ],
            generationConfig: {
              responseMimeType:
                options.format === 'json' ? 'application/json' : undefined,
              temperature: options.temperature ?? 0.2,
            },
            systemInstruction: options.system
              ? {
                  parts: [{ text: options.system }],
                }
              : undefined,
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
          signal: controller.signal,
        });

        if (
          response.status === 404 ||
          response.status === 503 ||
          response.status === 400 ||
          response.status === 429
        ) {
          const errBody = await response.text().catch(() => '');
          console.warn(
            `[GeminiProvider] Model ${model} returned HTTP ${response.status}. Trying next fallback... Details: ${errBody.slice(0, 150)}`,
          );
          lastError = new Error(
            `Gemini model ${model} unavailable (HTTP ${response.status}): ${errBody.slice(0, 150)}`,
          );
          continue;
        }

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          throw new Error(
            `Gemini API failed with HTTP ${response.status}: ${errBody.slice(0, 200)}`,
          );
        }

        const payload = (await response.json()) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{ text?: string }>;
            };
          }>;
        };

        const generatedText = payload.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!generatedText) {
          throw new Error('Gemini API returned an empty response candidate.');
        }

        return generatedText;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (candidateModels.indexOf(model) === candidateModels.length - 1) {
          throw lastError;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error('All Gemini candidate models failed.');
  }

  async embed(text: string): Promise<number[] | null> {
    // Preserve local nomic-embed-text embedding compatibility with Supabase pgvector
    return defaultAIProvider.embed(text);
  }
}

export const defaultGeminiProvider = new GeminiProvider();
