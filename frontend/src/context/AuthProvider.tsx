import { useEffect, useState, type ReactNode } from 'react';
import { apiRequest } from '../lib/api';
import type { AuthUser, RegisterInput } from '../types/auth';
import { AuthContext } from './authContext';

interface UserResponse {
  user: AuthUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On first load, ask the server whether the browser already has a valid session cookie.
  useEffect(() => {
    let cancelled = false;

    apiRequest<UserResponse>('GET', '/auth/me')
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email: string, password: string) {
    const data = await apiRequest<UserResponse>('POST', '/auth/login', { email, password });
    setUser(data.user);
    return data.user;
  }

  async function register(input: RegisterInput) {
    const data = await apiRequest<UserResponse>('POST', '/auth/register', input);
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    try {
      await apiRequest('POST', '/auth/logout');
    } finally {
      // Even if the request fails, forget the user in the UI.
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, updateUser: setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
