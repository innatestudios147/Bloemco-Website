import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

// A harmless placeholder so the app can still render (with a clear notice)
// before a Supabase project is linked, instead of crashing at import time.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } },
);
