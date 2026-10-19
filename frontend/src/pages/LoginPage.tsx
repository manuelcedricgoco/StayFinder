import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { AuthCard } from '../components/auth/AuthCard';
import { FormField } from '../components/auth/FormField';
import { OAuthButtons } from '../components/auth/OAuthButtons';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { ROLE_HOME } from '../lib/roles';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);

    try {
      const user = await login(email, password);
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
            title="Welcome back"
            subtitle="Log in to your StayFinder account."
            footer={
              <>
                New to StayFinder?{' '}
                <Link to="/register" className="font-medium text-emerald-700 hover:underline">
                  Create an account
                </Link>
              </>
            }
          >
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {searchParams.get('oauthError') === 'failed' && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  Social sign-in could not be completed. Please try again or use your email and password.
                </p>
              )}
              {formError && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              )}
              <FormField
                id="login-email"
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
                id="login-password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
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
              />
              <div className="text-right">
                <Link to="/forgot-password" className="text-sm text-emerald-700 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white shadow-md transition hover:bg-emerald-800 hover:shadow-lg disabled:opacity-60"
              >
                {submitting ? 'Logging in...' : 'Log in'}
              </button>
            </form>
            <OAuthButtons />
          </AuthCard>
        </div>
      </div>
    </div>
  );
}
