import { Link } from 'react-router-dom';
import { BackLink } from '../components/ui/BackLink';
import { useApiResource } from '../hooks/useApiResource';

interface BoarderInquiry {
  id: string;
  message: string;
  response: string | null;
  status: 'PENDING' | 'RESPONDED' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
  property: { id: string; name: string; status: string; location: { name: string } };
  owner: { name: string };
}

interface InquiryResponse {
  status: 'ok';
  inquiries: BoarderInquiry[];
}

const statusStyle: Record<BoarderInquiry['status'], string> = {
  PENDING: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300',
  RESPONDED: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300',
  CLOSED: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200',
};

export function BoarderInquiriesPage() {
  const { state } = useApiResource<InquiryResponse>('/boarder/inquiries');

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-12">
      <BackLink to="/boarder">Boarder dashboard</BackLink>
      <h1 className="mt-3 text-3xl font-bold text-slate-900 dark:text-slate-100">My inquiries</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">Messages you have sent to property owners.</p>
      {state.status === 'loading' && <p role="status" className="py-12 text-center text-slate-500 dark:text-slate-400">Loading inquiries…</p>}
      {state.status === 'error' && <p role="alert" className="mt-5 rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-800 dark:text-red-400">{state.message}</p>}
      {state.status === 'success' && state.data.inquiries.length === 0 && (
        <div className="mt-6 rounded-xl bg-slate-50 dark:bg-slate-800 p-8 text-center">
          <p className="font-semibold text-slate-900 dark:text-slate-100">No inquiries yet</p>
          <Link to="/properties" className="mt-3 inline-block font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">Browse approved properties</Link>
        </div>
      )}
      {state.status === 'success' && state.data.inquiries.length > 0 && (
        <ul className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {state.data.inquiries.map((inquiry) => (
            <li key={inquiry.id} className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link to={`/properties/${encodeURIComponent(inquiry.property.id)}`} className="text-lg font-semibold text-emerald-800 dark:text-emerald-300 hover:underline">
                      {inquiry.property.name}
                    </Link>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{inquiry.property.location.name} · Owner: {inquiry.owner.name}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[inquiry.status]}`}>
                    {inquiry.status}
                  </span>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Your message</h2>
                  <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-200">{inquiry.message}</p>
                </div>
                {inquiry.response && (
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950 p-4">
                    <h2 className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">Owner response</h2>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-emerald-900 dark:text-emerald-300">{inquiry.response}</p>
                  </div>
                )}
              </div>
              <p className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4 text-xs text-slate-500 dark:text-slate-400">Sent {new Date(inquiry.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
