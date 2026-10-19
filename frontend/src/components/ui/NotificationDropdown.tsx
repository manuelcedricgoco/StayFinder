import { Bell } from 'lucide-react';
import { useState } from 'react';

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</h4>
          <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">No new notifications.</p>
        </div>
      )}
    </div>
  );
}
