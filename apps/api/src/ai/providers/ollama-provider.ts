import type { AIProvider, GenerateOptions } from './ai-provider.js';
import { env } from '../../config/env.js';

export class OllamaProvider implements AIProvider {
  constructor(private readonly baseUrl = env.OLLAMA_BASE_URL) {}

  async generate(options: GenerateOptions): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? 30000,
    );
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        body: JSON.stringify({
          format: options.format,
          model: options.model || env.OLLAMA_MODEL || 'phi3:latest',
          options: {
            num_predict: 300,
            seed: options.seed ?? 42,
            temperature: options.temperature ?? 0.2,
          },
          prompt: options.prompt,
          stream: false,
          system: options.system,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Ollama generation failed with HTTP ${response.status}`,
        );
      }

      const payload = (await response.json()) as { response: string };
      return payload.response;
    } finally {
      clearTimeout(timeout);
    }
  }

  async embed(text: string): Promise<number[] | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        body: JSON.stringify({
          model: env.EMBEDDING_MODEL,
          prompt: text,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        signal: controller.signal,
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as { embedding: number[] };
      return payload.embedding;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const defaultAIProvider = new OllamaProvider();
