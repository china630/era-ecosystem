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

  @ApiPropertyOptional({ description: "Capitalization amount; defaults to purchasePrice + modernizationCost" })
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

export class AcquireWithCreateFixedAssetDto extends AcquireFixedAssetDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: "INV-001" })
  @IsString()
  @IsNotEmpty()
  inventoryNumber!: string;

  @ApiProperty({ example: "2024-01-15" })
  @IsDateString()
  purchaseDate!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  purchasePrice!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  usefulLifeMonths!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salvageValue?: number;
}
