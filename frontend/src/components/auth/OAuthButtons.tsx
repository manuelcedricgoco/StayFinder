import { useApiResource } from '../../hooks/useApiResource';
import type { RegisterInput } from '../../types/auth';

interface OAuthProvidersResponse {
  status: 'ok';
  providers: {
    google: { configured: boolean; enabled: boolean };
    facebook: { configured: boolean; enabled: boolean };
  };
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export function OAuthButtons({ role }: { role?: RegisterInput['role'] }) {
  const { state } = useApiResource<OAuthProvidersResponse>('/auth/oauth/providers');

  function beginSignIn(provider: 'google' | 'facebook') {
    const query = role ? `?role=${encodeURIComponent(role)}` : '';
    window.location.assign(`${API_BASE_URL}/auth/oauth/${provider}${query}`);
  }

  const availableProviders = state.status === 'success'
    ? (['google', 'facebook'] as const).filter((provider) => state.data.providers[provider].enabled)
    : [];

  return (
    <div className="mt-6">
      <div className="relative text-center">
        <span className="relative z-10 bg-white px-3 text-xs uppercase tracking-wide text-slate-500">
          or continue with
        </span>
        <span className="absolute left-0 top-1/2 h-px w-full bg-slate-200" aria-hidden="true" />
      </div>
      {state.status === 'loading' && <p role="status" className="mt-4 text-center text-xs text-slate-500">Checking sign-in providers…</p>}
      {state.status === 'error' && <p role="alert" className="mt-4 text-center text-xs text-red-700">Social sign-in providers could not be checked.</p>}
      {state.status === 'success' && availableProviders.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {availableProviders.map((provider) => (
            <button
              key={provider}
              type="button"
              onClick={() => beginSignIn(provider)}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium capitalize text-slate-700 hover:bg-slate-50"
            >
              {provider}
            </button>
          ))}
        </div>
      )}
      {state.status === 'success' && availableProviders.length === 0 && (
        <p className="mt-4 text-center text-xs text-slate-500">Social sign-in is not configured.</p>
      )}
    </div>
  );
}
