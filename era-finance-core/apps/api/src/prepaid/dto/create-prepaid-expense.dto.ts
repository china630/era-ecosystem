import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreatePrepaidExpenseDto {
  @ApiProperty({ example: "1000.0000" })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  totalAmount!: string;

  @ApiPropertyOptional({ default: "AZN" })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiProperty({ example: "2025-01-01" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: "2025-12-31" })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  counterpartyId?: string;

  @ApiPropertyOptional({
    description: "Expense NAS code; if omitted, MISC_OPERATING_EXPENSE posting role",
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  expenseAccountCode?: string;

  @ApiPropertyOptional({
    description: "Prepaid asset NAS code; if omitted, PREPAID_ASSET posting role",
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  prepaidAccountCode?: string;
}
