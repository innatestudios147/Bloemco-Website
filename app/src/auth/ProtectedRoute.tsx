import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { loading, configured, user, isStaff, isAdmin, isAwaitingApproval } = useAuth();

  if (!configured) {
    return (
      <div className="portal-wrap portal-narrow">
        <div className="portal-notice error">
          The blog isn't connected to its backend yet. Once Supabase is linked and the site is
          redeployed, staff sign-in will work here.
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="portal-wrap portal-narrow"><p>Loading…</p></div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isAwaitingApproval) {
    return (
      <div className="portal-wrap portal-narrow">
        <h1 className="portal-title">Waiting for approval</h1>
        <p className="portal-subtitle">
          Your account has been created, but an admin still needs to approve you before you can
          write or edit articles. You'll be able to access the staff portal as soon as that
          happens — no need to sign up again.
        </p>
      </div>
    );
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/staff" replace />;
  }

  if (!isStaff) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
