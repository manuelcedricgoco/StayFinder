import { MapPin } from 'lucide-react';
import type { LocationInfo } from '../../types/property';

export function LocationCard({ name, listingCount }: LocationInfo) {
  return (
    <a
      href="#featured"
      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"
        aria-hidden="true"
      >
        <MapPin size={21} />
      </span>
      <span>
        <span className="block font-semibold text-slate-900">{name}</span>
        <span className="block text-sm text-slate-500">{listingCount} listings</span>
      </span>
    </a>
  );
}
