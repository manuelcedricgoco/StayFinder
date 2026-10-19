import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option<T> {
  label: string;
  value: T;
}

interface FilterDropdownProps<T> {
  options: Option<T>[];
  selected: T;
  onSelect: (value: T) => void;
  className?: string;
  fullWidth?: boolean;
}

export function FilterDropdown<T>({ options, selected, onSelect, className = '', fullWidth = false }: FilterDropdownProps<T>) {
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

  const selectedOption = options.find((opt) => opt.value === selected);

  return (
    <div className={`relative ${fullWidth ? 'w-full' : 'inline-block'} text-left ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm hover:border-slate-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-100 ${fullWidth ? 'w-full' : ''}`}
      >
        <span className="text-sm font-medium whitespace-nowrap text-slate-700 dark:text-slate-200">
          {selectedOption?.label}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl animate-in fade-in zoom-in duration-150 left-0">
          <div className="py-1">
            {options.map((option) => (
              <button
                key={String(option.value)}
                onClick={() => {
                  onSelect(option.value);
                  setIsOpen(false);
                }}
                className={`block w-full text-left px-4 py-2 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
                  selected === option.value ? 'font-semibold bg-slate-50 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
