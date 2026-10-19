import type { InputHTMLAttributes, ReactNode } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  suffix?: ReactNode;
}

export function FormField({ id, label, error, hint, icon, suffix, className = '', ...inputProps }: FormFieldProps) {
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative mt-1">
        {icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            {icon}
          </div>
        )}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          className={`w-full rounded-lg border bg-white px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 ${
            icon ? 'pl-10' : ''
          } ${suffix ? 'pr-10' : ''} ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/30'
              : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-600/30'
          } ${className}`}
          {...inputProps}
        />
        {suffix && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {suffix}
          </div>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
