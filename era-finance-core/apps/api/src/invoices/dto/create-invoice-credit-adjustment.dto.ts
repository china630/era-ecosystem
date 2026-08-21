import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import { MANUAL_ADJUSTMENT_REASON_MIN } from "../../accounting/manual-adjustment.constants";

export enum InvoiceCreditOffset {
  REVENUE = "REVENUE",
  EXPENSE = "EXPENSE",
}

export class CreateInvoiceCreditAdjustmentDto {
  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  amount!: number;

  @ApiProperty({ example: "2026-08-20" })
  @IsDateString()
  date!: string;

  @ApiProperty({ minLength: MANUAL_ADJUSTMENT_REASON_MIN })
  @IsString()
  @MinLength(MANUAL_ADJUSTMENT_REASON_MIN)
  reason!: string;

  @ApiProperty({ enum: InvoiceCreditOffset })
  @IsEnum(InvoiceCreditOffset)
  offset!: InvoiceCreditOffset;
}
