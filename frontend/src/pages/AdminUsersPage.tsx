import { Search, Users } from 'lucide-react';
import { useState } from 'react';
import { BackLink } from '../components/ui/BackLink';
import { FilterDropdown } from '../components/ui/FilterDropdown';
import { useApiResource } from '../hooks/useApiResource';

type AccountRole = 'ADMIN' | 'OWNER' | 'BOARDER';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
  avatarUrl: string | null;
  createdAt: string;
  _count: {
    properties: number;
    favorites: number;
    inquiriesSent: number;
    reviews: number;
    reports: number;
  };
}

interface UsersResponse {
  status: 'ok';
  users: AdminUser[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const roleStyles: Record<AccountRole, string> = {
  ADMIN: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300',
  OWNER: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  BOARDER: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300',
};

function isAccountRole(value: string): value is AccountRole {
  return value === 'ADMIN' || value === 'OWNER' || value === 'BOARDER';
}

export function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<AccountRole | ''>('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams();
  if (search.trim()) params.set('q', search.trim());
  if (role) params.set('role', role);
  params.set('page', String(page));
  const { state } = useApiResource<UsersResponse>(`/admin/users?${params.toString()}`);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-12">
      <BackLink to="/admin">Admin dashboard</BackLink>
      <div className="mt-3">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Users</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">View owner, boarder, and administrator accounts and their activity.</p>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search users</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            maxLength={100}
            placeholder="Search by name or email"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 py-2.5 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          <span className="sr-only">Filter by role</span>
          <FilterDropdown
            options={[
              { label: 'All roles', value: '' },
              { label: 'Owners', value: 'OWNER' },
              { label: 'Boarders', value: 'BOARDER' },
              { label: 'Admins', value: 'ADMIN' }
            ]}
            selected={role}
            onSelect={(newRole) => {
              if (newRole === '' || isAccountRole(newRole)) {
                setRole(newRole);
                setPage(1);
              }
            }}
          />
        </label>
      </div>

      {state.status === 'loading' && <p role="status" className="py-10 text-center text-slate-500 dark:text-slate-400">Loading accounts…</p>}
      {state.status === 'error' && <p role="alert" className="mt-5 rounded-lg bg-red-50 dark:bg-red-950 p-4 text-sm text-red-800 dark:text-red-300">{state.message}</p>}
      {state.status === 'success' && state.data.users.length === 0 && (
        <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p className="mt-3 font-medium text-slate-800 dark:text-slate-100">No accounts found</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Try a different name, email, or role filter.</p>
        </div>
      )}
      {state.status === 'success' && state.data.users.length > 0 && (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {state.data.pagination.total.toLocaleString()} {state.data.pagination.total === 1 ? 'account' : 'accounts'}
              {search.trim() && <> matching “{search.trim()}”</>}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Account details are read-only.</p>
          </div>
          <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {state.data.users.map((account) => (
              <li key={account.id} className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
                <div className="flex flex-col gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    {account.avatarUrl ? (
                      <img src={account.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-300" aria-hidden="true">
                        {account.name.trim().charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="break-words font-semibold text-slate-900 dark:text-slate-100">{account.name}</h2>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleStyles[account.role]}`}>
                          {account.role.charAt(0) + account.role.slice(1).toLowerCase()}
                        </span>
                      </div>
                      <a href={`mailto:${account.email}`} className="mt-1 block break-all text-sm text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline">
                        {account.email}
                      </a>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Joined {new Date(account.createdAt).toLocaleDateString()}</p>
                </div>
                
                <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-600 dark:text-slate-300">
                  {account.role === 'OWNER' ? (
                    <div><dt className="inline">Listings </dt><dd className="inline font-semibold text-slate-800 dark:text-slate-100">{account._count.properties}</dd></div>
                  ) : account.role === 'BOARDER' ? (
                    <>
                      <div><dt className="inline">Favorites </dt><dd className="inline font-semibold text-slate-800 dark:text-slate-100">{account._count.favorites}</dd></div>
                      <div><dt className="inline">Inquiries </dt><dd className="inline font-semibold text-slate-800 dark:text-slate-100">{account._count.inquiriesSent}</dd></div>
                      <div><dt className="inline">Reviews </dt><dd className="inline font-semibold text-slate-800 dark:text-slate-100">{account._count.reviews}</dd></div>
                      <div><dt className="inline">Reports </dt><dd className="inline font-semibold text-slate-800 dark:text-slate-100">{account._count.reports}</dd></div>
                    </>
                  ) : (
                    <div><dt className="inline">Administrator account</dt></div>
                  )}
                </dl>
              </li>
            ))}
          </ul>
            <nav aria-label="User pages" className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Page {state.data.pagination.page} of {state.data.pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= state.data.pagination.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </nav>
        </>
      )}
    </section>
  );
}
