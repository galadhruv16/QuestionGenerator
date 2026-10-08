import { createClient } from '@supabase/supabase-js';

let client: ReturnType<typeof createClient> | undefined;

export const getSupabaseClient = () => {
  if (client) {
    return client;
  }

  const url = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    throw new Error('Supabase is not configured. Check apps/web/.env.local.');
  }

  client = createClient(url, publishableKey);
  return client;
};
