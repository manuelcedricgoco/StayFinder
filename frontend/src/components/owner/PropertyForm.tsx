import { useEffect, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { useApiResource } from '../../hooks/useApiResource';
import { ApiError } from '../../lib/api';
import { AVAILABILITY_LABEL, TYPE_LABEL } from '../../lib/listings';
import type {
  AmenityOption,
  Listing,
  ListingAvailability,
  ListingPayload,
  ListingType,
  LocationOption,
} from '../../types/listing';

interface PropertyFormProps {
  initial?: Listing;
  submitLabel: string;
  onSubmit: (payload: ListingPayload, images: {
    files: File[];
    removedImageIds: string[];
    cover: { type: 'existing'; id: string } | { type: 'new'; index: number } | null;
  }) => Promise<void>;
}

interface ImageItem {
  key: string;
  url: string;
  existingId?: string;
  file?: File;
}

const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const controlClass = (error?: string) =>
  `mt-1 w-full rounded-lg border bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${
    error
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/30'
      : 'border-slate-300 dark:border-slate-600 focus:border-emerald-600 focus:ring-emerald-600/30'
  }`;

const a11y = (id: string, error?: string) => ({
  'aria-invalid': error ? (true as const) : undefined,
  'aria-describedby': error ? `${id}-error` : undefined,
});

function Field(props: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  const { id, label, error, hint, children } = props;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      )}
    </div>
  );
}

export function PropertyForm({ initial, submitLabel, onSubmit }: PropertyFormProps) {
  const locations = useApiResource<{ locations: LocationOption[] }>('/locations');
  const amenityList = useApiResource<{ amenities: AmenityOption[] }>('/amenities');

  const [name, setName] = useState(initial?.name ?? '');
  const [propertyType, setPropertyType] = useState<ListingType>(initial?.propertyType ?? 'BOARDING_HOUSE');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [monthlyPrice, setMonthlyPrice] = useState(initial ? String(initial.monthlyPrice) : '');
  const [municipality, setMunicipality] = useState(initial?.municipality ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [availableRooms, setAvailableRooms] = useState(initial ? String(initial.availableRooms) : '1');
  const [availability, setAvailability] = useState<ListingAvailability>(initial?.availability ?? 'AVAILABLE');
  const [amenities, setAmenities] = useState<string[]>(initial?.amenities.map((a) => a.slug) ?? []);
  const [images, setImages] = useState<ImageItem[]>(() =>
    initial?.images.map((image) => ({
      key: image.id,
      url: image.url,
      existingId: image.id,
    })) ?? [],
  );
  const [imageError, setImageError] = useState<string | null>(null);
  const [coverKey, setCoverKey] = useState<string | null>(() =>
    initial?.images.find((image) => image.isPrimary)?.id ?? initial?.images[0]?.id ?? null,
  );
  const objectUrls = useRef(new Set<string>());
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current.clear();
  }, []);

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const err = (field: string) =>
    fieldErrors[field] ?? Object.entries(fieldErrors).find(([key]) => key.startsWith(`${field}.`))?.[1];

  const toNumber = (text: string) => (text.trim() === '' ? undefined : Number(text));

  function toggleAmenity(slug: string) {
    setAmenities((current) =>
      current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug],
    );
  }

  function addImages(fileList: FileList | null) {
    if (!fileList) return;
    setImageError(null);
    const selected = Array.from(fileList);
    const roomLeft = MAX_IMAGES - images.length;
    if (selected.length > roomLeft) {
      setImageError(`You can upload up to ${MAX_IMAGES} images per property. Remove an image before adding more.`);
      return;
    }

    const accepted: ImageItem[] = [];
    for (const file of selected) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        setImageError('Invalid file type. Please upload JPG, PNG, or WebP images.');
        break;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setImageError('File too large. Each image must be 5 MB or smaller.');
        break;
      }
      const url = URL.createObjectURL(file);
      objectUrls.current.add(url);
      accepted.push({ key: crypto.randomUUID(), url, file });
    }
    if (accepted.length) setImages((current) => [...current, ...accepted]);
  }

  function removeImage(image: ImageItem) {
    if (image.file) {
      URL.revokeObjectURL(image.url);
      objectUrls.current.delete(image.url);
    }
    setImages((current) => {
      const next = current.filter((item) => item.key !== image.key);
      if (coverKey === image.key) setCoverKey(next[0]?.key ?? null);
      return next;
    });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!submitting) addImages(event.dataTransfer.files);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);

    try {
      const files = images.flatMap((image) => image.file ? [image.file] : []);
      const coverImage = images.find((image) => image.key === coverKey);
      await onSubmit({
        name,
        propertyType,
        description,
        monthlyPrice: toNumber(monthlyPrice),
        municipality,
        address,
        availableRooms: toNumber(availableRooms),
        availability,
        amenities,
      }, {
        files,
        removedImageIds: (initial?.images ?? [])
          .filter((image) => !images.some((item) => item.existingId === image.id))
          .map((image) => image.id),
        cover: coverImage?.existingId
          ? { type: 'existing', id: coverImage.existingId }
          : coverImage?.file
            ? { type: 'new', index: files.indexOf(coverImage.file) }
            : null,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
        setFieldErrors(error.fieldErrors);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (locations.state.status === 'loading' || amenityList.state.status === 'loading') {
    return <p role="status" className="py-10 text-center text-slate-500 dark:text-slate-400">Loading form...</p>;
  }
  if (locations.state.status === 'error' || amenityList.state.status === 'error') {
    return (
      <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400">
        Could not load the form options. Please check that the backend is running.
      </p>
    );
  }

  const locationOptions = locations.state.data.locations;
  const amenityOptions = amenityList.state.data.amenities;

  if (locationOptions.length === 0) {
    return (
      <p role="alert" className="rounded-lg bg-amber-50 dark:bg-amber-950 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
        No municipalities found in the database. Run <code>npm run db:seed</code> in the backend folder, then
        refresh this page.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && (
        <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {formError}
        </p>
      )}

      <Field id="pf-name" label="Property name" error={err('name')}>
        <input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100}
          className={controlClass(err('name'))} {...a11y('pf-name', err('name'))} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="pf-type" label="Property type" error={err('propertyType')}>
          <select id="pf-type" value={propertyType} onChange={(e) => setPropertyType(e.target.value as ListingType)}
            className={controlClass(err('propertyType'))} {...a11y('pf-type', err('propertyType'))}>
            {(Object.keys(TYPE_LABEL) as ListingType[]).map((type) => (
              <option key={type} value={type}>{TYPE_LABEL[type]}</option>
            ))}
          </select>
        </Field>
        <Field id="pf-price" label="Monthly price (₱)" error={err('monthlyPrice')}>
          <input id="pf-price" type="number" inputMode="numeric" min={0} step={1} value={monthlyPrice}
            onChange={(e) => setMonthlyPrice(e.target.value)}
            className={controlClass(err('monthlyPrice'))} {...a11y('pf-price', err('monthlyPrice'))} />
        </Field>
      </div>

      <Field id="pf-description" label="Description" error={err('description')}
        hint="Describe the place, what is nearby, and any house rules (at least 20 characters).">
        <textarea id="pf-description" rows={5} value={description} onChange={(e) => setDescription(e.target.value)}
          maxLength={2000} className={controlClass(err('description'))} {...a11y('pf-description', err('description'))} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="pf-municipality" label="Municipality" error={err('municipality')}>
          <select id="pf-municipality" value={municipality} onChange={(e) => setMunicipality(e.target.value)}
            className={controlClass(err('municipality'))} {...a11y('pf-municipality', err('municipality'))}>
            <option value="">Select a municipality</option>
            {locationOptions.map((location) => (
              <option key={location.id} value={location.name}>{location.name}</option>
            ))}
          </select>
        </Field>
        <Field id="pf-address" label="Address" error={err('address')}>
          <input id="pf-address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200}
            className={controlClass(err('address'))} {...a11y('pf-address', err('address'))} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="pf-rooms" label="Available rooms" error={err('availableRooms')}>
          <input id="pf-rooms" type="number" inputMode="numeric" min={0} step={1} value={availableRooms}
            onChange={(e) => setAvailableRooms(e.target.value)}
            className={controlClass(err('availableRooms'))} {...a11y('pf-rooms', err('availableRooms'))} />
        </Field>
        <Field id="pf-availability" label="Availability" error={err('availability')}>
          <select id="pf-availability" value={availability}
            onChange={(e) => setAvailability(e.target.value as ListingAvailability)}
            className={controlClass(err('availability'))} {...a11y('pf-availability', err('availability'))}>
            {(Object.keys(AVAILABILITY_LABEL) as ListingAvailability[]).map((value) => (
              <option key={value} value={value}>{AVAILABILITY_LABEL[value]}</option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">Amenities</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {amenityOptions.map((amenity) => (
            <label key={amenity.slug} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
              <input type="checkbox" checked={amenities.includes(amenity.slug)} onChange={() => toggleAmenity(amenity.slug)}
                className="h-4 w-4 accent-emerald-700" />
              {amenity.name}
            </label>
          ))}
        </div>
        {err('amenities') && <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">{err('amenities')}</p>}
      </fieldset>

      <section aria-labelledby="pf-images-title">
        <h2 id="pf-images-title" className="text-sm font-medium text-slate-700 dark:text-slate-200">Property Images</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Upload photos of your boarding house or apartment. JPG, PNG, or WebP; up to 5 MB each.</p>
        <div onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}
          className="mt-3 rounded-xl border-2 border-dashed border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/50 p-5 text-center sm:p-8">
          <p aria-hidden="true" className="text-3xl">📷</p>
          <p className="mt-2 font-semibold text-slate-800 dark:text-slate-100">Upload Property Images</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Drag &amp; drop images here or click to browse</p>
          <button type="button" disabled={submitting || images.length >= MAX_IMAGES} onClick={() => fileInput.current?.click()}
            className="mt-4 rounded-lg border border-emerald-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 disabled:opacity-50">
            Choose images
          </button>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only"
            onChange={(event) => {
              addImages(event.currentTarget.files);
              event.currentTarget.value = '';
            }} />
        </div>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>{images.length} / {MAX_IMAGES} images selected</span>
          <span>Choose one image as the cover photo.</span>
        </div>
        {imageError && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{imageError}</p>}
        {images.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((image) => (
              <div key={image.key} className="relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                <img src={image.url} alt={image.file?.name ?? 'Property photo'} className="h-full w-full object-cover" />
                {coverKey === image.key && <span className="absolute left-2 top-2 rounded-full bg-emerald-700 px-2 py-1 text-xs font-semibold text-white">Cover</span>}
                <button type="button" aria-label={`Remove ${image.file?.name ?? 'property image'}`} disabled={submitting}
                  onClick={() => removeImage(image)} className="absolute right-2 top-2 rounded-full bg-white/95 dark:bg-slate-900/95 px-2.5 py-1 text-sm font-bold text-slate-700 dark:text-slate-200 shadow hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-700 dark:hover:text-red-400">×</button>
                {coverKey !== image.key && <button type="button" disabled={submitting} onClick={() => setCoverKey(image.key)}
                  className="absolute bottom-2 left-2 rounded-md bg-white/95 dark:bg-slate-900/95 px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow hover:text-emerald-800 dark:hover:text-emerald-300">Set as cover</button>}
              </div>
            ))}
          </div>
        )}
      </section>

      <button type="submit" disabled={submitting}
        className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 sm:w-auto sm:px-8">
        {submitting ? 'Saving property and uploading images...' : submitLabel}
      </button>
    </form>
  );
}
