import { Link } from 'react-router-dom';
import { BackLink } from '../components/ui/BackLink';
import { PropertyThumb } from '../components/owner/PropertyThumb';
import { useApiResource } from '../hooks/useApiResource';
import { ApiError, apiRequest } from '../lib/api';
import { AVAILABILITY_LABEL, formatPeso, TYPE_LABEL } from '../lib/listings';
import type { PublicListing } from '../types/listing';
import { useState } from 'react';

interface FavoriteItem {
  id: string;
  createdAt: string;
  property: PublicListing;
}

interface FavoriteResponse {
  status: 'ok';
  favorites: FavoriteItem[];
}

export function BoarderFavoritesPage() {
  const { state, reload } = useApiResource<FavoriteResponse>('/boarder/favorites');
  const [actionError, setActionError] = useState('');

  async function remove(propertyId: string) {
    setActionError('');
    try {
      await apiRequest('DELETE', `/boarder/favorites/${encodeURIComponent(propertyId)}`);
      reload();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Could not remove the saved property.');
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-12">
      <BackLink to="/boarder">Boarder dashboard</BackLink>
      <h1 className="mt-3 text-3xl font-bold text-slate-900 dark:text-slate-100">Saved properties</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">Approved listings you have saved for later.</p>
      {actionError && <p role="alert" className="mt-5 rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-400">{actionError}</p>}
      {state.status === 'loading' && <p role="status" className="py-12 text-center text-slate-500 dark:text-slate-400">Loading saved properties…</p>}
      {state.status === 'error' && <p role="alert" className="mt-5 rounded-lg bg-red-50 dark:bg-red-950 p-4 text-red-800 dark:text-red-400">{state.message}</p>}
      {state.status === 'success' && state.data.favorites.length === 0 && (
        <div className="mt-6 rounded-xl bg-slate-50 dark:bg-slate-800 p-8 text-center">
          <p className="font-semibold text-slate-900 dark:text-slate-100">No saved properties yet</p>
          <Link to="/properties" className="mt-3 inline-block font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">Browse listings</Link>
        </div>
      )}
      {state.status === 'success' && state.data.favorites.length > 0 && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {state.data.favorites.map(({ id, property }) => (
            <article key={id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
              <PropertyThumb
                type={property.propertyType}
                url={property.images[0]?.url}
                alt={property.name}
                className="h-48 w-full"
              />
              <div className="flex flex-1 flex-col p-5">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{TYPE_LABEL[property.propertyType]}</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{property.name}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{property.address}, {property.municipality}</p>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{AVAILABILITY_LABEL[property.availability]}</p>
                <p className="mt-2 font-bold text-emerald-700 dark:text-emerald-400">{formatPeso(property.monthlyPrice)} / month</p>
                <div className="mt-auto flex gap-3 pt-4">
                  <Link to={`/properties/${encodeURIComponent(property.id)}`} className="flex-1 rounded-lg bg-emerald-700 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-emerald-800">View details</Link>
                  <button type="button" onClick={() => remove(property.id)} className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">Remove</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
