import { useState } from 'react';
import { House, Menu, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useApiResource } from '../../hooks/useApiResource';
import { ROLE_HOME } from '../../lib/roles';
import type { PublicPlatformSettings } from '../../lib/platformSettings';

// "/#id" links work from any page: on the home page they scroll, elsewhere they go home first.
const NAV_LINKS = [
  { label: 'Home', href: '/#home' },
  { label: 'Find a Place', href: '/properties' },
  { label: 'About', href: '/#about' },
  { label: 'Contact', href: '/#contact' },
];

const linkClass = 'text-sm font-medium text-slate-600 hover:text-emerald-700';
const outlineClass =
  'rounded-lg border border-emerald-700 px-4 py-2 text-center text-sm font-semibold text-emerald-700 hover:bg-emerald-50';
const solidClass =
  'rounded-lg bg-emerald-700 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-emerald-800';

// Shows Login/Register for visitors, or My Area/Profile/Logout for logged-in users.
function AuthActions({
  onNavigate,
  stretch,
  allowRegistrations,
}: {
  onNavigate?: () => void;
  stretch?: boolean;
  allowRegistrations: boolean;
}) {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const grow = stretch ? ' flex-1' : '';

  if (isLoading) return null; // avoids flashing the wrong buttons on page load

  if (!user) {
    return (
      <>
        <Link to="/login" onClick={onNavigate} className={outlineClass + grow}>
          Login
        </Link>
        {allowRegistrations && (
          <Link to="/register" onClick={onNavigate} className={solidClass + grow}>
            Register
          </Link>
        )}
      </>
    );
  }

  async function handleLogout() {
    await logout();
    onNavigate?.();
    navigate('/');
  }

  return (
    <>
      <Link to={ROLE_HOME[user.role]} onClick={onNavigate} className={outlineClass + grow}>
        My Area
      </Link>
      <button type="button" onClick={handleLogout} className={solidClass + grow}>
        Logout
      </button>
    </>
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { state: settingsState } = useApiResource<{ status: 'ok'; settings: PublicPlatformSettings }>('/settings');
  const siteName = settingsState.status === 'success' ? settingsState.data.settings.siteName : 'StayFinder';
  const allowRegistrations = settingsState.status !== 'success' || settingsState.data.settings.allowRegistrations;
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" onClick={close} className="flex items-center gap-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-white"
            aria-hidden="true"
          >
            <House size={20} strokeWidth={2} />
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-bold text-slate-900">{siteName}</span>
            <span className="block text-[11px] font-medium uppercase tracking-wide text-emerald-700">
              Occidental Mindoro
            </span>
          </span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            link.href === '/properties' ? (
              <Link key={link.label} to={link.href} className={linkClass}>
                {link.label}
              </Link>
            ) : (
              <a key={link.label} href={link.href} className={linkClass}>
                {link.label}
              </a>
            )
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <AuthActions allowRegistrations={allowRegistrations} />
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="border-t border-slate-200 bg-white px-4 pb-4 md:hidden">
          <nav aria-label="Mobile" className="flex flex-col py-2">
            {NAV_LINKS.map((link) => (
              link.href === '/properties' ? (
                <Link
                  key={link.label}
                  to={link.href}
                  onClick={close}
                  className="rounded-md px-2 py-3 font-medium text-slate-700 hover:bg-slate-50"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={close}
                  className="rounded-md px-2 py-3 font-medium text-slate-700 hover:bg-slate-50"
                >
                  {link.label}
                </a>
              )
            ))}
          </nav>
          <div className="flex gap-2">
            <AuthActions onNavigate={close} stretch allowRegistrations={allowRegistrations} />
          </div>
        </div>
      )}
    </header>
  );
}
