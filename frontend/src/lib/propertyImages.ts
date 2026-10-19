import { apiUploadRequest } from './api';
import type { Listing, ListingImage } from '../types/listing';

interface ImageChanges {
  files: File[];
  removedImageIds: string[];
  cover: { type: 'existing'; id: string } | { type: 'new'; index: number } | null;
}

export async function persistPropertyImages(
  property: Listing,
  initial: Listing | undefined,
  changes: ImageChanges,
): Promise<void> {
  const basePath = `/owner/properties/${encodeURIComponent(property.id)}`;
  const originalIds = new Set(initial?.images.map((image) => image.id) ?? []);
  let uploaded: ListingImage[] = [];

  if (changes.files.length > 0) {
    const formData = new FormData();
    changes.files.forEach((file) => formData.append('images', file));
    const result = await apiUploadRequest<{ property: Listing }>('POST', `${basePath}/images`, formData);
    uploaded = result.property.images.filter((image) => !originalIds.has(image.id));
  }

  for (const imageId of changes.removedImageIds) {
    await apiUploadRequest('DELETE', `${basePath}/images/${encodeURIComponent(imageId)}`);
  }

  const coverId = changes.cover?.type === 'existing'
    ? changes.cover.id
    : changes.cover?.type === 'new'
      ? uploaded[changes.cover.index]?.id
      : undefined;
  if (coverId) {
    await apiUploadRequest('PATCH', `${basePath}/images/${encodeURIComponent(coverId)}/cover`);
  }
}
