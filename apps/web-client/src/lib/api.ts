import axios from 'axios';
import { withRetry } from './retry';
import type { AuthResponse, RegisterRequest } from '@ai-consultant/shared-types';

let csrfTokenMemory: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfTokenMemory = token;
}

function getCsrfTokenFromCookie(): string | null {
  const match = document.cookie.match(/(?:^|; )aicw_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getCsrfToken(): string | null {
  const fromCookie = getCsrfTokenFromCookie();
  if (fromCookie) {
    csrfTokenMemory = fromCookie;
    return fromCookie;
  }
  return csrfTokenMemory;
}

export async function ensureCsrfToken(): Promise<string | null> {
  try {
    const res = await api.get<{ token: string | null }>('/auth/csrf');
    if (res.data.token) {
      setCsrfToken(res.data.token);
      return res.data.token;
    }
  } catch {
    /* ignore */
  }
  try {
    const res = await api.post<{ success: boolean; csrfToken?: string }>(
      '/auth/refresh',
    );
    if (res.data.csrfToken) {
      setCsrfToken(res.data.csrfToken);
      return res.data.csrfToken;
    }
  } catch {
    /* ignore */
  }
  const fromCookie = getCsrfTokenFromCookie();
  if (fromCookie) {
    setCsrfToken(fromCookie);
    return fromCookie;
  }
  return null;
}

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const method = config.method?.toUpperCase();
  if (method && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = getCsrfToken() ?? (await ensureCsrfToken());
    if (csrf) {
      config.headers['X-CSRF-Token'] = csrf;
    }
  }
  return config;
});

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = api
      .post<{ success: boolean; csrfToken?: string }>('/auth/refresh')
      .then(async (res) => {
        if (res.data.csrfToken) {
          setCsrfToken(res.data.csrfToken);
        } else {
          await ensureCsrfToken();
        }
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 403 &&
      original &&
      !original._csrfRetry &&
      typeof error.response?.data?.message === 'string' &&
      error.response.data.message.includes('CSRF')
    ) {
      original._csrfRetry = true;
      setCsrfToken(null);
      await refreshSession();
      await ensureCsrfToken();
      return api(original);
    }
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes('/auth/login') &&
      !original.url?.includes('/auth/register') &&
      !original.url?.includes('/auth/refresh')
    ) {
      original._retry = true;
      const ok = await refreshSession();
      if (ok) {
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

export async function registerUser(data: RegisterRequest) {
  const res = await api.post<AuthResponse>('/auth/register', data);
  return res.data;
}

export async function loginUser(email: string, password: string) {
  const res = await api.post<AuthResponse>('/auth/login', { email, password });
  return res.data;
}

export async function verify2fa(code: string, twoFaToken: string) {
  const res = await api.post<AuthResponse>('/auth/2fa/verify', {
    code,
    twoFaToken,
  });
  return res.data;
}

export async function logoutUser() {
  await api.post('/auth/logout');
}

export async function fetchCurrentUser() {
  return withRetry(() =>
    api.post<{ user: AuthResponse['user'] }>('/auth/me').then((res) => res.data.user),
  );
}

export async function fetchWsToken(): Promise<string | null> {
  try {
    const res = await api.post<{ token: string }>('/auth/ws-token');
    return res.data.token ?? null;
  } catch {
    return null;
  }
}

export async function requestPasswordReset(email: string) {
  await api.post('/auth/forgot-password', { email });
}

export async function resetPassword(token: string, password: string) {
  await api.post('/auth/reset-password', { token, password });
}
