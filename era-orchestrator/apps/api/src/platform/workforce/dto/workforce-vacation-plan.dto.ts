import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class VacationPlanLineDto {
  @IsUUID()
  employmentId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsInt()
  @Min(1)
  @Max(366)
  days!: number;
}

export class CreateWorkforceVacationPlanDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsOptional()
  @IsUUID()
  orgUnitId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VacationPlanLineDto)
  lines!: VacationPlanLineDto[];

  /** When true, create as SUBMITTED instead of DRAFT. */
  @IsOptional()
  submit?: boolean;
}

export class UpdateWorkforceVacationPlanDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VacationPlanLineDto)
  lines?: VacationPlanLineDto[];
}

export class RejectWorkforceVacationPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectionReason?: string;
}

export class ListWorkforceVacationPlansQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @IsOptional()
  @IsUUID()
  orgUnitId?: string;
}
