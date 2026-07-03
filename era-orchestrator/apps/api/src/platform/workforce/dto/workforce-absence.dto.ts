import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { WorkforceAbsenceKind } from "@era365/database";

export class CreateWorkforceAbsenceDto {
  @IsUUID()
  employmentId!: string;

  @IsEnum(WorkforceAbsenceKind)
  kind!: WorkforceAbsenceKind;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  /** When true, create as SUBMITTED instead of DRAFT. */
  @IsOptional()
  submit?: boolean;
}

export class UpdateWorkforceAbsenceDto {
  @IsOptional()
  @IsEnum(WorkforceAbsenceKind)
  kind?: WorkforceAbsenceKind;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class RejectWorkforceAbsenceDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectionReason?: string;
}

export class ListWorkforceAbsencesQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsUUID()
  employmentId?: string;
}
