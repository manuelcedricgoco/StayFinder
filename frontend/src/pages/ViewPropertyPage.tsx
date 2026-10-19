import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BackLink } from '../components/ui/BackLink';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { PropertyThumb } from '../components/owner/PropertyThumb';
import { StatusBadge } from '../components/owner/StatusBadge';
import { useApiResource } from '../hooks/useApiResource';
import { ApiError, apiRequest } from '../lib/api';
import { AVAILABILITY_LABEL, formatPeso, TYPE_LABEL } from '../lib/listings';
import type { Listing } from '../types/listing';

export function ViewPropertyPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state } = useApiResource<{ property: Listing }>(`/owner/properties/${id}`);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingProperty, setIsDeletingProperty] = useState(false);

  async function confirmDeleteProperty() {
    setIsDeletingProperty(true);
    try {
      await apiRequest('DELETE', `/owner/properties/${id}`);
      navigate('/owner/properties', { replace: true });
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Could not delete the property.');
      setIsDeleteModalOpen(false);
    } finally {
      setIsDeletingProperty(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-12">
      <BackLink to="/owner/properties" className="text-sm text-emerald-700 hover:underline dark:text-emerald-400">Back to My Properties</BackLink>

      {state.status === 'loading' && <p role="status" className="py-12 text-center text-slate-500 dark:text-slate-400">Loading...</p>}
      {state.status === 'error' && (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {state.httpStatus === 404 ? 'Property not found.' : state.message}
        </p>
      )}

      {state.status === 'success' && (() => {
        const property = state.data.property;
        const galleryImages = property.images;
        const activeImage = galleryImages.find((image) => image.id === selectedImageId)
          ?? galleryImages.find((image) => image.isPrimary)
          ?? galleryImages[0];
        return (
          <>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{property.name}</h1>
              <StatusBadge status={property.status} />
            </div>

            {property.status === 'PENDING' && (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                This listing is waiting for administrator approval. It is not public yet.
              </p>
            )}
            {property.status === 'REJECTED' && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
                Rejected: {property.rejectionReason ?? 'No reason given.'} Edit the listing to resubmit it.
              </p>
            )}
            {actionError && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">{actionError}</p>}

            <div className="mt-6">
              <PropertyThumb
                key={activeImage?.id ?? 'property-image-fallback'}
                url={activeImage?.url}
                type={property.propertyType}
                alt={`${property.name} cover photo`}
                className="aspect-video w-full rounded-2xl"
              />
              {galleryImages.length > 1 && (
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {galleryImages.map((image, index) => (
                    <button key={image.id} type="button"
                      aria-label={`Show property photo ${index + 1}`}
                      aria-pressed={activeImage?.id === image.id}
                      onClick={() => setSelectedImageId(image.id)}
                      className={`aspect-[4/3] overflow-hidden rounded-lg border-2 ${
                        activeImage?.id === image.id ? 'border-emerald-700' : 'border-transparent'
                      }`}>
                      <img src={image.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{formatPeso(property.monthlyPrice)} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">/ month</span></p>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <div><dt className="text-slate-500 dark:text-slate-400">Type</dt><dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{TYPE_LABEL[property.propertyType]}</dd></div>
                <div><dt className="text-slate-500 dark:text-slate-400">Availability</dt><dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{AVAILABILITY_LABEL[property.availability]} · {property.availableRooms} room(s)</dd></div>
                <div><dt className="text-slate-500 dark:text-slate-400">Municipality</dt><dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{property.municipality}</dd></div>
                <div><dt className="text-slate-500 dark:text-slate-400">Address</dt><dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{property.address}</dd></div>
              </dl>
              <h2 className="mt-6 font-semibold text-slate-900 dark:text-slate-100">Description</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">{property.description}</p>
              <h2 className="mt-6 font-semibold text-slate-900 dark:text-slate-100">Amenities</h2>
              {property.amenities.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">None listed.</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {property.amenities.map((a) => <li key={a.id} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">{a.name}</li>)}
                </ul>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to={`/owner/properties/${property.id}/rooms`} className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950">Manage rooms</Link>
              <Link to={`/owner/properties/${property.id}/edit`} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Edit</Link>
              <button type="button" onClick={() => setIsDeleteModalOpen(true)} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950">Delete</button>
            </div>
          </>
        );
      })()}

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDeleteProperty}
        title="Delete Property"
        description="Are you sure you want to delete this property? This action cannot be undone."
        confirmLabel="Delete"
        isProcessing={isDeletingProperty}
      />
    </section>
  );
}
