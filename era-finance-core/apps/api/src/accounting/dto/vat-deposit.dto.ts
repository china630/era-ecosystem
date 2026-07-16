import { IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class RouteVatDepositDto {
  @IsNumber()
  @Min(0.0001)
  paymentAmount!: number;

  @IsNumber()
  @Min(0.0001)
  vatPortion!: number;

  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @IsOptional()
  @IsUUID()
  counterpartyId?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  paymentDate?: string;
}

export class RemitVatDepositDto {
  @IsNumber()
  @Min(0.0001)
  amount!: number;

  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  paymentDate?: string;
}

export class ReconcileVatDepositDto {
  @IsString()
  dateFrom!: string;

  @IsString()
  dateTo!: string;
}
