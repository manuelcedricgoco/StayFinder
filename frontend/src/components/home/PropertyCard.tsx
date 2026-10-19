import type { Property, PropertyType } from '../../types/property';
import { BadgeCheck, GraduationCap, House, MapPin } from 'lucide-react';

const imageGradients: Record<PropertyType, string> = {
  'Boarding House': 'from-emerald-200 to-teal-300',
  Apartment: 'from-sky-200 to-indigo-300',
  Room: 'from-amber-200 to-orange-300',
  Bedspace: 'from-rose-200 to-pink-300',
};

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

export function PropertyCard({ property }: { property: Property }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg">
      {/* Placeholder image area. Real photos (Cloudinary) arrive in a later phase. */}
      <div
        className={`relative flex h-44 items-center justify-center bg-linear-to-br ${imageGradients[property.type]}`}
      >
        <span className="text-emerald-900/50" aria-hidden="true">
          <House size={52} strokeWidth={1.4} />
        </span>
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800">
          {property.type}
        </span>
        {property.verified && (
          <span className="absolute right-3 top-3 rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white">
            <span className="inline-flex items-center gap-1">
              <BadgeCheck size={14} aria-hidden="true" />
              Verified
            </span>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-semibold text-slate-900">{property.title}</h3>
        <p className="mt-1 text-sm text-slate-500">
          <MapPin className="mr-1 inline h-4 w-4" aria-hidden="true" />
          {property.municipality} · {property.area}
        </p>

        <ul className="mt-4 flex flex-wrap gap-2">
          {property.amenities.map((amenity) => (
            <li key={amenity} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
              {amenity}
            </li>
          ))}
          {property.studentFriendly && (
            <li className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
              <span className="inline-flex items-center gap-1">
                <GraduationCap size={14} aria-hidden="true" />
                Student-friendly
              </span>
            </li>
          )}
        </ul>

        <div className="mt-auto flex items-end justify-between pt-5">
          <p>
            <span className="text-xl font-bold text-emerald-700">
              {peso.format(property.monthlyPrice)}
            </span>
            <span className="text-sm text-slate-500"> / month</span>
          </p>
          {/* Details pages come in a later phase. */}
          <button
            type="button"
            className="rounded-lg border border-emerald-700 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            View Details
          </button>
        </div>
      </div>
    </article>
  );
}
