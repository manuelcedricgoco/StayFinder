import { useState, type FormEvent } from 'react';
import { BackLink } from '../components/ui/BackLink';
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
}

interface VerificationResponse {
  status: 'ok';
  verification: Verification | null;
}

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 dark:border-slate-600';

export function OwnerVerificationPage() {
  const { state, reload } = useApiResource<VerificationResponse>('/owner/verification');
  const [legalName, setLegalName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [documentType, setDocumentType] = useState('NATIONAL_ID');
  const [documentUrl, setDocumentUrl] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      await apiRequest('POST', '/owner/verification', {
        legalName,
        phoneNumber,
        documentType,
        documentUrl,
        additionalInfo,
      });
      setMessage('Verification submitted. It is pending administrator review.');
      reload();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Could not submit verification.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-12">
      <BackLink to="/owner">Owner dashboard</BackLink>
      <h1 className="mt-3 text-3xl font-bold text-slate-900 dark:text-slate-100">Owner verification</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">Submit your details for administrator review. A submission does not make the account verified automatically.</p>
      {state.status === 'loading' && <p role="status" className="mt-5 text-slate-500 dark:text-slate-400">Loading verification status…</p>}
      {state.status === 'error' && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-300">{state.message}</p>}
      {message && <p role="status" className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{message}</p>}
      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{error}</p>}
      {state.status === 'success' && state.data.verification && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Current status</p>
          <p className={`mt-1 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
            state.data.verification.status === 'APPROVED'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'
              : state.data.verification.status === 'REJECTED'
                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
          }`}>{state.data.verification.status}</p>
          <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">Submitted {new Date(state.data.verification.submittedAt).toLocaleString()}</p>
          {state.data.verification.rejectionReason && (
            <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">Reason: {state.data.verification.rejectionReason}</p>
          )}
          {state.data.verification.status === 'APPROVED' && (
            <p className="mt-3 text-sm text-emerald-800 dark:text-emerald-300">Your owner identity has been approved.</p>
          )}
        </div>
      )}
      {state.status === 'success' && state.data.verification?.status === 'PENDING' && (
        <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">Your verification is pending. You cannot edit or resubmit it until it is reviewed.</p>
      )}
      {state.status === 'success' && state.data.verification?.status !== 'APPROVED' && state.data.verification?.status !== 'PENDING' && (
        <form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Legal name
            <input required minLength={2} maxLength={120} value={legalName} onChange={(event) => setLegalName(event.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Phone number
            <input required minLength={7} maxLength={30} type="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} className={inputClass} placeholder="+63…" />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Government ID type
            <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className={inputClass}>
              <option value="NATIONAL_ID">National ID</option>
              <option value="DRIVERS_LICENSE">Driver&apos;s license</option>
              <option value="PASSPORT">Passport</option>
              <option value="VOTERS_ID">Voter&apos;s ID</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Private HTTPS document link
            <input required type="url" value={documentUrl} onChange={(event) => setDocumentUrl(event.target.value)} className={inputClass} placeholder="https://…" />
            <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">Use a private link only accessible to reviewers. Do not use a public link. The app does not upload or fetch the document.</span>
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Additional information (optional)
            <textarea maxLength={1000} rows={3} value={additionalInfo} onChange={(event) => setAdditionalInfo(event.target.value)} className={inputClass} />
          </label>
          <button disabled={saving} type="submit" className="rounded-lg bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
            {saving ? 'Submitting…' : state.data.verification ? 'Resubmit for review' : 'Submit for verification'}
          </button>
        </form>
      )}
    </section>
  );
}
