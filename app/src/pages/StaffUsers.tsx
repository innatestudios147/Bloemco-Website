import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import type { StaffProfile, StaffRole } from '../lib/types';

interface MergedUser extends StaffProfile {
  last_sign_in_at?: string | null;
}

export function StaffUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<MergedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<StaffRole>('editor');
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = 'Manage staff | Bloem Consulting Services'; }, []);

  async function load() {
    setError(null);
    const { data, error } = await supabase.functions.invoke('staff-users', { method: 'GET' });
    if (error) { setError(error.message); return; }
    setUsers((data as { users: MergedUser[] }).users);
  }

  useEffect(() => { load(); }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error } = await supabase.functions.invoke('staff-users', {
      method: 'POST',
      body: { action: 'invite', email: inviteEmail.trim(), role: inviteRole },
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setNotice(`Invited ${inviteEmail.trim()}.`);
    setInviteEmail('');
    load();
  }

  async function handleRoleChange(target: MergedUser, role: StaffRole) {
    setError(null);
    const { error } = await supabase.functions.invoke('staff-users', {
      method: 'POST',
      body: { action: 'set-role', profile_id: target.id, role },
    });
    if (error) { setError(error.message); return; }
    load();
  }

  async function handleRemove(target: MergedUser) {
    if (!window.confirm(`Remove ${target.email}'s access?`)) return;
    setError(null);
    const { error } = await supabase.functions.invoke('staff-users', {
      method: 'POST',
      body: { action: 'remove', profile_id: target.id },
    });
    if (error) { setError(error.message); return; }
    load();
  }

  return (
    <div className="portal-wrap">
      <h1 className="portal-title">Manage staff</h1>
      <p className="portal-subtitle">Invite staff by email, approve pending sign-ups, and manage roles.</p>

      {error && <div className="portal-notice error" style={{ marginBottom: 24 }}>{error}</div>}
      {notice && <div className="portal-notice success" style={{ marginBottom: 24 }}>{notice}</div>}

      <div className="portal-card" style={{ marginBottom: 30 }}>
        <h4 style={{ marginBottom: 16 }}>Invite someone by email</h4>
        <form onSubmit={handleInvite} className="btn-row">
          <input
            type="email"
            required
            placeholder="name@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            style={{ flex: 1, minWidth: 220, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '10px 14px', fontSize: 14 }}
          />
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as StaffRole)} style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '10px 14px' }}>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Inviting…' : 'Send invite'}</button>
        </form>
      </div>

      {users === null ? (
        <p>Loading…</p>
      ) : (
        <table className="portal-table">
          <thead>
            <tr><th>Email</th><th>Name</th><th>Role</th><th>Last sign-in</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.auth_provider_id === user?.id;
              return (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.display_name || '—'}</td>
                  <td>
                    <select
                      value={u.role}
                      disabled={isSelf}
                      onChange={(e) => handleRoleChange(u, e.target.value as StaffRole)}
                      style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '4px 8px' }}
                    >
                      <option value="pending">Pending</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('en-GB') : 'Never'}</td>
                  <td className="actions">
                    <button className="link-btn" style={{ color: '#a1332a' }} disabled={isSelf} onClick={() => handleRemove(u)}>
                      {isSelf ? 'This is you' : 'Remove'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
