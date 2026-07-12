import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class AdvanceExpenseLineDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  description!: string;

  @ApiPropertyOptional({
    description: "NAS expense account code or posting role (default MISC_OPERATING_EXPENSE → 731)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  expenseAccountCode?: string;

  @ApiPropertyOptional({ description: "VAT rate on receipt: -1, 0, 2, 8, or 18" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsIn([-1, 0, 2, 8, 18])
  vatRate?: number;

  @ApiPropertyOptional({ description: "Receipt attachment URL" })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  receiptUrl?: string;
}

export class CreateAdvanceReportDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty({ example: "2026-04-03" })
  @IsDateString()
  reportDate!: string;

  @ApiProperty({ type: [AdvanceExpenseLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdvanceExpenseLineDto)
  expenseLines!: AdvanceExpenseLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  purpose?: string;

  @ApiPropertyOptional({ default: "AZN" })
  @IsOptional()
  @IsString()
  @IsIn(["AZN", "USD", "EUR", "RUB", "TRY", "GBP", "KZT", "UAH", "GEL"])
  currencyCode?: string;

  @ApiPropertyOptional({ description: "Posted KXO ACCOUNTABLE_ISSUE cash order (MXO)" })
  @IsOptional()
  @IsUUID()
  cashOrderId?: string;
}

export class UpdateAdvanceReportDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  reportDate?: string;

  @ApiPropertyOptional({ type: [AdvanceExpenseLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdvanceExpenseLineDto)
  expenseLines?: AdvanceExpenseLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  purpose?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(["AZN", "USD", "EUR", "RUB", "TRY", "GBP", "KZT", "UAH", "GEL"])
  currencyCode?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  cashOrderId?: string | null;
}
