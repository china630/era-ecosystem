import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export enum FixedAssetInventoryDirection {
  SURPLUS = "SURPLUS",
  SHORTAGE = "SHORTAGE",
}

export class InventoryFixedAssetDto {
  @ApiProperty({ enum: FixedAssetInventoryDirection })
  @IsEnum(FixedAssetInventoryDirection)
  direction!: FixedAssetInventoryDirection;

  @ApiProperty({ description: "Adjustment amount in AZN" })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  note?: string;
}
