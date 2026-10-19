import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, Download, LoaderCircle } from 'lucide-react';
import { BackLink } from '../components/ui/BackLink';
import { useApiResource } from '../hooks/useApiResource';
import { ApiError, apiDownload } from '../lib/api';

interface ExportSummary {
  status: 'ok';
  counts: {
    users: number;
    systemChecks: number;
    locations: number;
    amenities: number;
    properties: number;
    propertyImages: number;
    rooms: number;
    favorites: number;
    inquiries: number;
    reviews: number;
    reports: number;
    ownerVerifications: number;
  };
}

const sections: { key: keyof ExportSummary['counts']; label: string }[] = [
  { key: 'users', label: 'User accounts' },
  { key: 'properties', label: 'Property listings' },
  { key: 'propertyImages', label: 'Property images' },
  { key: 'rooms', label: 'Rooms and units' },
  { key: 'locations', label: 'Municipalities' },
  { key: 'amenities', label: 'Amenities' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'inquiries', label: 'Inquiries' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'reports', label: 'Reports' },
  { key: 'ownerVerifications', label: 'Owner verifications' },
  { key: 'systemChecks', label: 'System checks' },
];

export function AdminExportPage() {
  const { state } = useApiResource<ExportSummary>('/admin/export/summary');
  const [downloading, setDownloading] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState(false);

  async function downloadExport() {
    setError('');
    setDownloaded(false);
    setDownloading(true);
    try {
      const file = await apiDownload('/admin/export');
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `stayfinder-database-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDownloaded(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not download the database export.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-12">
      <BackLink to="/admin">Admin dashboard</BackLink>
      <div className="mt-3">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Export Database</h1>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
          Download a JSON snapshot of StayFinder platform data for backup or analysis.
        </p>
      </div>

      <div className="mt-7 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-5 sm:p-6">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-amber-950 dark:text-amber-100">Sensitive information</h2>
            <p className="mt-1 text-sm leading-6 text-amber-900 dark:text-amber-200">
              The export includes user contact details, private verification-document links, and
              boarder activity. Store it securely and share it only with authorized people.
              Password hashes, login sessions, and OAuth account identifiers are excluded.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Included data</h2>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Current record counts in each exported section.</p>
          </div>
          <button
            type="button"
            onClick={downloadExport}
            disabled={downloading || state.status !== 'success' || !acknowledged}
            title={!acknowledged ? 'Confirm you understand the export contains sensitive information.' : undefined}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading
              ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <Download className="h-4 w-4" aria-hidden="true" />}
            {downloading ? 'Preparing export…' : 'Download JSON'}
          </button>
        </div>

        {state.status === 'loading' && (
          <p role="status" className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading database counts…</p>
        )}
        {state.status === 'error' && (
          <p role="alert" className="mt-5 rounded-lg bg-red-50 dark:bg-red-950 p-4 text-sm text-red-800 dark:text-red-300">{state.message}</p>
        )}
        {state.status === 'success' && (
          <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 dark:bg-slate-800 px-4 py-3">
                <dt className="text-sm text-slate-700 dark:text-slate-200">{label}</dt>
                <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{state.data.counts[key].toLocaleString()}</dd>
              </div>
            ))}
          </dl>
        )}

        <label className="mt-5 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 accent-emerald-700"
          />
          <span>I understand this export contains personal information and will store it securely.</span>
        </label>

        {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-300">{error}</p>}
        {downloaded && (
          <p role="status" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Your database export has been downloaded.
          </p>
        )}
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
        The export is a point-in-time JSON file. Keep exported copies in a secure location and delete
        them when they are no longer needed.
      </p>
    </section>
  );
}
