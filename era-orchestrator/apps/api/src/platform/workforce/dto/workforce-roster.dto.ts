import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";
import { Type } from "class-transformer";
import {
  WorkforceDayOverrideKind,
  WorkforcePlaceStatus,
} from "@era365/database";

export class CreateWorkforcePlaceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsUUID()
  responsibleOrgUnitId?: string;
}

export class UpdateWorkforcePlaceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEnum(WorkforcePlaceStatus)
  status?: WorkforcePlaceStatus;

  @IsOptional()
  @IsUUID()
  responsibleOrgUnitId?: string | null;
}

export class CreateWorkforceShiftTypeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  startMinute!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  endMinute!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(720)
  breakMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isNight?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(24)
  defaultHours?: number;
}

export class UpdateWorkforceShiftTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  startMinute?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  endMinute?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(720)
  breakMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isNight?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(24)
  defaultHours?: number;
}

export class CycleSlotDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  slotIndex!: number;

  /** Null/omit = OFF day. */
  @IsOptional()
  @IsUUID()
  shiftTypeId?: string | null;
}

export class CreateWorkforceShiftCycleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name!: string;

  @IsDateString()
  cycleAnchor!: string;

  @IsArray()
  @ArrayMaxSize(60)
  @Type(() => CycleSlotDto)
  slots!: CycleSlotDto[];
}

export class UpdateWorkforceShiftCycleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsDateString()
  cycleAnchor?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @Type(() => CycleSlotDto)
  slots?: CycleSlotDto[];
}

export class CreateWorkforceBrigadeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  employmentIds?: string[];
}

export class UpdateWorkforceBrigadeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  employmentIds?: string[];
}

export class CreateWorkforceShiftAssignmentDto {
  @IsUUID()
  placeId!: string;

  @IsUUID()
  cycleId!: string;

  @ValidateIf((o: CreateWorkforceShiftAssignmentDto) => !o.brigadeId)
  @IsUUID()
  employmentId?: string;

  @ValidateIf((o: CreateWorkforceShiftAssignmentDto) => !o.employmentId)
  @IsUUID()
  brigadeId?: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;
}

export class UpdateWorkforceShiftAssignmentDto {
  @IsOptional()
  @IsUUID()
  placeId?: string;

  @IsOptional()
  @IsUUID()
  cycleId?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;
}

export class CreateWorkforceDayOverrideDto {
  @IsUUID()
  employmentId!: string;

  @IsDateString()
  workDate!: string;

  @IsEnum(WorkforceDayOverrideKind)
  kind!: WorkforceDayOverrideKind;

  @IsOptional()
  @IsUUID()
  placeId?: string | null;

  @IsOptional()
  @IsUUID()
  shiftTypeId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class MaterializeRosterQueryDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  preserveManual?: boolean;
}
