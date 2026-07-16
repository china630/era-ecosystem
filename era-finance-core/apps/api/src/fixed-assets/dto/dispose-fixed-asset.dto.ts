import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export enum FixedAssetProceedsAccount {
  BANK = "BANK",
}

export class DisposeFixedAssetDto {
  @ApiPropertyOptional({ default: 1, description: "Fraction of asset disposed (0..1)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  @Max(1)
  portion?: number;

  @ApiPropertyOptional({ description: "Sale proceeds in AZN" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  proceeds?: number;

  @ApiPropertyOptional({ enum: FixedAssetProceedsAccount, default: FixedAssetProceedsAccount.BANK })
  @IsOptional()
  @IsEnum(FixedAssetProceedsAccount)
  proceedsAccount?: FixedAssetProceedsAccount;

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
