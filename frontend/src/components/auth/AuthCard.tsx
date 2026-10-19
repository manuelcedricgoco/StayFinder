import type { ReactNode } from 'react';

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

// Shared centered card used by the Login, Register and Forgot Password pages.
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="mx-auto flex max-w-md items-center px-4 py-12 sm:py-16">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && (
          <div className="mt-6 border-t border-slate-200 pt-4 text-center text-sm text-slate-600">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
