import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api';

export type HealthState<T> =
  | { state: 'loading' }
  | { state: 'success'; data: T }
  | { state: 'error'; message: string };

export function useHealthCheck<T>(path: string): HealthState<T> {
  const [result, setResult] = useState<HealthState<T>>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;

    apiGet<T>(path)
      .then((data) => {
        if (!cancelled) setResult({ state: 'success', data });
      })
      .catch(() => {
        if (!cancelled) {
          setResult({
            state: 'error',
            message: 'Could not reach the backend. Is it running on port 4000?',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return result;
}
