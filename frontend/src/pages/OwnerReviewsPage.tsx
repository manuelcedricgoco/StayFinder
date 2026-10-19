import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Search, Star } from 'lucide-react';
import { BackLink } from '../components/ui/BackLink';
import { FilterDropdown } from '../components/ui/FilterDropdown';
import { RatingStars } from '../components/ui/RatingStars';
import { useApiResource } from '../hooks/useApiResource';

type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ReviewSort = 'NEWEST' | 'OLDEST' | 'HIGHEST_RATING' | 'LOWEST_RATING';

interface OwnerReview {
  id: string;
  rating: number;
  content: string;
  status: ReviewStatus;
  createdAt: string;
  property: { id: string; name: string };
  boarder: { name: string };
}

interface OwnerPropertyRating {
  id: string;
  name: string;
  reviewCount: number;
  averageRating: number | null;
}

interface ReviewsResponse {
  status: 'ok';
  reviews: OwnerReview[];
  properties: OwnerPropertyRating[];
  summary: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    averageRating: number | null;
    ratingBreakdown: { rating: number; count: number }[];
    mostCommonRating: number | null;
    reviewsThisMonth: number;
    ratingTrend: number | null;
  };
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const statusPresentation: Record<ReviewStatus, { label: string; className: string }> = {
  APPROVED: { label: 'Approved', className: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800' },
  PENDING: { label: 'Pending', className: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800' },
  REJECTED: { label: 'Rejected', className: 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-800' },
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function StatCard(props: { label: string; value: string | number; detail?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{props.label}</p>
      <p className={`mt-2 text-2xl font-bold ${props.accent ?? 'text-slate-900 dark:text-slate-100'}`}>{props.value}</p>
      {props.detail && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{props.detail}</p>}
    </div>
  );
}

export function OwnerReviewsPage() {
  const [search, setSearch] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [rating, setRating] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<ReviewSort>('NEWEST');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (propertyId) params.set('propertyId', propertyId);
  if (rating) params.set('rating', rating);
  if (status) params.set('status', status);
  params.set('sort', sort);
  params.set('page', String(page));
  const { state } = useApiResource<ReviewsResponse>(`/owner/reviews?${params.toString()}`);

  function resetPage(callback: () => void) {
    callback();
    setPage(1);
  }

  const data = state.status === 'success' ? state.data : null;
  const maxRatingCount = Math.max(1, ...(data?.summary.ratingBreakdown.map((item) => item.count) ?? [0]));

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
      <BackLink to="/owner">Owner dashboard</BackLink>
      <div className="mt-3">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Property Reviews</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Monitor feedback from boarders and understand how guests experience your properties.
        </p>
      </div>

      {state.status === 'loading' && <p role="status" className="py-12 text-center text-slate-500 dark:text-slate-400">Loading reviews…</p>}
      {state.status === 'error' && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-300">{state.message}</p>}

      {data && (
        <>
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Overall Rating"
              value={data.summary.averageRating === null ? '—' : `${data.summary.averageRating.toFixed(1)} / 5`}
              detail={data.summary.averageRating === null ? 'No approved reviews yet' : `Based on ${data.summary.approved} approved reviews`}
              accent="text-amber-700 dark:text-amber-400"
            />
            <StatCard label="Total Reviews" value={data.summary.total} detail="Across all your properties" />
            <StatCard label="Approved" value={data.summary.approved} detail="Visible to boarders" accent="text-emerald-700 dark:text-emerald-400" />
            <StatCard label="Pending" value={data.summary.pending} detail="Awaiting moderation" accent="text-amber-700 dark:text-amber-400" />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="rating-breakdown-title">
              <h2 id="rating-breakdown-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Rating Breakdown</h2>
              {data.summary.approved === 0 ? (
                <p className="mt-4 rounded-lg bg-slate-50 p-5 text-center text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">No reviews yet</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {data.summary.ratingBreakdown.map((item) => (
                    <div key={item.rating} className="grid grid-cols-[4.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm">
                      <span className="text-slate-600 dark:text-slate-300">{item.rating} Stars</span>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${(item.count / maxRatingCount) * 100}%` }} />
                      </div>
                      <span className="text-right tabular-nums text-slate-600 dark:text-slate-300">{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="review-insights-title">
              <h2 id="review-insights-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Review Insights</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Most Common Rating</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{data.summary.mostCommonRating === null ? '—' : `${data.summary.mostCommonRating} Stars`}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Reviews This Month</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{data.summary.reviewsThisMonth}</p>
                </div>
                <div className="col-span-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Rating Trend vs Previous Month</p>
                  {data.summary.ratingTrend === null ? (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Not enough monthly review data to compare yet.</p>
                  ) : (
                    <p className={`mt-1 flex items-center gap-1 font-semibold ${data.summary.ratingTrend >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                      {data.summary.ratingTrend >= 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                      {Math.abs(data.summary.ratingTrend).toFixed(1)} stars compared with last month
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>

          <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="property-ratings-title">
            <h2 id="property-ratings-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Ratings by Property</h2>
            {data.properties.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Add a property to see its review performance here.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <tr><th className="py-2 pr-4 font-medium">Property</th><th className="py-2 pr-4 font-medium">Reviews</th><th className="py-2 font-medium">Average Rating</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.properties.slice().sort((a, b) => b.reviewCount - a.reviewCount || a.name.localeCompare(b.name)).map((property) => (
                      <tr key={property.id}>
                        <td className="py-3 pr-4">
                          <button type="button" onClick={() => resetPage(() => setPropertyId(property.id))}
                            className="text-left font-medium text-emerald-800 hover:underline dark:text-emerald-300">{property.name}</button>
                        </td>
                        <td className="py-3 pr-4 tabular-nums text-slate-700 dark:text-slate-200">{property.reviewCount}</td>
                        <td className="py-3">
                          {property.averageRating === null ? <span className="text-slate-400">No approved reviews</span> : (
                            <span className="inline-flex items-center gap-1 font-medium text-slate-800 dark:text-slate-100">
                              <Star size={15} fill="currentColor" className="text-amber-500" /> {property.averageRating.toFixed(1)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mt-7" aria-labelledby="recent-reviews-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="recent-reviews-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">Recent Reviews</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Newest reviews appear first by default.</p>
              </div>
              {propertyId && (
                <button type="button" onClick={() => resetPage(() => setPropertyId(''))}
                  className="text-sm font-medium text-emerald-800 hover:underline dark:text-emerald-300">Clear property filter</button>
              )}
            </div>

            <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1.5fr)_minmax(10rem,1fr)_minmax(8rem,0.75fr)_minmax(8rem,0.8fr)_minmax(9rem,1fr)] dark:border-slate-700 dark:bg-slate-900">
              <label className="relative sm:col-span-2 lg:col-span-1">
                <span className="sr-only">Search reviews</span>
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))}
                  placeholder="Search reviewer or review…" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-600" />
              </label>
              <div>
                <span className="sr-only">Filter by property</span>
                <FilterDropdown
                  fullWidth
                  options={[
                    { label: 'All Properties', value: '' },
                    ...data.properties.map((property) => ({ label: property.name, value: property.id })),
                  ]}
                  selected={propertyId}
                  onSelect={(val) => resetPage(() => setPropertyId(val))}
                />
              </div>
              <div>
                <span className="sr-only">Filter by rating</span>
                <FilterDropdown
                  fullWidth
                  options={[
                    { label: 'All Ratings', value: '' },
                    ...[5, 4, 3, 2, 1].map((value) => ({ label: `${value} Stars`, value: String(value) })),
                  ]}
                  selected={rating}
                  onSelect={(val) => resetPage(() => setRating(val))}
                />
              </div>
              <div>
                <span className="sr-only">Filter by status</span>
                <FilterDropdown
                  fullWidth
                  options={[
                    { label: 'All Statuses', value: '' },
                    { label: 'Approved', value: 'APPROVED' },
                    { label: 'Pending', value: 'PENDING' },
                    { label: 'Rejected', value: 'REJECTED' },
                  ]}
                  selected={status}
                  onSelect={(val) => resetPage(() => setStatus(val))}
                />
              </div>
              <div>
                <span className="sr-only">Sort reviews</span>
                <FilterDropdown
                  fullWidth
                  options={[
                    { label: 'Newest', value: 'NEWEST' },
                    { label: 'Oldest', value: 'OLDEST' },
                    { label: 'Highest Rating', value: 'HIGHEST_RATING' },
                    { label: 'Lowest Rating', value: 'LOWEST_RATING' },
                  ]}
                  selected={sort}
                  onSelect={(val) => resetPage(() => setSort(val as ReviewSort))}
                />
              </div>
            </div>

            {data.reviews.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center dark:border-slate-600 dark:bg-slate-900">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{data.summary.total === 0 ? 'No reviews yet' : 'No reviews match these filters'}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {data.summary.total === 0
                    ? 'Once boarders review your properties, their feedback will appear here.'
                    : 'Try changing the search or filters to see more reviews.'}
                </p>
                {data.summary.total === 0 && <Link to="/owner/properties" className="mt-4 inline-block text-sm font-semibold text-emerald-800 hover:underline dark:text-emerald-300">View My Properties →</Link>}
              </div>
            ) : (
              <ul className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {data.reviews.map((review) => {
                  const badge = statusPresentation[review.status];
                  return (
                    <li key={review.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link to={`/owner/properties/${encodeURIComponent(review.property.id)}`}
                            className="font-semibold text-emerald-800 hover:underline dark:text-emerald-300">{review.property.name}</Link>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Review by <span className="font-medium text-slate-700 dark:text-slate-200">{review.boarder.name}</span></p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badge.className}`}>{badge.label}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <RatingStars rating={review.rating} />
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{review.rating}.0 / 5</span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <time dateTime={review.createdAt} className="text-xs text-slate-500 dark:text-slate-400">{formatDate(review.createdAt)}</time>
                      </div>
                      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-200">{review.content}</p>
                      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                        <Link to={`/owner/properties/${encodeURIComponent(review.property.id)}`}
                          className="text-sm font-semibold text-emerald-800 hover:underline dark:text-emerald-300">View Property →</Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {data.pagination.totalPages > 1 && (
              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} reviews
                </p>
                <div className="flex gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200">Previous</button>
                  <button type="button" disabled={page >= data.pagination.totalPages} onClick={() => setPage((current) => current + 1)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200">Next</button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
