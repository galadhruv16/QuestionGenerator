import { env } from '../../config/env.js';
import { GeminiProvider, defaultGeminiProvider } from './gemini-provider.js';
import { GroqProvider, defaultGroqProvider } from './groq-provider.js';
import { OllamaProvider, defaultAIProvider } from './ollama-provider.js';

export interface GenerateOptions {
  model?: string;
  system?: string;
  prompt: string;
  format?: 'json';
  temperature?: number;
  seed?: number;
  timeoutMs?: number;
  maxTokens?: number;
}

export interface AIProvider {
  name?: 'gemini' | 'ollama' | 'groq';
  generate(options: GenerateOptions): Promise<string>;
  embed(text: string): Promise<number[] | null>;
}

export function getAIProvider(
  provider?: 'gemini' | 'ollama' | 'groq' | string,
  model?: string,
): AIProvider {
  const chosenProvider = provider || 'ollama';

  if (
    chosenProvider !== 'gemini' &&
    chosenProvider !== 'groq' &&
    chosenProvider !== 'ollama'
  ) {
    throw new Error(
      `Unsupported AI provider: "${chosenProvider}". GroundQ only supports "ollama", "gemini", or "groq".`,
    );
  }

  if (chosenProvider === 'gemini') {
    if (!env.GEMINI_API_KEY) {
      throw new Error(
        'Gemini provider requested but GEMINI_API_KEY is not configured',
      );
    }
    if (model) {
      return new GeminiProvider(env.GEMINI_API_KEY, model);
    }
    return defaultGeminiProvider;
  }

  if (chosenProvider === 'groq') {
    if (!env.GROQ_API_KEY) {
      throw new Error(
        'Groq provider requested but GROQ_API_KEY is not configured',
      );
    }
    if (model) {
      return new GroqProvider(env.GROQ_API_KEY, model);
    }
    return defaultGroqProvider;
  }

  // Ollama provider execution
  const inst = model
    ? new OllamaProvider(env.OLLAMA_BASE_URL)
    : defaultAIProvider;
  if (!(inst instanceof OllamaProvider)) {
    throw new Error(
      'Server assertion failure: Ollama provider requested but resolved provider is not an OllamaProvider instance.',
    );
  }
  return inst;
}

export { defaultAIProvider };
