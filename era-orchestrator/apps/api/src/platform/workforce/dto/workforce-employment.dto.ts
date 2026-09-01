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

  @IsOptional()
  page?: string;

  @IsOptional()
  pageSize?: string;
}
