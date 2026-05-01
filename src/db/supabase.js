import { createClient } from '@supabase/supabase-js';
import { env, requireEnv } from '../config/env.js';

let serviceClient;

export function getSupabaseServiceClient() {
  if (!serviceClient) {
    serviceClient = createClient(
      requireEnv('SUPABASE_URL', env.supabaseUrl),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY', env.supabaseServiceRoleKey),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );
  }

  return serviceClient;
}
