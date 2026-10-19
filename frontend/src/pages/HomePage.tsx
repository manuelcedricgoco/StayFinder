import { Link } from 'react-router-dom';
import { FeatureCard } from '../components/home/FeatureCard';
import { Hero } from '../components/home/Hero';
import { HowItWorks } from '../components/home/HowItWorks';
import { LocationCard } from '../components/home/LocationCard';
import { PropertyCard } from '../components/home/PropertyCard';
import { FEATURED_PROPERTIES, FEATURES, LOCATIONS } from '../data/landingContent';

export function HomePage() {
  return (
    <>
      <Hero />

      <section id="locations" className="scroll-mt-16 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-bold text-slate-900">Popular Locations</h2>
          <p className="mt-3 max-w-xl text-slate-600">
            Explore places to stay across the municipalities of Occidental Mindoro.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {LOCATIONS.map((location) => (
              <LocationCard key={location.name} {...location} />
            ))}
          </div>
        </div>
      </section>

      <section id="featured" className="scroll-mt-16 bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-bold text-slate-900">Featured Properties</h2>
          <p className="mt-3 max-w-xl text-slate-600">
            A preview of the kinds of places you will find on StayFinder. Sample listings shown.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURED_PROPERTIES.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="scroll-mt-16 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-slate-900">Why Choose StayFinder?</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">
            Built for Occidental Mindoro, so every search starts with what matters locally.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      <HowItWorks />

      <section className="px-4 py-16">
        <div className="mx-auto max-w-6xl rounded-3xl bg-linear-to-br from-emerald-800 to-teal-700 px-6 py-14 text-center text-white">
          <h2 className="text-3xl font-bold sm:text-4xl">Ready to find your next home?</h2>
          <p className="mx-auto mt-4 max-w-xl text-emerald-50/90">
            Start your search today and find a place that fits your budget and your lifestyle.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#home"
              className="w-full rounded-lg bg-white px-6 py-3 font-semibold text-emerald-800 hover:bg-emerald-50 sm:w-auto"
            >
              Start Searching
            </a>
            <Link
              to="/register"
              className="w-full rounded-lg border border-white/60 px-6 py-3 text-center font-semibold text-white hover:bg-white/10 sm:w-auto"
            >
              Create an Account
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
