import { useState, type FormEvent, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff, UserCircle, Home } from 'lucide-react';
import { AuthCard } from '../components/auth/AuthCard';
import { FormField } from '../components/auth/FormField';
import { OAuthButtons } from '../components/auth/OAuthButtons';
import { useApiResource } from '../hooks/useApiResource';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import type { PublicPlatformSettings } from '../lib/platformSettings';
import { ROLE_HOME } from '../lib/roles';
import type { RegisterInput } from '../types/auth';

const ACCOUNT_TYPES: { value: RegisterInput['role']; title: string; description: string; icon: ReactElement }[] = [
  { value: 'BOARDER', title: 'I need a place', description: 'Property seeker', icon: <UserCircle size={20} /> },
  { value: 'OWNER', title: 'I own a property', description: 'Property owner', icon: <Home size={20} /> },
];

export function RegisterPage() {
  const { register } = useAuth();
  const { state: settingsState } = useApiResource<{ status: 'ok'; settings: PublicPlatformSettings }>('/settings');
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<RegisterInput['role']>('BOARDER');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const registrationsOpen = settingsState.status === 'success' && settingsState.data.settings.allowRegistrations;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);

    try {
      const user = await register({ name, email, password, role });
      navigate(ROLE_HOME[user.role], { replace: true });
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

  return (
    <div className="flex min-h-[calc(100vh-64px)] w-full">
      <div className="relative hidden w-0 flex-1 lg:block">
        <img
          src="https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=2000&auto=format&fit=crop"
          alt="Occidental Mindoro landscape"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-emerald-900/40" />
      </div>

      <div className="flex w-full flex-1 items-center justify-center bg-slate-50 px-4 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <AuthCard
            title="Create your account"
            subtitle="Join StayFinder to find or list places in Occidental Mindoro."
            footer={
              <>
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-emerald-700 hover:underline">
                  Log in
                </Link>
              </>
            }
          >
            {settingsState.status === 'error' && (
              <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                Registration settings could not be loaded. Please try again later.
              </p>
            )}
            {!registrationsOpen ? (
              <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
                New account registration is currently disabled. Please try again later.
              </p>
            ) : (
              <>
                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  {formError && (
                    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                      {formError}
                    </p>
                  )}

                  <fieldset>
                    <legend className="text-sm font-medium text-slate-700">I am registering as</legend>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      {ACCOUNT_TYPES.map((type) => (
                        <label
                          key={type.value}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-all ${
                            role === type.value
                              ? 'border-emerald-600 bg-emerald-50 shadow-sm ring-1 ring-emerald-600'
                              : 'border-slate-300 hover:border-emerald-200 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="role"
                            value={type.value}
                            checked={role === type.value}
                            onChange={() => setRole(type.value)}
                            className="sr-only"
                          />
                          <div className={role === type.value ? 'text-emerald-700' : 'text-slate-400'}>{type.icon}</div>
                          <div>
                            <span className="block font-semibold text-slate-900">{type.title}</span>
                            <span className="block text-[10px] text-slate-500">{type.description}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <FormField
                    id="register-name"
                    label="Full name"
                    name="name"
                    autoComplete="name"
                    icon={<User size={18} />}
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    error={fieldErrors.name}
                  />
                  <FormField
                    id="register-email"
                    label="Email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    icon={<Mail size={18} />}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={fieldErrors.email}
                  />
                  <FormField
                    id="register-password"
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="new-password"
                    icon={<Lock size={18} />}
                    suffix={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    }
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    error={fieldErrors.password}
                    hint="At least 8 characters, with a letter and a number."
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white shadow-md transition hover:bg-emerald-800 hover:shadow-lg disabled:opacity-60"
                  >
                    {submitting ? 'Creating account...' : 'Create account'}
                  </button>
                </form>
                <OAuthButtons role={role} />
              </>
            )}
          </AuthCard>
        </div>
      </div>
    </div>
  );
}
