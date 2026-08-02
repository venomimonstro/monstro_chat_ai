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
import { api, fetchCurrentUser, logoutUser } from './api';

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
      return true;
    } catch {
      try {
        await api.post('/auth/refresh');
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
    refreshSession().finally(() => setLoading(false));
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
