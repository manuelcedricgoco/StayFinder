import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

type RoleOption = '' | 'OWNER' | 'BOARDER' | 'ADMIN';

const ROLE_LABELS: Record<RoleOption, string> = {
  '': 'All roles',
  'OWNER': 'Owners',
  'BOARDER': 'Boarders',
  'ADMIN': 'Admins',
};

interface RoleFilterProps {
  selectedRole: RoleOption;
  onSelect: (role: RoleOption) => void;
}

export function RoleFilter({ selectedRole, onSelect }: RoleFilterProps) {
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

  const roles: RoleOption[] = ['', 'OWNER', 'BOARDER', 'ADMIN'];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm hover:border-slate-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-100"
      >
        <span className="text-sm font-medium whitespace-nowrap text-slate-700 dark:text-slate-200">
          {ROLE_LABELS[selectedRole]}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-2 min-w-[160px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl animate-in fade-in zoom-in duration-150 right-0">
          <div className="py-1">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => {
                  onSelect(role);
                  setIsOpen(false);
                }}
                className={`block w-full text-left px-4 py-2 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
                  selectedRole === role ? 'font-semibold bg-slate-50 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                {ROLE_LABELS[role]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
