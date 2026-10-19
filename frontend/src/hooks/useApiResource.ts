import { useEffect, useState } from 'react';
import { ApiError, apiRequest } from '../lib/api';

export type ResourceState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string; httpStatus: number };

// Loads data from the API (with the login cookie). Call reload() to fetch again.
export function useApiResource<T>(path: string) {
  const [state, setState] = useState<ResourceState<T>>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    apiRequest<T>('GET', path)
      .then((data) => {
        if (!cancelled) setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const isApiError = error instanceof ApiError;
        setState({
          status: 'error',
          message: isApiError ? error.message : 'Something went wrong. Please try again.',
          httpStatus: isApiError ? error.status : 0,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [path, reloadKey]);

  return { state, reload: () => setReloadKey((key) => key + 1) };
}
