import type { AIProvider } from './ai-provider.js';

export class OllamaProvider implements AIProvider {
  constructor(private readonly baseUrl: string) {}
  async generate(_request: unknown): Promise<unknown> {
    throw new Error(
      `Ollama generation is not implemented yet: ${this.baseUrl}`,
    );
  }
  async embed(_text: string): Promise<number[]> {
    throw new Error(
      `Ollama embeddings are not implemented yet: ${this.baseUrl}`,
    );
  }
}
