import { useEffect, useState, type FormEvent } from 'react';
import { House } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, apiRequest } from '../lib/api';
import { AVAILABILITY_LABEL, formatPeso, TYPE_LABEL } from '../lib/listings';
import type {
  AmenityOption,
  LocationOption,
  PublicListing,
  PublicListingSearchResponse,
} from '../types/listing';

interface SearchFilters {
  q: string;
  municipality: string;
  propertyType: string;
  minPrice: string;
  maxPrice: string;
  availability: string;
  amenities: string[];
  sort: string;
}

type ReferenceResponse<T, K extends string> = {
  status: 'ok';
} & Record<K, T[]>;

const emptyFilters: SearchFilters = {
  q: '',
  municipality: '',
  propertyType: '',
  minPrice: '',
  maxPrice: '',
  availability: '',
  amenities: [],
  sort: 'NEWEST',
};

const fieldClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30';

function filtersFromParams(params: URLSearchParams): SearchFilters {
  return {
    q: params.get('q') ?? '',
    municipality: params.get('municipality') ?? '',
    propertyType: params.get('propertyType') ?? '',
    minPrice: params.get('minPrice') ?? '',
    maxPrice: params.get('maxPrice') ?? '',
    availability: params.get('availability') ?? '',
    amenities: params.get('amenities')?.split(',').filter(Boolean) ?? [],
    sort: params.get('sort') ?? 'NEWEST',
  };
}

function ListingCard({ listing }: { listing: PublicListing }) {
  const [imageFailed, setImageFailed] = useState(false);
  const image = listing.images[0];

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative flex h-48 items-center justify-center bg-linear-to-br from-emerald-100 to-teal-200">
        {image && !imageFailed ? (
          <img
            src={image.url}
            alt={listing.name}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="text-emerald-900/50" aria-hidden="true">
            <House size={52} strokeWidth={1.4} />
          </span>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-800">
          {TYPE_LABEL[listing.propertyType]}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-lg font-semibold text-slate-900">{listing.name}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {listing.address}, {listing.municipality}
        </p>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{listing.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {listing.amenities.map((amenity) => (
            <span key={amenity.id} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
              {amenity.name}
            </span>
          ))}
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <p className="font-bold text-emerald-700">
            {formatPeso(listing.monthlyPrice)}
            <span className="font-normal text-slate-500"> / month</span>
          </p>
          <p className="text-right text-xs text-slate-500">
            {AVAILABILITY_LABEL[listing.availability]}
            {listing.availability === 'AVAILABLE' && ` · ${listing.availableRooms} rooms`}
          </p>
        </div>
        <Link
          to={`/properties/${encodeURIComponent(listing.id)}`}
          className="mt-4 inline-flex justify-center rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        >
          View details
        </Link>
      </div>
    </article>
  );
}

export function PublicPropertiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => filtersFromParams(searchParams));
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [amenityOptions, setAmenityOptions] = useState<AmenityOption[]>([]);
  const [referenceError, setReferenceError] = useState('');
  const [result, setResult] = useState<PublicListingSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    setFilters(filtersFromParams(searchParams));
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<ReferenceResponse<LocationOption, 'locations'>>('GET', '/locations'),
      apiRequest<ReferenceResponse<AmenityOption, 'amenities'>>('GET', '/amenities'),
    ])
      .then(([locationResponse, amenityResponse]) => {
        if (!active) return;
        setLocations(locationResponse.locations);
        setAmenityOptions(amenityResponse.amenities);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setReferenceError(
          reason instanceof ApiError ? reason.message : 'Could not load search filter options.',
        );
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const query = searchParams.toString();
    apiRequest<PublicListingSearchResponse>(
      'GET',
      `/properties${query ? `?${query}` : ''}`,
    )
      .then((response) => {
        if (!active) return;
        setResult(response);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof ApiError ? reason.message : 'Could not load properties.');
        setResult(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [searchParams, retryToken]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (filters.q.trim()) params.set('q', filters.q.trim());
    if (filters.municipality) params.set('municipality', filters.municipality);
    if (filters.propertyType) params.set('propertyType', filters.propertyType);
    if (filters.minPrice) params.set('minPrice', filters.minPrice);
    if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);
    if (filters.availability) params.set('availability', filters.availability);
    if (filters.amenities.length) params.set('amenities', filters.amenities.join(','));
    if (filters.sort !== 'NEWEST') params.set('sort', filters.sort);
    setSearchParams(params);
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setSearchParams({});
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams);
    if (page === 1) params.delete('page');
    else params.set('page', String(page));
    setSearchParams(params);
  }

  function toggleAmenity(slug: string) {
    setFilters((current) => ({
      ...current,
      amenities: current.amenities.includes(slug)
        ? current.amenities.filter((item) => item !== slug)
        : [...current.amenities, slug],
    }));
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Occidental Mindoro rentals
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Find a place to stay</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Search approved listings by name, municipality, type, monthly budget, availability, and amenities.
        </p>
      </header>

      <form
        onSubmit={submitSearch}
        className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">
            Property name
            <input
              className={fieldClass}
              value={filters.q}
              maxLength={100}
              onChange={(event) => setFilters({ ...filters, q: event.target.value })}
              placeholder="Search by name"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Municipality
            <select
              className={fieldClass}
              value={filters.municipality}
              onChange={(event) => setFilters({ ...filters, municipality: event.target.value })}
            >
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.name}>{location.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Property type
            <select
              className={fieldClass}
              value={filters.propertyType}
              onChange={(event) => setFilters({ ...filters, propertyType: event.target.value })}
            >
              <option value="">Any type</option>
              {Object.entries(TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Availability
            <select
              className={fieldClass}
              value={filters.availability}
              onChange={(event) => setFilters({ ...filters, availability: event.target.value })}
            >
              <option value="">Any availability</option>
              {Object.entries(AVAILABILITY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Minimum monthly price
            <input
              className={fieldClass}
              type="number"
              min="0"
              max="1000000"
              value={filters.minPrice}
              onChange={(event) => setFilters({ ...filters, minPrice: event.target.value })}
              placeholder="₱"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Maximum monthly price
            <input
              className={fieldClass}
              type="number"
              min="0"
              max="1000000"
              value={filters.maxPrice}
              onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })}
              placeholder="₱"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Sort results
            <select
              className={fieldClass}
              value={filters.sort}
              onChange={(event) => setFilters({ ...filters, sort: event.target.value })}
            >
              <option value="NEWEST">Newest</option>
              <option value="PRICE_ASC">Price: low to high</option>
              <option value="PRICE_DESC">Price: high to low</option>
            </select>
          </label>
        </div>

        {amenityOptions.length > 0 && (
          <fieldset className="mt-5">
            <legend className="text-sm font-medium text-slate-700">Amenities (match all selected)</legend>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {amenityOptions.map((amenity) => (
                <label key={amenity.id} className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={filters.amenities.includes(amenity.slug)}
                    onChange={() => toggleAmenity(amenity.slug)}
                    className="h-4 w-4 rounded border-slate-300 accent-emerald-700"
                  />
                  {amenity.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {referenceError && <p className="mt-3 text-sm text-red-700">{referenceError}</p>}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            className="rounded-lg bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            Search properties
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Clear filters
          </button>
        </div>
      </form>

      <div className="mt-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h2 className="text-xl font-semibold text-slate-900" aria-live="polite">
          {loading
            ? 'Loading properties…'
            : result
              ? `${result.pagination.total} ${result.pagination.total === 1 ? 'property' : 'properties'} found`
              : 'Search results'}
        </h2>
      </div>

      {loading && (
        <div role="status" className="mt-5 rounded-xl bg-slate-50 p-8 text-center text-slate-600">
          Loading approved listings…
        </div>
      )}
      {!loading && error && (
        <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setRetryToken((value) => value + 1)}
            className="mt-3 font-semibold underline"
          >
            Try again
          </button>
        </div>
      )}
      {!loading && !error && result?.properties.length === 0 && (
        <div className="mt-5 rounded-xl bg-slate-50 p-8 text-center">
          <h3 className="text-lg font-semibold text-slate-900">No matching properties</h3>
          <p className="mt-2 text-slate-600">Try changing or clearing some filters.</p>
        </div>
      )}
      {!loading && !error && result && result.properties.length > 0 && (
        <>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {result.properties.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
          {result.pagination.totalPages > 1 && (
            <nav aria-label="Property result pages" className="mt-8 flex items-center justify-center gap-4">
              <button
                type="button"
                disabled={result.pagination.page <= 1}
                onClick={() => goToPage(result.pagination.page - 1)}
                className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {result.pagination.page} of {result.pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={result.pagination.page >= result.pagination.totalPages}
                onClick={() => goToPage(result.pagination.page + 1)}
                className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
