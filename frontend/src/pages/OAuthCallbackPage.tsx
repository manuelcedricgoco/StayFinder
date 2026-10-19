import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../lib/api';
import { ROLE_HOME } from '../lib/roles';
import type { AuthUser } from '../types/auth';

interface CurrentUserResponse {
  status: 'ok';
  user: AuthUser;
}

export function OAuthCallbackPage() {
  const { updateUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiRequest<CurrentUserResponse>('GET', '/auth/me')
      .then(({ user }) => {
        if (cancelled) return;
        updateUser(user);
        navigate(ROLE_HOME[user.role], { replace: true });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, updateUser]);

  return (
    <section className="mx-auto max-w-xl px-4 py-16 text-center">
      {error ? (
        <>
          <h1 className="text-2xl font-bold text-slate-900">Sign-in could not be completed</h1>
          <p className="mt-3 text-slate-600">Please try signing in again.</p>
          <a href="/login" className="mt-5 inline-block font-semibold text-emerald-700 hover:underline">Return to log in</a>
        </>
      ) : (
        <p role="status" className="text-slate-600">Finishing sign-in…</p>
      )}
    </section>
  );
}
