import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 text-center">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Page not found</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-300">The page you are looking for does not exist.</p>
      <Link to="/" className="mt-6 inline-block text-emerald-700 dark:text-emerald-400 underline">
        Back to Home
      </Link>
    </section>
  );
}
