import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import type { AuthUser } from '@ai-consultant/shared-types';
import { api, ensureCsrfToken, fetchCurrentUser, logoutUser, setCsrfToken } from './api';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const skipBootstrap = location.pathname === '/impersonate';

  const refreshSession = useCallback(async () => {
    try {
      const me = await fetchCurrentUser();
      setUser(me);
      await ensureCsrfToken();
      return true;
    } catch {
      try {
        const res = await api.post<{ success: boolean; csrfToken?: string }>(
          '/auth/refresh',
        );
        if (res.data.csrfToken) {
          setCsrfToken(res.data.csrfToken);
        }
        const me = await fetchCurrentUser();
        setUser(me);
        return true;
      } catch {
        setUser(null);
        return false;
      }
    }
  }, []);

  useEffect(() => {
    if (skipBootstrap) {
      setLoading(false);
      return;
    }
    const timeout = window.setTimeout(() => setLoading(false), 12_000);
    refreshSession().finally(() => {
      window.clearTimeout(timeout);
      setLoading(false);
    });
    return () => window.clearTimeout(timeout);
  }, [refreshSession, skipBootstrap]);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, setUser, logout, refreshSession }),
    [user, loading, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
