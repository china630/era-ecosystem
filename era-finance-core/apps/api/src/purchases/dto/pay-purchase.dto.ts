import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

export class PayPurchaseDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ example: "2026-06-05" })
  @IsDateString()
  paymentDate!: string;

  @ApiPropertyOptional({ description: "Credit NAS (cash/bank); default CASH_AZN" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  creditAccountCode?: string;

  @ApiPropertyOptional({ description: "Organization bank account when paying from bank" })
  @IsOptional()
  @IsUUID()
  bankAccountId?: string;
}
