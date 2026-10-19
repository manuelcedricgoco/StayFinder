import { STATUS_LABEL, STATUS_STYLE } from '../../lib/listings';
import type { ListingStatus } from '../../types/listing';

export function StatusBadge({ status }: { status: ListingStatus }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
