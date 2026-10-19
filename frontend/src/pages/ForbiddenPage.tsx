import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROLE_HOME } from '../lib/roles';

export function ForbiddenPage() {
  const { user } = useAuth();

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-24 text-center">
      <p className="text-5xl font-extrabold text-emerald-700 dark:text-emerald-400">403</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">You do not have access to this page</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">Your account type is not allowed to view this area.</p>
      <Link
        to={user ? ROLE_HOME[user.role] : '/'}
        className="mt-6 inline-block rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
      >
        {user ? 'Go to my area' : 'Back to Home'}
      </Link>
    </section>
  );
}
