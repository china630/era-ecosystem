import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class HireWorkforceEmploymentDto {
  @IsUUID()
  globalPersonId!: string;

  @IsDateString()
  hireDate!: string;

  @IsUUID()
  orgUnitId!: string;

  @IsUUID()
  positionId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  satelliteKeys?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(32)
  pin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  login?: string;

  @IsOptional()
  @IsUUID()
  commercialOrganizationId?: string;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  managerEmploymentId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  matrixManagerEmploymentId?: string | null;
}
