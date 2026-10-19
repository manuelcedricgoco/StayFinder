import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BackLink } from '../components/ui/BackLink';
import { FilterDropdown } from '../components/ui/FilterDropdown';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { useApiResource } from '../hooks/useApiResource';
import { ApiError, apiRequest } from '../lib/api';

interface AdminReport {
  id: string;
  reason: string;
  details: string | null;
  status: 'PENDING' | 'RESOLVED' | 'REJECTED';
  createdAt: string;
  boarder: { name: string };
  property: { id: string; name: string; status: string; owner: { name: string } };
}

interface ReportsResponse { status: 'ok'; reports: AdminReport[] }

export function AdminReportsPage() {
  const [filter, setFilter] = useState('PENDING');
  const path = `/admin/reports${filter ? `?status=${filter}` : ''}`;
  const { state, reload } = useApiResource<ReportsResponse>(path);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<AdminReport | null>(null);
  const [modalType, setModalType] = useState<'resolve' | 'reject' | null>(null);

  async function moderate(report: AdminReport, status: 'RESOLVED' | 'REJECTED') {
    setError('');
    setSavingId(report.id);
    try {
      await apiRequest('PATCH', `/admin/reports/${encodeURIComponent(report.id)}/status`, { status });
      reload();
      setModalType(null);
      setSelectedReport(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not update this report.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-12">
      <BackLink to="/admin">Admin dashboard</BackLink>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Property reports</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Investigate reports and record their outcome.</p></div>
        <FilterDropdown
          options={[
            { label: 'All', value: '' },
            { label: 'Pending', value: 'PENDING' },
            { label: 'Resolved', value: 'RESOLVED' },
            { label: 'Rejected', value: 'REJECTED' }
          ]}
          selected={filter}
          onSelect={setFilter}
        />
      </div>
      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-300">{error}</p>}
      {state.status === 'loading' && <p role="status" className="py-10 text-center text-slate-500 dark:text-slate-400">Loading reports…</p>}
      {state.status === 'error' && <p role="alert" className="mt-5 rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-800 dark:text-red-300">{state.message}</p>}
      {state.status === 'success' && state.data.reports.length === 0 && <p className="mt-6 rounded-xl bg-slate-50 dark:bg-slate-800 p-8 text-center text-slate-600 dark:text-slate-300">No reports match this status.</p>}
      {state.status === 'success' && <ul className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {state.data.reports.map((report) => (
        <li key={report.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">{report.property.name}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{report.reason.split('_').join(' ')} · {report.status}</p>
              </div>
              <span className="text-sm text-slate-500 dark:text-slate-400 sm:shrink-0">Reported by {report.boarder.name}</span>
            </div>
            {report.details && <p className="whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-200">{report.details}</p>}
            <p className="text-xs text-slate-500 dark:text-slate-400">Owner: {report.property.owner.name} · Listing: {report.property.status} · {new Date(report.createdAt).toLocaleString()}</p>
            <Link to="/admin/properties" className="text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline">Open listing moderation</Link>
          </div>
          {report.status === 'PENDING' && <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
            <button 
              disabled={savingId === report.id} 
              onClick={() => { setSelectedReport(report); setModalType('resolve'); }} 
              className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Resolve report
            </button>
            <button 
              disabled={savingId === report.id} 
              onClick={() => { setSelectedReport(report); setModalType('reject'); }} 
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-60"
            >
              Reject report
            </button>
          </div>}
        </li>
      ))}</ul>}

      <ConfirmationModal
        isOpen={modalType === 'resolve'}
        onClose={() => setModalType(null)}
        onConfirm={() => selectedReport && moderate(selectedReport, 'RESOLVED')}
        title="Resolve report"
        description={`Are you sure you want to resolve the report for ${selectedReport?.property.name} submitted by ${selectedReport?.boarder.name}?`}
        confirmLabel="Resolve report"
        isProcessing={!!savingId}
      />
      <ConfirmationModal
        isOpen={modalType === 'reject'}
        onClose={() => setModalType(null)}
        onConfirm={() => selectedReport && moderate(selectedReport, 'REJECTED')}
        title="Reject report"
        description={`Are you sure you want to dismiss/reject the report for ${selectedReport?.property.name}?`}
        confirmLabel="Reject report"
        isProcessing={!!savingId}
      />
    </section>
  );
}
