import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthCard } from '../components/auth/AuthCard';
import { FormField } from '../components/auth/FormField';

// UI placeholder only: password reset is not implemented, and nothing is sent to the server.
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Enter your email and we will help you reset it."
      footer={
        <Link to="/login" className="font-medium text-emerald-700 hover:underline">
          Back to log in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {submitted && (
          <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Password reset is not available yet. This feature will be added in a later update.
          </p>
        )}
        <FormField
          id="forgot-email"
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="submit"
          className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white hover:bg-emerald-800"
        >
          Send reset link
        </button>
      </form>
    </AuthCard>
  );
}
