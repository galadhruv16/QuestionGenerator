import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
  console.warn(
    'Supabase is not configured; protected API routes will be unavailable.',
  );
}

app.listen(env.API_PORT, () =>
  console.log(`GroundQ API listening on http://localhost:${env.API_PORT}`),
);
