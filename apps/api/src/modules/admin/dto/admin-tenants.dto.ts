import { IsNumber, IsString, IsUUID, MinLength } from 'class-validator';

export class TenantActionReasonDto {
  @IsString()
  @MinLength(3, { message: 'Укажите причину (минимум 3 символа)' })
  reason!: string;
}

export class TenantTariffChangeDto {
  @IsUUID()
  tariffId!: string;

  @IsString()
  @MinLength(3, { message: 'Укажите причину (минимум 3 символа)' })
  reason!: string;
}

export class TenantBalanceAdjustmentDto {
  @IsNumber()
  amount!: number;

  @IsString()
  @MinLength(3, { message: 'Укажите причину (минимум 3 символа)' })
  reason!: string;
}

export class ImpersonateTenantDto {
  @IsString()
  @MinLength(3, { message: 'Укажите причину (минимум 3 символа)' })
  reason!: string;
}

export class ImpersonationExchangeDto {
  @IsUUID()
  exchangeCode!: string;
}
