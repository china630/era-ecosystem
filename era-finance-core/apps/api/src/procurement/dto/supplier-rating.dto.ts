import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class CreateSupplierRatingDto {
  @ApiProperty()
  @IsUUID()
  scorecardId!: string;

  @ApiProperty()
  @IsUUID()
  criterionId!: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @ApiPropertyOptional({ example: "2026-Q2" })
  @IsOptional()
  @IsString()
  periodLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSupplierRatingDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  periodLabel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;
}
