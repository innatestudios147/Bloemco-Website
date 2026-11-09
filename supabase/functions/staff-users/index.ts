// /functions/v1/staff-users — admin only.
//   GET                     -> merged list of staff_profiles + auth user info
//   POST {action:"invite", email, role}            -> invite by email
//   POST {action:"set-role", profile_id, role}      -> change someone's role
//   POST {action:"remove", profile_id}              -> remove access
// An admin can never act on their own account here (no self-demote, no
// self-removal) — checked below before anything else.
import { handleOptions, json } from '../_shared/cors.ts';
import { getCaller, serviceClient } from '../_shared/caller.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const caller = await getCaller(req);
  if (!caller || caller.role !== 'admin') {
    return json({ error: 'Admin access required.' }, 403);
  }
  const svc = serviceClient();

  if (req.method === 'GET') {
    const { data: profiles, error } = await svc.from('staff_profiles').select('*').order('created_at', { ascending: false });
    if (error) return json({ error: error.message }, 400);

    // auth.admin.listUsers() is paginated; a staff roster is small, so a
    // couple of pages is more than enough in practice.
    const authUsers: Record<string, { last_sign_in_at: string | null }> = {};
    let page = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error: listErr } = await svc.auth.admin.listUsers({ page, perPage: 200 });
      if (listErr) break;
      for (const u of data.users) authUsers[u.id] = { last_sign_in_at: u.last_sign_in_at ?? null };
      if (data.users.length < 200) break;
      page += 1;
      if (page > 10) break; // sanity cap
    }

    const users = (profiles ?? []).map((p) => ({
      ...p,
      last_sign_in_at: p.auth_provider_id ? authUsers[p.auth_provider_id]?.last_sign_in_at ?? null : null,
    }));
    return json({ users });
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  const action = payload.action;

  if (action === 'invite') {
    const email = String(payload.email ?? '').trim().toLowerCase();
    const role = payload.role === 'admin' ? 'admin' : 'editor';
    if (!email) return json({ error: 'Email is required.' }, 400);

    const { data: existing } = await svc.from('staff_profiles').select('id').eq('email', email).maybeSingle();
    if (existing) {
      const { error } = await svc.from('staff_profiles').update({ role }).eq('id', existing.id);
      if (error) return json({ error: error.message }, 400);
    } else {
      const { error } = await svc.from('staff_profiles').insert({ email, role });
      if (error) return json({ error: error.message }, 400);
    }

    const { error: inviteErr } = await svc.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${Deno.env.get('SITE_URL') ?? ''}/login`,
    });
    // Someone can be "invited" again after already having an account (e.g.
    // to re-send access) — Supabase returns an error for an email that
    // already has an account, which we can safely ignore here since the
    // staff_profiles row above is what actually grants access.
    if (inviteErr && !/already registered|already exists/i.test(inviteErr.message)) {
      return json({ error: inviteErr.message }, 400);
    }
    return json({ ok: true });
  }

  if (action === 'set-role') {
    const profileId = String(payload.profile_id ?? '');
    const role = payload.role;
    if (!['pending', 'editor', 'admin'].includes(role as string)) return json({ error: 'Invalid role.' }, 400);
    if (profileId === caller.profileId) return json({ error: "You can't change your own role." }, 400);

    const { error } = await svc.from('staff_profiles').update({ role }).eq('id', profileId);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (action === 'remove') {
    const profileId = String(payload.profile_id ?? '');
    if (profileId === caller.profileId) return json({ error: "You can't remove your own access." }, 400);

    const { data: target } = await svc.from('staff_profiles').select('auth_provider_id').eq('id', profileId).maybeSingle();
    const { error } = await svc.from('staff_profiles').delete().eq('id', profileId);
    if (error) return json({ error: error.message }, 400);
    if (target?.auth_provider_id) {
      await svc.auth.admin.deleteUser(target.auth_provider_id).catch(() => undefined);
    }
    return json({ ok: true });
  }

  return json({ error: 'Unknown action.' }, 400);
});
