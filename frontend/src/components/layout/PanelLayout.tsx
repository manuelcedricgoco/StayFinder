import { ExternalLink, LogOut, Menu, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Sun, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useApiResource } from '../../hooks/useApiResource';
import { useTheme } from '../../hooks/useTheme';
import { NotificationDropdown } from '../ui/NotificationDropdown';
import { PANEL_CONFIG } from '../../lib/panelNav';
import { ROLE_HOME } from '../../lib/roles';
import type { PublicPlatformSettings } from '../../lib/platformSettings';

// The dashboard shell used by the Admin, Owner and Boarder areas: a sidebar plus a top bar.
// The sidebar menu comes from PANEL_CONFIG, chosen by the logged-in user's role; every panel
// shares the same neutral dark shell and only the accent color changes per role.
// The public website (home, search, login) keeps using the normal Layout instead.
export function PanelLayout() {
  const { user, logout } = useAuth();
  const { preference, cyclePreference } = useTheme();
  const navigate = useNavigate();
  const { state: settingsState } = useApiResource<{ status: 'ok'; settings: PublicPlatformSettings }>('/settings');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen]);

  if (!user) return null; // the route guard guarantees a user; this satisfies TypeScript

  const panel = PANEL_CONFIG[user.role];
  const siteName = settingsState.status === 'success' ? settingsState.data.settings.siteName : 'StayFinder';
  const userInitial = user.name.trim().charAt(0).toUpperCase() || 'U';
  const closeMobileMenu = () => setMobileOpen(false);
  const ThemeIcon = preference === 'light' ? Sun : preference === 'dark' ? Moon : Monitor;
  const themeLabel =
    preference === 'light' ? 'Light theme' : preference === 'dark' ? 'Dark theme' : 'Theme follows your system';

  async function handleLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-200 lg:flex">
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 cursor-default bg-slate-900/50 lg:hidden"
          onClick={closeMobileMenu}
          aria-label="Close menu"
        />
      )}

      <aside
        id="panel-sidebar"
        aria-label={`${panel.title} navigation`}
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col transition-[transform,width,visibility] duration-200 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0 ${panel.sidebar} ${
          mobileOpen ? 'visible translate-x-0' : 'invisible -translate-x-full'
        } ${
          desktopCollapsed ? 'lg:visible lg:w-16' : 'lg:visible lg:w-64'
        }`}
      >
        <div className={`flex h-16 shrink-0 items-center justify-between border-b px-4 ${panel.divider} ${
          desktopCollapsed ? 'lg:h-24 lg:flex-col lg:justify-center lg:gap-2 lg:px-1' : ''
        }`}>
          <Link
            to={ROLE_HOME[user.role]}
            onClick={closeMobileMenu}
            title={desktopCollapsed ? siteName : undefined}
            className={`flex items-center gap-3 ${desktopCollapsed ? 'lg:justify-center' : ''}`}
          >
            <img
              src="/favicon-logo.png"
              alt={siteName}
              className="h-8 w-8 object-contain"
            />
            <span className={`leading-tight ${desktopCollapsed ? 'lg:hidden' : ''}`}>
              <span className={`block text-base font-bold ${panel.brandText}`}>{siteName}</span>
              <span
                className={`mt-0.5 inline-block rounded px-1.5 text-[10px] font-semibold uppercase tracking-wide ${panel.badge}`}
              >
                {panel.title}
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={closeMobileMenu}
            aria-label="Close menu"
            className="rounded-lg p-1.5 hover:bg-white/10 lg:hidden"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setDesktopCollapsed((collapsed) => !collapsed)}
            aria-label={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden rounded-lg p-1.5 hover:bg-white/10 lg:block"
          >
            {desktopCollapsed
              ? <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
              : <PanelLeftClose className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {panel.items.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={closeMobileMenu}
              title={desktopCollapsed ? label : undefined}
              aria-label={label}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg border-l-4 px-3 py-3 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? `${panel.activeBorder} ${panel.activeLink}`
                    : `border-transparent ${panel.idleLink}`
                } ${desktopCollapsed ? 'lg:justify-center lg:px-0' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`h-5 w-5 shrink-0 ${isActive ? panel.activeIcon : ''}`}
                    aria-hidden="true"
                  />
                  <span className={desktopCollapsed ? 'lg:hidden' : ''}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className={`shrink-0 border-t p-4 ${panel.divider} ${desktopCollapsed ? 'lg:px-2' : ''}`}>
          <p className={`truncate text-sm font-semibold ${panel.brandText} ${desktopCollapsed ? 'lg:hidden' : ''}`}>{user.name}</p>
          <p className={`truncate text-xs ${panel.muted} ${desktopCollapsed ? 'lg:hidden' : ''}`}>{user.email}</p>
          <button
            type="button"
            onClick={handleLogout}
            title={desktopCollapsed ? 'Log out' : undefined}
            className={`mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${panel.idleLink} ${
              desktopCollapsed ? 'lg:mt-0 lg:justify-center lg:px-0' : ''
            }`}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className={desktopCollapsed ? 'lg:hidden' : ''}>Log out</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls="panel-sidebar"
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{panel.title}</p>
          <div className="ml-auto flex items-center gap-3">
            <Link
              to="/"
              className="hidden items-center gap-1.5 text-sm text-slate-600 hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-400 sm:flex"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              View website
            </Link>
            <button
              type="button"
              onClick={cyclePreference}
              aria-label={`${themeLabel}. Activate to switch theme.`}
              title={`${themeLabel} (click to change)`}
              className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ThemeIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <NotificationDropdown />
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={`${user.name} profile picture`}
                  className="h-7 w-7 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-600"
                />
              ) : (
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                  aria-label={`${user.name} initials`}
                >
                  {userInitial}
                </span>
              )}
              <span className="hidden text-sm font-medium text-slate-700 dark:text-slate-200 sm:inline">{user.name}</span>
            </div>
          </div>
        </header>

        {/* Pages bring their own width and padding, so none is added here. */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
