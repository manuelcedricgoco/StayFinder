import { createContext } from 'react';
import type { AuthUser, RegisterInput } from '../types/auth';

export interface AuthContextValue {
  user: AuthUser | null;
  /** true while we ask the server "is someone already logged in?" on page load */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
