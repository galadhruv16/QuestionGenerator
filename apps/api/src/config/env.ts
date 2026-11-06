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
  API_PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(Number(process.env.PORT) || 3001),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  SUPABASE_URL: optionalString.pipe(z.string().url().optional()),
  SUPABASE_ANON_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  GEMINI_API_KEY: optionalString,
  GEMINI_MODEL: z.string().default('gemini-flash-lite-latest'),
  GROQ_API_KEY: optionalString,
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('mistral:latest'),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
  OLLAMA_EMBEDDING_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  OLLAMA_STALL_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  OLLAMA_RUN_BUDGET_MS: z.coerce.number().int().positive().default(3600000),
  EMBEDDING_MODEL: z.string().default('nomic-embed-text:latest'),
});

export const env = envSchema.parse(process.env);
