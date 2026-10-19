import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeContext, type ResolvedTheme, type ThemePreference } from './themeContext';

const STORAGE_KEY = 'stayfinder-theme';
const CYCLE_ORDER: ThemePreference[] = ['light', 'dark', 'system'];

function readStoredPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // localStorage can throw (private mode); fall back to the system setting.
  }
  return 'system';
}

function readSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(readSystemTheme);

  // Follow the OS while the preference is "system".
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setSystemTheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const resolvedTheme: ResolvedTheme = preference === 'system' ? systemTheme : preference;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Still switch the theme for this visit even if it cannot be saved.
    }
  }, []);

  const cyclePreference = useCallback(() => {
    setPreferenceState((current) => {
      const next = CYCLE_ORDER[(CYCLE_ORDER.indexOf(current) + 1) % CYCLE_ORDER.length];
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignored
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference, cyclePreference }),
    [preference, resolvedTheme, setPreference, cyclePreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
