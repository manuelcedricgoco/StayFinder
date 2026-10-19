import { ArrowRight } from 'lucide-react';

const STEPS = [
  { title: 'Search', description: 'Pick a municipality, property type, and your monthly budget.' },
  { title: 'Compare', description: 'Browse listings and compare prices, amenities, and house rules.' },
  { title: 'View', description: 'Check the location and details of each place before you decide.' },
  { title: 'Contact', description: 'Reach out to the owner to ask questions and arrange a visit.' },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-16 bg-slate-50 py-16">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-center text-3xl font-bold text-slate-900">How It Works</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">
          Finding a place should be simple. Four easy steps get you there.
        </p>

        <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative flex flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-xl font-bold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{step.description}</p>
              {index < STEPS.length - 1 && (
                <span
                  className="absolute -right-7 top-3 hidden text-emerald-400 lg:block"
                  aria-hidden="true"
                >
                  <ArrowRight size={24} />
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
