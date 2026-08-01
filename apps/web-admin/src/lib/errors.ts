import type { AxiosError } from 'axios';
import type { ApiError } from '@ai-consultant/shared-types';

export function extractErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<ApiError>;
  if (axiosError.response?.data?.message) {
    return axiosError.response.data.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Что-то пошло не так. Проверьте соединение и попробуйте снова.';
}

export function getErrorCode(error: unknown): string | undefined {
  const axiosError = error as AxiosError<ApiError>;
  return axiosError.response?.data?.error;
}

export const businessErrorMessages: Record<string, string> = {
  INVALID_CREDENTIALS: 'Неверный email или пароль.',
  FORBIDDEN: 'У вас недостаточно прав.',
  NOT_FOUND: 'Объект не найден.',
  TENANT_SUSPENDED: 'Аккаунт клиента приостановлен.',
};

export function getBusinessErrorMessage(error: unknown): string {
  const code = getErrorCode(error);
  return (code && businessErrorMessages[code]) || extractErrorMessage(error);
}

export function isRetryableError(error: unknown): boolean {
  const axiosError = error as AxiosError;
  if (!axiosError.response) return true;
  const status = axiosError.response.status;
  return status >= 500 || status === 429 || status === 408;
}
