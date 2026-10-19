import {
  AlertCircle,
  Building2,
  Ellipsis,
  House,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Star,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiResource } from '../hooks/useApiResource';
import { ApiError, apiRequest } from '../lib/api';
import { formatPeso, TYPE_LABEL } from '../lib/listings';
import { FilterDropdown } from '../components/ui/FilterDropdown';
import type { Listing, ListingAvailability, ListingStatus, ListingType } from '../types/listing';

interface ManagedProperty extends Listing {
  rooms: Array<{ id: string; isAvailable: boolean }>;
  monthlyInquiries: number;
  averageRating: number | null;
  approvedReviewCount: number;
}

interface PropertiesResponse {
  status: 'ok';
  properties: ManagedProperty[];
}

type SortOption = 'NEWEST' | 'OLDEST' | 'PRICE_ASC' | 'PRICE_DESC' | 'MOST_AVAILABLE';
type StatusFilter = ListingStatus | '';
type TypeFilter = ListingType | '';
type AvailabilityFilter = ListingAvailability | '';

const inputStyle = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200';

const statusPresentation: Record<ListingStatus, { label: string; icon: string; style: string }> = {
  APPROVED: { label: 'Approved', icon: '✓', style: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  PENDING: { label: 'Pending Review', icon: '⏳', style: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  REJECTED: { label: 'Rejected', icon: '✕', style: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' },
  INACTIVE: { label: 'Suspended', icon: '⚠', style: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
};

function availableRoomCount(property: ManagedProperty) {
  return property.rooms.length > 0
    ? property.rooms.filter((room) => room.isAvailable).length
    : property.availability === 'FULLY_OCCUPIED' ? 0 : property.availableRooms;
}

function getAvailabilitySummary(property: ManagedProperty) {
  if (property.rooms.length > 0) {
    const available = property.rooms.filter((room) => room.isAvailable).length;
    const occupied = property.rooms.length - available;
    if (available === 0) return 'Fully occupied';
    return `${available} available · ${occupied} occupied`;
  }
  if (property.availability === 'FULLY_OCCUPIED') return 'Fully occupied';
  if (property.availability === 'COMING_SOON') return 'Coming soon';
  if (property.availableRooms > 0) return `${property.availableRooms} available · total not tracked`;
  return 'No rooms added';
}

function PropertyImage({ property }: { property: ManagedProperty }) {
  const [failed, setFailed] = useState(false);
  const image = property.images.find((item) => item.isPrimary) ?? property.images[0];
  if (image && !failed) {
    return (
      <img
        src={image.url}
        alt={`${property.name}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="aspect-video w-full object-cover"
      />
    );
  }
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-emerald-50 via-white to-teal-100 text-emerald-800 dark:from-emerald-950 dark:via-slate-900 dark:to-teal-950 dark:text-emerald-300">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-100 bg-white/80 shadow-sm dark:border-emerald-900 dark:bg-slate-800/80">
        <House className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">No property image</span>
    </div>
  );
}

function PropertyCard({
  property,
  deleting,
  onDelete,
}: {
  property: ManagedProperty;
  deleting: boolean;
  onDelete: (property: ManagedProperty) => void;
}) {
  const status = statusPresentation[property.status];
  const availability = getAvailabilitySummary(property);
  const roomsExist = property.rooms.length > 0;

  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-emerald-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-800">
      <div className="relative">
        <PropertyImage property={property} />
        <span className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ${status.style}`}>
          <span aria-hidden="true">{status.icon}</span> {status.label}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold text-slate-900 dark:text-slate-100">{property.name}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{TYPE_LABEL[property.propertyType]}</p>
          </div>
          <details className="group relative shrink-0">
            <summary
              aria-label={`More actions for ${property.name}`}
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 [&::-webkit-details-marker]:hidden dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Ellipsis className="h-5 w-5" aria-hidden="true" />
            </summary>
            <div className="absolute right-0 z-10 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <Link to={`/owner/properties/${encodeURIComponent(property.id)}/rooms`} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">Manage Rooms / Availability</Link>
              <Link to="/owner/inquiries" className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">View Inquiries</Link>
              <Link to="/owner/reviews" className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">View Reviews</Link>
              <button
                type="button"
                disabled={deleting}
                onClick={() => onDelete(property)}
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950"
              >
                {deleting ? 'Deleting…' : 'Delete Property'}
              </button>
            </div>
          </details>
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
          <MapPin className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          <span className="truncate">{property.municipality}, Occidental Mindoro</span>
        </p>
        <p className="mt-3 text-xl font-bold text-emerald-700 dark:text-emerald-400">
          {formatPeso(property.monthlyPrice)} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">/ month</span>
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Rooms</p>
            <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{roomsExist ? `${property.rooms.length} total` : 'Not added'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Availability</p>
            <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{availability}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
          {property.averageRating !== null && (
            <span className="inline-flex items-center gap-1">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
              <span className="font-semibold text-slate-800 dark:text-slate-100">{property.averageRating.toFixed(1)}</span>
              <span className="text-xs">({property.approvedReviewCount})</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle className="h-4 w-4 text-slate-400" aria-hidden="true" />
            {property.monthlyInquiries} {property.monthlyInquiries === 1 ? 'inquiry' : 'inquiries'} this month
          </span>
        </div>

        {property.status === 'REJECTED' && property.rejectionReason && (
          <details className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-300">
            <summary className="cursor-pointer font-medium">View rejection reason</summary>
            <p className="mt-2 whitespace-pre-line">{property.rejectionReason}</p>
          </details>
        )}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Link to={`/owner/properties/${encodeURIComponent(property.id)}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">View</Link>
          <Link to={`/owner/properties/${encodeURIComponent(property.id)}/edit`} className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-600 dark:text-emerald-400 dark:hover:bg-emerald-950">Edit</Link>
          <Link to={`/owner/properties/${encodeURIComponent(property.id)}/rooms`} className="ml-auto rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Manage Property →</Link>
        </div>
      </div>
    </article>
  );
}

export function MyPropertiesPage() {
  const { state, reload } = useApiResource<PropertiesResponse>('/owner/properties');
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [type, setType] = useState<TypeFilter>('');
  const [availability, setAvailability] = useState<AvailabilityFilter>('');
  const [sort, setSort] = useState<SortOption>('NEWEST');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const properties = state.status === 'success' ? state.data.properties : [];
  const visibleProperties = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const filtered = properties.filter((property) => {
      const matchesSearch = !normalizedSearch ||
        property.name.toLocaleLowerCase().includes(normalizedSearch) ||
        property.municipality.toLocaleLowerCase().includes(normalizedSearch);
      return matchesSearch &&
        (!status || property.status === status) &&
        (!type || property.propertyType === type) &&
        (!availability || property.availability === availability);
    });

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'OLDEST': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'PRICE_ASC': return a.monthlyPrice - b.monthlyPrice;
        case 'PRICE_DESC': return b.monthlyPrice - a.monthlyPrice;
        case 'MOST_AVAILABLE': return availableRoomCount(b) - availableRoomCount(a);
        case 'NEWEST':
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [availability, properties, search, sort, status, type]);

  const summary = useMemo(() => ({
    total: properties.length,
    approved: properties.filter((property) => property.status === 'APPROVED').length,
    pending: properties.filter((property) => property.status === 'PENDING').length,
    availableRooms: properties.reduce((total, property) => total + availableRoomCount(property), 0),
    occupiedRooms: properties.reduce((total, property) =>
      total + property.rooms.filter((room) => !room.isAvailable).length, 0),
  }), [properties]);

  async function handleDelete(property: ManagedProperty) {
    if (!window.confirm(`Delete this property?\n\n"${property.name}" and its related rooms, images, and listing data will be removed. This action cannot be undone.`)) {
      return;
    }
    setActionError(null);
    setDeletingId(property.id);
    try {
      await apiRequest('DELETE', `/owner/properties/${encodeURIComponent(property.id)}`);
      reload();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Could not delete the property.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">My Properties</h1>
          <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">Manage your boarding houses, apartments, rooms, availability, and listings.</p>
        </div>
        <Link to="/owner/properties/new" className="inline-flex w-fit items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
          <Plus className="h-4 w-4" aria-hidden="true" /> Add Property
        </Link>
      </header>

      {actionError && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{actionError}</p>}
      {state.status === 'loading' && <p role="status" className="py-12 text-center text-slate-500 dark:text-slate-400">Loading your properties…</p>}
      {state.status === 'error' && <p role="alert" className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.message}</p>}

      {state.status === 'success' && properties.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center dark:border-slate-600 dark:bg-slate-900">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            <Building2 className="h-7 w-7" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">You don&apos;t have any properties yet.</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600 dark:text-slate-300">Add your first boarding house or apartment to start receiving inquiries from boarders.</p>
          <Link to="/owner/properties/new" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
            <Plus className="h-4 w-4" aria-hidden="true" /> Add Your First Property
          </Link>
        </div>
      )}

      {state.status === 'success' && properties.length > 0 && (
        <>
          <section aria-label="Property summary" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {[
              { label: 'Total Properties', value: summary.total, Icon: Building2 },
              { label: 'Approved', value: summary.approved, Icon: Building2 },
              { label: 'Pending Review', value: summary.pending, Icon: AlertCircle },
              { label: 'Available Rooms', value: summary.availableRooms, Icon: House },
              { label: 'Occupied Rooms', value: summary.occupiedRooms, Icon: House },
            ].map(({ label, value, Icon }) => (
              <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-500 sm:text-sm dark:text-slate-400">{label}</p>
                  <Icon className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{value.toLocaleString()}</p>
              </article>
            ))}
          </section>

          <section aria-label="Search and filter properties" className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-900">
            <label className="relative block">
              <span className="sr-only">Search property name or location</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                maxLength={100}
                placeholder="Search by property name or location"
                className={`${inputStyle} pl-9`}
              />
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Status
                <FilterDropdown
                  fullWidth
                  options={[
                    { label: 'All statuses', value: '' },
                    { label: 'Approved', value: 'APPROVED' },
                    { label: 'Pending review', value: 'PENDING' },
                    { label: 'Rejected', value: 'REJECTED' },
                    { label: 'Suspended', value: 'INACTIVE' }
                  ]}
                  selected={status}
                  onSelect={(val) => setStatus(val as StatusFilter)}
                  className="mt-1"
                />
              </div>
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Property type
                <FilterDropdown
                  fullWidth
                  options={[
                    { label: 'All property types', value: '' },
                    ...(Object.keys(TYPE_LABEL) as ListingType[]).map(type => ({ label: TYPE_LABEL[type], value: type }))
                  ]}
                  selected={type}
                  onSelect={(val) => setType(val as TypeFilter)}
                  className="mt-1"
                />
              </div>
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Availability
                <FilterDropdown
                  fullWidth
                  options={[
                    { label: 'All availability', value: '' },
                    { label: 'Available', value: 'AVAILABLE' },
                    { label: 'Fully occupied', value: 'FULLY_OCCUPIED' },
                    { label: 'Coming soon', value: 'COMING_SOON' }
                  ]}
                  selected={availability}
                  onSelect={(val) => setAvailability(val as AvailabilityFilter)}
                  className="mt-1"
                />
              </div>
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Sort by
                <FilterDropdown
                  fullWidth
                  options={[
                    { label: 'Newest', value: 'NEWEST' },
                    { label: 'Oldest', value: 'OLDEST' },
                    { label: 'Price: Low to High', value: 'PRICE_ASC' },
                    { label: 'Price: High to Low', value: 'PRICE_DESC' },
                    { label: 'Most Available Rooms', value: 'MOST_AVAILABLE' }
                  ]}
                  selected={sort}
                  onSelect={(val) => setSort(val as SortOption)}
                  className="mt-1"
                />
              </div>
            </div>
          </section>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{visibleProperties.length}</span> of {properties.length} {properties.length === 1 ? 'property' : 'properties'}
            </p>
          </div>

          {visibleProperties.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-600 dark:bg-slate-900">
              <Search className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
              <p className="mt-3 font-semibold text-slate-900 dark:text-slate-100">No properties match your filters.</p>
              <button type="button" onClick={() => { setSearch(''); setStatus(''); setType(''); setAvailability(''); setSort('NEWEST'); }} className="mt-3 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">Clear filters</button>
            </div>
          ) : (
            <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
              {visibleProperties.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  deleting={deletingId === property.id}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
