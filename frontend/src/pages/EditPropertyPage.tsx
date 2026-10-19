import { useNavigate, useParams } from 'react-router-dom';
import { BackLink } from '../components/ui/BackLink';
import { PropertyForm } from '../components/owner/PropertyForm';
import { useApiResource } from '../hooks/useApiResource';
import { apiRequest } from '../lib/api';
import { persistPropertyImages } from '../lib/propertyImages';
import type { Listing, ListingPayload } from '../types/listing';

export function EditPropertyPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state } = useApiResource<{ property: Listing }>(`/owner/properties/${id}`);

  async function handleSubmit(payload: ListingPayload, images: Parameters<typeof persistPropertyImages>[2]) {
    const data = await apiRequest<{ property: Listing }>('PUT', `/owner/properties/${id}`, payload);
    await persistPropertyImages(data.property, data.property, images);
    navigate(`/owner/properties/${id}`);
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12">
      <BackLink to={`/owner/properties/${id}`} className="text-sm text-emerald-700 hover:underline dark:text-emerald-400">Back to property</BackLink>
      <h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">Edit Property</h1>

      {state.status === 'loading' && <p role="status" className="py-12 text-center text-slate-500 dark:text-slate-400">Loading...</p>}
      {state.status === 'error' && (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {state.httpStatus === 404 ? 'Property not found.' : state.message}
        </p>
      )}
      {state.status === 'success' && (
        <>
          {state.data.property.status !== 'PENDING' && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Saving changes sends this listing back for administrator review.
            </p>
          )}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <PropertyForm initial={state.data.property} submitLabel="Save changes" onSubmit={handleSubmit} />
          </div>
        </>
      )}
    </section>
  );
}
