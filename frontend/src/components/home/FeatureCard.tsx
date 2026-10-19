import type { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
  const Icon = icon;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"
        aria-hidden="true"
      >
        <Icon size={24} strokeWidth={1.8} />
      </span>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
    </div>
  );
}
