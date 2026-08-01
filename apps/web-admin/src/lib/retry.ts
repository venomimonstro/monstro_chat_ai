import { api } from './api';

export function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; delayMs?: number } = {},
): Promise<T> {
  const { retries = 2, delayMs = 500 } = options;

  return new Promise((resolve, reject) => {
    const attempt = async (left: number) => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        if (left === 0) {
          reject(error);
          return;
        }
        const axiosError = error as { config?: { _retry?: boolean } };
        if (axiosError.config?._retry) {
          reject(error);
          return;
        }
        await new Promise((r) => setTimeout(r, delayMs));
        attempt(left - 1);
      }
    };
    attempt(retries);
  });
}

export function getWithRetry<T>(url: string, retries = 2): Promise<T> {
  return withRetry(
    () => api.get<T>(url).then((res) => res.data),
    { retries, delayMs: 500 },
  );
}
