import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { MANUAL_ADJUSTMENT_TEMPLATES } from "../manual-adjustment.constants";

export class ManualAdjustmentLineDto {
  @ApiProperty({ example: "211" })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  accountCode!: string;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 4 },
    { message: "debit must be a finite number" },
  )
  @Min(0)
  debit!: number;

  @ApiProperty({ example: 0 })
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 4 },
    { message: "credit must be a finite number" },
  )
  @Min(0)
  credit!: number;
}

export class CreateManualAdjustmentDto {
  @ApiProperty({ example: "2026-08-20" })
  @IsDateString()
  date!: string;

  @ApiProperty({
    description: "What and why — required narrative for the voucher",
    example: "Returned 5 AZN over-collection to the client; original invoice not changed",
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;

  @ApiPropertyOptional({ enum: MANUAL_ADJUSTMENT_TEMPLATES })
  @IsOptional()
  @IsIn([...MANUAL_ADJUSTMENT_TEMPLATES])
  template?: (typeof MANUAL_ADJUSTMENT_TEMPLATES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  counterpartyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ description: "Link only — invoice is not mutated" })
  @IsOptional()
  @IsUUID()
  basisInvoiceId?: string;

  @ApiPropertyOptional({ description: "Link only — fixed asset card is not mutated" })
  @IsOptional()
  @IsUUID()
  basisFixedAssetId?: string;

  @ApiProperty({ type: [ManualAdjustmentLineDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => ManualAdjustmentLineDto)
  lines!: ManualAdjustmentLineDto[];
}
