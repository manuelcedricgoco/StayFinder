import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Clock3, MapPin, MessageCircle, Search } from 'lucide-react';
import { BackLink } from '../components/ui/BackLink';
import { FilterDropdown } from '../components/ui/FilterDropdown';
import { useApiResource } from '../hooks/useApiResource';
import { ApiError, apiRequest } from '../lib/api';

type InquiryStatus = 'PENDING' | 'RESPONDED' | 'CLOSED';
type InquirySort = 'NEWEST' | 'OLDEST' | 'UPDATED';

interface OwnerInquiry {
  id: string;
  message: string;
  response: string | null;
  status: InquiryStatus;
  createdAt: string;
  updatedAt: string;
  sender: { id: string; name: string };
  property: {
    id: string;
    name: string;
    monthlyPrice: number;
    availability: 'AVAILABLE' | 'FULLY_OCCUPIED' | 'COMING_SOON';
    availableRooms: number;
    location: { name: string };
  };
}

interface InquiryProperty {
  id: string;
  name: string;
}

interface InquiryResponse {
  status: 'ok';
  inquiries: OwnerInquiry[];
  properties: InquiryProperty[];
  summary: { total: number; waiting: number; responded: number; closed: number };
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const statusPresentation: Record<InquiryStatus, { label: string; className: string; dot: string }> = {
  PENDING: { label: 'Waiting for Response', className: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800', dot: 'bg-rose-500' },
  RESPONDED: { label: 'Responded', className: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800', dot: 'bg-emerald-500' },
  CLOSED: { label: 'Closed', className: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700', dot: 'bg-slate-400' },
};

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function timeAgo(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

function formatPeso(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function SummaryCard(props: { label: string; value: number; description: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{props.label}</p>
      <p className={`mt-2 text-2xl font-bold ${props.accent ?? 'text-slate-900 dark:text-slate-100'}`}>{props.value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{props.description}</p>
    </div>
  );
}

export function OwnerInquiriesPage() {
  const [search, setSearch] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<InquirySort>('NEWEST');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (propertyId) params.set('propertyId', propertyId);
  if (status) params.set('status', status);
  params.set('sort', sort);
  params.set('page', String(page));
  const { state, reload } = useApiResource<InquiryResponse>(`/owner/inquiries?${params.toString()}`);

  const data = state.status === 'success' ? state.data : null;
  const selectedInquiry = data?.inquiries.find((inquiry) => inquiry.id === selectedId)
    ?? data?.inquiries[0]
    ?? null;
  const reply = selectedInquiry
    ? drafts[selectedInquiry.id] ?? selectedInquiry.response ?? ''
    : '';

  function updateFilter(update: () => void) {
    update();
    setPage(1);
    setSelectedId(null);
    setMobileDetailsOpen(false);
  }

  async function updateInquiry(inquiry: OwnerInquiry, body: { response?: string; status?: InquiryStatus }) {
    setError('');
    setSaving(true);
    try {
      await apiRequest('PATCH', `/owner/inquiries/${encodeURIComponent(inquiry.id)}`, body);
      if (body.response !== undefined) {
        setDrafts((current) => ({ ...current, [inquiry.id]: body.response! }));
      }
      reload();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Could not update this inquiry.');
    } finally {
      setSaving(false);
    }
  }

  function closeInquiry(inquiry: OwnerInquiry) {
    if (!window.confirm('Close this inquiry? This will mark the conversation as resolved.')) return;
    void updateInquiry(inquiry, { status: 'CLOSED' });
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
      <BackLink to="/owner">Owner dashboard</BackLink>
      <div className="mt-3">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Property Inquiries</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Manage questions from boarders and respond to inquiries about your properties.
        </p>
      </div>

      {state.status === 'loading' && <p role="status" className="py-12 text-center text-slate-500 dark:text-slate-400">Loading inquiries…</p>}
      {state.status === 'error' && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-300">{state.message}</p>}

      {data && (
        <>
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard label="All Inquiries" value={data.summary.total} description="Received across your properties" />
            <SummaryCard label="Waiting for Response" value={data.summary.waiting} description="Pending owner response" accent="text-amber-700 dark:text-amber-400" />
            <SummaryCard label="Responded" value={data.summary.responded} description="A response has been sent" accent="text-emerald-700 dark:text-emerald-400" />
            <SummaryCard label="Closed" value={data.summary.closed} description="Marked as resolved" accent="text-slate-700 dark:text-slate-200" />
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Unread tracking is not available yet; waiting status reflects the inquiry status stored by the system.
          </p>

          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{error}</p>}

          {data.summary.total === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center dark:border-slate-600 dark:bg-slate-900">
              <MessageCircle className="mx-auto text-emerald-700 dark:text-emerald-400" size={30} />
              <h2 className="mt-3 font-semibold text-slate-900 dark:text-slate-100">No inquiries yet</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Boarder questions about your properties will appear here.</p>
              <Link to="/owner/properties" className="mt-4 inline-block text-sm font-semibold text-emerald-800 hover:underline dark:text-emerald-300">View My Properties →</Link>
            </div>
          ) : (
            <>
              <div className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1.5fr)_minmax(11rem,1fr)_minmax(10rem,1fr)_minmax(10rem,1fr)] dark:border-slate-700 dark:bg-slate-900">
                <label className="relative sm:col-span-2 lg:col-span-1">
                  <span className="sr-only">Search inquiries</span>
                  <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={(event) => updateFilter(() => setSearch(event.target.value))}
                    placeholder="Search people, properties, messages…" className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-600" />
                </label>
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  <span className="sr-only">Filter by property</span>
                  <FilterDropdown
                    fullWidth
                    options={[
                      { label: 'All Properties', value: '' },
                      ...data.properties.map(p => ({ label: p.name, value: p.id }))
                    ]}
                    selected={propertyId}
                    onSelect={(val) => updateFilter(() => setPropertyId(val))}
                  />
                </div>
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  <span className="sr-only">Filter by inquiry status</span>
                  <FilterDropdown
                    fullWidth
                    options={[
                      { label: 'All Statuses', value: '' },
                      { label: 'Waiting for Response', value: 'PENDING' },
                      { label: 'Responded', value: 'RESPONDED' },
                      { label: 'Closed', value: 'CLOSED' }
                    ]}
                    selected={status}
                    onSelect={(val) => updateFilter(() => setStatus(val))}
                  />
                </div>
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  <span className="sr-only">Sort inquiries</span>
                  <FilterDropdown
                    fullWidth
                    options={[
                      { label: 'Newest', value: 'NEWEST' },
                      { label: 'Oldest', value: 'OLDEST' },
                      { label: 'Recently Updated', value: 'UPDATED' }
                    ]}
                    selected={sort}
                    onSelect={(val) => updateFilter(() => setSort(val as InquirySort))}
                  />
                </div>
              </div>

              <div className="mt-4 grid min-h-[34rem] gap-4 lg:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.6fr)]">
                <section className={`${mobileDetailsOpen ? 'hidden lg:block' : 'block'} overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900`} aria-label="Inquiry list">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <h2 className="font-semibold text-slate-900 dark:text-slate-100">Inquiries</h2>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{data.pagination.total} total</span>
                  </div>
                  {data.inquiries.length === 0 ? (
                    <div className="p-6 text-center">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">No inquiries found</h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Try changing your search or filters.</p>
                    </div>
                  ) : (
                    <ul className="max-h-[42rem] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                      {data.inquiries.map((inquiry) => {
                        const badge = statusPresentation[inquiry.status];
                        const isSelected = (selectedInquiry?.id === inquiry.id);
                        return (
                          <li key={inquiry.id}>
                            <button type="button" onClick={() => {
                              setSelectedId(inquiry.id);
                              setMobileDetailsOpen(true);
                              setError('');
                            }}
                              className={`w-full px-4 py-4 text-left transition hover:bg-emerald-50/60 dark:hover:bg-emerald-950/60 ${
                                isSelected ? 'border-l-4 border-emerald-700 bg-emerald-50/70 pl-3 dark:bg-emerald-950/70' : 'border-l-4 border-transparent'
                              }`}>
                              <div className="flex items-start justify-between gap-2">
                                <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                                  <span className={`h-2 w-2 shrink-0 rounded-full ${badge.dot}`} aria-hidden="true" />
                                  <span className="truncate">{inquiry.sender.name}</span>
                                </span>
                                <time dateTime={inquiry.updatedAt} className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{timeAgo(inquiry.updatedAt)}</time>
                              </div>
                              <p className="mt-1 truncate pl-4 text-sm font-medium text-emerald-800 dark:text-emerald-300">{inquiry.property.name}</p>
                              <p className="mt-1 line-clamp-2 pl-4 text-sm text-slate-600 dark:text-slate-300">{inquiry.message}</p>
                              <span className={`ml-4 mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${badge.className}`}>{badge.label}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {data.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Page {page} / {data.pagination.totalPages}</span>
                      <div className="flex gap-2">
                        <button type="button" disabled={page <= 1} onClick={() => { setPage((current) => current - 1); setSelectedId(null); }}
                          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-slate-600">Previous</button>
                        <button type="button" disabled={page >= data.pagination.totalPages} onClick={() => { setPage((current) => current + 1); setSelectedId(null); }}
                          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-slate-600">Next</button>
                      </div>
                    </div>
                  )}
                </section>

                <section className={`${mobileDetailsOpen ? 'block' : 'hidden lg:block'} min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900`} aria-label="Inquiry details">
                  {!selectedInquiry ? (
                    <div className="flex h-full min-h-72 items-center justify-center p-8 text-center text-slate-500 dark:text-slate-400">
                      Select an inquiry to view the conversation.
                    </div>
                  ) : (
                    <>
                      <div className="border-b border-slate-100 p-4 sm:p-5 dark:border-slate-800">
                        <button type="button" onClick={() => setMobileDetailsOpen(false)} className="mb-3 text-sm font-medium text-emerald-800 hover:underline dark:text-emerald-300 lg:hidden">← All Inquiries</button>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="truncate text-xl font-bold text-slate-900 dark:text-slate-100">{selectedInquiry.sender.name}</h2>
                            <Link to={`/owner/properties/${encodeURIComponent(selectedInquiry.property.id)}`}
                              className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:underline dark:text-emerald-300">
                              <Building2 size={15} /> {selectedInquiry.property.name}
                            </Link>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusPresentation[selectedInquiry.status].className}`}>
                            {statusPresentation[selectedInquiry.status].label}
                          </span>
                        </div>
                      </div>

                      <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_14rem]">
                        <div className="min-w-0 space-y-4">
                          <article className="rounded-xl rounded-tl-sm bg-slate-100 p-4 dark:bg-slate-800">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Boarder’s Message</p>
                            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-800 dark:text-slate-100">{selectedInquiry.message}</p>
                            <time dateTime={selectedInquiry.createdAt} className="mt-3 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                              <Clock3 size={13} /> {formatDate(selectedInquiry.createdAt)}
                            </time>
                          </article>

                          {selectedInquiry.response && (
                            <article className="ml-3 rounded-xl rounded-tr-sm bg-emerald-50 p-4 sm:ml-8 dark:bg-emerald-950">
                              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">Your Response</p>
                              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-emerald-950 dark:text-emerald-100">{selectedInquiry.response}</p>
                              <time dateTime={selectedInquiry.updatedAt} className="mt-3 flex items-center gap-1 text-xs text-emerald-800/70 dark:text-emerald-300/70">
                                <Clock3 size={13} /> Last updated {formatDate(selectedInquiry.updatedAt)}
                              </time>
                            </article>
                          )}

                          {selectedInquiry.status !== 'CLOSED' ? (
                            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                              <label htmlFor={`reply-${selectedInquiry.id}`} className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {selectedInquiry.response ? 'Update your response' : 'Reply to boarder'}
                              </label>
                              <textarea id={`reply-${selectedInquiry.id}`} rows={4} maxLength={2000}
                                value={reply}
                                onChange={(event) => setDrafts((current) => ({ ...current, [selectedInquiry.id]: event.target.value }))}
                                placeholder="Write your response…" className="mt-2 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-600" />
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button type="button" disabled={saving || reply.trim().length < 2}
                                  onClick={() => void updateInquiry(selectedInquiry, { response: reply })}
                                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                                  {saving ? 'Sending…' : selectedInquiry.response ? 'Update Response' : 'Send Response'}
                                </button>
                                <button type="button" disabled={saving} onClick={() => closeInquiry(selectedInquiry)}
                                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                                  Close Inquiry
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                              <p className="text-sm text-slate-600 dark:text-slate-300">This conversation is closed.</p>
                              <button type="button" disabled={saving} onClick={() => void updateInquiry(selectedInquiry, {
                                status: selectedInquiry.response ? 'RESPONDED' : 'PENDING',
                              })}
                                className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-950">
                                Reopen Inquiry
                              </button>
                            </div>
                          )}
                        </div>

                        <aside className="h-fit rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Property Information</p>
                          <Link to={`/owner/properties/${encodeURIComponent(selectedInquiry.property.id)}`}
                            className="mt-2 block font-semibold text-emerald-800 hover:underline dark:text-emerald-300">{selectedInquiry.property.name}</Link>
                          <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                            <MapPin size={15} className="mt-0.5 shrink-0" />
                            {selectedInquiry.property.location.name}, Occidental Mindoro
                          </p>
                          <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPeso(selectedInquiry.property.monthlyPrice)} <span className="font-normal text-slate-500 dark:text-slate-400">/ month</span></p>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {selectedInquiry.property.availability === 'COMING_SOON'
                              ? 'Coming soon'
                              : selectedInquiry.property.availability === 'FULLY_OCCUPIED'
                                ? 'Fully occupied'
                                : `${selectedInquiry.property.availableRooms} available room(s)`}
                          </p>
                          <Link to={`/owner/properties/${encodeURIComponent(selectedInquiry.property.id)}`}
                            className="mt-4 inline-flex w-full justify-center rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950">
                            View Property
                          </Link>
                        </aside>
                      </div>
                    </>
                  )}
                </section>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
