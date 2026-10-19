import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { STATUS_LABEL } from '../../lib/listings';
import type { ListingStatus } from '../../types/listing';

interface StatusFilterProps {
  selectedStatus: ListingStatus | 'ALL';
  onSelect: (status: ListingStatus | 'ALL') => void;
}

export function StatusFilter({ selectedStatus, onSelect }: StatusFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const statuses: (ListingStatus | 'ALL')[] = ['PENDING', 'APPROVED', 'REJECTED', 'INACTIVE', 'ALL'];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        <span className="text-sm font-medium whitespace-nowrap">
          {selectedStatus === 'ALL' ? 'All Statuses' : STATUS_LABEL[selectedStatus as ListingStatus]}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-2 min-w-[160px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl animate-in fade-in zoom-in duration-150 right-0">
          <div className="py-1">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => {
                  onSelect(status);
                  setIsOpen(false);
                }}
                className={`block w-full text-left px-4 py-2 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
                  selectedStatus === status ? 'font-semibold bg-slate-50 dark:bg-slate-800' : ''
                }`}
              >
                {status === 'ALL' ? 'All Statuses' : STATUS_LABEL[status as ListingStatus]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
