import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_HOME } from '../../lib/roles';
import { ForbiddenPage } from '../../pages/ForbiddenPage';
import type { Role } from '../../types/auth';

function LoadingScreen() {
  return (
    <p role="status" className="px-4 py-24 text-center text-slate-500 dark:text-slate-400">
      Loading...
    </p>
  );
}

// Only for logged-in users. Pass allowedRoles to also restrict by role.
// NOTE: this only controls what the UI shows. The backend enforces the real security.
export function ProtectedRoute({ allowedRoles }: { allowedRoles?: Role[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <ForbiddenPage />;
  return <Outlet />;
}

// Only for visitors who are NOT logged in (login / register pages).
export function GuestRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return <Outlet />;
}
