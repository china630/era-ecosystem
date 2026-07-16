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

export enum FixedAssetRevaluationDirection {
  UP = "UP",
  DOWN = "DOWN",
}

export class RevalueFixedAssetDto {
  @ApiProperty({ enum: FixedAssetRevaluationDirection })
  @IsEnum(FixedAssetRevaluationDirection)
  direction!: FixedAssetRevaluationDirection;

  @ApiProperty()
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
