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
  TRIAL_EXPIRED: 'Пробный период закончился. Оформите подписку, чтобы продолжить.',
  USAGE_LIMIT_EXCEEDED: 'Достигнут лимит сообщений по тарифу. Обновите тариф или дождитесь следующего периода.',
  TENANT_SUSPENDED: 'Аккаунт приостановлен. Свяжитесь с поддержкой для уточнения.',
  LEAD_DUPLICATE: 'Лид с таким контактом уже есть в CRM.',
  CRM_SYNC_FAILED: 'Не удалось синхронизировать с CRM. Попробуйте повторить позже.',
  LIMIT_EXCEEDED: 'Превышен лимит. Увеличьте тариф или удалите неиспользуемые объекты.',
  INVALID_CREDENTIALS: 'Неверный email или пароль. Проверьте данные и попробуйте снова.',
  FORBIDDEN: 'У вас недостаточно прав для этого действия.',
  NOT_FOUND: 'Запрашиваемый объект не найден.',
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
