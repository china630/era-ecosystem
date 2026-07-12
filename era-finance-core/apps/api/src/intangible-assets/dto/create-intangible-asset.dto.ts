import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  FixedAssetDepreciationMethod,
  FixedAssetStatus,
} from "@erafinance/database";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CreateIntangibleAssetDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: "IA-001" })
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
  @IsInt()
  @Min(1)
  usefulLifeMonths!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salvageValue?: number;

  @ApiPropertyOptional({ enum: FixedAssetDepreciationMethod })
  @IsOptional()
  @IsEnum(FixedAssetDepreciationMethod)
  depreciationMethod?: FixedAssetDepreciationMethod;

  @ApiPropertyOptional({ enum: FixedAssetStatus })
  @IsOptional()
  @IsEnum(FixedAssetStatus)
  status?: FixedAssetStatus;
}
