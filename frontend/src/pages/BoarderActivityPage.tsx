import { Link } from 'react-router-dom';
import { BackLink } from '../components/ui/BackLink';
import { RatingStars } from '../components/ui/RatingStars';
import { useApiResource } from '../hooks/useApiResource';

interface BoarderReview {
  id: string;
  rating: number;
  content: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  property: { id: string; name: string };
}

interface BoarderReport {
  id: string;
  reason: string;
  details: string | null;
  status: 'PENDING' | 'RESOLVED' | 'REJECTED';
  createdAt: string;
  property: { id: string; name: string };
}

type ActivityResponse =
  | { status: 'ok'; reviews: BoarderReview[] }
  | { status: 'ok'; reports: BoarderReport[] };

export function BoarderActivityPage({ kind }: { kind: 'reviews' | 'reports' }) {
  const { state } = useApiResource<ActivityResponse>(`/boarder/${kind}`);
  const title = kind === 'reviews' ? 'My reviews' : 'My reports';

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-12">
      <BackLink to="/boarder">Boarder dashboard</BackLink>
      <h1 className="mt-3 text-3xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        {kind === 'reviews'
          ? 'Reviews are checked by moderators before they can be published.'
          : 'Reports are confidential and reviewed by the platform team.'}
      </p>
      {state.status === 'loading' && <p role="status" className="py-12 text-center text-slate-500 dark:text-slate-400">Loading…</p>}
      {state.status === 'error' && <p role="alert" className="mt-5 rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-800 dark:text-red-400">{state.message}</p>}
      {state.status === 'success' && kind === 'reviews' && 'reviews' in state.data && state.data.reviews.length === 0 && (
        <p className="mt-6 rounded-xl bg-slate-50 dark:bg-slate-800 p-8 text-center text-slate-600 dark:text-slate-300">You have not submitted any reviews.</p>
      )}
      {state.status === 'success' && kind === 'reports' && 'reports' in state.data && state.data.reports.length === 0 && (
        <p className="mt-6 rounded-xl bg-slate-50 dark:bg-slate-800 p-8 text-center text-slate-600 dark:text-slate-300">You have not submitted any reports.</p>
      )}
      {state.status === 'success' && kind === 'reviews' && 'reviews' in state.data && (
        <ul className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {state.data.reviews.map((review) => (
            <li key={review.id} className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
              <div>
                <div className="flex flex-wrap justify-between gap-2">
                  <Link to={`/properties/${encodeURIComponent(review.property.id)}`} className="font-semibold text-emerald-800 dark:text-emerald-300 hover:underline">{review.property.name}</Link>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-400">
                    <RatingStars rating={review.rating} />
                    <span className="text-slate-600 dark:text-slate-300">· {review.status}</span>
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-200">{review.content}</p>
              </div>
              <p className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-500 dark:text-slate-400">Submitted {new Date(review.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
      {state.status === 'success' && kind === 'reports' && 'reports' in state.data && (
        <ul className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {state.data.reports.map((report) => (
            <li key={report.id} className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
              <div>
                <div className="flex flex-wrap justify-between gap-2">
                  <Link to={`/properties/${encodeURIComponent(report.property.id)}`} className="font-semibold text-emerald-800 dark:text-emerald-300 hover:underline">{report.property.name}</Link>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{report.status}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{report.reason.replace(/_/g, ' ')}</p>
                {report.details && <p className="mt-2 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{report.details}</p>}
              </div>
              <p className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-500 dark:text-slate-400">Submitted {new Date(report.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
