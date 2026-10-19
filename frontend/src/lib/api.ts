const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

// Small fetch helper. It returns the parsed JSON body even for non-2xx responses
// (the health endpoints send useful details with a 503). It throws only when the
// server cannot be reached or does not return JSON.
export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  return (await response.json()) as T;
}

// ---- Authenticated requests (Phase 3) ----

export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

interface ErrorBody {
  message?: string;
  errors?: { field: string; message: string }[];
}

// Sends cookies with the request and THROWS an ApiError for any non-2xx response.
export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Please check that the backend is running.');
  }

  const data = (await response.json().catch(() => null)) as (T & ErrorBody) | null;

  if (!response.ok) {
    const fieldErrors: Record<string, string> = {};
    for (const error of data?.errors ?? []) {
      if (!(error.field in fieldErrors)) fieldErrors[error.field] = error.message;
    }
    throw new ApiError(
      response.status,
      data?.message ?? 'Something went wrong. Please try again.',
      fieldErrors,
    );
  }
  return data as T;
}

export async function apiDownload(path: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include' });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Please check that the backend is running.');
  }

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as ErrorBody | null;
    throw new ApiError(response.status, data?.message ?? 'Could not download this file.');
  }
  return response.blob();
}

export async function apiUpload<T>(path: string, body: FormData): Promise<T> {
  return apiUploadRequest<T>('POST', path, body);
}

export async function apiUploadRequest<T>(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: FormData,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      body,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Please check that the backend is running.');
  }

  const data = (await response.json().catch(() => null)) as (T & ErrorBody) | null;
  if (!response.ok) {
    throw new ApiError(response.status, data?.message ?? 'Could not update property images.');
  }
  return data as T;
}
