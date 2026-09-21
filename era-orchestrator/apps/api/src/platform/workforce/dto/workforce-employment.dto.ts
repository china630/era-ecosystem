import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class CreateWorkforceEmploymentDto {
  @IsUUID()
  globalPersonId!: string;

  @IsDateString()
  hireDate!: string;

  @IsUUID()
  orgUnitId!: string;

  @IsUUID()
  positionId!: string;

  @IsOptional()
  @IsUUID()
  financeEmployeeId?: string;

  @IsOptional()
  @IsUUID()
  commercialOrganizationId?: string;
}

export class ListWorkforceEmploymentsQueryDto {
  @IsOptional()
  @IsString()
  status?: "ACTIVE" | "TERMINATED";

  @IsOptional()
  @IsUUID()
  orgUnitId?: string;

  @IsOptional()
  subtree?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;

  @IsOptional()
  @IsString()
  satelliteKey?: string;

  /** Name substring (≥2) or exact AZ FIN (7 chars). Never matches UUID/mask. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsString()
  sex?: string;

  @IsOptional()
  @IsString()
  ageBucket?: string;

  @IsOptional()
  page?: string;

  @IsOptional()
  pageSize?: string;
}
