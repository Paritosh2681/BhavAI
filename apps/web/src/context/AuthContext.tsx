import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, errorMessage } from '../lib/api';
import type { Me } from '../lib/types';

type AuthState = {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<Me | null>;
  login: (email: string, password: string) => Promise<Me>;
  signup: (input: { email: string; password: string; name: string; role: 'SELLER' | 'BUYER'; country: string }) => Promise<Me>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const next = await api.get<Me | null>('/api/auth/me');
      setMe(next);
      return next;
    } catch {
      setMe(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<{ user: Me['user']; seller: Me['seller']; buyer: Me['buyer'] }>('/api/auth/login', {
      email,
      password,
    });
    const next = await refresh();
    if (!next) throw new Error('Signed in, but the account could not be loaded.');
    void result;
    return next;
  }, [refresh]);

  const signup = useCallback(
    async (input: { email: string; password: string; name: string; role: 'SELLER' | 'BUYER'; country: string }) => {
      await api.post('/api/auth/signup', input);
      const next = await refresh();
      if (!next) throw new Error('Account created, but it could not be loaded.');
      return next;
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      void errorMessage(error);
    }
    setMe(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ me, loading, refresh, login, signup, logout }),
    [me, loading, refresh, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export function homeFor(me: Me | null): string {
  if (!me) return '/login';
  if (me.user.role === 'SELLER') return '/seller';
  if (me.user.role === 'BUYER') return '/buyer';
  return '/seller';
}
