import type { AIProvider, GenerateOptions } from './ai-provider.js';
import { env } from '../../config/env.js';
import { defaultAIProvider } from './ollama-provider.js';

const FALLBACK_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'qwen-2.5-32b',
];

export class GroqProvider implements AIProvider {
  readonly name = 'groq' as const;

  private readonly apiKey: string | undefined;
  private readonly defaultModel: string;

  constructor(
    apiKey: string | undefined = env.GROQ_API_KEY,
    defaultModel: string = env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  ) {
    this.apiKey = apiKey ? apiKey.trim() : undefined;
    this.defaultModel = defaultModel;
  }

  async generate(options: GenerateOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        'GROQ_API_KEY is not configured in backend environment (.env). Get a free API key at https://console.groq.com.',
      );
    }

    const requestedModel = options.model || this.defaultModel;
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
        const messages: Array<{ content: string; role: 'system' | 'user' }> = [];
        if (options.system) {
          messages.push({ content: options.system, role: 'system' });
        }
        messages.push({ content: options.prompt, role: 'user' });

        const response = await fetch(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            body: JSON.stringify({
              messages,
              model,
              response_format:
                options.format === 'json' ? { type: 'json_object' } : undefined,
              temperature: options.temperature ?? 0.2,
            }),
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            method: 'POST',
            signal: controller.signal,
          },
        );

        if (response.status === 429 || response.status === 503) {
          const errBody = await response.text().catch(() => '');
          console.warn(
            `[GroqProvider] Model ${model} returned HTTP ${response.status}. Retrying fallback... Details: ${errBody.slice(0, 150)}`,
          );
          lastError = new Error(
            `Groq model ${model} unavailable (HTTP ${response.status}): ${errBody.slice(0, 150)}`,
          );
          continue;
        }

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          throw new Error(
            `Groq API failed with HTTP ${response.status}: ${errBody.slice(0, 200)}`,
          );
        }

        const payload = (await response.json()) as {
          choices?: Array<{
            message?: {
              content?: string;
            };
          }>;
        };

        const generatedText = payload.choices?.[0]?.message?.content;
        if (!generatedText) {
          throw new Error('Groq API returned an empty response choice.');
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

    throw lastError ?? new Error('All Groq candidate models failed.');
  }

  async embed(text: string): Promise<number[] | null> {
    return defaultAIProvider.embed(text);
  }
}

export const defaultGroqProvider = new GroqProvider();
