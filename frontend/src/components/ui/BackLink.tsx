import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BackLinkProps {
  to: string;
  children: ReactNode;
  className?: string;
}

export function BackLink({
  to,
  children,
  className = 'text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline',
}: BackLinkProps) {
  return (
    <Link to={to} className={`${className} inline-flex items-center gap-1`}>
      <ArrowLeft size={16} aria-hidden="true" />
      {children}
    </Link>
  );
}
