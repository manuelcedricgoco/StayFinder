import {
  AlertCircle,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  DoorOpen,
  MessageCircle,
  Plus,
  Star,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApiResource } from '../hooks/useApiResource';
import { useAuth } from '../hooks/useAuth';

type VerificationStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'NOT_VERIFIED';

interface PropertyPerformance {
  id: string;
  name: string;
  location: string;
  totalRooms: number | null;
  availableRooms: number;
  occupiedRooms: number | null;
  roomAvailabilityTracked: boolean;
  monthlyInquiries: number;
  averageRating: number | null;
  reviewCount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'INACTIVE';
}

interface RecentInquiry {
  id: string;
  message: string;
  status: 'PENDING' | 'RESPONDED' | 'CLOSED';
  createdAt: string;
  sender: { name: string };
  property: { id: string; name: string };
}

interface RecentReview {
  id: string;
  rating: number;
  content: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  boarder: { name: string };
  property: { id: string; name: string };
}

interface OwnerStats {
  totalProperties: number;
  approvedProperties: number;
  pendingProperties: number;
  availableRooms: number;
  occupiedRooms: number;
  trackedRoomCount: number;
  availableTrackedRooms: number;
  occupiedTrackedRooms: number;
  newInquiries: number;
  totalInquiries: number;
  averageRating: number | null;
  publishedReviewCount: number;
  verificationStatus: VerificationStatus;
  profileStatus: VerificationStatus;
  propertyPerformance: PropertyPerformance[];
  recentInquiries: RecentInquiry[];
  recentReviews: RecentReview[];
  earnings: { available: boolean };
  bookings: { available: boolean };
}

interface StatsResponse {
  status: 'ok';
  stats: OwnerStats;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  description: string;
  Icon: LucideIcon;
  tone?: 'default' | 'attention' | 'positive';
}

const panelCard = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900';

function MetricCard({ title, value, description, Icon, tone = 'default' }: MetricCardProps) {
  const iconColor = tone === 'attention'
    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
    : tone === 'positive'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  return (
    <article className={`rounded-xl border bg-white p-4 shadow-sm sm:p-5 dark:bg-slate-900 ${tone === 'attention' ? 'border-amber-200 dark:border-amber-800' : 'border-slate-200 dark:border-slate-700'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconColor}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{description}</p>
    </article>
  );
}

function formatRelativeDate(value: string) {
  const elapsedSeconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(elapsedSeconds) < 60) return formatter.format(elapsedSeconds, 'second');
  if (Math.abs(elapsedSeconds) < 3600) return formatter.format(Math.round(elapsedSeconds / 60), 'minute');
  if (Math.abs(elapsedSeconds) < 86400) return formatter.format(Math.round(elapsedSeconds / 3600), 'hour');
  return formatter.format(Math.round(elapsedSeconds / 86400), 'day');
}

function statusLabel(status: string) {
  return status.toLowerCase().replace(/_/g, ' ');
}

function statusClass(status: string) {
  if (status === 'APPROVED' || status === 'RESPONDED') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300';
  if (status === 'PENDING') return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300';
  if (status === 'REJECTED' || status === 'INACTIVE' || status === 'CLOSED') return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300';
}

function verificationDetails(status: VerificationStatus) {
  if (status === 'APPROVED') {
    return {
      title: 'Verified Owner',
      description: 'Your account has been successfully verified.',
      style: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
      Icon: CheckCircle2,
    };
  }
  if (status === 'PENDING') {
    return {
      title: 'Verification Pending',
      description: 'Your verification request is currently being reviewed.',
      style: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
      Icon: Clock3,
    };
  }
  if (status === 'REJECTED') {
    return {
      title: 'Verification needs attention',
      description: 'Your previous request was not approved. Review the status and resubmit.',
      style: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200',
      Icon: AlertCircle,
    };
  }
  return {
    title: 'Not verified',
    description: 'Submit your details to request owner verification.',
    style: 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100',
    Icon: BadgeCheck,
  };
}

function AttentionItem({ title, description, to, action }: { title: string; description: string; to: string; action: string }) {
  return (
    <li className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center dark:border-slate-700 dark:bg-slate-900">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-slate-100">{title}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>
        </div>
      </div>
      <Link to={to} className="self-start whitespace-nowrap text-sm font-semibold text-emerald-700 hover:underline sm:self-center dark:text-emerald-400">{action} →</Link>
    </li>
  );
}

export function OwnerDashboardPage() {
  const { user } = useAuth();
  const { state } = useApiResource<StatsResponse>('/owner/dashboard');
  const stats = state.status === 'success' ? state.data.stats : null;
  const verification = verificationDetails(stats?.verificationStatus ?? 'NOT_VERIFIED');
  const VerificationIcon = verification.Icon;
  const attentionItems = stats ? [
    ...(stats.newInquiries > 0
      ? [{
          title: `${stats.newInquiries} new ${stats.newInquiries === 1 ? 'inquiry' : 'inquiries'}`,
          description: `You have unanswered questions from boarders about your properties.`,
          to: '/owner/inquiries',
          action: 'View Inquiry',
        }]
      : []),
    ...(stats.pendingProperties > 0
      ? [{
          title: `${stats.pendingProperties} listing${stats.pendingProperties === 1 ? '' : 's'} under review`,
          description: 'Your property submissions are awaiting review.',
          to: '/owner/properties',
          action: 'View Listings',
        }]
      : []),
    ...(stats.propertyPerformance.some((property) => property.status === 'REJECTED')
      ? [{
          title: 'A listing needs an update',
          description: 'Review a rejected listing for its feedback and update it.',
          to: '/owner/properties',
          action: 'Update Listing',
        }]
      : []),
    ...(stats.verificationStatus === 'REJECTED' || stats.verificationStatus === 'NOT_VERIFIED'
      ? [{
          title: stats.verificationStatus === 'REJECTED' ? 'Verification needs attention' : 'Verify your owner account',
          description: stats.verificationStatus === 'REJECTED'
            ? 'Review the verification result and submit an updated request.'
            : 'Verification helps boarders know your owner identity has been reviewed.',
          to: '/owner/verification',
          action: 'View Verification',
        }]
      : []),
  ] : [];

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
      <header>
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Welcome back, {user?.name ?? 'Owner'} 👋</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">Owner Dashboard</h1>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
          Manage your properties, track inquiries, monitor bookings, and keep your listings up to date.
        </p>
      </header>

      {state.status === 'loading' && <p role="status" className="mt-6 text-slate-500 dark:text-slate-400">Loading your property dashboard…</p>}
      {state.status === 'error' && <p role="alert" className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{state.message}</p>}

      {stats && (
        <>
          <section aria-label="Owner statistics" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="My Properties" value={stats.totalProperties} description="Properties you own" Icon={Building2} />
            <MetricCard title="Available Rooms" value={stats.availableRooms} description="Currently listed as available" Icon={DoorOpen} tone="positive" />
            <MetricCard title="Occupied Rooms" value={stats.occupiedRooms} description="Individual rooms marked unavailable" Icon={DoorOpen} />
            <MetricCard title="New Inquiries" value={stats.newInquiries} description="Unanswered boarder questions" Icon={MessageCircle} tone={stats.newInquiries ? 'attention' : 'default'} />
            <MetricCard title="Upcoming Bookings" value="Unavailable" description="Reservations are not supported yet" Icon={CalendarDays} />
            <MetricCard title="Monthly Earnings" value="Unavailable" description="No payment data available yet" Icon={CreditCard} />
            <MetricCard title="Average Rating" value={stats.averageRating === null ? '—' : `${stats.averageRating.toFixed(1)} / 5`} description={`${stats.publishedReviewCount} published ${stats.publishedReviewCount === 1 ? 'review' : 'reviews'}`} Icon={Star} tone="positive" />
            <MetricCard title="Owner Verification" value={statusLabel(stats.verificationStatus)} description="Profile and verification status" Icon={UserRound} tone={stats.verificationStatus === 'APPROVED' ? 'positive' : stats.verificationStatus === 'PENDING' ? 'attention' : 'default'} />
          </section>

          <section aria-labelledby="needs-attention-title" className="mt-7">
            <h2 id="needs-attention-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">Needs Your Attention</h2>
            {attentionItems.length === 0 ? (
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">You&apos;re all caught up! 🎉</p>
                  <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">There are no pending owner actions right now.</p>
                </div>
              </div>
            ) : (
              <ul className="mt-3 space-y-3">
                {attentionItems.map((item) => <AttentionItem key={item.title} {...item} />)}
              </ul>
            )}
          </section>

          <section aria-labelledby="property-performance-title" className="mt-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="property-performance-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">Property Performance</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Availability, monthly inquiries, ratings, and listing status.</p>
              </div>
              <Link to="/owner/properties" className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">Manage Properties →</Link>
            </div>
            {stats.propertyPerformance.length === 0 ? (
              <div className={`${panelCard} mt-3 text-center`}>
                <Building2 className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
                <p className="mt-3 font-semibold text-slate-900 dark:text-slate-100">You don&apos;t have any properties yet.</p>
                <Link to="/owner/properties/new" className="mt-4 inline-flex rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">+ Add Your First Property</Link>
              </div>
            ) : (
              <div className="mt-3 grid gap-3 xl:grid-cols-2">
                {stats.propertyPerformance.map((property) => (
                  <article key={property.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-lg font-semibold text-slate-900 dark:text-slate-100">{property.name}</h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{property.location}, Occidental Mindoro</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(property.status)}`}>{statusLabel(property.status)}</span>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div><dt className="text-xs text-slate-500 dark:text-slate-400">Total rooms</dt><dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{property.totalRooms === null ? 'Not tracked' : property.totalRooms}</dd></div>
                      <div><dt className="text-xs text-slate-500 dark:text-slate-400">Available</dt><dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{property.availableRooms}</dd></div>
                      <div><dt className="text-xs text-slate-500 dark:text-slate-400">Occupied</dt><dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{property.occupiedRooms === null ? 'Not tracked' : property.occupiedRooms}</dd></div>
                      <div><dt className="text-xs text-slate-500 dark:text-slate-400">Inquiries this month</dt><dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{property.monthlyInquiries}</dd></div>
                      <div><dt className="text-xs text-slate-500 dark:text-slate-400">Average rating</dt><dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{property.averageRating === null ? '—' : `★ ${property.averageRating.toFixed(1)}`}</dd></div>
                      <div><dt className="text-xs text-slate-500 dark:text-slate-400">Reviews</dt><dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{property.reviewCount}</dd></div>
                    </dl>
                    {!property.roomAvailabilityTracked && (
                      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Individual room occupancy is not tracked for this listing yet.</p>
                    )}
                    <Link to={`/owner/properties/${encodeURIComponent(property.id)}`} className="mt-4 inline-flex text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">Manage Property →</Link>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="mt-7 grid gap-5 xl:grid-cols-2">
            <section aria-labelledby="recent-inquiries-title" className={panelCard}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 id="recent-inquiries-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">Recent Inquiries</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Latest messages from boarders.</p>
                </div>
                <Link to="/owner/inquiries" className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">View All Inquiries →</Link>
              </div>
              {stats.recentInquiries.length === 0 ? (
                <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">No new inquiries yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {stats.recentInquiries.map((inquiry) => (
                    <li key={inquiry.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{inquiry.sender.name}</p>
                          <Link to={`/owner/properties/${encodeURIComponent(inquiry.property.id)}`} className="mt-0.5 inline-block text-sm text-emerald-700 hover:underline dark:text-emerald-400">{inquiry.property.name}</Link>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${statusClass(inquiry.status)}`}>{statusLabel(inquiry.status)}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{inquiry.message}</p>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <time dateTime={inquiry.createdAt}>{formatRelativeDate(inquiry.createdAt)}</time>
                        <Link to="/owner/inquiries" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">View Inquiry →</Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="upcoming-bookings-title" className={panelCard}>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <h2 id="upcoming-bookings-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">Upcoming Bookings</h2>
              </div>
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 dark:border-slate-600 dark:bg-slate-800">
                <p className="font-medium text-slate-800 dark:text-slate-100">Bookings are not available yet.</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">StayFinder does not currently store reservations or check-in dates, so there are no booking records to display.</p>
              </div>
            </section>
          </div>

          <div className="mt-7 grid gap-5 xl:grid-cols-2">
            <section aria-labelledby="earnings-title" className={panelCard}>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <h2 id="earnings-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">Earnings Overview</h2>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {['This Month', 'Last Month', 'Total Earnings'].map((label) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Unavailable</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex min-h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center dark:border-slate-600 dark:bg-slate-800">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">No payment data available yet.</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Transactions are not currently recorded, so an earnings chart cannot be calculated.</p>
                </div>
              </div>
              <Link to="/owner/payments" className="mt-4 inline-flex text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">Payments →</Link>
            </section>

            <section aria-labelledby="room-availability-title" className={panelCard}>
              <div className="flex items-center gap-2">
                <DoorOpen className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <h2 id="room-availability-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">Room Availability</h2>
              </div>
              {stats.trackedRoomCount > 0 ? (
                <>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Individual room units only ({stats.trackedRoomCount} tracked).</p>
                  <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="img" aria-label={`${stats.availableTrackedRooms} available and ${stats.occupiedTrackedRooms} unavailable individual rooms`}>
                    <span className="bg-emerald-500" style={{ width: `${stats.availableTrackedRooms / stats.trackedRoomCount * 100}%` }} />
                    <span className="bg-slate-400" style={{ width: `${stats.occupiedTrackedRooms / stats.trackedRoomCount * 100}%` }} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />Available<span className="ml-auto font-semibold text-slate-900 dark:text-slate-100">{stats.availableTrackedRooms}</span></div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" aria-hidden="true" />Occupied / unavailable<span className="ml-auto font-semibold text-slate-900 dark:text-slate-100">{stats.occupiedTrackedRooms}</span></div>
                  </div>
                  <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Reserved and maintenance statuses are not part of the current room data model.</p>
                </>
              ) : (
                <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">No individual room units are tracked yet. Add rooms from a property&apos;s management page to see availability breakdowns.</p>
              )}
            </section>
          </div>

          <div className="mt-7 grid gap-5 xl:grid-cols-2">
            <section aria-labelledby="recent-reviews-title" className={panelCard}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 id="recent-reviews-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">Recent Reviews</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Latest reviews for your properties.</p>
                </div>
                <Link to="/owner/reviews" className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">View All Reviews →</Link>
              </div>
              {stats.recentReviews.length === 0 ? (
                <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">No reviews yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {stats.recentReviews.map((review) => (
                    <li key={review.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{review.boarder.name}</p>
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 dark:text-amber-400"><Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />{review.rating.toFixed(1)}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-700 dark:text-slate-200">{review.content}</p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Link to={`/owner/properties/${encodeURIComponent(review.property.id)}`} className="text-emerald-700 hover:underline dark:text-emerald-400">{review.property.name}</Link>
                        <span>{formatRelativeDate(review.createdAt)} · {statusLabel(review.status)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="verification-title" className={panelCard}>
              <div className="flex items-center gap-2">
                <VerificationIcon className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <h2 id="verification-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">Owner Verification</h2>
              </div>
              <div className={`mt-4 rounded-xl border p-4 ${verification.style}`}>
                <p className="font-semibold">{verification.title}</p>
                <p className="mt-1 text-sm">{verification.description}</p>
              </div>
              <Link to="/owner/verification" className="mt-4 inline-flex text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">View Verification →</Link>
            </section>
          </div>

          <section aria-labelledby="quick-actions-title" className="mt-7">
            <h2 id="quick-actions-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">Quick Actions</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { to: '/owner/properties/new', label: 'Add Property', Icon: Plus },
                { to: '/owner/properties', label: 'Manage Properties', Icon: Building2 },
                { to: '/owner/inquiries', label: 'View Inquiries', Icon: MessageCircle },
                { to: '/owner/payments', label: 'Payments', Icon: CreditCard },
                { to: '/owner/reviews', label: 'View Reviews', Icon: Star },
              ].map(({ to, label, Icon }) => (
                <Link key={to} to={to} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-700">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
                  <span className="ml-auto text-slate-400" aria-hidden="true">→</span>
                </Link>
              ))}
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400" aria-label="Bookings not currently available">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white dark:bg-slate-700"><CalendarDays className="h-4 w-4" aria-hidden="true" /></span>
                <span><span className="block text-sm font-semibold">View Bookings</span><span className="text-xs">Not available yet</span></span>
              </div>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
