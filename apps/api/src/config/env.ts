import 'dotenv/config';
import { z } from 'zod';

const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
);

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  SUPABASE_URL: optionalString.pipe(z.string().url().optional()),
  SUPABASE_ANON_KEY: optionalString,
  GEMINI_API_KEY: optionalString,
  GEMINI_MODEL: z.string().default('gemini-flash-lite-latest'),
  GROQ_API_KEY: optionalString,
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('qwen2.5:7b'),
  EMBEDDING_MODEL: z.string().default('nomic-embed-text'),
});

export const env = envSchema.parse(process.env);
