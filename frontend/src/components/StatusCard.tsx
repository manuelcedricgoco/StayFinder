export type StatusLevel = 'loading' | 'ok' | 'warning' | 'error';

interface StatusCardProps {
  title: string;
  level: StatusLevel;
  message: string;
}

const levelStyles: Record<StatusLevel, { badge: string; label: string }> = {
  loading: { badge: 'bg-slate-100 text-slate-700', label: 'Checking...' },
  ok: { badge: 'bg-emerald-100 text-emerald-800', label: 'OK' },
  warning: { badge: 'bg-amber-100 text-amber-800', label: 'Warning' },
  error: { badge: 'bg-red-100 text-red-800', label: 'Error' },
};

export function StatusCard({ title, level, message }: StatusCardProps) {
  const style = levelStyles[level];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${style.badge}`}>
          {style.label}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
    </div>
  );
}
