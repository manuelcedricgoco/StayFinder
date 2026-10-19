import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BUDGET_OPTIONS, LOCATIONS, PROPERTY_TYPES } from '../../data/landingContent';

const labelClass = 'block text-sm font-medium text-slate-700';
const fieldClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30';

export function SearchBar() {
  const navigate = useNavigate();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    const location = String(formData.get('location') ?? '');
    const type = String(formData.get('type') ?? '');
    const budget = String(formData.get('budget') ?? '');

    if (location) params.set('municipality', location);
    if (type) {
      const propertyType = {
        'Boarding House': 'BOARDING_HOUSE',
        Apartment: 'APARTMENT',
        Room: 'ROOM',
        Bedspace: 'BEDSPACE',
      }[type];
      if (propertyType) params.set('propertyType', propertyType);
    }
    const budgetRange: Record<string, [string, string]> = {
      'under-1500': ['', '1499'],
      '1500-3000': ['1500', '3000'],
      '3000-5000': ['3001', '5000'],
      '5000-8000': ['5001', '8000'],
      'over-8000': ['8001', ''],
    };
    const range = budgetRange[budget];
    if (range?.[0]) params.set('minPrice', range[0]);
    if (range?.[1]) params.set('maxPrice', range[1]);

    navigate(`/properties${params.size ? `?${params.toString()}` : ''}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Search for a place"
      className="grid gap-4 rounded-2xl bg-white p-4 text-left shadow-xl sm:grid-cols-2 sm:p-5 lg:grid-cols-[1fr_1fr_1fr_auto]"
    >
      <div>
        <label htmlFor="search-location" className={labelClass}>
          Location
        </label>
        <select id="search-location" name="location" className={fieldClass} defaultValue="">
          <option value="">All locations</option>
          {LOCATIONS.map((location) => (
            <option key={location.name} value={location.name}>
              {location.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="search-type" className={labelClass}>
          Property type
        </label>
        <select id="search-type" name="type" className={fieldClass} defaultValue="">
          <option value="">Any type</option>
          {PROPERTY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="search-budget" className={labelClass}>
          Monthly budget
        </label>
        <select id="search-budget" name="budget" className={fieldClass} defaultValue="">
          <option value="">Any budget</option>
          {BUDGET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="rounded-lg bg-emerald-700 px-6 py-2.5 font-semibold text-white hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 sm:col-span-2 lg:col-span-1 lg:self-end"
      >
        Search
      </button>
    </form>
  );
}
