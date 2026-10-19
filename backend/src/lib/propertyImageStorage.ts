import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from './HttpError';

export const PROPERTY_IMAGE_DIRECTORY = path.resolve(__dirname, '../../uploads/properties');
export const MAX_PROPERTY_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_PROPERTY_IMAGES = 10;
const PROPERTY_IMAGE_PUBLIC_PATH = '/api/uploads/properties/';

const IMAGE_SIGNATURES = [
  {
    mimeType: 'image/jpeg',
    extension: '.jpg',
    matches: (buffer: Buffer) => buffer.length >= 3 &&
      buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  {
    mimeType: 'image/png',
    extension: '.png',
    matches: (buffer: Buffer) => buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mimeType: 'image/webp',
    extension: '.webp',
    matches: (buffer: Buffer) => buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
  },
] as const;

export async function savePropertyImage(buffer: Buffer, mimeType: string): Promise<string> {
  if (buffer.length === 0 || buffer.length > MAX_PROPERTY_IMAGE_SIZE) {
    throw new HttpError(413, 'Each property image must be 5 MB or smaller.');
  }
  const signature = IMAGE_SIGNATURES.find((candidate) =>
    candidate.mimeType === mimeType && candidate.matches(buffer));
  if (!signature) throw new HttpError(400, 'Upload a valid JPG, PNG, or WebP image.');

  await mkdir(PROPERTY_IMAGE_DIRECTORY, { recursive: true });
  const filename = `${randomUUID()}${signature.extension}`;
  await writeFile(path.join(PROPERTY_IMAGE_DIRECTORY, filename), buffer, { flag: 'wx' });
  return `${PROPERTY_IMAGE_PUBLIC_PATH}${filename}`;
}

export async function removeStoredPropertyImage(imageUrl: string): Promise<void> {
  if (!imageUrl.startsWith(PROPERTY_IMAGE_PUBLIC_PATH)) return;
  const filename = imageUrl.slice(PROPERTY_IMAGE_PUBLIC_PATH.length);
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(filename)) return;
  await unlink(path.join(PROPERTY_IMAGE_DIRECTORY, filename)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
}
