import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

const getSupabaseConfig = () => {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error('Supabase is not configured for the API.');
  }

  return { anonKey: env.SUPABASE_ANON_KEY, url: env.SUPABASE_URL };
};

export const createSupabaseUserClient = (accessToken: string) => {
  const { anonKey, url } = getSupabaseConfig();

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
};
