import { IsString, IsUUID, IsOptional } from 'class-validator';

export class CheckoutDto {
  @IsUUID()
  tariffId!: string;
}

export class ManualBalanceDto {
  @IsString()
  amount!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ChangeTariffDto {
  @IsUUID()
  tariffId!: string;
}
