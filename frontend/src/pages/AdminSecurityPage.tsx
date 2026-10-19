import { FilterDropdown } from '../components/ui/FilterDropdown';
import { DatePicker } from '../components/ui/DatePicker';
import { RevokeSessionModal } from '../components/ui/RevokeSessionModal';
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleX,
  Clock3,
  Download,
  KeyRound,
  LockKeyhole,
  Monitor,
  Search,
  ShieldCheck,
  Timer,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { BackLink } from '../components/ui/BackLink';
import { useApiResource } from '../hooks/useApiResource';
import { apiDownload, apiRequest, ApiError } from '../lib/api';
import type { Role } from '../types/auth';

interface SecurityEvent {
  id: string;
  createdAt: string;
  userName: string | null;
  email: string | null;
  role: Role | null;
  action: string;
  target: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  status: string;
  loginStatus?: 'SUCCESSFUL' | 'FAILED';
}

interface SecuritySession {
  id: string;
  user: { id: string; name: string; email: string; role: Role };
  role: Role;
  ipAddress: string | null;
  userAgent: string | null;
  loginAt: string;
  lastActivityAt: string;
  status: string;
}

interface SecurityResponse {
  status: 'ok';
  overview: {
    loginAttempts: number;
    successfulLogins: number;
    failedLogins: number;
    activeSessions: number;
    suspiciousActivities: number;
    blockedAccounts: number;
    blockedAccountsAvailable: boolean;
  };
  loginActivity: SecurityEvent[];
  auditLogs: SecurityEvent[];
  suspicious: Array<{
    id: string;
    createdAt: string;
    label: string;
    description: string;
    user: string;
    ipAddress: string | null;
    status: string;
  }>;
  sessions: SecuritySession[];
  accountSecurity: Record<string, { available: boolean }>;
}

const cardStyles = 'rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm sm:p-5';
const inputStyles = 'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatAction(value: string) {
  return value.toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function deviceDescription(userAgent: string | null) {
  if (!userAgent) return 'Unknown device';
  const browser = /Edg\//.test(userAgent) ? 'Edge'
    : /Firefox\//.test(userAgent) ? 'Firefox'
      : /Chrome\//.test(userAgent) ? 'Chrome'
        : /Safari\//.test(userAgent) ? 'Safari'
          : 'Browser';
  const platform = /Android/.test(userAgent) ? 'Android'
    : /iPhone|iPad/.test(userAgent) ? 'iOS'
      : /Windows/.test(userAgent) ? 'Windows'
        : /Mac OS/.test(userAgent) ? 'macOS'
          : /Linux/.test(userAgent) ? 'Linux'
            : 'Device';
  return `${browser} / ${platform}`;
}

function StatusBadge({ value }: { value: string }) {
  const success = ['SUCCESS', 'SUCCESSFUL', 'ACTIVE', 'APPROVED', 'RESOLVED'].includes(value.toUpperCase());
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
      success ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
    }`}>
      {formatAction(value)}
    </span>
  );
}

function EmptyRow({ columns, message }: { columns: number; message: string }) {
  return <tr><td colSpan={columns} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">{message}</td></tr>;
}

export function AdminSecurityPage() {
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    user: '',
    role: '',
    action: '',
    status: '',
    ip: '',
    q: '',
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busySession, setBusySession] = useState<string | null>(null);
  const [sessionToRevoke, setSessionToRevoke] = useState<SecuritySession | null>(null);
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  const { state, reload } = useApiResource<SecurityResponse>(`/admin/security${query ? `?${query}` : ''}`);

  function updateFilter(name: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  async function exportLogs() {
    setError('');
    setNotice('');
    try {
      const blob = await apiDownload(`/admin/security/export.csv${query ? `?${query}` : ''}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'stayfinder-security-logs.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not export security logs.');
    }
  }

  async function revokeSession(session: SecuritySession) {
    setBusySession(session.id);
    setError('');
    setNotice('');
    try {
      await apiRequest('DELETE', `/admin/security/sessions/${encodeURIComponent(session.id)}`);
      setNotice(`Session for ${session.user.name} was revoked.`);
      setSessionToRevoke(null);
      reload();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not revoke this session.');
    } finally {
      setBusySession(null);
    }
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
      <RevokeSessionModal
        isOpen={!!sessionToRevoke}
        onClose={() => setSessionToRevoke(null)}
        onConfirm={() => sessionToRevoke && revokeSession(sessionToRevoke)}
        userName={sessionToRevoke?.user.name ?? ''}
        device={deviceDescription(sessionToRevoke?.userAgent ?? null)}
        isProcessing={!!busySession}
      />
      <BackLink to="/admin">Admin dashboard</BackLink>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Security &amp; Activity</h1>
          <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">Review sign-in activity, active sessions, and administrative actions. Activity is recorded without passwords, password hashes, or authentication tokens.</p>
        </div>
        <button
          type="button"
          onClick={exportLogs}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          <Download className="h-4 w-4" aria-hidden="true" /> Export Logs
        </button>
      </div>

      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-lg bg-emerald-50 dark:bg-emerald-950 p-3 text-sm text-emerald-800 dark:text-emerald-300">{notice}</p>}
      {state.status === 'loading' && <p role="status" className="py-10 text-center text-slate-500 dark:text-slate-400">Loading security activity…</p>}
      {state.status === 'error' && <p role="alert" className="mt-5 rounded-lg bg-red-50 dark:bg-red-950 p-4 text-sm text-red-800 dark:text-red-300">{state.message}</p>}

      {state.status === 'success' && (
        <>
          <section aria-labelledby="security-overview-title" className="mt-7">
            <h2 id="security-overview-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Security overview</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[
                { label: 'Total login attempts', value: state.data.overview.loginAttempts, Icon: Activity, color: 'text-sky-700 bg-sky-50 dark:text-sky-300 dark:bg-sky-950' },
                { label: 'Successful logins', value: state.data.overview.successfulLogins, Icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950' },
                { label: 'Failed login attempts', value: state.data.overview.failedLogins, Icon: CircleX, color: 'text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-950' },
                { label: 'Active sessions', value: state.data.overview.activeSessions, Icon: Users, color: 'text-violet-700 bg-violet-50 dark:text-violet-300 dark:bg-violet-950' },
                { label: 'Potentially Suspicious', value: state.data.overview.suspiciousActivities, Icon: AlertTriangle, color: 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950' },
                { label: 'Blocked accounts', value: state.data.overview.blockedAccounts, Icon: Ban, color: 'text-slate-700 bg-slate-100 dark:text-slate-200 dark:bg-slate-800', note: state.data.overview.blockedAccountsAvailable ? '' : 'Account blocking unavailable' },
              ].map(({ label, value, Icon, color, note }) => (
                <div key={label} className={`${cardStyles} flex items-center gap-3`}>
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-600 dark:text-slate-300">{label}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value.toLocaleString()}</p>
                    {note && <p className="text-xs text-slate-500 dark:text-slate-400">{note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="security-filters-title" className={`${cardStyles} mt-6`}>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
              <h2 id="security-filters-title" className="font-semibold text-slate-900 dark:text-slate-100">Filters and search</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DatePicker label="From" value={filters.from} onChange={(val) => updateFilter('from', val)} />
              <DatePicker label="To" value={filters.to} onChange={(val) => updateFilter('to', val)} />
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">User<input value={filters.user} onChange={(event) => updateFilter('user', event.target.value)} maxLength={100} placeholder="Name or email" className={`${inputStyles} mt-1`} /></label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Search users and actions<input value={filters.q} onChange={(event) => updateFilter('q', event.target.value)} maxLength={100} placeholder="Search activity" className={`${inputStyles} mt-1`} /></label>
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">Role
                <div className="mt-1">
                  <FilterDropdown
                    fullWidth
                    options={[
                      { label: 'All roles', value: '' },
                      { label: 'Admin', value: 'ADMIN' },
                      { label: 'Owner', value: 'OWNER' },
                      { label: 'Boarder', value: 'BOARDER' }
                    ]}
                    selected={filters.role}
                    onSelect={(val) => updateFilter('role', val)}
                  />
                </div>
              </div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Action<input value={filters.action} onChange={(event) => updateFilter('action', event.target.value)} maxLength={100} placeholder="e.g. LOGIN" className={`${inputStyles} mt-1`} /></label>
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">Status
                <div className="mt-1">
                  <FilterDropdown
                    fullWidth
                    options={[
                      { label: 'All statuses', value: '' },
                      { label: 'Successful', value: 'SUCCESS' },
                      { label: 'Failed', value: 'FAILED' },
                      { label: 'Review', value: 'REVIEW' }
                    ]}
                    selected={filters.status}
                    onSelect={(val) => updateFilter('status', val)}
                  />
                </div>
              </div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">IP address<input value={filters.ip} onChange={(event) => updateFilter('ip', event.target.value)} maxLength={100} placeholder="Filter by IP" className={`${inputStyles} mt-1`} /></label>
            </div>
          </section>

          <section aria-labelledby="login-activity-title" className={`${cardStyles} mt-6`}>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <h2 id="login-activity-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recent login activity</h2>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400"><tr><th className="px-3 py-3">User / email</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">IP address</th><th className="px-3 py-3">Device / browser</th><th className="px-3 py-3">Location</th><th className="px-3 py-3">Login time</th><th className="px-3 py-3">Status</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {state.data.loginActivity.length === 0 ? <EmptyRow columns={7} message="No login events match these filters." /> : state.data.loginActivity.map((event) => (
                    <tr key={event.id}>
                      <td className="px-3 py-3"><p className="font-medium text-slate-900 dark:text-slate-100">{event.userName ?? 'Unknown user'}</p><p className="text-xs text-slate-500 dark:text-slate-400">{event.email ?? 'Email unavailable'}</p></td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{event.role ?? '—'}</td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{event.ipAddress ?? 'Unavailable'}</td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{deviceDescription(event.userAgent)}</td>
                      <td className="px-3 py-3 text-slate-500 dark:text-slate-400">Unavailable</td>
                      <td className="px-3 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatDate(event.createdAt)}</td>
                      <td className="px-3 py-3"><StatusBadge value={event.loginStatus ?? event.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
            <section aria-labelledby="audit-log-title" className={cardStyles}>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <h2 id="audit-log-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Security activity / audit logs</h2>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400"><tr><th className="px-3 py-3">Date/time</th><th className="px-3 py-3">User / role</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Target / resource</th><th className="px-3 py-3">IP address</th><th className="px-3 py-3">Status</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {state.data.auditLogs.length === 0 ? <EmptyRow columns={6} message="No audit events match these filters." /> : state.data.auditLogs.map((event) => (
                      <tr key={event.id}>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600 dark:text-slate-300">{formatDate(event.createdAt)}</td>
                        <td className="px-3 py-3"><p className="font-medium text-slate-900 dark:text-slate-100">{event.userName ?? 'Unknown user'}</p><p className="text-xs text-slate-500 dark:text-slate-400">{event.role ?? '—'}</p></td>
                        <td className="px-3 py-3 font-medium text-slate-800 dark:text-slate-100">{formatAction(event.action)}</td>
                        <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{event.target ?? '—'}</td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{event.ipAddress ?? '—'}</td>
                        <td className="px-3 py-3"><StatusBadge value={event.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {state.data.auditLogs.length === 250 && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Showing the newest 250 matching events. Use filters to narrow the results.</p>}
            </section>

            <section aria-labelledby="suspicious-title" className={cardStyles}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <h2 id="suspicious-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Potentially Suspicious</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Automated indicators for review only; they do not establish malicious behavior.</p>
              {state.data.suspicious.length === 0 ? (
                <p className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800 p-4 text-sm text-slate-600 dark:text-slate-300">No repeated failed-login patterns detected in the last 15 minutes.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {state.data.suspicious.map((item) => (
                    <li key={item.id} className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">{item.label}</span><span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(item.createdAt)}</span></div>
                      <p className="mt-2 font-medium text-slate-900 dark:text-slate-100">{item.description}</p>
                      <p className="mt-1 break-words text-sm text-slate-600 dark:text-slate-300">{item.user} · {item.ipAddress ?? 'IP unavailable'}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section aria-labelledby="active-sessions-title" className={`${cardStyles} mt-6`}>
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <h2 id="active-sessions-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Active sessions</h2>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400"><tr><th className="px-3 py-3">User</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Device / browser</th><th className="px-3 py-3">Login time</th><th className="px-3 py-3">Last activity</th><th className="px-3 py-3">Session status</th><th className="px-3 py-3">Action</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {state.data.sessions.length === 0 ? <EmptyRow columns={7} message="There are no active sessions." /> : state.data.sessions.map((session) => (
                    <tr key={session.id}>
                      <td className="px-3 py-3"><p className="font-medium text-slate-900 dark:text-slate-100">{session.user.name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{session.user.email}</p></td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{session.role}</td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{deviceDescription(session.userAgent)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-slate-300">{formatDate(session.loginAt)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-slate-300">{formatDate(session.lastActivityAt)}</td>
                      <td className="px-3 py-3"><StatusBadge value={session.status} /></td>
                      <td className="px-3 py-3"><button type="button" disabled={busySession === session.id} onClick={() => setSessionToRevoke(session)} className="rounded-lg border border-rose-200 dark:border-rose-800 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 disabled:opacity-50">Revoke session</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="account-security-title" className={`${cardStyles} mt-6`}>
            <div className="flex items-center gap-2">
              <LockKeyhole className="h-5 w-5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
              <h2 id="account-security-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Account security</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">These controls are not supported by the current backend and are shown as unavailable.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                { label: 'Two-factor authentication', Icon: KeyRound },
                { label: 'Password policy', Icon: ShieldCheck },
                { label: 'Session timeout', Icon: Timer },
                { label: 'Maximum failed login attempts', Icon: CircleX },
                { label: 'Account lockout duration', Icon: Clock3 },
              ].map(({ label, Icon }) => (
                <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
                  <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                  <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-100">{label}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Unavailable</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
