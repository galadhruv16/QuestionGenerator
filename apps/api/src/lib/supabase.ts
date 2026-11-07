import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

const getSupabaseConfig = () => {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error('Supabase is not configured for the API.');
  }

  return { anonKey: env.SUPABASE_ANON_KEY, url: env.SUPABASE_URL };
};

export const createSupabaseUserClient = (accessToken: string): SupabaseClient => {
  const { anonKey, url } = getSupabaseConfig();

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
};

/**
 * Creates a backend-only Supabase client with the service-role key.
 * This client is exclusively used for detached, long-running backend background operations
 * (e.g., question synthesis persistence, multi-page chunk embedding) after the initiating
 * HTTP request has fully authenticated the user and strictly verified project/resource ownership.
 *
 * Never expose the service-role key to frontend bundles or client responses.
 */
export const createSupabaseAdminClient = (): SupabaseClient => {
  if (!env.SUPABASE_URL) {
    throw new Error('SUPABASE_URL is not configured for backend service-role operations.');
  }

  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY is not configured on the server. Background operations require a backend service-role key for persistence.',
    );
  }

  return createClient(env.SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
