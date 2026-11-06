import os from 'node:os';
import type { AIProvider, GenerateOptions } from './ai-provider.js';
import { env } from '../../config/env.js';

export class OllamaProvider implements AIProvider {
  constructor(private readonly baseUrl = env.OLLAMA_BASE_URL) {}

  async generate(options: GenerateOptions): Promise<string> {
    const controller = new AbortController();
    const overallTimeoutMs = options.timeoutMs ?? 180000; // 3 min default per attempt
    const stallTimeoutMs = 60000; // 60s without a single token

    let stallTimer: NodeJS.Timeout | null = null;
    const resetStallTimer = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        controller.abort(
          new Error('Ollama generation stalled: no tokens received for 60 seconds'),
        );
      }, stallTimeoutMs);
    };

    const overallTimer = setTimeout(() => {
      controller.abort(
        new Error(`Ollama generation timed out after ${overallTimeoutMs / 1000}s`),
      );
    }, overallTimeoutMs);

    resetStallTimer();

    // Dynamically calculate optimal thread count to prevent CPU oversubscription.
    // Zen 2 / Ryzen CPU with SMT performs worse when threads > physical cores.
    const cpuCount = os.cpus()?.length || 4;
    const optimalThreads = cpuCount >= 8 ? 4 : Math.max(1, cpuCount <= 4 ? cpuCount : cpuCount - 1);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        body: JSON.stringify({
          format: options.format,
          keep_alive: '30m',
          model: options.model || env.OLLAMA_MODEL || 'mistral:latest',
          options: {
            num_ctx: 2048,
            num_predict: options.maxTokens ?? 700,
            num_thread: optimalThreads,
            seed: options.seed ?? 42,
            stop: ['\n\n\n```', '<|end|>', '<|endoftext|>', '<|im_end|>', '</s>'],
            temperature: options.temperature ?? 0.35,
          },
          prompt: options.prompt,
          stream: true,
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

      if (!response.body) {
        throw new Error('Ollama generation response body is empty');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        resetStallTimer();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed) as {
              done?: boolean;
              response?: string;
            };
            if (parsed.response) {
              accumulated += parsed.response;
            }
          } catch {
            // Partial JSON line or malformed chunk, continue
          }
        }
      }

      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim()) as { response?: string };
          if (parsed.response) {
            accumulated += parsed.response;
          }
        } catch {
          // ignore
        }
      }

      return accumulated;
    } finally {
      if (stallTimer) clearTimeout(stallTimer);
      clearTimeout(overallTimer);
    }
  }

  async embed(text: string): Promise<number[] | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        body: JSON.stringify({
          keep_alive: '30m',
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
