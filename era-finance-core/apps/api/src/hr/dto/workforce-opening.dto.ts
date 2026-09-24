import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class WorkforceOpeningDto {
  @IsString()
  organizationId!: string;

  @IsString()
  cpEmploymentId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salary?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  internalRate?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  balanceDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  baseVacationDaysPerYear?: number;

  @IsOptional()
  @IsString()
  asOfDate?: string;
}
