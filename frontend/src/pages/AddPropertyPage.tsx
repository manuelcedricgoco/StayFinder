import { useNavigate } from 'react-router-dom';
import { BackLink } from '../components/ui/BackLink';
import { PropertyForm } from '../components/owner/PropertyForm';
import { apiRequest, ApiError } from '../lib/api';
import { persistPropertyImages } from '../lib/propertyImages';
import type { Listing, ListingPayload } from '../types/listing';

export function AddPropertyPage() {
  const navigate = useNavigate();

  async function handleSubmit(payload: ListingPayload, images: Parameters<typeof persistPropertyImages>[2]) {
    const data = await apiRequest<{ property: Listing }>('POST', '/owner/properties', payload);
    try {
      await persistPropertyImages(data.property, undefined, images);
    } catch (error) {
      try {
        await apiRequest('DELETE', `/owner/properties/${encodeURIComponent(data.property.id)}`);
      } catch {
        throw new ApiError(0, 'The property was created, but its images could not be uploaded. Open My Properties to finish editing it.');
      }
      throw error;
    }
    navigate(`/owner/properties/${data.property.id}`);
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12">
      <BackLink to="/owner/properties" className="text-sm text-emerald-700 hover:underline dark:text-emerald-400">Back to My Properties</BackLink>
      <h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">Add Property</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">New listings are reviewed by an administrator before they are published.</p>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <PropertyForm submitLabel="Submit for review" onSubmit={handleSubmit} />
      </div>
    </section>
  );
}
