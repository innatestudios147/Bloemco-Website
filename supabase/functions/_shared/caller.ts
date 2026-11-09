import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';

export interface Caller {
  userId: string;
  email: string;
  profileId: string;
  role: 'pending' | 'editor' | 'admin';
}

// Two clients: one scoped to the caller's own JWT (just to verify who they
// are), and a service-role client for the actual privileged read/write —
// this is what lets these functions do things RLS alone can't express
// (merging in auth.users data, bypassing RLS for a sanitized write).
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

// Resolves the authenticated caller from the Authorization header and loads
// their staff_profiles row. Returns null if there is no valid session or no
// profile yet (shouldn't normally happen — the on_auth_user_created trigger
// always creates one).
export async function getCaller(req: Request): Promise<Caller | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const anon = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await anon.auth.getUser();
  if (error || !data.user) return null;

  const svc = serviceClient();
  const { data: profile } = await svc
    .from('staff_profiles')
    .select('id, role')
    .eq('auth_provider_id', data.user.id)
    .maybeSingle();
  if (!profile) return null;

  return { userId: data.user.id, email: data.user.email ?? '', profileId: profile.id, role: profile.role };
}
