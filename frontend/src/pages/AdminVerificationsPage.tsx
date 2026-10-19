import { useState } from 'react';
import { BackLink } from '../components/ui/BackLink';
import { FilterDropdown } from '../components/ui/FilterDropdown';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { useApiResource } from '../hooks/useApiResource';
import { ApiError, apiRequest } from '../lib/api';

interface Verification {
  id: string;
  legalName: string;
  phoneNumber: string;
  documentType: string;
  documentUrl: string;
  additionalInfo: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  submittedAt: string;
  owner: { name: string; email: string };
}

interface VerificationsResponse { status: 'ok'; verifications: Verification[] }

export function AdminVerificationsPage() {
  const [filter, setFilter] = useState('PENDING');
  const path = `/admin/verifications${filter ? `?status=${filter}` : ''}`;
  const { state, reload } = useApiResource<VerificationsResponse>(path);
  const [activeVerification, setActiveVerification] = useState<Verification | null>(null);
  const [modalType, setModalType] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function moderate(status: 'APPROVED' | 'REJECTED', reason?: string) {
    if (!activeVerification) return;

    setError('');
    setSaving(true);
    try {
      await apiRequest('PATCH', `/admin/verifications/${encodeURIComponent(activeVerification.id)}/status`, {
        status,
        ...(status === 'REJECTED' ? { rejectionReason: reason } : {}),
      });
      reload();
      setModalType(null);
      setActiveVerification(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not update verification.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-12">
      <BackLink to="/admin">Admin dashboard</BackLink>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Owner verification</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Review owner details and private identity-document links.</p></div>
        <FilterDropdown
          options={[
            { label: 'All', value: '' },
            { label: 'Pending', value: 'PENDING' },
            { label: 'Approved', value: 'APPROVED' },
            { label: 'Rejected', value: 'REJECTED' }
          ]}
          selected={filter}
          onSelect={setFilter}
        />
      </div>
      <p className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-950 p-3 text-sm text-amber-900 dark:text-amber-200">Identity links contain sensitive information. Open only when needed and do not share them.</p>
      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-300">{error}</p>}
      {state.status === 'loading' && <p role="status" className="py-10 text-center text-slate-500 dark:text-slate-400">Loading verification requests…</p>}
      {state.status === 'error' && <p role="alert" className="mt-5 rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-800 dark:text-red-300">{state.message}</p>}
      {state.status === 'success' && state.data.verifications.length === 0 && <p className="mt-6 rounded-xl bg-slate-50 dark:bg-slate-800 p-8 text-center text-slate-600 dark:text-slate-300">No verification requests match this status.</p>}
      {state.status === 'success' && <ul className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {state.data.verifications.map((verification) => (
        <li key={verification.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">{verification.legalName}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Account: {verification.owner.name} ({verification.owner.email}) · {verification.status}</p>
              </div>
              <span className="text-sm text-slate-500 dark:text-slate-400 sm:shrink-0">Submitted {new Date(verification.submittedAt).toLocaleString()}</span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200">{verification.documentType.split('_').join(' ')} · {verification.phoneNumber}</p>
            {verification.additionalInfo && <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">{verification.additionalInfo}</p>}
            <a href={verification.documentUrl} target="_blank" rel="noreferrer" className="break-all text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline">Open private document link</a>
            {verification.rejectionReason && <p className="text-sm text-red-700 dark:text-red-400">Previous rejection: {verification.rejectionReason}</p>}
          </div>
          {verification.status === 'PENDING' && <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
            <button 
              onClick={() => { setActiveVerification(verification); setModalType('approve'); }} 
              className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Approve
            </button>
            <button 
              onClick={() => { setActiveVerification(verification); setModalType('reject'); }} 
              className="rounded-lg border border-red-300 dark:border-red-800 px-3 py-2 text-sm font-semibold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
            >
              Reject
            </button>
          </div>}
        </li>
      ))}</ul>}

      <ConfirmationModal
        isOpen={modalType === 'approve'}
        onClose={() => setModalType(null)}
        onConfirm={() => moderate('APPROVED')}
        title="Approve verification"
        description={`Approve the verification for ${activeVerification?.legalName}?`}
        confirmLabel="Approve"
        isProcessing={saving}
      />
      <ConfirmationModal
        isOpen={modalType === 'reject'}
        onClose={() => setModalType(null)}
        onConfirm={(reason) => moderate('REJECTED', reason)}
        title="Reject verification"
        description={`Reject the verification for ${activeVerification?.legalName}?`}
        confirmLabel="Reject"
        isProcessing={saving}
        withInput
        inputLabel="Rejection reason"
      />
    </section>
  );
}
