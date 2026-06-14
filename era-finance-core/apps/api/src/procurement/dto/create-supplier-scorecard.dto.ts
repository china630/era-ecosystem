import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class CreateSupplierScorecardCriterionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  label!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class CreateSupplierScorecardDto {
  @ApiProperty()
  @IsUUID()
  counterpartyId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ example: "2026-Q2" })
  @IsOptional()
  @IsString()
  periodLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [CreateSupplierScorecardCriterionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSupplierScorecardCriterionDto)
  criteria?: CreateSupplierScorecardCriterionDto[];
}
