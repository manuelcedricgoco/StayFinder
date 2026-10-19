interface AreaPlaceholderPageProps {
  title: string;
  description: string;
}

// Used for panel sections that are listed in the sidebar but not built yet.
export function AreaPlaceholderPage({ title, description }: AreaPlaceholderPageProps) {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-12">
      <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
      <p className="mt-3 max-w-xl text-slate-600">{description}</p>
      <p className="mt-6 inline-block rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Coming soon: this section has not been built yet.
      </p>
    </section>
  );
}
