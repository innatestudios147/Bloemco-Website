import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

type Mode = 'sign-in' | 'sign-up' | 'forgot' | 'set-new-password';

export function Login() {
  const { user, isStaff, isAwaitingApproval, configured, signIn, signUp, sendPasswordReset, updatePassword } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Supabase sends staff invite / password-reset emails back here with
  // #access_token=…&type=recovery (or type=invite) in the URL hash — that's
  // our cue to show the "set a new password" form instead of plain sign-in.
  useEffect(() => {
    const hash = window.location.hash;
    if (/type=recovery|type=invite/.test(hash)) {
      setMode('set-new-password');
    }
  }, []);

  if (user && isStaff) return <Navigate to="/staff" replace />;

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) setError(error);
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signUp(email, password);
    setBusy(false);
    if (error) { setError(error); return; }
    setNotice('Account created. Check your email to confirm it, then sign in — an admin still needs to approve you before you can publish.');
    setMode('sign-in');
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await sendPasswordReset(email);
    setBusy(false);
    if (error) { setError(error); return; }
    setNotice('If that email has an account, a reset link is on its way.');
  }

  async function handleSetNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) { setError(error); return; }
    setNotice('Password set. Redirecting…');
    setTimeout(() => navigate('/staff'), 1200);
  }

  if (user && isAwaitingApproval && mode !== 'set-new-password') {
    return (
      <div className="portal-wrap portal-narrow">
        <h1 className="portal-title">Waiting for approval</h1>
        <p className="portal-subtitle">You're signed in, but an admin still needs to approve your account before you can access the staff portal.</p>
      </div>
    );
  }

  return (
    <div className="portal-wrap portal-narrow">
      <h1 className="portal-title">
        {mode === 'sign-in' && 'Staff sign in'}
        {mode === 'sign-up' && 'Create an account'}
        {mode === 'forgot' && 'Reset your password'}
        {mode === 'set-new-password' && 'Set a new password'}
      </h1>
      <p className="portal-subtitle">
        {mode === 'sign-in' && 'Sign in to write, edit and publish articles.'}
        {mode === 'sign-up' && 'New accounts need admin approval before they can publish.'}
        {mode === 'forgot' && "We'll email you a link to reset your password."}
        {mode === 'set-new-password' && 'Choose a new password for your account.'}
      </p>

      {!configured && (
        <div className="portal-notice error" style={{ marginBottom: 24 }}>
          The blog isn't connected to its backend yet, so sign-in won't work here until Supabase is linked.
        </div>
      )}
      {error && <div className="portal-notice error" style={{ marginBottom: 24 }}>{error}</div>}
      {notice && <div className="portal-notice success" style={{ marginBottom: 24 }}>{notice}</div>}

      <div className="portal-card">
        {mode === 'sign-in' && (
          <form onSubmit={handleSignIn}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy || !configured} style={{ width: '100%', marginBottom: 16 }}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <div className="btn-row" style={{ justifyContent: 'space-between' }}>
              <button type="button" className="link-btn" onClick={() => { setMode('sign-up'); setError(null); setNotice(null); }}>Create an account</button>
              <button type="button" className="link-btn" onClick={() => { setMode('forgot'); setError(null); setNotice(null); }}>Forgot password?</button>
            </div>
          </form>
        )}

        {mode === 'sign-up' && (
          <form onSubmit={handleSignUp}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="field-hint">At least 8 characters.</p>
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy || !configured} style={{ width: '100%', marginBottom: 16 }}>
              {busy ? 'Creating…' : 'Create account'}
            </button>
            <button type="button" className="link-btn" onClick={() => { setMode('sign-in'); setError(null); setNotice(null); }}>Back to sign in</button>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgot}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy || !configured} style={{ width: '100%', marginBottom: 16 }}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
            <button type="button" className="link-btn" onClick={() => { setMode('sign-in'); setError(null); setNotice(null); }}>Back to sign in</button>
          </form>
        )}

        {mode === 'set-new-password' && (
          <form onSubmit={handleSetNewPassword}>
            <div className="field">
              <label htmlFor="new-password">New password</label>
              <input id="new-password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
              {busy ? 'Saving…' : 'Set password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
