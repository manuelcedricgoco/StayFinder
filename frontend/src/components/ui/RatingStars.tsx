import { Star } from 'lucide-react';

export function RatingStars({ rating }: { rating: number }) {
  const visibleRating = Math.max(0, Math.min(5, Math.floor(rating)));

  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${visibleRating} out of 5 stars`}
    >
      {Array.from({ length: visibleRating }, (_, index) => (
        <Star key={index} size={14} fill="currentColor" aria-hidden="true" />
      ))}
    </span>
  );
}
