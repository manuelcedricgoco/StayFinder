import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock3,
  Flag,
  MessageSquareText,
  ShieldCheck,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApiResource } from '../hooks/useApiResource';

interface DashboardActivity {
  id: string;
  type: string;
  description: string;
  person: string;
  target: string | null;
  status: string;
  createdAt: string;
}

interface AdminStats {
  totalUsers: number;
  owners: number;
  boarders: number;
  administrators: number;
  totalProperties: number;
  pendingProperties: number;
  approvedProperties: number;
  rejectedProperties: number;
  inactiveProperties: number;
  verifiedOwners: number;
  pendingReviews: number;
  pendingReports: number;
  pendingVerifications: number;
  recentActivity: DashboardActivity[];
  securitySummary: {
    failedLoginAttempts: number;
    activeSessions: number;
    suspiciousActivities: number;
    latestEvent: { action: string; person: string; createdAt: string } | null;
  };
}

interface AdminStatsResponse {
  status: 'ok';
  stats: AdminStats;
}

interface OverviewCard {
  label: string;
  description: string;
  value: number;
  Icon: LucideIcon;
  tone: 'default' | 'warning' | 'success';
}

const quickActions = [
  { to: '/admin/properties', title: 'Review Listings', Icon: Building2 },
  { to: '/admin/verifications', title: 'Verify Owners', Icon: BadgeCheck },
  { to: '/admin/reports', title: 'Review Reports', Icon: Flag },
  { to: '/admin/reviews', title: 'Moderate Reviews', Icon: Star },
  { to: '/admin/users', title: 'Manage Users', Icon: Users },
  { to: '/admin/security', title: 'View Security Logs', Icon: ShieldCheck },
];

function formatActivityDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'long',
  }).format(value);
}

function statusTone(value: string) {
  switch (value.toUpperCase()) {
    case 'APPROVED':
    case 'SUCCESS':
    case 'RESOLVED':
      return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
    case 'PENDING':
    case 'REVIEW':
      return 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
    case 'REJECTED':
    case 'FAILED':
      return 'bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300';
    case 'INACTIVE':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
    default:
      return 'bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-300';
  }
}

function ActivityIcon({ type }: { type: string }) {
  if (type.includes('PROPERTY') || type.includes('LISTING')) return <Building2 className="h-4 w-4" aria-hidden="true" />;
  if (type.includes('VERIFICATION')) return <BadgeCheck className="h-4 w-4" aria-hidden="true" />;
  if (type.includes('REPORT')) return <Flag className="h-4 w-4" aria-hidden="true" />;
  if (type.includes('REVIEW')) return <Star className="h-4 w-4" aria-hidden="true" />;
  if (type.includes('LOGIN') || type.includes('SESSION')) return <ShieldCheck className="h-4 w-4" aria-hidden="true" />;
  return <Users className="h-4 w-4" aria-hidden="true" />;
}

function OverviewCard({ label, description, value, Icon, tone }: OverviewCard) {
  const indicator = tone === 'warning'
    ? 'bg-amber-500'
    : tone === 'success'
      ? 'bg-emerald-500'
      : 'bg-slate-300 dark:bg-slate-600';
  const iconTone = tone === 'warning'
    ? 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
    : tone === 'success'
      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';

  return (
    <article className={`group flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md ${
      tone === 'warning' ? 'border-amber-200 dark:border-amber-800' : ''
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{value.toLocaleString()}</p>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconTone}`}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${indicator}`} aria-hidden="true" />
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </article>
  );
}

export function AdminDashboardPage() {
  const { state } = useApiResource<AdminStatsResponse>('/admin/dashboard');
  const today = formatDate(new Date());

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Admin Dashboard</h1>
          <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
            Monitor StayFinder listings, users, owner verification, reports, reviews, and platform activity.
          </p>
        </div>
        <p className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 shadow-sm">
          <Clock3 className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" /> {today}
        </p>
      </header>

      {state.status === 'loading' && <p role="status" className="mt-6 text-slate-500 dark:text-slate-400">Loading dashboard activity…</p>}
      {state.status === 'error' && <p role="alert" className="mt-6 rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-300">{state.message}</p>}

      {state.status === 'success' && (
        <>
          <section aria-label="Platform statistics" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {([
              { label: 'Total Users', description: 'All registered accounts', value: state.data.stats.totalUsers, Icon: Users, tone: 'default' },
              { label: 'Property Listings', description: 'Total properties submitted', value: state.data.stats.totalProperties, Icon: Building2, tone: 'default' },
              { label: 'Pending Listings', description: 'Awaiting admin approval', value: state.data.stats.pendingProperties, Icon: Clock3, tone: 'warning' },
              { label: 'Verified Owners', description: 'Completed owner verification', value: state.data.stats.verifiedOwners, Icon: BadgeCheck, tone: 'success' },
              { label: 'Pending Verifications', description: 'Owner requests to review', value: state.data.stats.pendingVerifications, Icon: BadgeCheck, tone: 'warning' },
              { label: 'Active Reports', description: 'Unresolved property reports', value: state.data.stats.pendingReports, Icon: Flag, tone: state.data.stats.pendingReports ? 'warning' : 'default' },
              { label: 'Pending Reviews', description: 'Waiting for moderation', value: state.data.stats.pendingReviews, Icon: Star, tone: state.data.stats.pendingReviews ? 'warning' : 'default' },
              { label: 'Active Properties', description: 'Approved and published', value: state.data.stats.approvedProperties, Icon: CheckCircle2, tone: 'success' },
            ] satisfies OverviewCard[]).map((card) => <OverviewCard key={card.label} {...card} />)}
          </section>

          <section aria-labelledby="needs-attention-title" className="mt-7">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 id="needs-attention-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">Needs Attention</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Prioritize the outstanding reviews and requests.</p>
              </div>
              <AlertTriangle className="mb-1 h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { title: 'Pending Listing Approvals', count: state.data.stats.pendingProperties, to: '/admin/properties', color: 'border-rose-500' },
                { title: 'Owner Verification Requests', count: state.data.stats.pendingVerifications, to: '/admin/verifications', color: 'border-orange-500' },
                { title: 'Unresolved Property Reports', count: state.data.stats.pendingReports, to: '/admin/reports', color: 'border-orange-500' },
                { title: 'Reviews Waiting for Moderation', count: state.data.stats.pendingReviews, to: '/admin/reviews', color: 'border-amber-500' },
              ].map((item) => (
                <article key={item.title} className={`flex flex-col justify-between gap-4 rounded-xl border-l-4 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm transition hover:border-l-8 hover:shadow-md ${item.color}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.title}</p>
                    <span className="text-xl font-bold text-slate-900 dark:text-slate-100">{item.count}</span>
                  </div>
                  <Link to={item.to} className="group inline-flex w-fit items-center gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400">
                    Review
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </Link>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="property-overview-title" className="mt-7 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="property-overview-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">Property Listing Overview</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Current listing review and publication status.</p>
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{state.data.stats.totalProperties.toLocaleString()} total listings</p>
            </div>
            <div className="mt-5 flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="img" aria-label={`Listings: ${state.data.stats.approvedProperties} approved, ${state.data.stats.pendingProperties} pending, ${state.data.stats.rejectedProperties} rejected, ${state.data.stats.inactiveProperties} suspended`}>
              {[
                { label: 'Approved', value: state.data.stats.approvedProperties, color: 'bg-emerald-500' },
                { label: 'Pending', value: state.data.stats.pendingProperties, color: 'bg-amber-400' },
                { label: 'Rejected', value: state.data.stats.rejectedProperties, color: 'bg-rose-500' },
                { label: 'Suspended', value: state.data.stats.inactiveProperties, color: 'bg-slate-400' },
              ].map((item) => (
                <span
                  key={item.label}
                  className={item.color}
                  style={{ width: state.data.stats.totalProperties ? `${item.value / state.data.stats.totalProperties * 100}%` : '0%' }}
                />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Approved', value: state.data.stats.approvedProperties, color: 'bg-emerald-500' },
                { label: 'Pending', value: state.data.stats.pendingProperties, color: 'bg-amber-400' },
                { label: 'Rejected', value: state.data.stats.rejectedProperties, color: 'bg-rose-500' },
                { label: 'Suspended', value: state.data.stats.inactiveProperties, color: 'bg-slate-400' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} aria-hidden="true" />
                  <span>{item.label}</span>
                  <span className="ml-auto font-semibold text-slate-900 dark:text-slate-100">{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="recent-activity-title" className="mt-7 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <div>
                <h2 id="recent-activity-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">Recent Activity</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Latest activity from platform records and security audit logs.</p>
              </div>
            </div>
            {state.data.stats.recentActivity.length === 0 ? (
              <p className="mt-5 rounded-xl bg-slate-50 dark:bg-slate-800 p-5 text-sm text-slate-600 dark:text-slate-300">No recent platform activity to show.</p>
            ) : (
              <ol className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
                {state.data.stats.recentActivity.map((item) => (
                  <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      <ActivityIcon type={item.type} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium capitalize text-slate-900 dark:text-slate-100">{item.description}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(item.status)}`}>{item.status.toLowerCase()}</span>
                      </div>
                      <p className="mt-1 break-words text-sm text-slate-600 dark:text-slate-300">
                        {item.person}{item.target ? <> · <span className="font-medium text-slate-700 dark:text-slate-200">{item.target}</span></> : null}
                      </p>
                    </div>
                    <time dateTime={item.createdAt} className="shrink-0 pt-1 text-right text-xs text-slate-500 dark:text-slate-400">{formatActivityDate(item.createdAt)}</time>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            <section aria-labelledby="user-overview-title" className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <h2 id="user-overview-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">User Overview</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{state.data.stats.totalUsers.toLocaleString()} registered users</p>
              <dl className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { label: 'Boarders', value: state.data.stats.boarders },
                  { label: 'Owners', value: state.data.stats.owners },
                  { label: 'Administrators', value: state.data.stats.administrators },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-center">
                    <dd className="text-xl font-bold text-slate-900 dark:text-slate-100">{item.value.toLocaleString()}</dd>
                    <dt className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.label}</dt>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby="security-summary-title" className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <h2 id="security-summary-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">Security</h2>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: 'Failed logins', value: state.data.stats.securitySummary.failedLoginAttempts },
                  { label: 'Active sessions', value: state.data.stats.securitySummary.activeSessions },
                  { label: 'Potentially suspicious', value: state.data.stats.securitySummary.suspiciousActivities },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-center">
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{item.value.toLocaleString()}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                Latest event:{' '}
                {state.data.stats.securitySummary.latestEvent
                  ? <><span className="font-medium text-slate-800 dark:text-slate-100">{state.data.stats.securitySummary.latestEvent.person} · {state.data.stats.securitySummary.latestEvent.action.toLowerCase().split('_').join(' ')}</span> <time dateTime={state.data.stats.securitySummary.latestEvent.createdAt}>({formatActivityDate(state.data.stats.securitySummary.latestEvent.createdAt)})</time></>
                  : 'No security events recorded'}
              </p>
              <Link to="/admin/security" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">View Security →</Link>
            </section>
          </div>

          <section aria-labelledby="quick-actions-title" className="mt-7">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
              <h2 id="quick-actions-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">Quick Actions</h2>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {quickActions.map(({ to, title, Icon }) => (
                <Link key={to} to={to} className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm transition hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</span>
                  <span className="ml-auto text-slate-400 dark:text-slate-500" aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
