import { useState } from 'react';
import { BackLink } from '../components/ui/BackLink';
import { StatusFilter } from '../components/ui/StatusFilter';
import { useApiResource } from '../hooks/useApiResource';
import { ApiError, apiRequest } from '../lib/api';
import { FilterDropdown } from '../components/ui/FilterDropdown';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { formatPeso, TYPE_LABEL, STATUS_LABEL } from '../lib/listings';
import { ListingStatus } from '../types/listing';

interface AdminProperty {
  id: string;
  name: string;
  description: string;
  propertyType: keyof typeof TYPE_LABEL;
  monthlyPrice: number;
  municipality: string;
  address: string;
  status: ListingStatus;
  rejectionReason: string | null;
  images: { id: string; url: string; isPrimary: boolean }[];
  owner: { name: string; email: string };
}

interface PropertiesResponse {
  status: 'ok';
  properties: AdminProperty[];
}

export function AdminPropertiesPage() {
  const [filter, setFilter] = useState<ListingStatus | 'ALL'>('PENDING');
  const path = `/admin/properties${filter !== 'ALL' ? `?status=${filter}` : ''}`;
  const { state, reload } = useApiResource<PropertiesResponse>(path);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<AdminProperty | null>(null);
  const [activeModal, setActiveModal] = useState<'APPROVE' | 'REJECT' | 'DEACTIVATE' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  async function updateStatus(property: AdminProperty, status: 'APPROVED' | 'REJECTED' | 'INACTIVE', reason?: string) {
    setError('');
    setSavingId(property.id);
    try {
      await apiRequest('PATCH', `/admin/properties/${encodeURIComponent(property.id)}/status`, {
        status,
        ...(status === 'REJECTED' ? { rejectionReason: reason } : {}),
      });
      reload();
      setActiveModal(null);
      setRejectionReason('');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not update the listing.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-12">
      <BackLink to="/admin">Admin dashboard</BackLink>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Property listings</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Review submissions and update listing publication status.</p></div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Status</span>
          <FilterDropdown 
            options={[
              { label: 'All Statuses', value: 'ALL' },
              { label: 'Pending', value: 'PENDING' },
              { label: 'Approved', value: 'APPROVED' },
              { label: 'Rejected', value: 'REJECTED' },
              { label: 'Inactive', value: 'INACTIVE' }
            ]}
            selected={filter}
            onSelect={setFilter as (val: string | 'ALL') => void}
          />
        </div>
      </div>
      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-300">{error}</p>}
      {state.status === 'loading' && <p role="status" className="py-10 text-center text-slate-500 dark:text-slate-400">Loading listings…</p>}
      {state.status === 'error' && <p role="alert" className="mt-5 rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-800 dark:text-red-300">{state.message}</p>}
      {state.status === 'success' && state.data.properties.length === 0 && <p className="mt-6 rounded-xl bg-slate-50 dark:bg-slate-800 p-8 text-center text-slate-600 dark:text-slate-300">No listings match this status.</p>}
      {state.status === 'success' && (
        <ul className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {state.data.properties.map((property) => (
            <li key={property.id} className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm transition hover:shadow-md">
              {property.images[0] && (
                <img
                  src={property.images[0].url}
                  alt={property.name}
                  className="h-48 w-full rounded-t-2xl object-cover"
                />
              )}
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{property.name}</h2>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                    property.status === 'PENDING' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300' :
                    property.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300' :
                    property.status === 'REJECTED' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300' :
                    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {property.status}
                  </span>
                </div>
                <p className="mt-1 font-semibold text-emerald-700 dark:text-emerald-400">{formatPeso(property.monthlyPrice)} / month</p>
                <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  <p>{TYPE_LABEL[property.propertyType]} · {property.municipality}</p>
                  <p className="text-slate-500 dark:text-slate-400">{property.address}</p>
                </div>
                <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4 text-sm text-slate-600 dark:text-slate-300">
                  <p className="font-medium text-slate-900 dark:text-slate-100">Owner: {property.owner.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{property.owner.email}</p>
                </div>
                <p className="mt-4 flex-1 text-sm text-slate-600 dark:text-slate-300 line-clamp-3">{property.description}</p>

                {property.status !== 'APPROVED' && (
                  <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-5">
                    <div className="flex items-center gap-2">
                      <button disabled={savingId === property.id} onClick={() => { setSelectedProperty(property); setActiveModal('APPROVE'); }} className="flex-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60">Approve</button>
                      <button disabled={savingId === property.id} onClick={() => { setSelectedProperty(property); setActiveModal('DEACTIVATE'); }} className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60">Deactivate</button>
                    </div>
                    <button disabled={savingId === property.id} onClick={() => { setSelectedProperty(property); setActiveModal('REJECT'); }} className="mt-4 w-full rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-rose-700 dark:text-rose-400 transition hover:bg-rose-50 dark:hover:bg-rose-950 disabled:opacity-60">Reject Listing</button>
                    {property.rejectionReason && <p className="mt-3 text-xs text-rose-600 dark:text-rose-400 font-medium italic">Previous: {property.rejectionReason}</p>}
                  </div>
                )}
                {property.status === 'APPROVED' && (
                  <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-5">
                    <button disabled={savingId === property.id} onClick={() => { setSelectedProperty(property); setActiveModal('DEACTIVATE'); }} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60">Deactivate Listing</button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {selectedProperty && (
        <>
          <ConfirmationModal
            isOpen={activeModal === 'APPROVE'}
            onClose={() => setActiveModal(null)}
            onConfirm={() => updateStatus(selectedProperty, 'APPROVED')}
            title="Approve Property"
            description={`Are you sure you want to approve ${selectedProperty.name}?`}
            confirmLabel="Approve"
            isProcessing={savingId === selectedProperty.id}
          />
          <ConfirmationModal
            isOpen={activeModal === 'DEACTIVATE'}
            onClose={() => setActiveModal(null)}
            onConfirm={() => updateStatus(selectedProperty, 'INACTIVE')}
            title="Deactivate Property"
            description={`Are you sure you want to deactivate ${selectedProperty.name}?`}
            confirmLabel="Deactivate"
            isProcessing={savingId === selectedProperty.id}
          />
          <ConfirmationModal
            isOpen={activeModal === 'REJECT'}
            onClose={() => setActiveModal(null)}
            onConfirm={(reason) => updateStatus(selectedProperty, 'REJECTED', reason)}
            title="Reject Listing"
            description={`Are you sure you want to reject ${selectedProperty.name}?`}
            confirmLabel="Confirm Rejection"
            isProcessing={savingId === selectedProperty.id}
            withInput={true}
            inputLabel="Rejection Reason"
          />
        </>
      )}
    </section>
  );
}
