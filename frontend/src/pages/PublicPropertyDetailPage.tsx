import { lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { BackLink } from '../components/ui/BackLink';
import { RatingStars } from '../components/ui/RatingStars';
import { PropertyThumb } from '../components/owner/PropertyThumb';
import { BoarderPropertyActions } from '../components/boarder/BoarderPropertyActions';
import { useApiResource } from '../hooks/useApiResource';
import { AVAILABILITY_LABEL, formatPeso, TYPE_LABEL } from '../lib/listings';
import type { PublicListingDetail } from '../types/listing';

const PropertyMap = lazy(() =>
  import('../components/properties/PropertyMap').then((module) => ({ default: module.PropertyMap })),
);

interface PublicPropertyResponse {
  status: 'ok';
  property: PublicListingDetail;
}

export function PublicPropertyDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { state } = useApiResource<PublicPropertyResponse>(`/properties/${encodeURIComponent(id)}`);

  if (state.status === 'loading') {
    return (
      <section className="mx-auto max-w-5xl px-4 py-12">
        <p role="status" className="py-12 text-center text-slate-500">Loading property details…</p>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section className="mx-auto max-w-5xl px-4 py-12">
        <BackLink to="/properties">Back to search</BackLink>
        <div role="alert" className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-8">
          <h1 className="text-2xl font-bold text-slate-900">
            {state.httpStatus === 404 ? 'Property not found' : 'Could not load property'}
          </h1>
          <p className="mt-2 text-slate-600">
            {state.httpStatus === 404
              ? 'This listing may have been removed or is no longer publicly available.'
              : state.message}
          </p>
        </div>
      </section>
    );
  }

  const { property } = state.data;
  const coordinates: [number, number] | null =
    property.latitude !== null && property.longitude !== null
      ? [property.latitude, property.longitude]
      : null;
  const openStreetMapUrl = coordinates
    ? `https://www.openstreetmap.org/?mlat=${coordinates[0]}&mlon=${coordinates[1]}#map=16/${coordinates[0]}/${coordinates[1]}`
    : null;

  return (
    <article className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
      <BackLink to="/properties">Back to search</BackLink>

      <header className="mt-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          {TYPE_LABEL[property.propertyType]} · {property.municipality}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">{property.name}</h1>
        <p className="mt-2 text-slate-600">{property.address}, {property.municipality}</p>
      </header>

      <section aria-label="Property photos" className="mt-6 grid gap-3 sm:grid-cols-2">
        {property.images.length === 0 ? (
          <PropertyThumb type={property.propertyType} className="h-64 rounded-2xl sm:col-span-2 sm:h-96" />
        ) : (
          property.images.map((image, index) => (
            <PropertyThumb
              key={image.id}
              url={image.url}
              type={property.propertyType}
              alt={`${property.name} photo ${index + 1}`}
              className={`w-full rounded-2xl ${index === 0 ? 'h-64 sm:col-span-2 sm:h-96' : 'h-48'}`}
            />
          ))
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold text-slate-900">About this place</h2>
            <p className="mt-3 whitespace-pre-line leading-7 text-slate-700">{property.description}</p>

            <h3 className="mt-6 font-semibold text-slate-900">Amenities</h3>
            {property.amenities.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No amenities have been listed.</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {property.amenities.map((amenity) => (
                  <li key={amenity.id} className="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
                    {amenity.name}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold text-slate-900">Rooms</h2>
            {property.rooms.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                Room-by-room details have not been added. {property.availableRooms} room(s) are currently available.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {property.rooms.map((room) => (
                  <li key={room.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{room.name}</p>
                      <p className="text-sm text-slate-500">Capacity: {room.capacity}</p>
                    </div>
                    <p className="text-sm font-semibold text-emerald-700">
                      {room.monthlyPrice === null ? 'Use property price' : `${formatPeso(room.monthlyPrice)} / month`}
                      <span className="ml-2 font-normal text-slate-500">
                        {room.isAvailable ? 'Available' : 'Unavailable'}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold text-slate-900">Boarder reviews</h2>
            {property.reviews.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No approved reviews yet.</p>
            ) : (
              <ul className="mt-3 space-y-4">
                {property.reviews.map((review) => (
                  <li key={review.id} className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
                    <p className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700">
                      <RatingStars rating={review.rating} />
                      <span className="text-slate-600">{review.rating} / 5</span>
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{review.content}</p>
                    <p className="mt-2 text-xs text-slate-500">{new Date(review.createdAt).toLocaleDateString()}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Location</h2>
                <p className="mt-1 text-sm text-slate-600">{property.address}, {property.municipality}</p>
              </div>
              {openStreetMapUrl && (
                <a
                  href={openStreetMapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-emerald-700 hover:underline"
                >
                  Open in OpenStreetMap
                </a>
              )}
            </div>
            {coordinates ? (
              <Suspense fallback={<p role="status" className="mt-3 h-72 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Loading map…</p>}>
                <PropertyMap latitude={coordinates[0]} longitude={coordinates[1]} name={property.name} />
              </Suspense>
            ) : (
              <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                Map location is not available for this listing.
              </p>
            )}
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
          <p className="text-2xl font-bold text-emerald-700">
            {formatPeso(property.monthlyPrice)}
            <span className="text-sm font-normal text-slate-500"> / month</span>
          </p>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="text-slate-500">Availability</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {AVAILABILITY_LABEL[property.availability]}
                {property.availability === 'AVAILABLE' && ` · ${property.availableRooms} room(s)`}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Property type</dt>
              <dd className="mt-1 font-medium text-slate-900">{TYPE_LABEL[property.propertyType]}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Owner</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {property.owner.name}
                {property.owner.isVerified && <span className="ml-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Verified owner</span>}
              </dd>
            </div>
          </dl>
          <p className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
            Contact and inquiry tools are planned for the boarder features phase.
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-500">Only identity submissions approved by an administrator receive the verified-owner badge.</p>
        </aside>
      </div>
      <BoarderPropertyActions propertyId={property.id} propertyName={property.name} />
    </article>
  );
}
