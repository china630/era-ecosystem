import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export enum FixedAssetCreditSource {
  SUPPLIER = "SUPPLIER",
  BANK = "BANK",
}

export class AcquireFixedAssetDto {
  @ApiProperty({ enum: FixedAssetCreditSource })
  @IsEnum(FixedAssetCreditSource)
  creditSource!: FixedAssetCreditSource;

  @ApiPropertyOptional({ description: "Required when creditSource is SUPPLIER" })
  @IsOptional()
  @IsUUID()
  counterpartyId?: string;

  @ApiPropertyOptional({ description: "Capitalization amount; defaults to purchasePrice" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  amount?: number;

  @ApiPropertyOptional({ example: "2024-01-15" })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
