import { createClient } from '@supabase/supabase-js';

let browserClient: ReturnType<typeof createClient> | null = null;

function requirePublicEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
  const value = process.env[name];

  if (!value || value.trim().length === 0) {
    throw new Error(`${name.toLowerCase()} is required.`);
  }

  return value;
}

export function getSupabaseClient() {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = requirePublicEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = requirePublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  browserClient = createClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}
