import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarPopoverProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

export function CalendarPopover({ value, onChange, label, className = '' }: CalendarPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const initialDate = value ? new Date(value) : new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const selectDate = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const formatted = date.toISOString().split('T')[0];
    onChange(formatted);
    setIsOpen(false);
  };

  const monthName = currentMonth.toLocaleString('default', { month: 'long' });
  const year = currentMonth.getFullYear();

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">{label}</label>}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm hover:border-slate-400 transition-colors focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none"
      >
        <Calendar className="w-4 h-4 text-slate-400" />
        <span className="text-sm text-slate-700 dark:text-slate-200">{value || 'Select date'}</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl animate-in fade-in zoom-in duration-150 p-4">
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ChevronLeft className="w-5 h-5" /></button>
            <span className="font-semibold text-sm">{monthName} {year}</span>
            <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ChevronRight className="w-5 h-5" /></button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2 text-slate-400">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const month = (currentMonth.getMonth() + 1).toString().padStart(2, '0');
              const dayStr = day.toString().padStart(2, '0');
              const dateStr = `${currentMonth.getFullYear()}-${month}-${dayStr}`;
              const isSelected = value === dateStr;
              
              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => selectDate(day)}
                  className={`h-8 w-8 flex items-center justify-center text-sm rounded-full transition-colors ${
                    isSelected ? 'bg-emerald-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
