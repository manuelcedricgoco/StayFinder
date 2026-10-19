import { createContext } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextValue {
  /** What the user picked. 'system' follows the operating system setting. */
  preference: ThemePreference;
  /** The theme actually applied to <html> right now. */
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** light -> dark -> system -> light */
  cyclePreference: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
