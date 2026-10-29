import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import {
  OrgCommercialLinkMode,
  OrgUnitKind,
  WorkforceWorkRegime,
} from "@era365/database";

export class BootstrapWorkforceScopeDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}

export class CreateOrgUnitDto {
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(OrgUnitKind)
  unitKind?: OrgUnitKind;
}

export class UpdateOrgUnitDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  managerEmploymentId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  managerUserId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(OrgUnitKind)
  unitKind?: OrgUnitKind;
}

export class CreateWorkforcePositionDto {
  @IsUUID()
  orgUnitId!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalSlots?: number;

  @IsOptional()
  @IsBoolean()
  leadership?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsNumber()
  tariffAzn?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsEnum(WorkforceWorkRegime)
  defaultWorkRegime?: WorkforceWorkRegime | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsNumber()
  weeklyHours?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  jobId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  parentPositionId?: string | null;
}

export class UpdateWorkforcePositionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalSlots?: number;

  @IsOptional()
  @IsBoolean()
  leadership?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsNumber()
  tariffAzn?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsEnum(WorkforceWorkRegime)
  defaultWorkRegime?: WorkforceWorkRegime | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsNumber()
  weeklyHours?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  jobId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  parentPositionId?: string | null;
}

export class UpdateEmploymentReportingDto {
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  managerEmploymentId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  matrixManagerEmploymentId?: string | null;
}

export class UpsertCommercialLinkDto {
  @IsUUID()
  workforceScopeId!: string;

  @IsOptional()
  @IsUUID()
  orgUnitId?: string | null;

  @IsOptional()
  @IsEnum(OrgCommercialLinkMode)
  linkMode?: OrgCommercialLinkMode;
}

export class TransferEmploymentDto {
  @IsUUID()
  orgUnitId!: string;

  @IsUUID()
  positionId!: string;
}
