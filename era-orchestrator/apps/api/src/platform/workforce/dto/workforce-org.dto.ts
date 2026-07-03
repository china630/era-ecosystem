import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";
import { OrgCommercialLinkMode } from "@era365/database";

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
  @IsUUID()
  managerEmploymentId?: string | null;

  @IsOptional()
  @IsUUID()
  managerUserId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
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
