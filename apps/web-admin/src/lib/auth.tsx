import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthUser } from '@ai-consultant/shared-types';
import {
  api,
  ensureCsrfToken,
  fetchCurrentUser,
  loginAdmin,
  logoutUser,
  setCsrfToken,
} from './api';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
  login: (email: string, password: string) => Promise<{ requires2fa?: boolean; twoFaToken?: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      await ensureCsrfToken();
      const me = await fetchCurrentUser();
      if (me.role !== 'admin' && me.role !== 'owner') {
        setUser(null);
        return false;
      }
      setUser(me);
      return true;
    } catch {
      try {
        const res = await api.post<{ success: boolean; csrfToken?: string }>(
          '/auth/refresh',
        );
        if (res.data.csrfToken) {
          setCsrfToken(res.data.csrfToken);
        } else {
          await ensureCsrfToken();
        }
        const me = await fetchCurrentUser();
        if (me.role !== 'admin' && me.role !== 'owner') {
          setUser(null);
          return false;
        }
        setUser(me);
        return true;
      } catch {
        setUser(null);
        return false;
      }
    }
  }, []);

  useEffect(() => {
    refreshSession().finally(() => setLoading(false));
  }, [refreshSession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginAdmin(email, password);
    if (res.requires2fa) {
      return { requires2fa: true, twoFaToken: res.twoFaToken };
    }
    await refreshSession();
    return {};
  }, [refreshSession]);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, setUser, login, logout, refreshSession }),
    [user, loading, login, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
