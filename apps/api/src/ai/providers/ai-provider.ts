import { env } from '../../config/env.js';
import { GeminiProvider, defaultGeminiProvider } from './gemini-provider.js';
import { OllamaProvider, defaultAIProvider } from './ollama-provider.js';

export interface GenerateOptions {
  model?: string;
  system?: string;
  prompt: string;
  format?: 'json';
  temperature?: number;
  seed?: number;
  timeoutMs?: number;
}

export interface AIProvider {
  name?: 'gemini' | 'ollama';
  generate(options: GenerateOptions): Promise<string>;
  embed(text: string): Promise<number[] | null>;
}

export function getAIProvider(
  provider?: 'gemini' | 'ollama',
  model?: string,
): AIProvider {
  const chosenProvider = provider || (env.GEMINI_API_KEY ? 'gemini' : 'ollama');

  if (chosenProvider === 'gemini') {
    if (model) {
      return new GeminiProvider(env.GEMINI_API_KEY, model);
    }
    return defaultGeminiProvider;
  }

  if (model) {
    return new OllamaProvider(env.OLLAMA_BASE_URL);
  }
  return defaultAIProvider;
}

export { defaultAIProvider };
