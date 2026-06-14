import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";
import { CreateSupplierScorecardCriterionDto } from "./create-supplier-scorecard.dto";

export class UpdateSupplierScorecardDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  periodLabel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional({ type: [CreateSupplierScorecardCriterionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSupplierScorecardCriterionDto)
  criteria?: CreateSupplierScorecardCriterionDto[];
}
