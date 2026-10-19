import { useState, type FormEvent } from 'react';
import { Download, Eye, Plus, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BackLink } from '../components/ui/BackLink';
import { FilterDropdown } from '../components/ui/FilterDropdown';
import { useApiResource } from '../hooks/useApiResource';
import { ApiError, apiDownload, apiRequest } from '../lib/api';

type PaymentMethod = 'CASH' | 'GCASH' | 'MAYA' | 'BANK_TRANSFER' | 'OTHER';

interface PaymentRoom {
  id: string;
  name: string;
  monthlyPrice: number | null;
  isAvailable: boolean;
}

interface PaymentProperty {
  id: string;
  name: string;
  monthlyPrice: number;
  availability: 'AVAILABLE' | 'FULLY_OCCUPIED' | 'COMING_SOON';
  availableRooms: number;
  location: { name: string };
  rooms: PaymentRoom[];
  totalCollected: number;
  paymentCount: number;
}

interface PaymentRecord {
  id: string;
  boarderName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  status: 'PAID';
  referenceNumber: string | null;
  notes: string | null;
  createdAt: string;
  property: { id: string; name: string; monthlyPrice: number; location: { name: string } };
  room: { id: string; name: string } | null;
}

interface PaymentsResponse {
  status: 'ok';
  records: PaymentRecord[];
  properties: PaymentProperty[];
  summary: {
    totalCollected: number;
    thisMonth: number;
    pendingCount: number | null;
    completedCount: number;
  };
  monthlyEarnings: { month: string; amount: number }[];
  hasMonthlyHistory: boolean;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

interface PaymentDraft {
  propertyId: string;
  roomId: string;
  boarderName: string;
  amount: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  notes: string;
}

const methodLabels: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  GCASH: 'GCash (recorded)',
  MAYA: 'Maya (recorded)',
  BANK_TRANSFER: 'Bank transfer (recorded)',
  OTHER: 'Other',
};

function peso(amount: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount);
}

function paymentDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function summaryRange(range: string) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  if (range === 'TODAY') return { from: dateInputValue(start), to: dateInputValue(end) };
  if (range === 'WEEK') {
    start.setDate(start.getDate() - 6);
    return { from: dateInputValue(start), to: dateInputValue(end) };
  }
  if (range === 'MONTH') {
    start.setDate(1);
    return { from: dateInputValue(start), to: dateInputValue(end) };
  }
  if (range === 'LAST_MONTH') {
    const lastStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: dateInputValue(lastStart), to: dateInputValue(lastEnd) };
  }
  return { from: '', to: '' };
}

function StatCard(props: { label: string; value: string; detail: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{props.label}</p>
      <p className={`mt-2 text-2xl font-bold ${props.tone ?? 'text-slate-900 dark:text-slate-100'}`}>{props.value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{props.detail}</p>
    </div>
  );
}

const emptyDraft = (): PaymentDraft => ({
  propertyId: '',
  roomId: '',
  boarderName: '',
  amount: '',
  paymentDate: dateInputValue(new Date()),
  paymentMethod: 'CASH',
  referenceNumber: '',
  notes: '',
});

export function OwnerPaymentsPage() {
  const [search, setSearch] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [datePreset, setDatePreset] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PaymentRecord | null>(null);
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [confirmDraft, setConfirmDraft] = useState<PaymentDraft | null>(null);
  const [draft, setDraft] = useState<PaymentDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const range = datePreset === 'CUSTOM'
    ? { from: customFrom, to: customTo }
    : summaryRange(datePreset);
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (propertyId) params.set('propertyId', propertyId);
  if (paymentMethod) params.set('paymentMethod', paymentMethod);
  if (range.from) params.set('from', range.from);
  if (range.to) params.set('to', range.to);
  params.set('page', String(page));
  const { state, reload } = useApiResource<PaymentsResponse>(`/owner/payments?${params.toString()}`);
  const data = state.status === 'success' ? state.data : null;
  const formProperty = data?.properties.find((property) => property.id === draft.propertyId);
  const maxEarning = Math.max(1, ...(data?.monthlyEarnings.map((month) => month.amount) ?? [0]));
  const hasPaymentFilters = Boolean(search.trim() || propertyId || paymentMethod || range.from || range.to);

  function updateFilter(callback: () => void) {
    callback();
    setPage(1);
  }

  async function exportRecords() {
    setExporting(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set('search', search.trim());
      if (propertyId) query.set('propertyId', propertyId);
      if (paymentMethod) query.set('paymentMethod', paymentMethod);
      if (range.from) query.set('from', range.from);
      if (range.to) query.set('to', range.to);
      const blob = await apiDownload(`/owner/payments/export.csv${query.size ? `?${query}` : ''}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'stayfinder-payment-records.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not export payment records.');
    } finally {
      setExporting(false);
    }
  }

  function prepareConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setConfirmDraft(draft);
  }

  async function confirmPayment() {
    if (!confirmDraft) return;
    setSaving(true);
    setError('');
    try {
      await apiRequest('POST', '/owner/payments', {
        propertyId: confirmDraft.propertyId,
        ...(confirmDraft.roomId ? { roomId: confirmDraft.roomId } : {}),
        boarderName: confirmDraft.boarderName.trim(),
        amount: Number(confirmDraft.amount),
        paymentDate: new Date(`${confirmDraft.paymentDate}T12:00:00`).toISOString(),
        paymentMethod: confirmDraft.paymentMethod,
        referenceNumber: confirmDraft.referenceNumber.trim() || null,
        notes: confirmDraft.notes.trim() || null,
      });
      setConfirmDraft(null);
      setShowRecordForm(false);
      setDraft(emptyDraft());
      reload();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not record this payment.');
      setConfirmDraft(null);
    } finally {
      setSaving(false);
    }
  }

  const updateDraft = (key: keyof PaymentDraft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
      <BackLink to="/owner">Owner dashboard</BackLink>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Payments</h1>
          <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">Track rent payments, payment records, and earnings across your properties.</p>
        </div>
        <button type="button" onClick={() => { setError(''); setShowRecordForm(true); setConfirmDraft(null); }}
          disabled={!data || data.properties.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
          <Plus size={17} /> Record Payment
        </button>
      </div>

      <p className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200">
        Payment processing is recorded manually. GCash, Maya, and bank transfer selections are payment methods noted in the ledger, not online transactions.
      </p>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{error}</p>}
      {state.status === 'loading' && <p role="status" className="py-12 text-center text-slate-500 dark:text-slate-400">Loading payment records…</p>}
      {state.status === 'error' && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-300">{state.message}</p>}

      {data && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard label="Total Collected" value={peso(data.summary.totalCollected)} detail="Manually recorded as paid" tone="text-emerald-700 dark:text-emerald-400" />
            <StatCard label="This Month" value={peso(data.summary.thisMonth)} detail="Payments dated this month" />
            <StatCard label="Pending" value={data.summary.pendingCount === null ? '—' : String(data.summary.pendingCount)} detail="Pending payments are not tracked" tone="text-amber-700 dark:text-amber-400" />
            <StatCard label="Completed" value={String(data.summary.completedCount)} detail="Confirmed payment records" />
          </div>

          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-900" aria-label="Payment records filters">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1.5fr)_minmax(11rem,1fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto]">
              <label className="relative">
                <span className="sr-only">Search payments</span>
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(event) => updateFilter(() => setSearch(event.target.value))}
                  placeholder="Search boarder, property, reference…" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-600" />
              </label>
              <div>
                <span className="sr-only">Filter payments by property</span>
                <FilterDropdown
                  fullWidth
                  options={[
                    { label: 'All Properties', value: '' },
                    ...data.properties.map((property) => ({ label: property.name, value: property.id })),
                  ]}
                  selected={propertyId}
                  onSelect={(val) => updateFilter(() => setPropertyId(val))}
                />
              </div>
              <div>
                <span className="sr-only">Filter payments by date</span>
                <FilterDropdown
                  fullWidth
                  options={[
                    { label: 'All Dates', value: '' },
                    { label: 'Today', value: 'TODAY' },
                    { label: 'This Week', value: 'WEEK' },
                    { label: 'This Month', value: 'MONTH' },
                    { label: 'Last Month', value: 'LAST_MONTH' },
                    { label: 'Custom Range', value: 'CUSTOM' },
                  ]}
                  selected={datePreset}
                  onSelect={(val) => {
                    updateFilter(() => setDatePreset(val));
                    if (val !== 'CUSTOM') {
                      setCustomFrom('');
                      setCustomTo('');
                    }
                  }}
                />
              </div>
              <div>
                <span className="sr-only">Filter payments by recorded method</span>
                <FilterDropdown
                  fullWidth
                  options={[
                    { label: 'All Methods', value: '' },
                    ...Object.entries(methodLabels).map(([value, label]) => ({ label, value })),
                  ]}
                  selected={paymentMethod}
                  onSelect={(val) => updateFilter(() => setPaymentMethod(val))}
                />
              </div>
              <button type="button" onClick={() => void exportRecords()} disabled={exporting}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-950">
                <Download size={16} /> {exporting ? 'Exporting…' : 'Export CSV'}
              </button>
            </div>
            {datePreset === 'CUSTOM' && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">From
                  <input type="date" value={customFrom} max={customTo || undefined} onChange={(event) => updateFilter(() => setCustomFrom(event.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600" />
                </label>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">To
                  <input type="date" value={customTo} min={customFrom || undefined} onChange={(event) => updateFilter(() => setCustomTo(event.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600" />
                </label>
              </div>
            )}
          </section>

          <section className="mt-7" aria-labelledby="payment-records-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="payment-records-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">Payment Records</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{data.pagination.total} record(s) · Recorded payment methods, not gateway-verified transactions</p>
              </div>
            </div>

            {data.records.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center dark:border-slate-600 dark:bg-slate-900">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{data.pagination.total === 0 && !hasPaymentFilters ? 'No payment records yet' : 'No payment records found'}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {data.pagination.total === 0 && !hasPaymentFilters
                    ? 'Payment records for your properties will appear here.'
                    : 'Try changing your search or filters.'}
                </p>
                {data.pagination.total === 0 && <button type="button" onClick={() => setShowRecordForm(true)} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:underline dark:text-emerald-300"><Plus size={16} /> Record Payment</button>}
              </div>
            ) : (
              <>
                <div className="mt-4 hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block dark:border-slate-700 dark:bg-slate-900">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Boarder</th>
                        <th className="px-4 py-3 font-medium">Property / Room</th><th className="px-4 py-3 font-medium">Amount</th>
                        <th className="px-4 py-3 font-medium">Method</th><th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.records.map((record) => (
                        <tr key={record.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/70">
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{paymentDate(record.paymentDate)}</td>
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{record.boarderName}</td>
                          <td className="px-4 py-3">
                            <Link to={`/owner/properties/${encodeURIComponent(record.property.id)}`} className="font-medium text-emerald-800 hover:underline dark:text-emerald-300">{record.property.name}</Link>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{record.room?.name ?? 'Room not specified'}</p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{peso(record.amount)}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{methodLabels[record.paymentMethod]}</td>
                          <td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Paid</span></td>
                          <td className="px-4 py-3"><button type="button" onClick={() => setSelected(record)} className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 hover:underline dark:text-emerald-300"><Eye size={15} /> View</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="mt-4 space-y-3 md:hidden">
                  {data.records.map((record) => (
                    <li key={record.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0"><p className="truncate font-semibold text-slate-900 dark:text-slate-100">{record.boarderName}</p>
                          <Link to={`/owner/properties/${encodeURIComponent(record.property.id)}`} className="mt-1 block truncate text-sm text-emerald-800 hover:underline dark:text-emerald-300">{record.property.name}</Link></div>
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Paid</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div><p className="text-xs text-slate-500 dark:text-slate-400">Amount</p><p className="mt-0.5 font-semibold">{peso(record.amount)}</p></div>
                        <div><p className="text-xs text-slate-500 dark:text-slate-400">Date</p><p className="mt-0.5">{paymentDate(record.paymentDate)}</p></div>
                        <div><p className="text-xs text-slate-500 dark:text-slate-400">Room</p><p className="mt-0.5">{record.room?.name ?? 'Not specified'}</p></div>
                        <div><p className="text-xs text-slate-500 dark:text-slate-400">Method</p><p className="mt-0.5">{methodLabels[record.paymentMethod]}</p></div>
                      </div>
                      <button type="button" onClick={() => setSelected(record)} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 dark:text-emerald-300"><Eye size={15} /> View details</button>
                    </li>
                  ))}
                </ul>
                {data.pagination.totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Page {page} of {data.pagination.totalPages}</span>
                    <div className="flex gap-2">
                      <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-slate-600">Previous</button>
                      <button type="button" disabled={page >= data.pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-slate-600">Next</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="earnings-overview-title">
              <h2 id="earnings-overview-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Earnings Overview</h2>
              {!data.hasMonthlyHistory ? (
                <p className="mt-4 rounded-lg bg-slate-50 p-5 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">Not enough payment history to display a trend.</p>
              ) : (
                <div className="mt-5 flex h-48 items-end gap-2 border-b border-slate-200 pb-2 sm:gap-4 dark:border-slate-700">
                  {data.monthlyEarnings.map((month) => (
                    <div key={month.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                      <span className="max-w-full truncate text-[10px] text-slate-500 dark:text-slate-400">{peso(month.amount)}</span>
                      <div className="flex h-[68%] w-full items-end">
                        <div title={`${month.month}: ${peso(month.amount)}`} className="w-full rounded-t-md bg-emerald-600"
                          style={{ height: `${month.amount ? Math.max(5, (month.amount / maxEarning) * 100) : 0}%` }} />
                      </div>
                      <span className="text-center text-[10px] text-slate-600 sm:text-xs dark:text-slate-300">{month.month.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Collected amounts by payment date; no forecasts or unrecorded rent included.</p>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="property-earnings-title">
              <h2 id="property-earnings-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Earnings by Property</h2>
              {data.properties.length === 0 ? <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Add a property to track rent records.</p> : (
                <div className="mt-3 space-y-1">
                  {data.properties.slice().sort((a, b) => b.totalCollected - a.totalCollected).map((property) => (
                    <button type="button" key={property.id} onClick={() => updateFilter(() => setPropertyId(property.id))}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950">
                      <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{property.name}</span><span className="text-xs text-slate-500 dark:text-slate-400">{property.paymentCount} payment(s)</span></span>
                      <span className="shrink-0 text-sm font-semibold text-emerald-800 dark:text-emerald-300">{peso(property.totalCollected)}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {(showRecordForm || confirmDraft) && data && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) {
            setShowRecordForm(false);
            setConfirmDraft(null);
          }
        }}>
          <div role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="payment-dialog-title" className="text-xl font-bold text-slate-900 dark:text-slate-100">{confirmDraft ? 'Confirm Payment Record' : 'Record Payment'}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{confirmDraft ? 'Review the details before recording this as paid.' : 'Record a payment already received. This does not process money online.'}</p>
              </div>
              <button type="button" aria-label="Close" disabled={saving} onClick={() => { setShowRecordForm(false); setConfirmDraft(null); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"><X size={18} /></button>
            </div>

            {confirmDraft ? (
              <>
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">Record this payment?</p>
                  <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">Confirming creates a permanent paid ledger entry; it will not initiate a payment.</p>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800">
                  <div><dt className="text-slate-500 dark:text-slate-400">Boarder</dt><dd className="mt-0.5 font-medium">{confirmDraft.boarderName}</dd></div>
                  <div><dt className="text-slate-500 dark:text-slate-400">Property</dt><dd className="mt-0.5 font-medium">{data.properties.find((property) => property.id === confirmDraft.propertyId)?.name}</dd></div>
                  <div><dt className="text-slate-500 dark:text-slate-400">Amount</dt><dd className="mt-0.5 font-semibold text-emerald-800 dark:text-emerald-300">{peso(Number(confirmDraft.amount))}</dd></div>
                  <div><dt className="text-slate-500 dark:text-slate-400">Payment method</dt><dd className="mt-0.5 font-medium">{methodLabels[confirmDraft.paymentMethod]}</dd></div>
                  <div><dt className="text-slate-500 dark:text-slate-400">Date</dt><dd className="mt-0.5 font-medium">{paymentDate(new Date(`${confirmDraft.paymentDate}T12:00:00`).toISOString())}</dd></div>
                  {confirmDraft.roomId && <div><dt className="text-slate-500 dark:text-slate-400">Room</dt><dd className="mt-0.5 font-medium">{data.properties.find((property) => property.id === confirmDraft.propertyId)?.rooms.find((room) => room.id === confirmDraft.roomId)?.name}</dd></div>}
                </dl>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button type="button" disabled={saving} onClick={() => setConfirmDraft(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">Cancel</button>
                  <button type="button" disabled={saving} onClick={() => void confirmPayment()} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{saving ? 'Recording…' : 'Confirm Payment'}</button>
                </div>
              </>
            ) : (
              <form className="mt-5 space-y-4" onSubmit={prepareConfirmation}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Property
                    <select required value={draft.propertyId} onChange={(event) => {
                      const nextProperty = data.properties.find((property) => property.id === event.target.value);
                      setDraft((current) => ({
                        ...current,
                        propertyId: event.target.value,
                        roomId: '',
                        amount: nextProperty ? String(nextProperty.monthlyPrice) : current.amount,
                      }));
                    }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900">
                      <option value="">Choose your property</option>
                      {data.properties.map((property) => <option value={property.id} key={property.id}>{property.name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Room (optional)
                    <select value={draft.roomId} onChange={(event) => {
                      const room = formProperty?.rooms.find((item) => item.id === event.target.value);
                      setDraft((current) => ({ ...current, roomId: event.target.value, amount: room?.monthlyPrice ? String(room.monthlyPrice) : current.amount }));
                    }} disabled={!formProperty} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:disabled:bg-slate-800">
                      <option value="">Not specified</option>
                      {formProperty?.rooms.map((room) => <option value={room.id} key={room.id}>{room.name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Boarder name
                    <input required minLength={2} maxLength={120} value={draft.boarderName} onChange={(event) => updateDraft('boarderName', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 dark:border-slate-600" />
                  </label>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Amount (₱)
                    <input required type="number" min={1} max={100000000} step={1} value={draft.amount} onChange={(event) => updateDraft('amount', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 dark:border-slate-600" />
                  </label>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Payment date
                    <input required type="date" max={dateInputValue(new Date())} value={draft.paymentDate} onChange={(event) => updateDraft('paymentDate', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 dark:border-slate-600" />
                  </label>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Recorded payment method
                    <select value={draft.paymentMethod} onChange={(event) => updateDraft('paymentMethod', event.target.value as PaymentMethod)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900">
                      {Object.entries(methodLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-700 sm:col-span-2 dark:text-slate-200">Reference number (optional)
                    <input maxLength={120} value={draft.referenceNumber} onChange={(event) => updateDraft('referenceNumber', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 dark:border-slate-600" />
                  </label>
                  <label className="text-sm font-medium text-slate-700 sm:col-span-2 dark:text-slate-200">Notes (optional)
                    <textarea rows={3} maxLength={1000} value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 dark:border-slate-600" />
                  </label>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">No card details, CVV, passwords, or payment credentials are collected.</p>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => setShowRecordForm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">Cancel</button>
                  <button type="submit" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Review Payment</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelected(null);
        }}>
          <div role="dialog" aria-modal="true" aria-labelledby="payment-detail-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div><h2 id="payment-detail-title" className="text-xl font-bold text-slate-900 dark:text-slate-100">Payment Details</h2><p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">Transaction ID: {selected.id}</p></div>
              <button type="button" aria-label="Close details" onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"><X size={18} /></button>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <div><dt className="text-slate-500 dark:text-slate-400">Payment date</dt><dd className="mt-1 font-medium">{paymentDate(selected.paymentDate)}</dd></div>
              <div><dt className="text-slate-500 dark:text-slate-400">Boarder</dt><dd className="mt-1 font-medium">{selected.boarderName}</dd></div>
              <div><dt className="text-slate-500 dark:text-slate-400">Property</dt><dd className="mt-1"><Link to={`/owner/properties/${encodeURIComponent(selected.property.id)}`} className="font-medium text-emerald-800 hover:underline dark:text-emerald-300">{selected.property.name}</Link></dd></div>
              <div><dt className="text-slate-500 dark:text-slate-400">Room</dt><dd className="mt-1 font-medium">{selected.room?.name ?? 'Not specified'}</dd></div>
              <div><dt className="text-slate-500 dark:text-slate-400">Amount</dt><dd className="mt-1 font-semibold text-emerald-800 dark:text-emerald-300">{peso(selected.amount)}</dd></div>
              <div><dt className="text-slate-500 dark:text-slate-400">Payment method</dt><dd className="mt-1 font-medium">{methodLabels[selected.paymentMethod]}</dd></div>
              <div><dt className="text-slate-500 dark:text-slate-400">Status</dt><dd className="mt-1"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Paid · manually recorded</span></dd></div>
              <div><dt className="text-slate-500 dark:text-slate-400">Reference number</dt><dd className="mt-1 break-all font-medium">{selected.referenceNumber ?? 'Not provided'}</dd></div>
              <div className="col-span-2"><dt className="text-slate-500 dark:text-slate-400">Notes</dt><dd className="mt-1 whitespace-pre-line font-medium">{selected.notes ?? 'No notes'}</dd></div>
            </dl>
            <button type="button" onClick={() => setSelected(null)} className="mt-6 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Close</button>
          </div>
        </div>
      )}
    </section>
  );
}
