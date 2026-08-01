import { HttpException, HttpStatus } from '@nestjs/common';

export class TrialExpiredException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code: 'TRIAL_EXPIRED',
        message:
          'Пробный период закончился. Оформите подписку, чтобы продолжить работу.',
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}

export class UsageLimitExceededException extends HttpException {
  constructor(used: number, limit: number) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: 'USAGE_LIMIT_EXCEEDED',
        message: `Достигнут лимит сообщений по тарифу (${used}/${limit}).`,
        used,
        limit,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class TenantSuspendedException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        code: 'TENANT_SUSPENDED',
        message: 'Аккаунт приостановлен. Обратитесь в поддержку.',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
