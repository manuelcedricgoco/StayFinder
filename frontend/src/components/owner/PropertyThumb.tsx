import { useState } from 'react';
import { House } from 'lucide-react';
import type { ListingType } from '../../types/listing';

const gradients: Record<ListingType, string> = {
  BOARDING_HOUSE: 'from-emerald-200 to-teal-300',
  APARTMENT: 'from-sky-200 to-indigo-300',
  ROOM: 'from-amber-200 to-orange-300',
  BEDSPACE: 'from-rose-200 to-pink-300',
};

interface PropertyThumbProps {
  url?: string;
  type: ListingType;
  alt?: string;
  className?: string;
}

// Show the uploaded or legacy image URL when available, otherwise a property illustration.
export function PropertyThumb({ url, type, alt = '', className = '' }: PropertyThumbProps) {
  const [failed, setFailed] = useState(false);

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`object-cover ${className}`}
      />
    );
  }
  return (
    <div className={`flex items-center justify-center bg-linear-to-br ${gradients[type]} ${className}`}>
      <span className="text-slate-900/40" aria-hidden="true">
        <House size={40} strokeWidth={1.5} />
      </span>
    </div>
  );
}
